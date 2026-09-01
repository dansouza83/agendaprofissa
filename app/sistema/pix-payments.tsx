"use client";

import { useState } from "react";
import type { Appointment, Client, PaymentSubmission, Service, TenantPaymentSettings, WorkspaceData } from "../domain";
import { onlinePaymentReceiptUrl, saveOnlinePixKey, uploadOnlinePixReceipt } from "../lib/supabase";

const brl = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const receiptAccept = "image/jpeg,image/png,image/webp,application/pdf";

function latestSubmission(submissions: PaymentSubmission[], appointmentId: string) {
  return submissions.filter((item) => item.appointmentId === appointmentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export function ClientPixPayment({
  appointment,
  client,
  service,
  settings,
  submissions,
  online,
  onSubmitted,
}: {
  appointment: Appointment;
  client: Client;
  service?: Service;
  settings?: TenantPaymentSettings;
  submissions: PaymentSubmission[];
  online: boolean;
  onSubmitted: (submission: PaymentSubmission) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const submission = latestSubmission(submissions, appointment.id);

  if (appointment.paymentStatus === "paid") {
    return <div className="border-t border-[#e3ebe7] bg-[#eef8f3] px-5 py-4 text-sm text-[#176b55]">
      <b>✓ Pagamento confirmado pelo profissional</b>
      <p className="mt-1 text-xs text-[#416d61]">O horário está reservado e a confirmação foi enviada nas notificações.</p>
    </div>;
  }

  if (submission?.status === "submitted") {
    return <div className="border-t border-[#eee6d5] bg-[#fff8e9] px-5 py-4 text-sm text-[#795300]">
      <b>◷ Comprovante enviado para conferência</b>
      <p className="mt-1 text-xs">{submission.receiptOriginalName} • aguarde a confirmação manual do profissional.</p>
    </div>;
  }

  if (!settings?.pixKey) {
    return <div className="border-t border-[#e6ebe8] bg-[#f7f9f8] px-5 py-4 text-sm text-[#596a64]">
      O profissional ainda não cadastrou uma chave PIX para este atendimento.
    </div>;
  }

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(settings.pixKey);
      setMessage("Chave PIX copiada.");
    } catch {
      setMessage("Selecione e copie a chave PIX exibida.");
    }
  };

  const submit = async () => {
    if (!file) {
      setMessage("Escolha a imagem ou o PDF do comprovante.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const created = online
        ? await uploadOnlinePixReceipt(appointment, client.id, file)
        : {
            id: crypto.randomUUID(), tenantId: appointment.tenantId, appointmentId: appointment.id, clientId: client.id,
            paymentMethod: "pix" as const, receiptPath: `local:${file.name}`, receiptOriginalName: file.name,
            receiptContentType: file.type as PaymentSubmission["receiptContentType"], receiptSizeBytes: file.size,
            status: "submitted" as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          };
      onSubmitted(created);
      setFile(null);
      setMessage("Comprovante enviado. O profissional foi notificado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar o comprovante.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="border-t border-[#e3ebe7] bg-[#f7fbf9] px-5 py-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#2f7d70]">Pagamento direto ao profissional</p>
        <p className="mt-1 text-sm text-[#52665f]">Valor do serviço: <b>{brl(service?.price ?? 0)}</b></p>
      </div>
      <span className="rounded-full bg-[#e2f2eb] px-3 py-1 text-xs font-extrabold text-[#176b55]">PIX</span>
    </div>
    <label htmlFor={`pix-key-${appointment.id}`} className="mt-3 block text-xs font-bold text-[#41564f]">Chave PIX do profissional</label>
    <div className="mt-1 flex flex-col gap-2 sm:flex-row">
      <input id={`pix-key-${appointment.id}`} className="input min-w-0 flex-1" value={settings.pixKey} readOnly aria-label="Chave PIX do profissional" />
      <button type="button" className="btn btn-secondary" onClick={() => void copyKey()}>Copiar chave</button>
    </div>
    <label htmlFor={`pix-receipt-${appointment.id}`} className="mt-3 block text-xs font-bold text-[#41564f]">Comprovante (JPG, PNG, WebP ou PDF, até 5 MB)</label>
    <input id={`pix-receipt-${appointment.id}`} className="input mt-1 w-full file:mr-3 file:rounded-lg file:border-0 file:bg-[#e4f2ec] file:px-3 file:py-2 file:font-bold file:text-[#24685d]" type="file" accept={receiptAccept} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
    <button type="button" className="btn btn-primary mt-3 w-full" disabled={busy || !file} onClick={() => void submit()}>{busy ? "Enviando com segurança…" : "Enviar comprovante PIX"}</button>
    <p className="mt-2 text-[11px] leading-5 text-[#66776f]">O Agenda Profissa não recebe nem retém o valor. O PIX é pago diretamente ao profissional, que confere o comprovante e confirma manualmente.</p>
    {message && <p className="mt-2 rounded-lg bg-white p-2 text-xs font-semibold text-[#315f54]" role="status">{message}</p>}
  </div>;
}

export function ProfessionalPixManagement({
  data,
  tenantId,
  online,
  onData,
  onRefresh,
  onConfirm,
  notify,
}: {
  data: WorkspaceData;
  tenantId: string;
  online: boolean;
  onData: (data: WorkspaceData) => void;
  onRefresh: () => Promise<void>;
  onConfirm: (appointmentId: string) => void;
  notify: (message: string) => void;
}) {
  const savedKey = data.paymentSettings?.find((item) => item.tenantId === tenantId)?.pixKey ?? "";
  const [pixKey, setPixKey] = useState(savedKey);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const submissions = (data.paymentSubmissions ?? []).filter((item) => item.paymentMethod === "pix");

  const save = async () => {
    setSaving(true);
    try {
      if (online) {
        await saveOnlinePixKey(tenantId, pixKey);
        await onRefresh();
      } else {
        const next: TenantPaymentSettings = { tenantId, pixKey: pixKey.trim(), updatedAt: new Date().toISOString() };
        onData({ ...data, paymentSettings: [next, ...(data.paymentSettings ?? []).filter((item) => item.tenantId !== tenantId)] });
      }
      notify(pixKey.trim() ? "Chave PIX salva com segurança." : "Recebimentos PIX desativados.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível salvar a chave PIX.");
    } finally {
      setSaving(false);
    }
  };

  const openReceipt = async (submission: PaymentSubmission) => {
    if (!online) {
      notify("No teste local, o arquivo não é enviado para a nuvem.");
      return;
    }
    setOpening(submission.id);
    try {
      const url = await onlinePaymentReceiptUrl(submission.receiptPath);
      const receiptWindow = window.open(url, "_blank", "noopener,noreferrer");
      if (!receiptWindow) notify("Permita a abertura de uma nova guia para visualizar o comprovante.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível abrir o comprovante.");
    } finally {
      setOpening(null);
    }
  };

  return <section className="card p-6 lg:col-span-2" aria-labelledby="pix-management-title">
    <p className="eyebrow">Recebimentos dos seus clientes</p>
    <h3 id="pix-management-title" className="mt-1 text-xl font-extrabold">Gerenciamento PIX</h3>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5f7069]">Cadastre sua chave para que ela apareça somente aos clientes vinculados a um agendamento. O pagamento vai diretamente para você; o Agenda Profissa não recebe o valor.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <label className="label">Sua chave PIX
        <input className="input" value={pixKey} maxLength={180} autoComplete="off" onChange={(event) => setPixKey(event.target.value)} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" />
      </label>
      <button type="button" className="btn btn-primary sm:mb-px" disabled={saving} onClick={() => void save()}>{saving ? "Salvando…" : "Salvar chave PIX"}</button>
    </div>
    <div className="mt-7 border-t border-[#e4ebe7] pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="eyebrow">Conferência manual</p><h4 className="mt-1 font-extrabold">Comprovantes recebidos</h4></div>
        <span className="rounded-full bg-[#edf5f1] px-3 py-1 text-xs font-bold text-[#42645a]">{submissions.filter((item) => item.status === "submitted").length} aguardando</span>
      </div>
      <div className="mt-4 space-y-3">
        {submissions.length ? submissions.map((submission) => {
          const appointment = data.appointments.find((item) => item.id === submission.appointmentId);
          const client = data.clients.find((item) => item.id === submission.clientId);
          const service = data.services.find((item) => item.id === appointment?.serviceId);
          return <article key={submission.id} className="rounded-2xl border border-[#dfe9e4] bg-[#f9fbfa] p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <p className="font-extrabold">{client?.name ?? "Cliente"} • {service?.name ?? "Atendimento"}</p>
                <p className="mt-1 text-xs text-[#62736c]">{appointment ? `${new Intl.DateTimeFormat("pt-BR").format(new Date(`${appointment.date}T12:00`))} às ${appointment.time}` : "Agendamento vinculado"} • {submission.receiptOriginalName}</p>
                <p className={`mt-2 text-xs font-extrabold ${submission.status === "confirmed" ? "text-emerald-700" : "text-amber-700"}`}>{submission.status === "confirmed" ? "✓ Pagamento confirmado" : "◷ Aguardando sua conferência"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-secondary" disabled={opening === submission.id} onClick={() => void openReceipt(submission)}>{opening === submission.id ? "Abrindo…" : "Ver comprovante"}</button>
                {submission.status === "submitted" && appointment?.paymentStatus !== "paid" && <button type="button" className="btn btn-primary" onClick={() => onConfirm(submission.appointmentId)}>Confirmar recebimento</button>}
              </div>
            </div>
          </article>;
        }) : <div className="rounded-2xl bg-[#f5f8f6] p-6 text-center text-sm text-[#6b7974]">Nenhum comprovante PIX recebido.</div>}
      </div>
    </div>
  </section>;
}
