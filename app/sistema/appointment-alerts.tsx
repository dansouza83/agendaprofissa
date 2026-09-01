"use client";

import type { AppointmentNotification } from "../domain";

export function unreadAppointmentNotifications(notifications: AppointmentNotification[]) {
  return notifications.filter((notification) => !notification.readAt).length;
}

export function AppointmentAlerts({ notifications, onRead }: { notifications: AppointmentNotification[]; onRead: (notificationId: string) => void }) {
  if (!notifications.length) return null;

  return <section className="card overflow-hidden" aria-label="Alertas de agendamentos">
    <div className="border-b border-[#e3eae6] p-5">
      <p className="eyebrow">Atualizações automáticas</p>
      <h2 className="mt-1 text-xl font-extrabold">Alertas de agendamentos</h2>
      <p className="mt-1 text-sm text-[#687570]">Acompanhe novos horários, comprovantes recebidos e confirmações de pagamento.</p>
    </div>
    <div className="divide-y divide-[#e6ece8]" aria-live="polite">
      {notifications.map((notification) => {const confirmed=notification.type==="payment_confirmed",receipt=notification.type==="receipt_submitted";return <article key={notification.id} className={`flex gap-3 p-4 sm:p-5 ${notification.readAt ? "bg-white" : "bg-[#edf8f3]"}`}>
        <span className={`grid h-10 w-10 flex-none place-items-center rounded-xl text-lg ${confirmed ? "bg-[#dff3e9] text-[#176b55]" : receipt ? "bg-[#e5eefc] text-[#285b92]" : "bg-[#fff2d7] text-[#8a5a00]"}`} aria-hidden="true">{confirmed ? "✓" : receipt ? "▧" : "◷"}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-extrabold text-[#183d34]">{notification.title}</h3>
            <time className="text-[11px] text-[#6e7c76]" dateTime={notification.createdAt}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(notification.createdAt))}</time>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#4f625b]">{notification.body}</p>
          {!notification.readAt && <button type="button" className="mt-2 text-xs font-extrabold text-[#24685d] underline-offset-4 hover:underline" onClick={() => onRead(notification.id)}>Marcar como lido</button>}
        </div>
      </article>})}
    </div>
  </section>;
}
