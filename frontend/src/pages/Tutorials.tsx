import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Clapperboard,
  Loader2,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  Video,
} from "lucide-react";
import AppShell from "@/components/AppShell";
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
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errMessage } from "@/lib/format";
import type { Tutorial } from "@/lib/types";

// ---------- animated visualizations, one per step ----------

const BAR_ORDERS: number[][] = [
  [42, 78, 25, 90, 55, 80, 35, 65],
  [78, 42, 25, 90, 55, 80, 35, 65],
  [78, 42, 25, 55, 80, 35, 65, 90],
  [25, 35, 42, 55, 65, 78, 80, 90],
];

function SortingViz({ step }: { step: number }) {
  const bars = BAR_ORDERS[Math.min(step, BAR_ORDERS.length - 1)];
  return (
    <div className="flex h-48 items-end justify-center gap-2" data-testid="tutorial-animation-canvas">
      {bars.map((v) => (
        <motion.div
          key={v}
          layout
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="w-8 rounded-t bg-gradient-to-t from-blue-600 to-sky-400"
          style={{ height: `${v}%` }}
        />
      ))}
    </div>
  );
}

function GraphViz({ step }: { step: number }) {
  return (
    <svg viewBox="0 0 320 200" className="h-48 w-full" data-testid="tutorial-animation-canvas">
      <line x1="10" y1="190" x2="310" y2="190" stroke="#334155" strokeWidth="1" />
      <line x1="20" y1="10" x2="20" y2="190" stroke="#334155" strokeWidth="1" />
      <motion.path
        key={`curve-${step}`}
        d="M30 170 C 110 160, 150 90, 300 30"
        fill="none"
        stroke="#3b82f6"
        strokeWidth={3}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1 }}
      />
      {step >= 1 ? (
        <motion.line
          x1="60" y1="167" x2="200" y2="82"
          stroke="#f59e0b" strokeWidth={2}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        />
      ) : null}
      {step >= 2 ? (
        <>
          <motion.line
            x1="140" y1="120" x2="215" y2="66"
            stroke="#34d399" strokeWidth={2.5}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          />
          <circle cx="140" cy="120" r="4" fill="#34d399" />
        </>
      ) : null}
      {step >= 3 ? (
        <motion.text x="222" y="60" fill="#34d399" fontSize="12" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          slope = f'(x)
        </motion.text>
      ) : null}
    </svg>
  );
}

function ProjectileViz({ step }: { step: number }) {
  const range = step >= 3 ? 280 : 220;
  return (
    <div className="relative h-48 overflow-hidden rounded-lg bg-[#050914]" data-testid="tutorial-animation-canvas">
      <div className="absolute bottom-0 h-px w-full bg-slate-700" />
      {step >= 2 ? (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 340 192" preserveAspectRatio="none">
          <motion.path
            d={`M24 186 Q ${24 + range / 2} -186 ${24 + range} 186`}
            fill="none"
            stroke="#34d399"
            strokeWidth={2}
            strokeDasharray="6 6"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2 }}
          />
        </svg>
      ) : null}
      <motion.div
        key={`ball-${step}`}
        className="absolute bottom-1 left-6 size-3 rounded-full bg-sky-400"
        animate={{ x: [0, range / 2, range], y: [0, -110, 0] }}
        transition={{ duration: 1.6, ease: "easeOut", times: [0, 0.5, 1] }}
      />
    </div>
  );
}

function CardsViz({ step }: { step: number }) {
  return (
    <div className="flex h-48 items-center justify-center gap-4" data-testid="tutorial-animation-canvas">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ scale: step % 3 === i ? 1.12 : 1, rotate: step % 3 === i ? 3 : 0 }}
          transition={{ type: "spring", stiffness: 240, damping: 20 }}
          className="flex size-24 items-center justify-center rounded-2xl border border-border bg-card font-heading text-2xl font-bold text-primary"
        >
          {String.fromCharCode(65 + i)}
        </motion.div>
      ))}
    </div>
  );
}

function Viz({ viz, step }: { viz: string; step: number }) {
  if (viz === "sorting") return <SortingViz step={step} />;
  if (viz === "graph") return <GraphViz step={step} />;
  if (viz === "projectile") return <ProjectileViz step={step} />;
  return <CardsViz step={step} />;
}

// ---------- the player ----------

function TutorialPlayer({ tutorial }: { tutorial: Tutorial }) {
  const steps = tutorial.steps;
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (idx >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIdx((i) => i + 1), 4000);
    return () => clearTimeout(t);
  }, [playing, idx, steps.length]);

  const step = Math.min(idx, Math.max(0, steps.length - 1));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-[#050914] p-6">
        <Viz viz={steps[step]?.viz ?? "cards"} step={step} />
        <motion.div key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <p className="mt-5 font-mono text-xs uppercase tracking-wider text-slate-400">
            Step {step + 1}/{steps.length}
          </p>
          <h2 className="mt-1 font-heading text-xl font-bold tracking-tight">{steps[step]?.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{steps[step]?.description}</p>
        </motion.div>
      </div>

      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            aria-label={`Go to step ${i + 1}`}
            data-testid="tutorial-step-dot"
            className={`h-1.5 flex-1 rounded-full transition-colors duration-150 ${i <= step ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          data-testid="tutorial-step-backward-btn"
          disabled={step === 0}
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
        >
          <SkipBack className="size-4" />
        </Button>
        <Button
          size="icon"
          data-testid="tutorial-play-toggle-btn"
          disabled={steps.length === 0}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          data-testid="tutorial-step-forward-btn"
          disabled={step >= steps.length - 1}
          onClick={() => setIdx((i) => Math.min(steps.length - 1, i + 1))}
        >
          <SkipForward className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------- the page ----------

interface StepDraft {
  title: string;
  description: string;
  viz: string;
}

function TutorialsInner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: tutorials } = useQuery({
    queryKey: ["tutorials"],
    queryFn: () => apiGet<Tutorial[]>("/tutorials"),
  });
  const [selected, setSelected] = useState<Tutorial | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState<"animated" | "youtube">("animated");
  const [youtubeId, setYoutubeId] = useState("");
  const [steps, setSteps] = useState<StepDraft[]>([{ title: "", description: "", viz: "cards" }]);
  const isTeacher = user?.role === "teacher" || user?.role === "admin";

  const create = useMutation({
    mutationFn: () =>
      apiPost<Tutorial>("/tutorials", {
        title,
        subject,
        kind,
        youtube_id: kind === "youtube" ? youtubeId.trim() || null : null,
        steps: kind === "animated" ? steps : [],
      }),
    onSuccess: () => {
      toast.success("Tutorial published");
      void qc.invalidateQueries({ queryKey: ["tutorials"] });
      setCreateOpen(false);
      setTitle("");
      setSubject("");
      setYoutubeId("");
      setSteps([{ title: "", description: "", viz: "cards" }]);
    },
    onError: (err) => toast.error(errMessage(err)),
  });

  const valid =
    title.trim() !== "" &&
    (kind === "animated"
      ? steps.every((s) => s.title.trim() !== "")
      : youtubeId.trim() !== "");

  if (selected) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <button
          onClick={() => setSelected(null)}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
          data-testid="tutorials-back-btn"
        >
          <ArrowLeft className="size-4" /> All tutorials
        </button>
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">{selected.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {selected.subject} · by {selected.created_by_name}
          </p>
        </div>
        {selected.kind === "youtube" && selected.youtube_id ? (
          <iframe
            src={`https://www.youtube.com/embed/${selected.youtube_id}`}
            className="aspect-video w-full rounded-2xl border border-border"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={selected.title}
            data-testid="tutorial-video-embed"
          />
        ) : (
          <TutorialPlayer tutorial={selected} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Tutorials</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Animated step lessons played in-app, plus video lectures.
          </p>
        </div>
        {isTeacher ? (
          <Button data-testid="tutorial-create-btn" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" /> New tutorial
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(tutorials ?? []).map((t) => (
          <Card
            key={t.id}
            data-testid="tutorial-card"
            className="cursor-pointer transition-transform duration-200 hover:-translate-y-0.5"
            onClick={() => setSelected(t)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15">
                  {t.kind === "youtube" ? <Video className="size-5 text-primary" /> : <Clapperboard className="size-5 text-primary" />}
                </span>
                <Badge variant="outline" className={t.kind === "animated" ? "border-primary/40 text-primary" : "border-border text-slate-400"}>
                  {t.kind === "animated" ? "Interactive" : "Video"}
                </Badge>
              </div>
              <h2 className="mt-4 font-heading text-lg font-bold tracking-tight">{t.title}</h2>
              <p className="mt-1 text-xs text-slate-400">
                {t.subject} · {t.kind === "animated" ? `${t.steps.length} steps` : "YouTube lecture"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto" data-testid="tutorial-create-card">
          <DialogHeader>
            <DialogTitle className="font-heading">New tutorial</DialogTitle>
            <DialogDescription>Animated lessons play step-by-step inside the app; video lessons embed YouTube.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                data-testid="tutorial-create-kind-animated-btn"
                onClick={() => setKind("animated")}
                className={kind === "animated" ? "border-primary bg-primary/10 text-primary-foreground" : ""}
              >
                <Clapperboard className="mr-2 size-4" /> Animated
              </Button>
              <Button
                type="button"
                variant="outline"
                data-testid="tutorial-create-kind-youtube-btn"
                onClick={() => setKind("youtube")}
                className={kind === "youtube" ? "border-primary bg-primary/10 text-primary-foreground" : ""}
              >
                <Video className="mr-2 size-4" /> YouTube
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tut-title">Title</Label>
              <Input id="tut-title" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="tutorial-create-title-input" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tut-subject">Subject</Label>
              <Input id="tut-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Mathematics" data-testid="tutorial-create-subject-input" />
            </div>
            {kind === "youtube" ? (
              <div className="space-y-2">
                <Label htmlFor="tut-yt">YouTube video ID</Label>
                <Input id="tut-yt" value={youtubeId} onChange={(e) => setYoutubeId(e.target.value)} placeholder="spUNpyF58BY" data-testid="tutorial-create-youtube-input" />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Steps</Label>
                {steps.map((s, i) => (
                  <div key={i} className="space-y-2 rounded-lg border border-border p-3" data-testid="tutorial-create-step">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs uppercase tracking-wider text-slate-400">Step {i + 1}</span>
                      {steps.length > 1 ? (
                        <Button variant="ghost" size="xs" data-testid="tutorial-step-remove-btn" onClick={() => setSteps((ss) => ss.filter((_, j) => j !== i))}>
                          Remove
                        </Button>
                      ) : null}
                    </div>
                    <Input placeholder="Step title" value={s.title} onChange={(e) => setSteps((ss) => ss.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} data-testid="tutorial-step-title-input" />
                    <Input placeholder="What happens in this step" value={s.description} onChange={(e) => setSteps((ss) => ss.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} data-testid="tutorial-step-desc-input" />
                    <select
                      value={s.viz}
                      onChange={(e) => setSteps((ss) => ss.map((x, j) => (j === i ? { ...x, viz: e.target.value } : x)))}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      data-testid="tutorial-step-viz-select"
                    >
                      <option value="cards">Cards</option>
                      <option value="sorting">Sorting bars</option>
                      <option value="graph">Math graph</option>
                      <option value="projectile">Projectile arc</option>
                    </select>
                  </div>
                ))}
                <Button variant="outline" size="sm" data-testid="tutorial-step-add-btn" onClick={() => setSteps((ss) => [...ss, { title: "", description: "", viz: "cards" }])}>
                  <Plus className="mr-2 size-4" /> Add step
                </Button>
              </div>
            )}
            <Button className="w-full" disabled={!valid || create.isPending} onClick={() => create.mutate()} data-testid="tutorial-create-submit-btn">
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : "Publish tutorial"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Tutorials() {
  return (
    <AppShell>
      <TutorialsInner />
    </AppShell>
  );
}
