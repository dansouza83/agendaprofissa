import { createClient } from "npm:@supabase/supabase-js@2";

const service = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

function brazilianWhatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (/^55\d{10,11}$/.test(digits)) return digits;
  if (/^\d{10,11}$/.test(digits)) return `55${digits}`;
  return null;
}

function schedule(startsAt: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(startsAt));
  const [date, time = ""] = parts.split(", ");
  return { date, time };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sessão inválida." }, 401);
    const { data: userData, error: userError } = await service.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Sessão inválida." }, 401);

    const input = await request.json() as { appointmentId?: unknown };
    const appointmentId = String(input.appointmentId ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(appointmentId)) return json({ error: "Agendamento inválido." }, 400);

    const { data: appointment, error: appointmentError } = await service
      .from("appointments")
      .select("id, tenant_id, client_id, service_id, starts_at, payment_status")
      .eq("id", appointmentId)
      .maybeSingle();
    if (appointmentError || !appointment) return json({ error: "Agendamento não encontrado." }, 404);

    const [membershipResult, subscriptionResult, clientResult, serviceResult, tenantResult] = await Promise.all([
      service.from("memberships").select("role").eq("tenant_id", appointment.tenant_id).eq("user_id", userData.user.id).maybeSingle(),
      service.from("subscriptions").select("status, payment_status").eq("tenant_id", appointment.tenant_id).maybeSingle(),
      service.from("clients").select("name, phone").eq("id", appointment.client_id).eq("tenant_id", appointment.tenant_id).maybeSingle(),
      service.from("services").select("name").eq("id", appointment.service_id).eq("tenant_id", appointment.tenant_id).maybeSingle(),
      service.from("tenants").select("name, timezone").eq("id", appointment.tenant_id).maybeSingle(),
    ]);
    const queryError = membershipResult.error || subscriptionResult.error || clientResult.error || serviceResult.error || tenantResult.error;
    if (queryError) throw queryError;
    if (!membershipResult.data) return json({ error: "Acesso permitido somente ao profissional responsável." }, 403);
    if (subscriptionResult.data?.status !== "authorized" || subscriptionResult.data?.payment_status !== "approved") return json({ error: "Assinatura profissional inativa." }, 403);
    if (appointment.payment_status !== "paid") return json({ error: "O pagamento ainda não foi confirmado." }, 409);

    const phone = brazilianWhatsAppPhone(clientResult.data?.phone ?? "");
    if (!phone) return json({ sent: false, reason: "O cliente não possui um WhatsApp brasileiro válido." });

    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN")?.trim();
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")?.trim();
    const templateName = Deno.env.get("WHATSAPP_PAYMENT_CONFIRMED_TEMPLATE")?.trim();
    const graphVersion = Deno.env.get("WHATSAPP_GRAPH_API_VERSION")?.trim() || "v23.0";
    const templateLanguage = Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE")?.trim() || "pt_BR";
    if (!accessToken || !phoneNumberId || !templateName) return json({ sent: false, reason: "Credenciais oficiais do WhatsApp ainda não configuradas." });

    const { date, time } = schedule(appointment.starts_at, tenantResult.data?.timezone || "America/Sao_Paulo");
    const response = await fetch(`https://graph.facebook.com/${encodeURIComponent(graphVersion)}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "template",
        template: {
          name: templateName,
          language: { code: templateLanguage },
          components: [{
            type: "body",
            parameters: [
              { type: "text", text: clientResult.data?.name || "Cliente" },
              { type: "text", text: serviceResult.data?.name || "Atendimento" },
              { type: "text", text: date },
              { type: "text", text: time },
              { type: "text", text: tenantResult.data?.name || "Profissional" },
              { type: "text", text: userData.user.email || "consulte o sistema" },
            ],
          }],
        },
      }),
    });
    const responseBody = await response.json() as Record<string, unknown>;
    if (!response.ok) {
      console.error("WhatsApp Cloud API recusou a notificação", { status: response.status, responseBody });
      return json({ sent: false, reason: "O WhatsApp recusou o envio. Verifique o modelo aprovado e as credenciais." }, 502);
    }
    return json({ sent: true });
  } catch (error) {
    console.error("Falha na notificação de pagamento", error);
    return json({ error: "Não foi possível enviar a notificação automática." }, 500);
  }
});
