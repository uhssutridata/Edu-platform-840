import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, ClipboardList, Radio, ShieldCheck, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import AppShell from "@/components/AppShell";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { countdown, fmtDate, planLabel } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import type { ExamItem, HomeworkItem, UserCard } from "@/lib/types";

function DashCard({
  icon: Icon,
  label,
  children,
  testid,
}: {
  icon: typeof Timer;
  label: string;
  children: React.ReactNode;
  testid: string;
}) {
  return (
    <Card data-testid={testid} className="transition-transform duration-200 hover:-translate-y-0.5">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-400">
          <Icon className="size-4" /> {label}
        </div>
        <div className="mt-4">{children}</div>
      </CardContent>
    </Card>
  );
}

function StudentDash() {
  const { user } = useAuth();
  const now = useNow(1000);
  const { data: exams } = useQuery({
    queryKey: ["exams"],
    queryFn: () => apiGet<ExamItem[]>("/exams"),
    refetchInterval: 15_000,
  });
  const { data: homework } = useQuery({ queryKey: ["homework"], queryFn: () => apiGet<HomeworkItem[]>("/homework") });

  const nextExam =
    exams?.find((e) => e.status === "live" && e.my_status !== "submitted") ??
    exams?.find((e) => e.status === "scheduled");
  const unsubmitted = homework?.filter((h) => !h.my_submission) ?? [];
  const graded = homework?.filter((h) => h.my_submission?.status === "graded") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight" data-testid="dashboard-title">
          Welcome back, {user?.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Your desk for today — exams, homework and everything due.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <DashCard icon={Timer} label={nextExam?.status === "live" ? "Exam live now" : "Next exam"} testid="dash-next-exam-card">
          {nextExam ? (
            <>
              <p className="font-heading text-lg font-bold">{nextExam.title}</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-emerald-400" data-testid="dash-exam-countdown">
                {nextExam.status === "live"
                  ? `${countdown(new Date(nextExam.end_at).getTime() - now)} left`
                  : `${countdown(new Date(nextExam.start_at).getTime() - now)} to start`}
              </p>
              <Link
                to="/exams"
                className={buttonVariants({ size: "sm" }) + " mt-3"}
                data-testid="dash-exams-link"
              >
                Open exams
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No exams scheduled — check back soon.</p>
          )}
        </DashCard>
        <DashCard icon={BookOpen} label="Homework" testid="dash-homework-card">
          <p className="font-heading text-3xl font-bold">{unsubmitted.length}</p>
          <p className="text-sm text-muted-foreground">assignments waiting for your PDF</p>
          {unsubmitted[0] ? (
            <p className="mt-2 truncate text-xs text-slate-400">Due soonest: {unsubmitted[0].title}</p>
          ) : null}
          <Link to="/homework" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline" data-testid="dash-homework-link">
            Homework desk <ArrowRight className="size-3.5" />
          </Link>
        </DashCard>
        <DashCard icon={Radio} label="Subscription" testid="dash-subscription-card">
          <Badge
            variant="outline"
            data-testid="dash-plan-badge"
            className={user?.subscribed ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-border text-slate-300"}
          >
            {planLabel(user?.plan ?? "free")}
          </Badge>
          <p className="mt-2 text-sm text-muted-foreground">
            {user?.subscribed
              ? `Active until ${fmtDate(user?.subscription_end)}`
              : "Homework and exams need an active plan"}
          </p>
          <Link to="/subscription" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline" data-testid="dash-subscription-link">
            Manage plan <ArrowRight className="size-3.5" />
          </Link>
        </DashCard>
      </div>
      {graded.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-5" data-testid="dash-recent-grades">
          <p className="font-mono text-xs uppercase tracking-wider text-slate-400">Recent grades</p>
          <ul className="mt-3 space-y-2">
            {graded.slice(0, 3).map((h) => (
              <li key={h.id} className="flex items-center justify-between text-sm">
                <span className="truncate text-slate-300">{h.title}</span>
                <span className="ml-3 font-mono text-emerald-400">{h.my_submission?.grade}/100</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function TeacherDash() {
  const { user } = useAuth();
  const { data: exams } = useQuery({
    queryKey: ["exams"],
    queryFn: () => apiGet<ExamItem[]>("/exams"),
    refetchInterval: 15_000,
  });
  const { data: homework } = useQuery({ queryKey: ["homework"], queryFn: () => apiGet<HomeworkItem[]>("/homework") });

  const pending = (homework ?? []).reduce((acc, h) => acc + Math.max(0, h.submission_count - h.graded_count), 0);
  const live = exams?.filter((e) => e.status === "live") ?? [];
  const upcoming = exams?.filter((e) => e.status === "scheduled") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight" data-testid="dashboard-title">
          Welcome back, {user?.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Your teaching desk — grading, live exams and your plan.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <DashCard icon={BookOpen} label="Pending grading" testid="dash-grading-card">
          <p className="font-heading text-3xl font-bold" data-testid="dash-pending-count">{pending}</p>
          <p className="text-sm text-muted-foreground">submissions waiting on you</p>
          <Link to="/homework" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline" data-testid="dash-grading-link">
            Open grading desk <ArrowRight className="size-3.5" />
          </Link>
        </DashCard>
        <DashCard icon={ClipboardList} label="Exams" testid="dash-exams-card">
          <p className="font-heading text-lg font-bold">{live.length} live</p>
          <p className="text-sm text-muted-foreground">{upcoming.length} scheduled</p>
          <Link to="/exams" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline" data-testid="dash-exams-link">
            Schedule or review <ArrowRight className="size-3.5" />
          </Link>
        </DashCard>
        <DashCard icon={Radio} label="Subscription" testid="dash-subscription-card">
          <Badge
            variant="outline"
            data-testid="dash-plan-badge"
            className={user?.subscribed ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-border text-slate-300"}
          >
            {planLabel(user?.plan ?? "free")}
          </Badge>
          <p className="mt-2 text-sm text-muted-foreground">
            {user?.subscribed ? `Active until ${fmtDate(user?.subscription_end)}` : "Grading needs Teacher Pro"}
          </p>
          <Link to="/subscription" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline" data-testid="dash-subscription-link">
            Manage plan <ArrowRight className="size-3.5" />
          </Link>
        </DashCard>
      </div>
    </div>
  );
}

function AdminDash() {
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => apiGet<UserCard[]>("/users"), refetchInterval: 10_000 });
  const online = users?.filter((u) => u.online).length ?? 0;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight" data-testid="dashboard-title">
          Admin control room
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Live presence across the platform.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <DashCard icon={Radio} label="Online right now" testid="dash-online-card">
          <p className="font-heading text-3xl font-bold text-emerald-400" data-testid="dash-online-count">{online}</p>
          <p className="text-sm text-muted-foreground">active sessions in the last minute</p>
        </DashCard>
        <DashCard icon={ShieldCheck} label="Registered users" testid="dash-users-card">
          <p className="font-heading text-3xl font-bold">{users?.length ?? 0}</p>
          <p className="text-sm text-muted-foreground">
            {users?.filter((u) => u.role === "student").length ?? 0} students ·{" "}
            {users?.filter((u) => u.role === "teacher").length ?? 0} teachers
          </p>
        </DashCard>
        <DashCard icon={Radio} label="Live sessions radar" testid="dash-radar-card">
          <p className="text-sm text-muted-foreground">Who is logged in, refreshed every 5 seconds.</p>
          <Link
            to="/admin"
            className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            data-testid="dash-admin-link"
          >
            Open radar <ArrowRight className="size-3.5" />
          </Link>
        </DashCard>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <AppShell>
      <DashboardInner />
    </AppShell>
  );
}

function DashboardInner() {
  const { user } = useAuth();
  if (user?.role === "teacher") return <TeacherDash />;
  if (user?.role === "admin") return <AdminDash />;
  return <StudentDash />;
}
