import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, CreditCard, Loader2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import { usePlans } from "@/components/PaywallModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errMessage, fmtDate, planLabel } from "@/lib/format";
import type { CheckoutResponse, Transaction } from "@/lib/types";

function SubscriptionInner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: plans } = usePlans();
  const { data: transactions } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => apiGet<Transaction[]>("/payments/transactions"),
  });

  const checkout = useMutation({
    mutationFn: (lookupKey: string) =>
      apiPost<CheckoutResponse>("/payments/checkout", { lookup_key: lookupKey }),
    onSuccess: (res) => {
      toast.success(`${res.plan_name} activated`, {
        description: "Test-mode billing — no real charge. Unlocked for 30 days.",
      });
      void qc.invalidateQueries();
    },
    onError: (err) => toast.error(errMessage(err)),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Homework, live exams and grading need an active plan. Test mode — no real charge.
        </p>
      </div>

      <Card data-testid="current-plan-card">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-slate-400">Current plan</p>
            <p className="mt-1 font-heading text-2xl font-bold" data-testid="current-plan-name">
              {planLabel(user?.plan ?? "free")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="current-plan-status">
              {user?.subscribed
                ? `Active until ${fmtDate(user?.subscription_end)}`
                : "Not subscribed — unlock the desk below"}
            </p>
          </div>
          <CreditCard className="size-8 text-primary" />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {(plans ?? []).map((plan) => {
          const mine = plan.role === user?.role;
          const active = user?.plan === plan.plan_id && user?.subscribed;
          return (
            <Card
              key={plan.lookup_key}
              data-testid="subscription-tier-card"
              className={`transition-transform duration-200 hover:-translate-y-0.5 ${mine ? "border-primary/60" : ""}`}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <span className="font-heading text-lg font-bold">{plan.name}</span>
                  {active ? (
                    <Badge className="border-emerald-500/40 text-emerald-300" variant="outline" data-testid="plan-active-badge">
                      Active
                    </Badge>
                  ) : mine ? (
                    <Badge className="bg-primary text-primary-foreground">For you</Badge>
                  ) : (
                    <Badge variant="outline" className="border-border text-slate-500">For {plan.role}s</Badge>
                  )}
                </div>
                <div className="mt-2 font-heading text-3xl font-bold">
                  ${plan.amount}
                  <span className="text-sm font-normal text-muted-foreground">/{plan.interval}</span>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-5 w-full"
                  disabled={!mine || checkout.isPending}
                  data-testid="subscription-checkout-btn"
                  onClick={() => checkout.mutate(plan.lookup_key)}
                >
                  {checkout.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : active ? (
                    "Extend 30 days"
                  ) : (
                    `Subscribe — $${plan.amount}/mo`
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card data-testid="transactions-table">
        <CardContent className="p-0">
          <div className="border-b border-border px-6 py-4">
            <p className="font-mono text-xs uppercase tracking-wider text-slate-400">Billing history</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(transactions ?? []).map((t) => (
                <TableRow key={t.session_id} data-testid="transaction-row">
                  <TableCell className="text-xs text-slate-400">{fmtDate(t.created_at)}</TableCell>
                  <TableCell className="text-slate-200">{t.plan_name}</TableCell>
                  <TableCell className="font-mono text-slate-300">
                    ${t.amount.toFixed(2)} {t.currency.toUpperCase()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
                      {t.payment_status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {(transactions ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    No payments yet.
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

export default function Subscription() {
  return (
    <AppShell>
      <SubscriptionInner />
    </AppShell>
  );
}
