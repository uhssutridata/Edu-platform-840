import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Flag,
  Loader2,
  Radio,
  XCircle,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import PaywallModal from "@/components/PaywallModal";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { countdown, errMessage, fmtDateTime, isPaywallError } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import type { ExamDetail, ExamResult } from "@/lib/types";

function ResultPanel({ exam, result }: { exam: ExamDetail; result: ExamResult }) {
  return (
    <div className="mx-auto max-w-2xl space-y-5" data-testid="exam-result-panel">
      <Link to="/exams" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200" data-testid="exam-result-back-link">
        <ArrowLeft className="size-4" /> All exams
      </Link>
      <Card>
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-400" />
          <h1 className="mt-3 font-heading text-2xl font-bold tracking-tight">{exam.title} — submitted</h1>
          <div className="mt-4 font-mono text-5xl font-bold tracking-widest text-emerald-400" data-testid="exam-result-score">
            {result.score}
            <span className="text-2xl text-slate-500">/{result.total}</span>
          </div>
          {result.auto_submitted ? (
            <Badge className="mt-3 border-red-500/40 text-red-300" variant="outline" data-testid="exam-auto-submit-badge">
              Auto-submitted at the deadline
            </Badge>
          ) : null}
          <p className="mt-2 text-xs text-slate-500">Submitted {fmtDateTime(result.submitted_at)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <p className="font-mono text-xs uppercase tracking-wider text-slate-400">Breakdown</p>
          <ul className="mt-3 space-y-2">
            {result.questions.map((q, i) => {
              const row = result.breakdown.find((b) => b.question_id === q.id);
              const ans = row?.answer;
              const correct = row?.correct ?? false;
              return (
                <li key={q.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3" data-testid="exam-result-row">
                  <div>
                    <p className="text-sm text-slate-200">{i + 1}. {q.text}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Your answer: {ans !== null && ans !== undefined ? String.fromCharCode(65 + ans) : "—"} ·
                      Correct: {String.fromCharCode(65 + (q.correct_index ?? 0))}
                    </p>
                  </div>
                  {correct ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-red-400" />
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function ExamRoomInner() {
  const { examId } = useParams<{ examId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const now = useNow(250);

  const [phase, setPhase] = useState<"idle" | "running">("idle");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [idx, setIdx] = useState(0);
  const [blurs, setBlurs] = useState(0);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paywall, setPaywall] = useState(false);

  const { data: exam, isLoading } = useQuery({
    queryKey: ["exam", examId],
    queryFn: () => apiGet<ExamDetail>(`/exams/${examId}`),
    refetchInterval: 5_000,
  });

  // Server clock sync — one probe; the countdown runs on server time, not the browser clock.
  const { data: timeData } = useQuery({
    queryKey: ["server-time"],
    queryFn: () => apiGet<{ now: string }>("/exams/time"),
    staleTime: Infinity,
    refetchOnMount: "always",
  });
  const offsetRef = useRef(0);
  useEffect(() => {
    if (timeData) offsetRef.current = new Date(timeData.now).getTime() - Date.now();
  }, [timeData]);

  const running = exam?.my_attempt?.status === "in_progress" || phase === "running";
  const submitted = exam?.my_attempt?.status === "submitted";

  const { data: serverResult } = useQuery({
    queryKey: ["exam-result", examId],
    queryFn: () => apiGet<ExamResult>(`/exams/${examId}/result`),
    enabled: submitted,
  });

  // Keep answers across an accidental refresh.
  useEffect(() => {
    if (!examId) return;
    try {
      const raw = localStorage.getItem(`astra-exam-${examId}`);
      if (raw) setAnswers(JSON.parse(raw) as Record<string, number>);
    } catch {
      /* ignore */
    }
  }, [examId]);
  useEffect(() => {
    if (running && examId) localStorage.setItem(`astra-exam-${examId}`, JSON.stringify(answers));
  }, [answers, running, examId]);

  // Anti-tamper focus guard.
  const warnedRef = useRef(false);
  useEffect(() => {
    if (!running) return;
    const onBlur = () => {
      setBlurs((b) => b + 1);
      if (!warnedRef.current) {
        warnedRef.current = true;
        toast.warning("Focus lost", { description: "Leaving the exam tab is recorded." });
      }
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [running]);

  const start = useMutation({
    mutationFn: () => apiPost<unknown>(`/exams/${examId}/start`),
    onSuccess: () => {
      setPhase("running");
      void qc.invalidateQueries({ queryKey: ["exam", examId] });
      void qc.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Exam started", { description: "The clock is server-synced — auto-submit at zero." });
    },
    onError: (err) => {
      if (isPaywallError(err)) setPaywall(true);
      else toast.error(errMessage(err));
    },
  });

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const submittedRef = useRef(false);

  const submit = useMutation({
    mutationFn: () => apiPost<ExamResult>(`/exams/${examId}/submit`, { answers: answersRef.current }),
    onSuccess: (res) => {
      setResult(res);
      setPhase("idle");
      setJustSubmitted(true);
      submittedRef.current = true;
      localStorage.removeItem(`astra-exam-${examId}`);
      void qc.invalidateQueries();
      toast.success(res.auto_submitted ? "Time is up — auto-submitted" : "Exam submitted");
    },
    onError: (err) => {
      toast.error(errMessage(err));
      setPhase("idle");
      void qc.invalidateQueries({ queryKey: ["exam", examId] });
    },
  });

  const serverNow = now + offsetRef.current;
  const remaining = exam && running ? new Date(exam.end_at).getTime() - serverNow : 0;

  // Auto-submit at zero — the deadline is enforced again server-side.
  useEffect(() => {
    if (running && exam && !submittedRef.current && remaining <= 0) {
      submittedRef.current = true;
      submit.mutate();
    }
  }, [remaining, running, exam, submit.mutate]);

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="exam-room-loading">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-64 w-full animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }
  if (!exam) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          Exam not found.{" "}
          <Link to="/exams" className="text-primary hover:underline">Back to exams</Link>
        </CardContent>
      </Card>
    );
  }

  // Teacher / admin preview with the answer key.
  if (user?.role !== "student") {
    return (
      <div className="space-y-5">
        <Link to="/exams" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200" data-testid="exam-room-back-link">
          <ArrowLeft className="size-4" /> All exams
        </Link>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{exam.title}</h1>
        <div className="space-y-3">
          {exam.questions.map((q, i) => (
            <Card key={q.id} data-testid="exam-key-item">
              <CardContent className="p-5">
                <p className="font-medium text-slate-200">{i + 1}. {q.text}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {q.options.map((opt, oi) => (
                    <Badge key={oi} variant="outline" className={oi === q.correct_index ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-border text-slate-400"}>
                      {String.fromCharCode(65 + oi)} · {opt}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const shownResult = result ?? serverResult ?? null;

  if (submitted && shownResult) {
    return (
      <>
        <ResultPanel exam={exam} result={shownResult} />
        <Dialog open={justSubmitted} onOpenChange={setJustSubmitted}>
          <DialogContent className="max-w-sm" data-testid="exam-result-modal">
            <DialogHeader>
              <DialogTitle className="font-heading">Exam submitted</DialogTitle>
              <DialogDescription>
                {shownResult.auto_submitted
                  ? "The timer hit zero — your answers were auto-submitted."
                  : "Your answers are in and graded."}
              </DialogDescription>
            </DialogHeader>
            <p className="text-center font-mono text-4xl font-bold text-emerald-400">
              {shownResult.score}/{shownResult.total}
            </p>
            <Button
              className="w-full"
              data-testid="exam-result-close-btn"
              onClick={() => {
                setJustSubmitted(false);
                navigate("/exams");
              }}
            >
              Back to exams
            </Button>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (running && remaining > -65_000) {
    const questions = exam.questions;
    const current = questions[Math.min(idx, questions.length - 1)];
    const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length;
    const urgent = remaining < 60_000;
    return (
      <div className="space-y-5" data-testid="exam-runner">
        <div
          className="sticky top-14 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-[#050914]/95 px-4 py-3 backdrop-blur"
          data-testid="exam-hud"
        >
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Radio className="size-4 text-red-400" />
            <span className="font-heading font-bold">{exam.title}</span>
            <Badge variant="outline" className="hidden border-emerald-500/40 text-emerald-300 sm:inline-flex">
              Server-synced
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            {blurs > 0 ? (
              <span className="flex items-center gap-1 text-xs text-amber-400" data-testid="exam-focus-warning">
                <AlertTriangle className="size-3.5" /> {blurs} focus loss
              </span>
            ) : null}
            <span className="text-xs text-slate-400" data-testid="exam-progress-count">
              Answered {answeredCount}/{questions.length}
            </span>
            <span
              className={`font-mono text-2xl font-bold tracking-widest ${
                urgent ? "text-red-400" : "text-emerald-400 animate-timer-glow"
              }`}
              data-testid="exam-countdown-timer"
            >
              {countdown(remaining)}
            </span>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_230px]">
          <motion.div key={current.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
            <Card data-testid="exam-question-item">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
                    Question {idx + 1} of {questions.length} · {current.points} pt
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    data-testid="exam-flag-question-btn"
                    onClick={() => setFlagged((f) => ({ ...f, [current.id]: !f[current.id] }))}
                  >
                    <Flag className={`mr-1.5 size-3.5 ${flagged[current.id] ? "text-amber-400" : ""}`} />
                    {flagged[current.id] ? "Flagged" : "Flag"}
                  </Button>
                </div>
                <h2 className="mt-3 font-heading text-xl font-bold tracking-tight">{current.text}</h2>
                <div className="mt-5 space-y-2">
                  {current.options.map((opt, oi) => {
                    const selected = answers[current.id] === oi;
                    return (
                      <button
                        key={oi}
                        data-testid="exam-option-radio"
                        data-selected={selected || undefined}
                        onClick={() => setAnswers((a) => ({ ...a, [current.id]: oi }))}
                        className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors duration-150 ${
                          selected
                            ? "border-primary bg-primary/10 text-white"
                            : "border-border text-slate-300 hover:bg-accent"
                        }`}
                      >
                        <span
                          className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                            selected ? "border-primary bg-primary text-primary-foreground" : "border-slate-600 text-slate-400"
                          }`}
                        >
                          {String.fromCharCode(65 + oi)}
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-mono text-xs uppercase tracking-wider text-slate-400">Question map</p>
            <div className="mt-3 grid grid-cols-5 gap-2 lg:grid-cols-4">
              {questions.map((q, i) => {
                const answered = answers[q.id] !== undefined;
                return (
                  <button
                    key={q.id}
                    data-testid="exam-question-nav-btn"
                    onClick={() => setIdx(i)}
                    className={`size-9 rounded-md border font-mono text-xs transition-colors duration-150 ${
                      i === idx ? "ring-2 ring-blue-500" : ""
                    } ${answered ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" : "border-border text-slate-400"} ${
                      flagged[q.id] ? "border-amber-400" : ""
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 space-y-1.5 text-xs text-slate-500">
              <p className="flex items-center gap-2">
                <span className="inline-block size-2 rounded-full bg-emerald-500" /> answered
              </p>
              <p className="flex items-center gap-2">
                <span className="inline-block size-2 rounded-full border border-amber-400" /> flagged
              </p>
            </div>
            <Button className="mt-4 w-full" data-testid="exam-submit-all-btn" onClick={() => setConfirmOpen(true)}>
              Submit exam
            </Button>
          </div>
        </div>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="max-w-sm" data-testid="exam-submit-confirm-dialog">
            <DialogHeader>
              <DialogTitle className="font-heading">Submit exam?</DialogTitle>
              <DialogDescription>
                You answered {answeredCount} of {questions.length}. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)} data-testid="exam-cancel-submit-btn">
                Keep working
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setConfirmOpen(false);
                  submit.mutate();
                }}
                disabled={submit.isPending}
                data-testid="exam-confirm-submit-btn"
              >
                Submit
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <PaywallModal open={paywall} onOpenChange={setPaywall} role="student" />
      </div>
    );
  }

  if (running) {
    return (
      <Card data-testid="exam-closed-card">
        <CardContent className="p-10 text-center">
          <p className="font-heading text-xl font-bold">The window closed before auto-submit could fire.</p>
          <p className="mt-2 text-sm text-muted-foreground">Reload — your teacher can see your attempt.</p>
          <Button variant="outline" className="mt-4" onClick={() => submit.mutate()} data-testid="exam-retry-submit-btn">
            Try submitting now
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (exam.status === "scheduled") {
    const toStart = new Date(exam.start_at).getTime() - serverNow;
    return (
      <div className="mx-auto max-w-xl text-center" data-testid="exam-waiting-room">
        <Badge variant="outline" className="border-border text-slate-300">Starts {fmtDateTime(exam.start_at)}</Badge>
        <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight">{exam.title}</h1>
        <div className="mt-8 font-mono text-6xl font-bold tracking-widest text-emerald-400" data-testid="exam-start-countdown">
          {countdown(toStart)}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Unlocks for everyone at the same moment · {exam.duration_minutes} minutes · {exam.questions.length} questions
        </p>
        <Button variant="outline" className="mt-6" onClick={() => void qc.invalidateQueries({ queryKey: ["exam", examId] })} data-testid="exam-refresh-btn">
          Refresh status
        </Button>
      </div>
    );
  }

  if (exam.status === "live") {
    return (
      <div className="mx-auto max-w-xl" data-testid="exam-start-screen">
        <Card>
          <CardContent className="p-8 text-center">
            <Badge className="border-red-500/40 text-red-300" variant="outline">
              <Radio className="mr-1.5 size-3" /> LIVE · closes {fmtDateTime(exam.end_at)}
            </Badge>
            <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight">{exam.title}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {exam.duration_minutes} minutes · {exam.questions.length} questions · {exam.total_points} points.
              The timer keeps running once you start — answers auto-submit at zero.
            </p>
            <Button size="lg" className="mt-6" data-testid="exam-start-btn" onClick={() => start.mutate()} disabled={start.isPending}>
              {start.isPending ? <Loader2 className="size-4 animate-spin" /> : "Start exam"}
            </Button>
          </CardContent>
        </Card>
        <PaywallModal open={paywall} onOpenChange={setPaywall} role="student" />
      </div>
    );
  }

  return (
    <Card data-testid="exam-closed-card">
      <CardContent className="p-10 text-center">
        <p className="font-heading text-xl font-bold">This exam window has closed.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {exam.my_status === "missed" ? "You didn't submit within the window." : "Results are with your teacher."}
        </p>
        <Link to="/exams" className={buttonVariants({ variant: "outline" }) + " mt-4"} data-testid="exam-closed-back-link">
          Back to exams
        </Link>
      </CardContent>
    </Card>
  );
}

export default function ExamRoom() {
  return (
    <AppShell>
      <ExamRoomInner />
    </AppShell>
  );
}
