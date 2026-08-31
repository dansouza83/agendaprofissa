export function normalizeBrazilianWhatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (/^55\d{10,11}$/.test(digits)) return digits;
  if (/^\d{10,11}$/.test(digits)) return `55${digits}`;
  return null;
}

export function appointmentWhatsAppUrl(input: { phone: string; clientName: string; serviceName: string; date: string; time: string; paymentStatus: "paid" | "pending"; businessName: string }) {
  const phone = normalizeBrazilianWhatsAppPhone(input.phone);
  if (!phone) return null;
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(`${input.date}T12:00:00`));
  const firstName = input.clientName.trim().split(/\s+/)[0] || "cliente";
  const message = input.paymentStatus === "paid"
    ? `Olá, ${firstName}! Seu pagamento foi confirmado e o horário para ${input.serviceName}, em ${date} às ${input.time}, está reservado. Atendimento: ${input.businessName}.`
    : `Olá, ${firstName}! Seu agendamento de ${input.serviceName} está registrado para ${date} às ${input.time}. O pagamento ainda está pendente de confirmação. Atendimento: ${input.businessName}.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
