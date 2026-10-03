import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  CreditCard,
  GraduationCap,
  MessageSquare,
  Radio,
  Sparkles,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Timer,
    title: "Synchronized live exams",
    body: "One start time for the whole cohort, a server-synced countdown, and auto-submit when the clock hits zero.",
  },
  {
    icon: BookOpen,
    title: "PDF homework desk",
    body: "Upload submissions, preview the PDF inline, and grade side-by-side with written feedback.",
  },
  {
    icon: Sparkles,
    title: "Animated tutorials",
    body: "Step-by-step visual lessons played inside the app — sorting, slopes, projectiles — plus YouTube embeds.",
  },
  {
    icon: MessageSquare,
    title: "1:1 and group chat",
    body: "Direct lines between students and teachers, plus cohort channels with live presence dots.",
  },
  {
    icon: Radio,
    title: "Admin radar",
    body: "Admins see exactly who is logged in, live — session pulse, roles, plans and last ping.",
  },
  {
    icon: CreditCard,
    title: "Subscriptions",
    body: "Student Pro and Teacher Pro plans unlock the desk. Checkout runs in test mode — no real charge.",
  },
];

const DEMO_ROWS = [
  { role: "Admin", email: "admin@lms.com", password: "admin123" },
  { role: "Teacher", email: "teacher@lms.com", password: "teacher123" },
  { role: "Student", email: "student@lms.com", password: "student123" },
];

export default function Home() {
  const { user } = useAuth();
  return (
    <div className="min-h-svh bg-[#0b0f19] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0b0f19]/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5" data-testid="home-brand-link">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="size-5" />
            </span>
            <span className="font-heading text-lg font-bold tracking-tight">AstraLearn</span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <Link
                to="/dashboard"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
                data-testid="home-dashboard-link"
              >
                Go to dashboard <ArrowRight className="size-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex h-9 items-center rounded-md px-4 text-sm text-slate-300 transition-colors duration-150 hover:text-white"
                  data-testid="home-login-link"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
                  data-testid="home-register-link"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-slate-400" data-testid="home-hero-kicker">
            Live learning platform
          </span>
          <h1 className="mt-4 font-heading text-5xl font-bold leading-[1.05] tracking-tight text-white lg:text-6xl">
            One classroom.<br />One clock.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-slate-300">
            Register your cohort, schedule an exam for everyone at the same instant, collect PDF homework,
            grade it with feedback, and keep the conversation going — all in one command center.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to={user ? "/dashboard" : "/register"}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
              data-testid="home-cta-primary"
            >
              {user ? "Open your desk" : "Create free account"} <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex h-11 items-center rounded-lg border border-white/15 px-6 text-sm font-medium text-slate-200 transition-colors duration-150 hover:bg-white/5"
              data-testid="home-cta-secondary"
            >
              Sign in
            </Link>
          </div>

          <div className="mt-10 rounded-xl border border-white/10 bg-[#111827] p-4" data-testid="home-demo-credentials">
            <p className="font-mono text-xs uppercase tracking-wider text-slate-400">Demo accounts — try every role</p>
            <div className="mt-3 space-y-1.5">
              {DEMO_ROWS.map((d) => (
                <div key={d.role} className="flex items-center justify-between text-sm">
                  <span className="text-slate-200">{d.role}</span>
                  <span className="font-mono text-xs text-slate-400">
                    {d.email} · {d.password}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative">
          <img
            src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?crop=entropy&cs=srgb&fm=jpg&q=85"
            alt="Students collaborating online"
            className="aspect-[4/3] w-full rounded-3xl border border-white/10 object-cover"
            data-testid="home-hero-image"
          />
          <div className="absolute inset-0 rounded-3xl bg-[linear-gradient(135deg,rgba(11,15,25,0.95)_0%,rgba(15,23,42,0.5)_100%)]" />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="absolute -left-4 top-8 rounded-xl border border-white/10 bg-[#1e293b]/95 p-4 shadow-xl"
            data-testid="home-floating-exam-card"
          >
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-2 rounded-full bg-red-400 opacity-75 animate-presence-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-red-500" />
              </span>
              Live exam — Mathematics Midterm
            </div>
            <div className="mt-2 font-mono text-2xl font-bold tracking-widest text-emerald-400">42:10</div>
            <p className="text-xs text-slate-400">32 students taking it right now</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.45 }}
            className="absolute -right-2 bottom-8 rounded-xl border border-white/10 bg-[#1e293b]/95 p-4 shadow-xl"
            data-testid="home-floating-grade-card"
          >
            <div className="text-xs text-slate-300">PDF graded — Linear Algebra PS1</div>
            <div className="mt-1 font-heading text-2xl font-bold text-white">
              88<span className="text-sm font-normal text-slate-400">/100</span>
            </div>
            <Badge className="mt-2 bg-emerald-500/15 text-emerald-300" variant="outline">
              Feedback sent
            </Badge>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="font-heading text-3xl font-bold tracking-tight text-white">The whole teaching loop</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="rounded-2xl border border-white/10 bg-[#111827] p-6 transition-transform duration-200 hover:-translate-y-0.5"
              data-testid="home-feature-card"
            >
              <f.icon className="size-6 text-primary" />
              <h3 className="mt-4 font-heading text-lg font-bold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 text-xs text-slate-500">
          <span>AstraLearn — live learning platform</span>
          <span className="font-mono uppercase tracking-wider">Exams · Homework · Chat · Subscriptions</span>
        </div>
      </footer>
    </div>
  );
}
