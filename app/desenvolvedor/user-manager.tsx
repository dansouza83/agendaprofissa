"use client";

import { useMemo, useState } from "react";

type AccountType = "professional" | "client";
type ManagedUser = {
  id: string;
  email: string;
  fullName: string;
  accountType: AccountType;
  business: string | null;
  role: string | null;
  createdAt: string;
  emailConfirmed: boolean;
  suspended: boolean;
  subscription: "active" | "pending" | null;
};
type Business = { id: string; name: string; slug: string };
export type UserDirectory = { users: ManagedUser[]; businesses: Business[] };
type Request = (path: string, method?: string, body?: unknown) => Promise<unknown>;

const blank = { fullName: "", email: "", password: "", accountType: "professional" as AccountType, businessName: "", tenantId: "", phone: "" };

export function UserManager({ directory, request, refresh, busy, setBusy, report }: { directory: UserDirectory | null; request: Request; refresh: () => Promise<void>; busy: boolean; setBusy: (value: boolean) => void; report: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | AccountType>("all");
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(blank);
  const users = useMemo(() => (directory?.users ?? []).filter((user) => {
    const matchesText = `${user.fullName} ${user.email} ${user.business ?? ""}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"));
    return matchesText && (filter === "all" || user.accountType === filter);
  }), [directory, filter, query]);
  const set = <K extends keyof typeof blank>(key: K, value: typeof blank[K]) => setForm((current) => ({ ...current, [key]: value }));
  const close = () => { setEditing(null); setCreating(false); setForm(blank); };
  const startCreate = () => { setEditing(null); setCreating(true); setForm(blank); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    report("");
    try {
      if (editing) {
        await request("/api/developer/users", "POST", { action: "update", userId: editing.id, fullName: form.fullName, email: form.email, password: form.password });
        report("Dados da conta atualizados.");
      } else {
        await request("/api/developer/users", "POST", { action: "create", ...form });
        report("Conta criada e e-mail confirmado pelo administrador.");
      }
      close();
      await refresh();
    } catch (error) {
      report(error instanceof Error ? error.message : "Não foi possível salvar a conta.");
    } finally {
      setBusy(false);
    }
  };
  const changeSuspension = async (user: ManagedUser) => {
    setBusy(true);
    report("");
    try {
      await request("/api/developer/users", "POST", { action: "suspend", userId: user.id, suspended: !user.suspended });
      report(user.suspended ? "Conta reativada." : "Conta suspensa. Novos acessos foram bloqueados.");
      await refresh();
    } catch (error) {
      report(error instanceof Error ? error.message : "Não foi possível alterar o acesso.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (user: ManagedUser) => {
    if (!window.confirm(`Excluir permanentemente a conta de ${user.fullName}? Esta ação não pode ser desfeita.`)) return;
    setBusy(true);
    report("");
    try {
      await request("/api/developer/users", "POST", { action: "delete", userId: user.id });
      report("Conta removida com segurança.");
      await refresh();
    } catch (error) {
      report(error instanceof Error ? error.message : "Não foi possível excluir a conta.");
    } finally {
      setBusy(false);
    }
  };
  const startEdit = (user: ManagedUser) => {
    setEditing(user);
    setCreating(false);
    setForm({ fullName: user.fullName, email: user.email, password: "", accountType: user.accountType, businessName: user.business ?? "", tenantId: "", phone: "" });
  };

  if (!directory) return <section className="card mt-6 p-6"><p className="eyebrow">Administração de contas</p><p className="mt-3 text-sm text-[#a7bbb3]">Carregando usuários cadastrados…</p></section>;
  return <section className="card mt-6 p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow">Administração de contas</p><h2 className="mt-1 text-xl font-extrabold">Usuários cadastrados</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#a7bbb3]">Crie e atualize contas, suspenda acessos e remova usuários comuns. A exclusão de proprietário de negócio exige uma decisão separada para preservar clientes e agenda.</p></div><button type="button" className="btn btn-primary" onClick={startCreate}>+ Adicionar usuário</button></div>
    <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]"><label className="label">Buscar por nome, e-mail ou negócio<input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: Marina ou Studio Aurora"/></label><label className="label">Tipo<select className="input min-w-40" value={filter} onChange={(event) => setFilter(event.target.value as "all" | AccountType)}><option value="all">Todos</option><option value="professional">Profissionais</option><option value="client">Alunos e clientes</option></select></label></div>
    {(editing || creating) ? <form className="mt-6 rounded-2xl border border-[#386151] bg-[#10241d] p-5" onSubmit={submit}><div className="flex items-start justify-between gap-4"><div><h3 className="font-extrabold">{editing ? "Editar conta" : "Nova conta"}</h3><p className="mt-1 text-xs text-[#a7bbb3]">{editing ? "A senha é opcional: preencha apenas para redefini-la." : "A conta será criada com o e-mail já confirmado."}</p></div><button type="button" className="text-sm font-bold text-[#a9ddcf]" onClick={close}>Cancelar</button></div><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="label">Nome completo<input className="input" value={form.fullName} onChange={(event) => set("fullName", event.target.value)} required/></label><label className="label">E-mail<input className="input" type="email" value={form.email} onChange={(event) => set("email", event.target.value)} required/></label><label className="label">{editing ? "Nova senha (opcional)" : "Senha temporária"}<input className="input" type="password" minLength={8} value={form.password} onChange={(event) => set("password", event.target.value)} autoComplete="new-password" required={!editing}/></label>{!editing && <label className="label">Tipo de conta<select className="input" value={form.accountType} onChange={(event) => set("accountType", event.target.value as AccountType)}><option value="professional">Profissional</option><option value="client">Aluno ou cliente</option></select></label>}{!editing && form.accountType === "professional" && <label className="label md:col-span-2">Nome do negócio<input className="input" value={form.businessName} onChange={(event) => set("businessName", event.target.value)} required/></label>}{!editing && form.accountType === "client" && <><label className="label">Vincular ao negócio (opcional)<select className="input" value={form.tenantId} onChange={(event) => set("tenantId", event.target.value)}><option value="">Criar sem vínculo</option>{directory.businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label><label className="label">Telefone (opcional)<input className="input" value={form.phone} onChange={(event) => set("phone", event.target.value)}/></label></>}</div><button className="btn btn-primary mt-5" disabled={busy}>{busy ? "Salvando…" : editing ? "Salvar alterações" : "Criar conta"}</button></form> : <button type="button" className="btn btn-secondary mt-6" onClick={startCreate}>Adicionar primeira conta</button>}
    <div className="mt-6 grid gap-3">{users.map((user) => <article key={user.id} className="rounded-2xl border border-[#29443a] bg-[#0c1b15] p-4"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-extrabold">{user.fullName}</h3><span className={`status ${user.suspended ? "cancelado" : "confirmado"}`}>{user.suspended ? "Suspensa" : "Ativa"}</span>{user.subscription === "active" && <span className="status confirmado">Assinatura ativa</span>}</div><p className="mt-1 truncate text-sm text-[#a7bbb3]">{user.email}</p><p className="mt-2 text-xs text-[#8ca89d]">{user.accountType === "professional" ? `Profissional${user.business ? ` • ${user.business}` : ""}` : `Aluno/cliente${user.business ? ` • ${user.business}` : " sem vínculo"}`} {user.role ? ` • ${user.role}` : ""}</p></div><div className="flex flex-wrap gap-2"><button type="button" className="btn btn-secondary !px-3 !py-2 text-xs" disabled={busy || user.email === "dansouzafloripa@gmail.com"} onClick={() => startEdit(user)}>Editar</button><button type="button" className="btn btn-secondary !px-3 !py-2 text-xs" disabled={busy || user.email === "dansouzafloripa@gmail.com"} onClick={() => void changeSuspension(user)}>{user.suspended ? "Reativar" : "Suspender"}</button><button type="button" className="rounded-xl border border-red-900/70 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-950/40 disabled:opacity-50" disabled={busy || user.email === "dansouzafloripa@gmail.com"} onClick={() => void remove(user)}>Excluir</button></div></div></article>)}{directory && !users.length && <p className="rounded-xl bg-[#152b23] p-5 text-sm text-[#a7bbb3]">Nenhuma conta encontrada para este filtro.</p>}</div>
  </section>;
}
