import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDateTime, planLabel, timeAgo } from "@/lib/format";
import type { ActiveSession, UserCard } from "@/lib/types";

function Stat({ label, value, testid }: { label: string; value: number | string; testid: string }) {
  return (
    <Card data-testid={testid}>
      <CardContent className="p-5">
        <p className="font-mono text-xs uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-2 font-heading text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function AdminRadarInner() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: sessions } = useQuery({
    queryKey: ["active-sessions"],
    queryFn: () => apiGet<ActiveSession[]>("/auth/active"),
    refetchInterval: 5_000,
    enabled: isAdmin,
  });
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiGet<UserCard[]>("/users"),
    refetchInterval: 10_000,
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <Card data-testid="admin-forbidden-card">
        <CardContent className="flex flex-col items-center p-10 text-center">
          <ShieldAlert className="size-10 text-amber-400" />
          <p className="mt-4 font-heading text-xl font-bold">Admins only</p>
          <p className="mt-1 text-sm text-muted-foreground">This radar is restricted to the platform admin.</p>
        </CardContent>
      </Card>
    );
  }

  const online = sessions?.filter((s) => s.online).length ?? 0;
  const subscribers = users?.filter((u) => u.subscribed).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Live sessions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who is logged in right now — refreshed every 5 seconds from session heartbeats.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Online now" value={online} testid="admin-stat-online" />
        <Stat label="Registered users" value={users?.length ?? 0} testid="admin-stat-users" />
        <Stat label="Subscribers" value={subscribers} testid="admin-stat-subscribers" />
        <Stat
          label="Students · Teachers"
          value={`${users?.filter((u) => u.role === "student").length ?? 0} · ${users?.filter((u) => u.role === "teacher").length ?? 0}`}
          testid="admin-stat-roles"
        />
      </div>

      <Card data-testid="admin-active-users-table">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead>Session start</TableHead>
                <TableHead className="hidden xl:table-cell">Device</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sessions ?? []).map((s) => (
                <TableRow key={s.session_id} data-testid="admin-user-row">
                  <TableCell>
                    <div className="font-medium text-slate-200">{s.user.name}</div>
                    <div className="text-xs text-slate-500">{s.user.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-border capitalize text-slate-300">{s.user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      data-testid="admin-user-sub-badge"
                      className={
                        s.user.subscribed
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          : "border-border text-slate-400"
                      }
                    >
                      {planLabel(s.user.plan)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {s.online ? (
                      <span className="flex items-center gap-2 text-xs text-emerald-400" data-testid="admin-user-online-ping">
                        <span className="relative flex size-2">
                          <span className="absolute inline-flex size-2 rounded-full bg-emerald-400 opacity-70 animate-presence-ping" />
                          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                        </span>
                        Online
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">Away</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">{timeAgo(s.last_active)}</TableCell>
                  <TableCell className="text-xs text-slate-400">{fmtDateTime(s.login_at)}</TableCell>
                  <TableCell className="hidden max-w-40 truncate text-xs text-slate-500 xl:table-cell">
                    {s.user_agent || "—"}
                  </TableCell>
                </TableRow>
              ))}
              {(sessions ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No sessions yet — sign in from another browser to see the radar fill up.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminRadar() {
  return (
    <AppShell>
      <AdminRadarInner />
    </AppShell>
  );
}
