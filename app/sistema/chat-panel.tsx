"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChatMessage, WorkspaceData } from "../domain";
import { markOnlineMessagesRead, sendOnlineMessage } from "../lib/supabase";

type ChatAudience = "professional" | "client";

export function unreadMessages(messages: ChatMessage[]) {
  return messages.filter((message) => !message.mine && !message.readAt).length;
}

export function MessageNotification({ count, onClick }: { count: number; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="relative grid h-11 w-11 place-items-center rounded-xl border border-[#dce6e1] bg-white text-lg text-[#2f7d70]" aria-label={count ? `${count} mensagem(ns) não lida(s)` : "Abrir mensagens"} title="Mensagens"><span aria-hidden="true">✉</span>{count > 0 && <span className="message-notification-badge absolute -right-1 -top-1 min-w-5 rounded-full bg-[#b54134] px-1.5 py-0.5 text-center text-[10px] font-black leading-4 text-white">{count > 99 ? "99+" : count}</span>}</button>;
}

export function ChatPanel({ data, messages, setMessages, online, audience }: { data: WorkspaceData; messages: ChatMessage[]; setMessages: (messages: ChatMessage[]) => void; online: boolean; audience: ChatAudience }) {
  const availableClients = useMemo(() => audience === "professional" ? data.clients.filter((client) => Boolean(client.userId)) : data.clients, [audience, data.clients]);
  const [selectedClientId, setSelectedClientId] = useState(availableClients[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const selectedClient = availableClients.find((client) => client.id === selectedClientId) ?? availableClients[0];
  const conversation = messages.filter((message) => message.clientId === selectedClient?.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const selectedUnreadKey = messages.filter((message) => message.clientId === selectedClient?.id && !message.mine && !message.readAt).map((message) => message.id).join(",");

  useEffect(() => {
    if (selectedClientId && availableClients.some((client) => client.id === selectedClientId)) return;
    setSelectedClientId(availableClients[0]?.id ?? "");
  }, [availableClients, selectedClientId]);

  useEffect(() => {
    if (!selectedClient) return;
    const unread = messages.filter((message) => message.clientId === selectedClient.id && !message.mine && !message.readAt);
    if (!unread.length) return;
    const readAt = new Date().toISOString();
    setMessages(messages.map((message) => unread.some((item) => item.id === message.id) ? { ...message, readAt } : message));
    if (online) void markOnlineMessagesRead(selectedClient.tenantId, selectedClient.id).catch(() => setNotice("Não foi possível confirmar a leitura agora."));
  }, [online, selectedClient?.id, selectedUnreadKey]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedClient || !draft.trim() || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const message = online
        ? await sendOnlineMessage(selectedClient.tenantId, selectedClient.id, draft)
        : { id: crypto.randomUUID(), tenantId: selectedClient.tenantId, clientId: selectedClient.id, senderUserId: "local", body: draft.trim(), createdAt: new Date().toISOString(), readAt: null, mine: true } satisfies ChatMessage;
      setMessages([...messages, message]);
      setDraft("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível enviar a mensagem.");
    } finally {
      setBusy(false);
    }
  };

  if (!availableClients.length) return <section className="card p-6"><p className="eyebrow">Mensagens internas</p><h2 className="mt-1 text-xl font-extrabold">Nenhuma conversa disponível</h2><p className="mt-3 text-sm leading-6 text-[#687570]">{audience === "professional" ? "O chat será liberado quando um cliente estiver vinculado a uma conta de acesso." : "Seu perfil ainda não está vinculado ao cadastro de um profissional."}</p></section>;

  return <section className="card overflow-hidden" aria-label="Mensagens internas"><div className="border-b border-[#e3eae6] p-5"><p className="eyebrow">Mensagens internas</p><div className="mt-1 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><h2 className="text-xl font-extrabold">Conversa segura</h2>{availableClients.length > 1 && <label className="text-xs font-bold text-[#66736e]">Conversa<select className="input mt-1 min-w-56" value={selectedClient?.id ?? ""} onChange={(event) => setSelectedClientId(event.target.value)}>{availableClients.map((client) => <option key={client.id} value={client.id}>{audience === "professional" ? client.name : client.businessName ?? "Profissional vinculado"}</option>)}</select></label>}</div></div><div className="chat-conversation-surface max-h-[430px] min-h-64 space-y-3 overflow-y-auto bg-[#f5f8f6] p-4 sm:p-5" aria-live="polite">{conversation.length ? conversation.map((message) => <article key={message.id} className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.mine ? "ml-auto bg-[#2f7d70] text-white" : "border border-[#dfe8e3] bg-white text-[#33453f]"}`}><p className="whitespace-pre-wrap break-words leading-6">{message.body}</p><p className={`mt-1 text-[10px] ${message.mine ? "chat-message-meta-mine text-white" : "text-[#78857f]"}`}>{message.mine ? "Você" : audience === "professional" ? selectedClient?.name : selectedClient?.businessName ?? "Profissional"} • {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(message.createdAt))}{message.mine && message.readAt ? " • Lida" : ""}</p></article>) : <div className="grid min-h-56 place-items-center text-center"><div><span className="text-3xl" aria-hidden="true">✉</span><h3 className="mt-3 font-extrabold">Comece a conversa</h3><p className="mt-1 text-sm text-[#6d7975]">As mensagens ficam disponíveis somente para o cliente vinculado e o negócio.</p></div></div>}</div><form className="border-t border-[#e3eae6] p-4 sm:p-5" onSubmit={submit}><label className="sr-only" htmlFor={`chat-message-${audience}`}>Digite sua mensagem</label><div className="flex items-end gap-2"><textarea id={`chat-message-${audience}`} className="input min-h-12 resize-none" rows={2} maxLength={2000} placeholder="Digite sua mensagem…" value={draft} onChange={(event) => setDraft(event.target.value)} required/><button className="btn btn-primary min-w-24" disabled={busy || !draft.trim()}>{busy ? "Enviando…" : "Enviar"}</button></div><div className="mt-2 flex justify-between gap-3 text-xs text-[#75817d]"><span>{notice || "Não compartilhe senhas, códigos ou dados de pagamento."}</span><span>{draft.length}/2000</span></div></form></section>;
}
