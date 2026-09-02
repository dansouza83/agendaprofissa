"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Appointment, Client, PaymentSubmission, PixKeyType, Service, TenantPaymentSettings, WorkspaceData } from "../domain";
import { prepareOnlinePixReceipt, reviewOnlinePixReceipt, saveOnlinePixSettings, uploadOnlinePixReceipt } from "../lib/supabase";
import { buildPixPayload, pixPaymentStage, validatePixReceipt, validatePixSettings } from "../lib/pix";

const brl = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const when = (value?: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "";
const receiptAccept = "image/jpeg,image/png,image/webp,application/pdf";
const errorMessage = (error: unknown, fallback: string) => error && typeof error === "object" && "message" in error ? String(error.message) : fallback;

export function PaymentTimeline({ appointment, receipt }: { appointment: Appointment; receipt?: PaymentSubmission }) {
  const stage = pixPaymentStage(appointment, receipt);
  const labels = [receipt?.status === "rejected" ? "Reenviar comprovante" : "Aguardando PIX", "Comprovante enviado", "Em conferência", "Pagamento confirmado"];
  const dates = [null, receipt?.createdAt, receipt?.reviewStartedAt, appointment.paymentConfirmedAt];
  return <ol className="pix-timeline" aria-label="Acompanhamento do pagamento">
    {labels.map((label, index) => <li key={label} className={index <= stage ? "is-reached" : ""} aria-current={index === stage ? "step" : undefined}>
      <span className="pix-step" aria-hidden="true">{index < stage ? "✓" : index + 1}</span>
      <span><b>{label}</b>{index <= stage && dates[index] && <small>{when(dates[index])}</small>}</span>
    </li>)}
  </ol>;
}

function ReceiptHistory({ receipts }: { receipts: PaymentSubmission[] }) {
  if (!receipts.length) return null;
  return <details className="pix-history">
    <summary>Histórico de comprovantes ({receipts.length})</summary>
    <ul>{receipts.map(receipt => <li key={receipt.id}>
      <b>{receipt.receiptOriginalName}</b><span>Enviado em {when(receipt.createdAt)}</span>
      <span>{receipt.status === "confirmed" ? "Confirmado manualmente" : receipt.status === "rejected" ? "Novo comprovante solicitado" : receipt.reviewStartedAt ? "Em conferência" : "Enviado para conferência"}</span>
      {receipt.reviewedAt && <span>{when(receipt.reviewedAt)} • {receipt.reviewedByName || "Profissional"}</span>}
      {receipt.rejectionReason && <p>Motivo: {receipt.rejectionReason}</p>}
    </li>)}</ul>
  </details>;
}

export function ClientPixPayment({ appointment, client, service, settings, submissions, online, onSubmitted }: {
  appointment: Appointment; client: Client; service?: Service; settings?: TenantPaymentSettings;
  submissions: PaymentSubmission[]; online: boolean; onSubmitted: (submission: PaymentSubmission) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const receipts = submissions.filter(item => item.appointmentId === appointment.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const receipt = receipts[0];
  const paid = appointment.paymentStatus === "paid";
  const waiting = !paid && receipt?.status === "submitted";
  const rejected = !paid && receipt?.status === "rejected";
  const amountCents = appointment.amountCents ?? (service ? Math.round(service.price * 100) : null);
  let payload = "";
  if (!paid && !waiting && settings?.pixKey && amountCents !== null) {
    try { payload = buildPixPayload(settings, amountCents, appointment.id.replace(/-/g, "").slice(0, 25)); } catch { /* Keep key-copy/upload available for older, incomplete settings. */ }
  }

  const copy = async (value: string, label: string) => {
    try { await navigator.clipboard.writeText(value); setMessage(label + " copiado."); }
    catch { setMessage("Não foi possível copiar automaticamente. Selecione o campo e copie o conteúdo."); }
  };
  const submit = async () => {
    if (!file || busy) return;
    setBusy(true); setMessage("");
    try {
      validatePixReceipt(file);
      const created: PaymentSubmission = online ? await uploadOnlinePixReceipt(appointment, client.id, file) : {
        id: crypto.randomUUID(), tenantId: appointment.tenantId, appointmentId: appointment.id, clientId: client.id,
        paymentMethod: "pix", receiptPath: "local:" + file.name, receiptOriginalName: file.name,
        receiptContentType: file.type as PaymentSubmission["receiptContentType"], receiptSizeBytes: file.size,
        status: "submitted", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      onSubmitted(created); setFile(null);
      setMessage(online ? "Comprovante enviado. O profissional foi notificado no sistema." : "Comprovante simulado no teste local; nenhum arquivo foi enviado.");
    } catch (error) { setMessage(errorMessage(error, "Não foi possível enviar o comprovante.")); }
    finally { setBusy(false); }
  };

  return <section className="pix-panel" aria-label="Pagamento PIX do agendamento">
    <PaymentTimeline appointment={appointment} receipt={receipt} />
    {paid ? <div className="pix-notice pix-success"><b>✓ Pagamento confirmado pelo profissional</b><p>Confirmação manual registrada em {when(appointment.paymentConfirmedAt) || "seu histórico"}.</p></div>
      : waiting ? <div className="pix-notice"><b>{receipt.reviewStartedAt ? "O profissional está conferindo seu comprovante" : "Comprovante recebido para conferência"}</b><p>Aguarde a confirmação no sistema. Não é necessário pagar novamente.</p></div>
      : <>
        {rejected && <div className="pix-notice pix-warning" role="status"><b>Envie outro comprovante</b><p>{receipt.rejectionReason}</p><p>Se você já pagou, <strong>não pague novamente</strong>. Confira a transferência no banco e envie o comprovante correto.</p></div>}
        {settings?.pixKey ? <>
          {!rejected && <div className="pix-checkout">
            {payload && <div className="pix-qr"><QRCodeSVG value={payload} size={192} level="M" marginSize={4} bgColor="#ffffff" fgColor="#000000" title="QR Code PIX para pagamento direto ao profissional" /><span>Escaneie no aplicativo do banco</span></div>}
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Pagamento direto ao profissional</p>
              <p className="pix-amount">{amountCents === null ? "Consulte o valor com o profissional" : brl(amountCents / 100)}</p>
              {settings.pixHolderName && <p className="pix-muted">Recebedor informado: <b>{settings.pixHolderName}</b></p>}
              <p className="pix-muted mt-2">Confira o nome do recebedor e o valor no seu banco antes de pagar.</p>
              {payload ? <>
                <button type="button" className="btn btn-primary mt-3 w-full" onClick={() => void copy(payload, "PIX Copia e Cola")}>Copiar PIX Copia e Cola</button>
                <details className="pix-history"><summary>Ver código PIX</summary><textarea className="input mt-2 w-full" rows={3} value={payload} readOnly aria-label="PIX Copia e Cola" /></details>
              </> : <p className="pix-muted mt-2">QR Code indisponível: o profissional precisa completar os dados PIX e o valor do agendamento.</p>}
            </div>
          </div>}
          {!rejected && <><label htmlFor={"pix-key-" + appointment.id} className="label mt-3">Chave PIX do profissional</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id={"pix-key-" + appointment.id} className="input min-w-0 flex-1" value={settings.pixKey} readOnly />
              <button type="button" className="btn btn-secondary" onClick={() => void copy(settings.pixKey, "Chave PIX")}>Copiar chave</button>
            </div></>}
        </> : <p className="pix-muted mt-3">O profissional ainda não cadastrou uma chave PIX. Combine o pagamento diretamente com ele.</p>}
        {(settings?.pixKey || rejected) && <div className="pix-upload">
          <label htmlFor={"pix-receipt-" + appointment.id} className="label">Já pagou? Envie o comprovante</label>
          <p id={"pix-file-help-" + appointment.id} className="pix-muted mb-2">JPG, PNG, WebP ou PDF, até 5 MB. O arquivo fica privado.</p>
          <input id={"pix-receipt-" + appointment.id} className="input w-full" type="file" accept={receiptAccept} disabled={busy} aria-describedby={"pix-file-help-" + appointment.id} onChange={event => {
            const selected = event.target.files?.[0] ?? null;
            try { if (selected) validatePixReceipt(selected); setFile(selected); setMessage(""); }
            catch (error) { setFile(null); event.target.value = ""; setMessage(errorMessage(error, "Arquivo inválido.")); }
          }} />
          <button type="button" className="btn btn-primary mt-3 w-full" disabled={busy || !file} onClick={() => void submit()}>{busy ? "Enviando…" : rejected ? "Enviar novo comprovante" : "Enviar comprovante PIX"}</button>
          <p className="pix-muted mt-2">O envio não confirma o pagamento. O profissional precisa conferir o recebimento na própria conta.</p>
        </div>}
      </>}
    <ReceiptHistory receipts={receipts} />
    <p className="pix-muted mt-3">O Agenda Profissa não recebe nem retém o valor deste atendimento. A conferência e a confirmação são feitas pelo profissional.</p>
    {message && <p className="pix-notice mt-3" role="status">{message}</p>}
  </section>;
}

export function ProfessionalPixManagement({ data, tenantId, online, onData, onRefresh, onConfirm, notify }: {
  data: WorkspaceData; tenantId: string; online: boolean; onData: (data: WorkspaceData) => void;
  onRefresh: () => Promise<void>; onConfirm: (appointmentId: string) => void; notify: (message: string) => void;
}) {
  const initial = data.paymentSettings?.find(item => item.tenantId === tenantId);
  const [settings, setSettings] = useState<TenantPaymentSettings>(initial ?? { tenantId, pixKey: "", updatedAt: null });
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [prepared, setPrepared] = useState<{ id: string; url: string; expiresAt: number } | null>(null);
  const submissions = (data.paymentSubmissions ?? []).filter(item => item.tenantId === tenantId && item.paymentMethod === "pix").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const setField = (field: keyof TenantPaymentSettings, value: string) => setSettings(current => ({ ...current, [field]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const next = validatePixSettings({ ...settings, tenantId, updatedAt: new Date().toISOString() });
      if (online) { await saveOnlinePixSettings(next); await onRefresh(); }
      else onData({ ...data, paymentSettings: [next, ...(data.paymentSettings ?? []).filter(item => item.tenantId !== tenantId)] });
      setSettings(next);
      notify(next.pixKey ? "Dados PIX salvos. QR Code disponível nos agendamentos com valor." : "Recebimentos PIX desativados.");
    } catch (error) { notify(errorMessage(error, "Não foi possível salvar os dados PIX.")); }
    finally { setSaving(false); }
  };

  const prepareReceipt = async (submission: PaymentSubmission) => {
    if (!online) { notify("No teste local, o arquivo não é enviado para a nuvem."); return; }
    setWorking(submission.id);
    try {
      setPrepared(await prepareOnlinePixReceipt(submission));
    }
    catch (error) { notify(errorMessage(error, "Não foi possível abrir o comprovante.")); }
    finally { setWorking(null); }
  };

  const review = async (receipt: PaymentSubmission, action: "start_review" | "request_new") => {
    if (working) return;
    if (action === "request_new" && (reason.trim().length < 5 || reason.trim().length > 500)) { notify("Informe um motivo entre 5 e 500 caracteres."); return; }
    setWorking(receipt.id);
    try {
      if (online) { await reviewOnlinePixReceipt(receipt.id, action, reason); await onRefresh(); }
      else {
        const now = new Date().toISOString();
        onData({ ...data, paymentSubmissions: (data.paymentSubmissions ?? []).map(item => item.id !== receipt.id ? item : {
          ...item, reviewStartedAt: item.reviewStartedAt ?? now, updatedAt: now,
          ...(action === "request_new" ? { status: "rejected" as const, rejectionReason: reason.trim(), reviewedAt: now, reviewedByName: "Profissional (teste local)" } : {}),
        }), notifications: action === "request_new" ? [...(data.notifications ?? []), {
          id: crypto.randomUUID(), tenantId, appointmentId: receipt.appointmentId, clientId: receipt.clientId, type: "receipt_rejected",
          title: "Envie outro comprovante PIX", body: reason.trim() + ". Se já pagou, não pague novamente.", createdAt: now, readAt: null,
        }] : data.notifications });
      }
      setRequesting(null); setReason("");
      notify(action === "request_new" ? "Solicitação registrada. O cliente poderá enviar outro comprovante." : "Conferência iniciada. Confira o valor recebido no seu banco.");
    } catch (error) { notify(errorMessage(error, "Não foi possível registrar a conferência.")); }
    finally { setWorking(null); }
  };

  return <section className="card pix-management p-5 lg:col-span-2" aria-labelledby="pix-management-title">
    <p className="eyebrow">Recebimentos dos seus clientes</p>
    <h3 id="pix-management-title" className="mt-1 text-xl font-extrabold">Gerenciamento PIX</h3>
    <p className="pix-muted mt-2">O pagamento vai diretamente para sua conta. Estes dados aparecem somente aos clientes vinculados a um agendamento.</p>
    <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); void save(); }}>
      <label className="label">Tipo de chave
        <select className="input" value={settings.pixKeyType ?? ""} onChange={event => setField("pixKeyType", event.target.value as PixKeyType)}>
          <option value="">Selecione</option><option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="email">E-mail</option><option value="phone">Telefone</option><option value="random">Chave aleatória</option>
        </select>
      </label>
      <label className="label">Sua chave PIX
        <input className="input" value={settings.pixKey} maxLength={180} autoComplete="off" onChange={event => setField("pixKey", event.target.value)} placeholder="Chave cadastrada no seu banco" />
      </label>
      <label className="label">Nome do recebedor (até 25 caracteres)
        <input className="input" value={settings.pixHolderName ?? ""} maxLength={25} onChange={event => setField("pixHolderName", event.target.value)} placeholder="Nome do titular da conta" />
      </label>
      <label className="label">Cidade do recebedor (até 15 caracteres)
        <input className="input" value={settings.pixHolderCity ?? ""} maxLength={15} onChange={event => setField("pixHolderCity", event.target.value)} placeholder="Ex.: Florianópolis" />
      </label>
      <p className="pix-muted sm:col-span-2">Use uma chave registrada no seu banco. O sistema verifica o formato, mas não verifica a titularidade. Para desativar o PIX, apague a chave e salve.</p>
      <button type="submit" className="btn btn-primary sm:col-span-2" disabled={saving}>{saving ? "Salvando…" : "Salvar dados PIX"}</button>
    </form>
    <div className="pix-review-list">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-extrabold">Comprovantes recebidos</h4>
        <span className="pix-count">{submissions.filter(item => item.status === "submitted").length} aguardando</span>
      </div>
      <p className="pix-muted mt-2">Confira no extrato o valor e o recebedor. Uma imagem de comprovante, sozinha, não garante que o PIX foi recebido.</p>
      <div className="mt-4 space-y-3">{submissions.length ? submissions.map(submission => {
        const appointment = data.appointments.find(item => item.id === submission.appointmentId);
        const client = data.clients.find(item => item.id === submission.clientId);
        const service = data.services.find(item => item.id === appointment?.serviceId);
        const canReview = submission.status === "submitted" && appointment?.paymentStatus === "pending" && appointment.status !== "cancelado";
        return <article key={submission.id} className="pix-receipt">
          <p className="font-extrabold">{client?.name ?? "Cliente"} • {service?.name ?? "Atendimento"}</p>
          <p className="pix-muted mt-1">{appointment ? new Intl.DateTimeFormat("pt-BR").format(new Date(appointment.date + "T12:00")) + " às " + appointment.time : "Agendamento vinculado"}{appointment?.amountCents != null && " • " + brl(appointment.amountCents / 100)}</p>
          <p className="pix-muted mt-1 break-all">{submission.receiptOriginalName} • {when(submission.createdAt)}</p>
          <p className="mt-2 text-sm font-bold">{submission.status === "confirmed" ? "✓ Confirmado manualmente" : submission.status === "rejected" ? "↻ Novo comprovante solicitado" : submission.reviewStartedAt ? "◷ Em conferência" : "◷ Comprovante enviado"}</p>
          {submission.rejectionReason && <p className="pix-notice pix-warning mt-2">Motivo: {submission.rejectionReason}</p>}
          {submission.reviewedAt && <p className="pix-muted mt-2">{when(submission.reviewedAt)} • {submission.reviewedByName || "Profissional"}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {prepared?.id === submission.id ? <a className="btn btn-secondary" href={prepared.url} target="_blank" rel="noopener noreferrer" onClick={event => {
              if (Date.now() >= prepared.expiresAt) { event.preventDefault(); setPrepared(null); notify("O link privado expirou. Prepare o comprovante novamente."); }
            }}>Abrir arquivo ↗</a> : <button type="button" className="btn btn-secondary" disabled={working !== null} onClick={() => void prepareReceipt(submission)}>{working === submission.id ? "Aguarde…" : "Ver comprovante"}</button>}
            {canReview && <>
              {!submission.reviewStartedAt && <button type="button" className="btn btn-secondary" disabled={working !== null} onClick={() => void review(submission, "start_review")}>Iniciar conferência</button>}
              <button type="button" className="btn btn-primary" disabled={working !== null} onClick={() => onConfirm(submission.appointmentId)}>Confirmar recebimento</button>
              <button type="button" className="btn btn-secondary" disabled={working !== null} aria-expanded={requesting === submission.id} onClick={() => { setRequesting(submission.id); setReason(""); }}>Solicitar novo comprovante</button>
            </>}
          </div>
          {prepared?.id === submission.id && <p className="pix-muted mt-2">Arquivo privado pronto: clique em “Abrir arquivo”. Link válido por até 5 minutos.</p>}
          {requesting === submission.id && canReview && <form className="pix-request-form" onSubmit={event => { event.preventDefault(); void review(submission, "request_new"); }}>
            <label className="label">Explique o motivo ao cliente
              <textarea className="input w-full" rows={3} minLength={5} maxLength={500} required value={reason} onChange={event => setReason(event.target.value)} placeholder="Ex.: a imagem está ilegível. Envie o comprovante completo." />
            </label>
            <p className="pix-muted">O arquivo anterior será preservado. Isso não cancela nem estorna uma transferência e não pede que o cliente pague duas vezes.</p>
            <div className="mt-3 flex flex-wrap gap-2"><button className="btn btn-primary" type="submit" disabled={working !== null}>Enviar solicitação</button><button className="btn btn-secondary" type="button" disabled={working !== null} onClick={() => { setRequesting(null); setReason(""); }}>Cancelar</button></div>
          </form>}
        </article>;
      }) : <p className="pix-notice">Nenhum comprovante PIX recebido.</p>}</div>
    </div>
  </section>;
}
