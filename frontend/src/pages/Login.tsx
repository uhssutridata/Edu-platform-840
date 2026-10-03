import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin } from "@/lib/auth";
import { errMessage } from "@/lib/format";

const DEMOS = [
  { role: "admin", label: "Admin", email: "admin@lms.com", password: "admin123" },
  { role: "teacher", label: "Teacher", email: "teacher@lms.com", password: "teacher123" },
  { role: "student", label: "Student", email: "student@lms.com", password: "student123" },
];

export default function Login() {
  const [params] = useSearchParams();
  const prefill = DEMOS.find((d) => d.role === params.get("demo"));
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [password, setPassword] = useState(prefill?.password ?? "");
  const login = useLogin();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate(
      { email, password },
      { onError: (err) => toast.error("Sign in failed", { description: errMessage(err) }) },
    );
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0d1527] p-10 lg:flex">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(11,15,25,0.95) 0%, rgba(15,23,42,0.85) 100%), url('https://images.unsplash.com/photo-1522202176988-66273c2fd55f?crop=entropy&cs=srgb&fm=jpg&q=85') center/cover",
          }}
        />
        <div className="relative">
          <Link to="/" className="flex items-center gap-2.5" data-testid="login-brand-link">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="size-5" />
            </span>
            <span className="font-heading text-xl font-bold tracking-tight">AstraLearn</span>
          </Link>
        </div>
        <div className="relative max-w-md">
          <h1 className="font-heading text-4xl font-bold tracking-tight text-white">
            One classroom.<br />One clock.<br />Zero excuses.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            Synchronized live exams, PDF homework grading, animated tutorials and real-time chat — the whole
            teaching loop in one command center.
          </p>
          <div className="mt-8 space-y-2">
            <p className="font-mono text-xs uppercase tracking-wider text-slate-400">Demo accounts</p>
            {DEMOS.map((d) => (
              <button
                key={d.role}
                data-testid={`demo-login-${d.role}-btn`}
                onClick={() => {
                  setEmail(d.email);
                  setPassword(d.password);
                }}
                className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-black/50"
              >
                <span className="font-medium text-slate-200">{d.label}</span>
                <span className="font-mono text-xs text-slate-400">
                  {d.email} · {d.password}
                </span>
              </button>
            ))}
          </div>
        </div>
        <p className="relative font-mono text-xs uppercase tracking-wider text-slate-500">
          Live exam radar · Homework desk · Chat
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md" size="default">
          <CardHeader>
            <CardTitle className="font-heading text-2xl font-bold tracking-tight" data-testid="login-title">
              Sign in
            </CardTitle>
            <CardDescription>Students, teachers and admins share one door.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4" data-testid="login-form">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                  data-testid="login-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  data-testid="login-password-input"
                />
              </div>
              <Button type="submit" className="w-full" disabled={login.isPending} data-testid="login-submit-btn">
                {login.isPending ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              New here?{" "}
              <Link to="/register" className="text-primary hover:underline" data-testid="login-to-register-link">
                Create an account
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
