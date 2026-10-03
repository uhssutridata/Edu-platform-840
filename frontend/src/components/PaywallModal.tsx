import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiGet, apiPost } from "@/lib/api";
import { errMessage } from "@/lib/format";
import type { CheckoutResponse, Plan, Role } from "@/lib/types";

export function usePlans() {
  return useQuery({ queryKey: ["plans"], queryFn: () => apiGet<Plan[]>("/payments/plans") });
}

// The subscription gate barrier: shown whenever a gated action returns HTTP 402.
export default function PaywallModal({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
}) {
  const qc = useQueryClient();
  const { data: plans } = usePlans();
  const checkout = useMutation({
    mutationFn: (lookupKey: string) =>
      apiPost<CheckoutResponse>("/payments/checkout", { lookup_key: lookupKey }),
    onSuccess: (res) => {
      toast.success(`${res.plan_name} activated`, {
        description: "Test-mode billing — no real charge. Everything is unlocked for 30 days.",
      });
      void qc.invalidateQueries();
      onOpenChange(false);
    },
    onError: (err) => toast.error(errMessage(err)),
  });

  const ordered = [...(plans ?? [])].sort((a, b) => (a.role === role ? -1 : 1) - (b.role === role ? -1 : 1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="paywall-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold tracking-tight">
            Unlock the full platform
          </DialogTitle>
          <DialogDescription>
            Homework submissions, live exams and grading live behind the subscription. Test mode — no real
            charge.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {ordered.map((plan) => {
            const mine = plan.role === role;
            return (
              <div
                key={plan.lookup_key}
                data-testid="subscription-tier-card"
                className={`rounded-xl border p-4 transition-transform duration-200 hover:-translate-y-0.5 ${
                  mine ? "border-primary/60 bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-heading font-bold">{plan.name}</span>
                  {mine ? <Badge className="bg-primary text-primary-foreground">For you</Badge> : null}
                </div>
                <div className="mt-2 font-heading text-2xl font-bold">
                  ${plan.amount}
                  <span className="text-sm font-normal text-muted-foreground">/{plan.interval}</span>
                </div>
                <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-4 w-full"
                  disabled={!mine || checkout.isPending}
                  data-testid="subscription-checkout-btn"
                  onClick={() => {
                    if (mine) checkout.mutate(plan.lookup_key);
                  }}
                >
                  {checkout.isPending ? "Processing…" : `Subscribe — $${plan.amount}/mo`}
                </Button>
              </div>
            );
          })}
        </div>
        <p className="text-center font-mono text-[11px] uppercase tracking-wider text-slate-500">
          Test card 4242 4242 4242 4242 · instant activation in this build
        </p>
      </DialogContent>
    </Dialog>
  );
}
