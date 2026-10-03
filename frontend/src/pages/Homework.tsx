import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, FileText, Loader2, Plus, Upload } from "lucide-react";
import AppShell from "@/components/AppShell";
import PaywallModal from "@/components/PaywallModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPost, apiPostForm } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errMessage, fmtDate, fmtDateTime, isPaywallError } from "@/lib/format";
import type { HomeworkDetail, HomeworkItem, SubmissionBrief, SubmissionFull } from "@/lib/types";

function statusBadge(status: string) {
  if (status === "graded") return <Badge className="bg-emerald-500/15 text-emerald-300" variant="outline">Graded</Badge>;
  return <Badge className="bg-amber-500/15 text-amber-300" variant="outline">Submitted</Badge>;
}

function SubmitDialog({
  hw,
  open,
  onOpenChange,
}: {
  hw: HomeworkItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [paywall, setPaywall] = useState(false);
  const submit = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("file", file as File);
      return apiPostForm<SubmissionBrief>(`/homework/${hw.id}/submit`, fd);
    },
    onSuccess: (res) => {
      toast.success("Homework submitted", { description: `${res.filename} is in for grading.` });
      void qc.invalidateQueries({ queryKey: ["homework"] });
      onOpenChange(false);
      setFile(null);
    },
    onError: (err) => {
      if (isPaywallError(err)) {
        onOpenChange(false);
        setPaywall(true);
      } else {
        toast.error("Upload failed", { description: errMessage(err) });
      }
    },
  });

  const doSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (file) submit.mutate();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md" data-testid="homework-upload-card">
          <DialogHeader>
            <DialogTitle className="font-heading">Submit — {hw.title}</DialogTitle>
            <DialogDescription>Upload a single PDF (max 5 MB). You can re-upload until it's graded.</DialogDescription>
          </DialogHeader>
          <form onSubmit={doSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pdf">PDF file</Label>
              <Input
                id="pdf"
                type="file"
                accept="application/pdf,.pdf"
                data-testid="homework-pdf-file-input"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <p className="text-xs text-slate-400" data-testid="homework-file-chosen">
                  {file.name} · {(file.size / 1024).toFixed(0)} KB
                </p>
              ) : null}
            </div>
            <Button type="submit" className="w-full" disabled={!file || submit.isPending} data-testid="homework-submit-btn">
              {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
              {submit.isPending ? "Uploading…" : "Upload PDF"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <PaywallModal open={paywall} onOpenChange={setPaywall} role="student" />
    </>
  );
}

function StudentHomework() {
  const { data: homework } = useQuery({ queryKey: ["homework"], queryFn: () => apiGet<HomeworkItem[]>("/homework") });
  const [target, setTarget] = useState<HomeworkItem | null>(null);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Homework</h1>
        <p className="mt-1 text-sm text-muted-foreground">Upload your PDFs and watch grades land in real time.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {(homework ?? []).map((hw) => (
          <Card key={hw.id} data-testid="homework-assignment-card" className="transition-transform duration-200 hover:-translate-y-0.5">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-heading text-lg font-bold tracking-tight">{hw.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{hw.description}</p>
                </div>
                {hw.my_submission ? statusBadge(hw.my_submission.status) : (
                  <Badge variant="outline" className="border-border text-slate-400">Pending</Badge>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                <span className="font-mono uppercase tracking-wider">Due {fmtDate(hw.due_date)}</span>
                <span>by {hw.created_by_name}</span>
              </div>
              {hw.my_submission?.status === "graded" ? (
                <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3" data-testid="homework-grade-feedback">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-emerald-400">{hw.my_submission.grade}/100</span>
                    <span className="text-xs text-slate-400">{fmtDateTime(hw.my_submission.submitted_at)}</span>
                  </div>
                  {hw.my_submission.feedback ? (
                    <p className="mt-1.5 text-sm text-slate-300">“{hw.my_submission.feedback}”</p>
                  ) : null}
                </div>
              ) : (
                <Button
                  className="mt-4 w-full sm:w-auto"
                  variant={hw.my_submission ? "outline" : "default"}
                  data-testid="homework-open-upload-btn"
                  onClick={() => setTarget(hw)}
                >
                  <Upload className="mr-2 size-4" />
                  {hw.my_submission ? "Re-upload" : "Submit PDF"}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {target ? <SubmitDialog hw={target} open={!!target} onOpenChange={(v) => !v && setTarget(null)} /> : null}
    </div>
  );
}

function GradingRow({ sub }: { sub: SubmissionFull }) {
  const qc = useQueryClient();
  const [grade, setGrade] = useState(sub.grade !== null ? String(sub.grade) : "");
  const [feedback, setFeedback] = useState(sub.feedback ?? "");
  const [paywall, setPaywall] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const save = useMutation({
    mutationFn: () =>
      apiPost<SubmissionFull>(`/homework/submissions/${sub.id}/grade`, {
        grade: Number(grade),
        feedback,
      }),
    onSuccess: () => {
      toast.success("Grade saved", { description: `${sub.student_name} — ${Number(grade)}/100` });
      void qc.invalidateQueries({ queryKey: ["homework"] });
    },
    onError: (err) => {
      if (isPaywallError(err)) setPaywall(true);
      else toast.error(errMessage(err));
    },
  });
  const valid = grade !== "" && !Number.isNaN(Number(grade)) && Number(grade) >= 0 && Number(grade) <= 100;

  return (
    <>
      <TableRow data-testid="grading-row">
        <TableCell>
          <div className="font-medium text-slate-200">{sub.student_name}</div>
          <div className="text-xs text-slate-500">{fmtDateTime(sub.submitted_at)}</div>
        </TableCell>
        <TableCell>{statusBadge(sub.status)}</TableCell>
        <TableCell>
          <Button variant="outline" size="sm" data-testid="homework-view-pdf-btn" onClick={() => setPdfOpen(true)}>
            <FileText className="mr-2 size-4" /> View PDF
          </Button>
        </TableCell>
        <TableCell className="w-24">
          <Input
            type="number"
            min={0}
            max={100}
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="0–100"
            data-testid="teacher-grade-score-input"
          />
        </TableCell>
        <TableCell className="min-w-52">
          <Textarea
            rows={2}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Feedback for the student…"
            data-testid="teacher-feedback-textarea"
          />
        </TableCell>
        <TableCell>
          <Button size="sm" disabled={!valid || save.isPending} data-testid="teacher-save-grade-btn" onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save"}
          </Button>
        </TableCell>
      </TableRow>
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="max-w-3xl" data-testid="homework-pdf-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">{sub.student_name} — {sub.filename}</DialogTitle>
          </DialogHeader>
          <iframe
            src={`/api/homework/submissions/${sub.id}/pdf`}
            className="h-[65vh] w-full rounded-lg border border-border bg-white"
            title={`PDF submission by ${sub.student_name}`}
            data-testid="homework-pdf-preview"
          />
        </DialogContent>
      </Dialog>
      <PaywallModal open={paywall} onOpenChange={setPaywall} role="teacher" />
    </>
  );
}

function TeacherHomework() {
  const qc = useQueryClient();
  const { data: homework } = useQuery({ queryKey: ["homework"], queryFn: () => apiGet<HomeworkItem[]>("/homework") });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState("");

  const { data: detail } = useQuery({
    queryKey: ["homework", selectedId],
    queryFn: () => apiGet<HomeworkDetail>(`/homework/${selectedId}`),
    enabled: !!selectedId,
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost<HomeworkItem>("/homework", { title, description, due_date: due || null }),
    onSuccess: () => {
      toast.success("Assignment created");
      void qc.invalidateQueries({ queryKey: ["homework"] });
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      setDue("");
    },
    onError: (err) => toast.error(errMessage(err)),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Homework desk</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create assignments and grade the PDFs that land.</p>
        </div>
        <Button data-testid="homework-create-btn" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" /> New assignment
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(homework ?? []).map((hw) => (
          <Card key={hw.id} data-testid="homework-assignment-card" className="transition-transform duration-200 hover:-translate-y-0.5">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-heading text-lg font-bold tracking-tight">{hw.title}</h2>
                <Badge variant="outline" className="border-border text-slate-400" data-testid="homework-submission-count">
                  {hw.graded_count}/{hw.submission_count} graded
                </Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{hw.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider text-slate-400">Due {fmtDate(hw.due_date)}</span>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="homework-open-grading-btn"
                  onClick={() => setSelectedId(hw.id)}
                >
                  Grade submissions
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedId ? (
        <div className="rounded-xl border border-border bg-card" data-testid="grading-desk">
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" data-testid="grading-back-btn" onClick={() => setSelectedId(null)}>
                <ArrowLeft className="size-4" />
              </Button>
              <div>
                <p className="font-heading font-bold">{detail?.title ?? "Loading…"}</p>
                <p className="text-xs text-muted-foreground">Score 0–100 with written feedback — saved instantly.</p>
              </div>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submission</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Feedback</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(detail?.submissions ?? []).map((sub) => (
                <GradingRow key={sub.id} sub={sub} />
              ))}
              {(detail?.submissions ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No submissions yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md" data-testid="homework-create-card">
          <DialogHeader>
            <DialogTitle className="font-heading">New assignment</DialogTitle>
            <DialogDescription>Students see this on their desk immediately.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="hw-title">Title</Label>
              <Input id="hw-title" required value={title} onChange={(e) => setTitle(e.target.value)} data-testid="homework-create-title-input" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hw-desc">Instructions</Label>
              <Textarea id="hw-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} data-testid="homework-create-desc-input" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hw-due">Due date</Label>
              <Input id="hw-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} data-testid="homework-create-due-input" />
            </div>
            <Button type="submit" className="w-full" disabled={create.isPending} data-testid="homework-create-submit-btn">
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : "Create assignment"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Homework() {
  return (
    <AppShell>
      <HomeworkInner />
    </AppShell>
  );
}

function HomeworkInner() {
  const { user } = useAuth();
  if (user?.role === "teacher" || user?.role === "admin") return <TeacherHomework />;
  return <StudentHomework />;
}
