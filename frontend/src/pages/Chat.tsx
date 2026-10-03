import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MessageSquarePlus, Send } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errMessage, fmtDateTime } from "@/lib/format";
import type { ConversationItem, Message, UserCard } from "@/lib/types";

function ChatInner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);

  const { data: convs } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => apiGet<ConversationItem[]>("/chat/conversations"),
    refetchInterval: 5_000,
  });
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiGet<UserCard[]>("/users"),
    refetchInterval: 10_000,
  });
  const { data: messages } = useQuery({
    queryKey: ["messages", selectedId],
    queryFn: () => apiGet<Message[]>(`/chat/conversations/${selectedId}/messages`),
    enabled: !!selectedId,
    refetchInterval: 3_000,
  });

  const send = useMutation({
    mutationFn: (payload: { convId: string; text: string }) =>
      apiPost<Message>(`/chat/conversations/${payload.convId}/messages`, { text: payload.text }),
    onSuccess: () => {
      setText("");
      void qc.invalidateQueries({ queryKey: ["messages", selectedId] });
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err) => toast.error(errMessage(err)),
  });

  const startDm = useMutation({
    mutationFn: (otherId: string) =>
      apiPost<ConversationItem>("/chat/conversations", { type: "dm", member_ids: [otherId] }),
    onSuccess: (conv) => {
      void qc.invalidateQueries({ queryKey: ["conversations"] });
      setSelectedId(conv.id);
    },
    onError: (err) => toast.error(errMessage(err)),
  });

  const createGroup = useMutation({
    mutationFn: () =>
      apiPost<ConversationItem>("/chat/conversations", {
        type: "group",
        name: groupName,
        member_ids: memberIds,
      }),
    onSuccess: (conv) => {
      toast.success("Channel created");
      void qc.invalidateQueries({ queryKey: ["conversations"] });
      setGroupOpen(false);
      setGroupName("");
      setMemberIds([]);
      setSelectedId(conv.id);
    },
    onError: (err) => toast.error(errMessage(err)),
  });

  const selected = convs?.find((c) => c.id === selectedId) ?? null;
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, selectedId]);

  const doSend = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim() && selectedId) send.mutate({ convId: selectedId, text });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Chat</h1>
        <p className="mt-1 text-sm text-muted-foreground">Direct lines and cohort channels — presence updates live.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Tabs defaultValue="channels">
          <TabsList className="w-full">
            <TabsTrigger value="channels" className="flex-1" data-testid="chat-channels-tab">Channels</TabsTrigger>
            <TabsTrigger value="people" className="flex-1" data-testid="chat-people-tab">People</TabsTrigger>
          </TabsList>

          <TabsContent value="channels" className="mt-3 space-y-1.5">
            <Button variant="outline" size="sm" className="w-full" data-testid="chat-new-group-btn" onClick={() => setGroupOpen(true)}>
              <MessageSquarePlus className="mr-2 size-4" /> New group
            </Button>
            {(convs ?? []).map((c) => {
              const other = c.type === "dm" ? c.members.find((m) => m.id !== user?.id) : null;
              return (
                <button
                  key={c.id}
                  data-testid="chat-channel-item"
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors duration-150 ${
                    selectedId === c.id ? "border-primary/50 bg-primary/10" : "border-border hover:bg-accent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-200">
                      {other?.online ? (
                        <span className="size-2 shrink-0 rounded-full bg-emerald-500" data-testid="chat-online-dot" />
                      ) : null}
                      <span className="truncate">{c.name}</span>
                    </span>
                    {c.unread > 0 ? (
                      <Badge className="bg-primary text-primary-foreground" data-testid="chat-unread-badge">
                        {c.unread}
                      </Badge>
                    ) : null}
                  </div>
                  {c.last_message ? (
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {c.last_message.sender_name}: {c.last_message.text}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </TabsContent>

          <TabsContent value="people" className="mt-3 space-y-1.5">
            {(users ?? [])
              .filter((u) => u.id !== user?.id)
              .map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2" data-testid="chat-person-row">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <span className={`size-2 shrink-0 rounded-full ${u.online ? "bg-emerald-500" : "bg-slate-600"}`} data-testid="chat-presence-dot" />
                    <span className="truncate text-slate-200">{u.name}</span>
                    <Badge variant="outline" className="border-border text-[10px] capitalize text-slate-500">{u.role}</Badge>
                  </span>
                  <Button variant="ghost" size="xs" data-testid="chat-dm-user-btn" onClick={() => startDm.mutate(u.id)}>
                    Message
                  </Button>
                </div>
              ))}
          </TabsContent>
        </Tabs>

        <div className="flex h-[70vh] flex-col rounded-xl border border-border bg-card" data-testid="chat-thread">
          {selected ? (
            <>
              <div className="border-b border-border px-4 py-3">
                <p className="font-heading font-bold">{selected.name}</p>
                <p className="text-xs text-muted-foreground">{selected.members.length} members</p>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4" data-testid="chat-message-list">
                {(messages ?? []).map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`} data-testid="chat-message-bubble">
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${mine ? "bg-blue-600 text-white" : "bg-[#1f2937] text-slate-200"}`}>
                        {!mine ? <p className="text-[11px] font-medium text-slate-400">{m.sender_name}</p> : null}
                        <p>{m.text}</p>
                        <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-blue-200" : "text-slate-500"}`}>
                          {fmtDateTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <form className="flex gap-2 border-t border-border p-3" onSubmit={doSend}>
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Message…"
                  data-testid="chat-message-input"
                />
                <Button type="submit" size="icon" disabled={!text.trim() || send.isPending} data-testid="chat-send-message-btn">
                  {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Pick a channel or open a direct message from the People tab.
            </div>
          )}
        </div>
      </div>

      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent className="max-w-md" data-testid="chat-group-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">New group channel</DialogTitle>
            <DialogDescription>Members see it instantly — presence dots included.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Channel name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              data-testid="chat-group-name-input"
            />
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {(users ?? [])
                .filter((u) => u.id !== user?.id)
                .map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    data-testid={`chat-member-check-${u.id}`}
                  >
                    <Checkbox
                      checked={memberIds.includes(u.id)}
                      onCheckedChange={(v) =>
                        setMemberIds((ids) => (v ? [...ids, u.id] : ids.filter((x) => x !== u.id)))
                      }
                    />
                    {u.name} <span className="text-xs text-slate-500">({u.role})</span>
                  </label>
                ))}
            </div>
            <Button
              className="w-full"
              disabled={!groupName.trim() || createGroup.isPending}
              onClick={() => createGroup.mutate()}
              data-testid="chat-group-create-btn"
            >
              {createGroup.isPending ? <Loader2 className="size-4 animate-spin" /> : "Create channel"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Chat() {
  return (
    <AppShell>
      <ChatInner />
    </AppShell>
  );
}
