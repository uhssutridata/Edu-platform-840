// Session helpers over the ["me"] query — the httpOnly cookie is the source of truth.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "@/lib/api";
import type { UserPublic } from "@/lib/types";

export function useAuth() {
  const query = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<UserPublic>("/auth/me"),
    retry: false,
    staleTime: 30_000,
  });
  return { user: query.data ?? null, isLoading: query.isLoading };
}

export function useLogin() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      apiPost<UserPublic>("/auth/login", body),
    onSuccess: (user) => {
      qc.setQueryData(["me"], user);
      void qc.invalidateQueries();
      navigate("/dashboard");
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (body: { name: string; email: string; password: string; role: string }) =>
      apiPost<UserPublic>("/auth/register", body),
    onSuccess: (user) => {
      qc.setQueryData(["me"], user);
      void qc.invalidateQueries();
      navigate("/dashboard");
    },
  });
}

// Route every sign-out through here: qc.clear() wipes the cached data so the next
// login on this browser never renders the previous account's react-query cache.
export function useLogout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => apiPost<{ ok: boolean }>("/auth/logout"),
    onSettled: () => {
      qc.clear();
      navigate("/");
    },
  });
}

// Presence ping — the admin radar reads this to show who is logged in right now.
export function useHeartbeat() {
  return useMutation({
    mutationFn: () => apiPost<{ ok: boolean }>("/auth/heartbeat"),
  });
}
