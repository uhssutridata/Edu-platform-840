import { useEffect, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  BookOpen,
  ClipboardList,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth, useHeartbeat, useLogout } from "@/lib/auth";
import { planLabel } from "@/lib/format";
import type { Role } from "@/lib/types";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  testid: string;
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["student", "teacher", "admin"], testid: "nav-dashboard" },
  { to: "/homework", label: "Homework", icon: BookOpen, roles: ["student", "teacher", "admin"], testid: "nav-homework" },
  { to: "/exams", label: "Exams", icon: ClipboardList, roles: ["student", "teacher", "admin"], testid: "nav-exams" },
  { to: "/tutorials", label: "Tutorials", icon: Sparkles, roles: ["student", "teacher", "admin"], testid: "nav-tutorials" },
  { to: "/chat", label: "Chat", icon: MessageSquare, roles: ["student", "teacher", "admin"], testid: "nav-chat" },
  { to: "/subscription", label: "Subscription", icon: CreditCard, roles: ["student", "teacher"], testid: "nav-subscription" },
  { to: "/admin", label: "Live sessions", icon: ShieldCheck, roles: ["admin"], testid: "nav-admin" },
];

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-5 py-5" data-testid="brand-link">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <GraduationCap className="size-5" />
      </span>
      <span className="font-heading text-lg font-bold tracking-tight">AstraLearn</span>
    </Link>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const role: Role = user?.role ?? "student";
  return (
    <nav className="flex flex-1 flex-col gap-1 p-3" data-testid="app-sidebar">
      {NAV.filter((n) => n.roles.includes(role)).map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          data-testid={n.testid}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 ${
              isActive
                ? "bg-primary/15 text-primary-foreground"
                : "text-slate-400 hover:bg-accent hover:text-slate-200"
            }`
          }
        >
          <n.icon className="size-4 shrink-0" />
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
}

function SignInPrompt() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/15">
        <GraduationCap className="size-7 text-primary" />
      </div>
      <h1 className="mt-5 font-heading text-2xl font-bold tracking-tight">You're browsing as a guest</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in to reach your homework desk, live exams, tutorials and chat — or create an account in under a minute.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link
          to="/login"
          className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
          data-testid="prompt-login-link"
        >
          Sign in
        </Link>
        <Link
          to="/register"
          className="inline-flex h-10 items-center rounded-md border border-border px-5 text-sm font-medium text-slate-200 transition-colors duration-150 hover:bg-accent"
          data-testid="prompt-register-link"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const heartbeat = useHeartbeat();
  const logout = useLogout();
  const role: Role = user?.role ?? "student";

  // Presence heartbeat: the admin "who is online" radar reads this every 15s.
  useEffect(() => {
    if (!user) return;
    heartbeat.mutate();
    const timer = setInterval(() => heartbeat.mutate(), 15_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar lg:flex">
        <Brand />
        <SidebarNav />
        <div className="border-t border-border p-4 text-xs text-slate-500">
          Signed in as <span className="text-slate-300">{user?.name ?? "guest"}</span>
          <span className="mt-0.5 block capitalize text-slate-500">{user?.role ?? "visitor"}</span>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger
                render={
                  <Button variant="ghost" size="icon" className="lg:hidden" data-testid="sidebar-toggle-btn" />
                }
              >
                <Menu className="size-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <Brand />
                <SidebarNav />
              </SheetContent>
            </Sheet>
            <span className="font-mono text-xs uppercase tracking-wider text-slate-500">AstraLearn LMS</span>
          </div>
          {user ? (
            <div className="flex items-center gap-3">
              <span data-testid="session-pulse" className="relative flex size-2.5" title="Session active">
                <span className="absolute inline-flex size-2.5 rounded-full bg-emerald-400 opacity-70 animate-presence-ping" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
              </span>
              <Badge
                variant="outline"
                data-testid="topbar-plan-badge"
                className={
                  user.subscribed
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-border text-slate-400"
                }
              >
                {planLabel(user.plan)}
              </Badge>
              <span className="hidden text-sm text-slate-300 sm:block" data-testid="topbar-user-email">
                {user.email}
              </span>
              <Button
                variant="ghost"
                size="icon"
                data-testid="logout-btn"
                onClick={() => logout.mutate()}
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          ) : null}
        </header>

        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8" data-testid="app-main">
          {isLoading ? (
            <div className="mt-10 space-y-4" data-testid="app-loading-skeleton">
              <div className="h-8 w-64 animate-pulse rounded bg-muted" />
              <div className="h-40 w-full animate-pulse rounded-xl bg-muted" />
              <div className="h-40 w-2/3 animate-pulse rounded-xl bg-muted" />
            </div>
          ) : user ? (
            children
          ) : (
            <SignInPrompt />
          )}
        </main>
      </div>
    </div>
  );
}
