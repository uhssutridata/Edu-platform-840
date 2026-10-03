import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BookOpen, GraduationCap, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRegister } from "@/lib/auth";
import { errMessage } from "@/lib/format";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const register = useRegister();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    register.mutate(
      { name, email, password, role },
      {
        onError: (err) => {
          const desc = errMessage(err);
          const detail = (err as { body?: { detail?: unknown } }).body?.detail;
          toast.error("Registration failed", {
            description: typeof detail === "string" ? detail : desc,
          });
        },
      },
    );
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-center overflow-hidden bg-[#0d1527] p-10 lg:flex">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(11,15,25,0.95) 0%, rgba(15,23,42,0.85) 100%), url('https://images.unsplash.com/photo-1610484826967-09c5720778c7?crop=entropy&cs=srgb&fm=jpg&q=85') center/cover",
          }}
        />
        <div className="relative max-w-md">
          <span className="font-mono text-xs uppercase tracking-wider text-slate-400">Join AstraLearn</span>
          <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight text-white">
            Your whole class, on the same clock.
          </h1>
          <ul className="mt-8 space-y-4 text-sm text-slate-300">
            <li className="flex gap-3">
              <BookOpen className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <strong className="text-slate-100">Students</strong> — upload PDF homework, take synchronized
                live exams, watch animated tutorials.
              </span>
            </li>
            <li className="flex gap-3">
              <Users className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <strong className="text-slate-100">Teachers</strong> — schedule exams for the entire cohort,
                grade submissions with feedback, run group channels.
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="font-heading text-2xl font-bold tracking-tight" data-testid="register-title">
              Create account
            </CardTitle>
            <CardDescription>Pick your role — it decides your desk.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4" data-testid="register-form">
              <div className="grid grid-cols-2 gap-2" data-testid="register-role-group">
                <Button
                  type="button"
                  variant="outline"
                  data-testid="register-role-student-btn"
                  onClick={() => setRole("student")}
                  className={role === "student" ? "border-primary bg-primary/10 text-primary-foreground" : ""}
                >
                  <GraduationCap className="mr-2 size-4" /> Student
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  data-testid="register-role-teacher-btn"
                  onClick={() => setRole("teacher")}
                  className={role === "teacher" ? "border-primary bg-primary/10 text-primary-foreground" : ""}
                >
                  <Users className="mr-2 size-4" /> Teacher
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jordan Lee"
                  data-testid="register-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                  data-testid="register-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  data-testid="register-password-input"
                />
              </div>
              <Button type="submit" className="w-full" disabled={register.isPending} data-testid="register-submit-btn">
                {register.isPending ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline" data-testid="register-to-login-link">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
