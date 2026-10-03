// Shared formatting + error-message helpers.
import { format, formatDistanceToNow } from "date-fns";
import { ApiError } from "@/lib/api";

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "MMM d, HH:mm");
  } catch {
    return iso;
  }
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return `${formatDistanceToNow(new Date(iso))} ago`;
  } catch {
    return "—";
  }
}

export function planLabel(plan: string): string {
  if (plan === "student_pro") return "Student Pro";
  if (plan === "teacher_pro") return "Teacher Pro";
  return "Free";
}

export function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function errMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { detail?: unknown } | null;
    if (body && typeof body.detail === "string") return body.detail;
    return err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong";
}

// The backend signals "needs an active subscription" with HTTP 402.
export function isPaywallError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 402;
}
