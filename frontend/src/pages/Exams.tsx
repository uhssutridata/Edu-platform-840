import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, ClipboardList, Loader2, Plus, Radio } from "lucide-react";
import AppShell from "@/components/AppShell";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { countdown, errMessage, fmtDateTime } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import type { AttemptRow, ExamDetail, ExamItem } from "@/lib/types";

interface QDraft {
  text: string;
  options: string[];
  correct_index: number;
}

function StatusChip({ exam, now }: { exam: ExamItem; now: number }) {
  if (exam.status === "live") {
    return (
      <Badge className="bg-red-500/15 text-red-300" variant="outline" data-testid="exam-status-badge">
        <Radio className="mr-1.5 size-3" /> LIVE · {countdown(new Date(exam.end_at).getTime() - now)} left
      </Badge>
    );
  }
  if (exam.status === "scheduled") {
    return (
      <Badge variant="outline" className="border-border text-slate-300" data-testid="exam-status-badge">
        <CalendarClock className="mr-1.5 size-3" /> Starts in {countdown(new Date(exam.start_at).getTime() - now)}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-border text-slate-500" data-testid="exam-status-badge">
      Ended · {fmtDateTime(exam.end_at)}
    </Badge>
  );
}

function ResultsDialog({ examId, open, onOpenChange }: { examId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: rows } = useQuery({
    queryKey: ["exam-results", examId],
    queryFn: () => apiGet<AttemptRow[]>(`/exams/${examId}/results`),
    enabled: open,
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="exam-results-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading">Results</DialogTitle>
          <DialogDescription>Auto-graded the moment each student submits.</DialogDescription>
        </DialogHeader>
        <Table data-testid="exam-results-table">
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Auto-submit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).map((r) => (
              <TableRow key={r.attempt_id} data-testid="exam-result-row">
                <TableCell className="font-medium text-slate-200">{r.student_name}</TableCell>
                <TableCell>
                  <span className="font-mono text-emerald-400">{r.score ?? "—"}/{r.total}</span>
                </TableCell>
                <TableCell className="text-xs text-slate-400">{fmtDateTime(r.submitted_at)}</TableCell>
                <TableCell>{r.auto_submitted ? <Badge variant="outline" className="border-red-500/40 text-red-300">Timer</Badge> : "—"}</TableCell>
              </TableRow>
            ))}
            {(rows ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">No attempts yet.</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}

function CreateExamDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState("30");
  const [questions, setQuestions] = useState<QDraft[]>([
    { text: "", options: ["", "", "", ""], correct_index: 0 },
  ]);

  const create = useMutation({
    mutationFn: () =>
      apiPost<ExamDetail>("/exams", {
        title,
        subject,
        start_at: new Date(start).toISOString(),
        duration_minutes: Number(duration),
        questions: questions.map((q) => ({
          text: q.text,
          options: q.options,
          correct_index: q.correct_index,
          points: 1,
        })),
      }),
    onSuccess: () => {
      toast.success("Exam scheduled", { description: "Every student sees the same unlock moment." });
      void qc.invalidateQueries({ queryKey: ["exams"] });
      onOpenChange(false);
      setTitle("");
      setSubject("");
      setStart("");
      setDuration("30");
      setQuestions([{ text: "", options: ["", "", "", ""], correct_index: 0 }]);
    },
    onError: (err) => toast.error(errMessage(err)),
  });

  const valid =
    title.trim() !== "" &&
    start !== "" &&
    !Number.isNaN(new Date(start).getTime()) &&
    questions.every((q) => q.text.trim() !== "" && q.options.every((o) => o.trim() !== ""));

  const setQ = (i: number, patch: Partial<QDraft>) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto" data-testid="exam-create-card">
        <DialogHeader>
          <DialogTitle className="font-heading">Schedule exam</DialogTitle>
          <DialogDescription>
            One start time for the whole cohort — the room unlocks at that exact moment and auto-submits at the
            deadline.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="exam-title">Title</Label>
              <Input id="exam-title" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="exam-create-title-input" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exam-subject">Subject</Label>
              <Input id="exam-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Mathematics" data-testid="exam-create-subject-input" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exam-start">Start time</Label>
              <Input id="exam-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} data-testid="exam-create-start-input" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exam-duration">Duration (minutes)</Label>
              <Input id="exam-duration" type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} data-testid="exam-create-duration-input" />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Questions</Label>
            {questions.map((q, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border p-3" data-testid="exam-create-question">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider text-slate-400">Q{i + 1}</span>
                  {questions.length > 1 ? (
                    <Button variant="ghost" size="xs" data-testid="exam-create-question-remove-btn" onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}>
                      Remove
                    </Button>
                  ) : null}
                </div>
                <Input
                  placeholder="Question text"
                  value={q.text}
                  onChange={(e) => setQ(i, { text: e.target.value })}
                  data-testid="exam-create-question-text-input"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.options.map((opt, oi) => (
                    <label key={oi} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${i}`}
                        checked={q.correct_index === oi}
                        onChange={() => setQ(i, { correct_index: oi })}
                        data-testid="exam-create-correct-radio"
                        className="size-4 accent-blue-500"
                      />
                      <Input
                        placeholder={`Option ${oi + 1}`}
                        value={opt}
                        onChange={(e) => setQ(i, { options: q.options.map((o, k) => (k === oi ? e.target.value : o)) })}
                        data-testid="exam-create-option-input"
                      />
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">Select the radio next to the correct option.</p>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              data-testid="exam-create-question-add-btn"
              onClick={() => setQuestions((qs) => [...qs, { text: "", options: ["", "", "", ""], correct_index: 0 }])}
            >
              <Plus className="mr-2 size-4" /> Add question
            </Button>
          </div>

          <Button
            className="w-full"
            disabled={!valid || create.isPending}
            data-testid="exam-create-submit-btn"
            onClick={() => create.mutate()}
          >
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : "Schedule exam"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExamCard({ exam, isTeacher }: { exam: ExamItem; isTeacher: boolean }) {
  const now = useNow(1000);
  const [resultsOpen, setResultsOpen] = useState(false);
  return (
    <Card data-testid="exam-card" className="transition-transform duration-200 hover:-translate-y-0.5">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-bold tracking-tight">{exam.title}</h2>
            <p className="mt-1 text-xs text-slate-400">
              {exam.subject} · {exam.question_count} questions · {exam.total_points} points · by {exam.created_by_name}
            </p>
          </div>
          <StatusChip exam={exam} now={now} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {isTeacher ? (
            <>
              <Button variant="outline" size="sm" data-testid="exam-results-btn" onClick={() => setResultsOpen(true)}>
                Results
              </Button>
            </>
          ) : exam.my_status === "submitted" ? (
            <>
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300" data-testid="exam-score-badge">
                Scored {exam.my_score}/{exam.total_points}
              </Badge>
              <Link to={`/exams/${exam.id}`} className={buttonVariants({ variant: "outline", size: "sm" })} data-testid="exam-result-link">
                View result
              </Link>
            </>
          ) : exam.my_status === "in_progress" ? (
            <Link to={`/exams/${exam.id}`} className={buttonVariants({ size: "sm" })} data-testid="exam-enter-btn">
              Resume exam
            </Link>
          ) : exam.status === "live" ? (
            <Link to={`/exams/${exam.id}`} className={buttonVariants({ size: "sm" })} data-testid="exam-enter-btn">
              Enter exam
            </Link>
          ) : exam.my_status === "missed" ? (
            <Badge variant="outline" className="border-red-500/40 text-red-300" data-testid="exam-missed-badge">Missed</Badge>
          ) : (
            <span
              className={buttonVariants({ variant: "outline", size: "sm" }) + " cursor-not-allowed opacity-50"}
              data-testid="exam-enter-btn"
            >
              Opens {fmtDateTime(exam.start_at)}
            </span>
          )}
        </div>
      </CardContent>
      {isTeacher ? <ResultsDialog examId={exam.id} open={resultsOpen} onOpenChange={setResultsOpen} /> : null}
    </Card>
  );
}

function ExamsInner() {
  const { user } = useAuth();
  const { data: exams } = useQuery({
    queryKey: ["exams"],
    queryFn: () => apiGet<ExamItem[]>("/exams"),
    refetchInterval: 15_000,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const isTeacher = user?.role === "teacher" || user?.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Exams</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One window for the whole cohort — server-synced countdown, auto-submit at zero.
          </p>
        </div>
        {isTeacher ? (
          <Button data-testid="exam-create-btn" onClick={() => setCreateOpen(true)}>
            <ClipboardList className="mr-2 size-4" /> Schedule exam
          </Button>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {(exams ?? []).map((e) => (
          <ExamCard key={e.id} exam={e} isTeacher={isTeacher} />
        ))}
      </div>
      {isTeacher ? <CreateExamDialog open={createOpen} onOpenChange={setCreateOpen} /> : null}
    </div>
  );
}

export default function Exams() {
  return (
    <AppShell>
      <ExamsInner />
    </AppShell>
  );
}
