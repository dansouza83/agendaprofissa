import { createClient } from "npm:@supabase/supabase-js@2";

type CredentialRow = { access_token: string; webhook_secret: string };
const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function credentials() {
  const { data, error } = await service.rpc("admin_get_mp_credentials", { requested_environment: null });
  if (error) throw error;
  const row = data?.[0] as CredentialRow | undefined;
  if (!row?.access_token) throw new Error("Integração não configurada.");
  return row;
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}

async function validSignature(request: Request, dataId: string, secret: string) {
  if (!secret) return false;
  const signature = request.headers.get("x-signature") || "";
  const requestId = request.headers.get("x-request-id") || "";
  const parts = Object.fromEntries(signature.split(",").map((part) => part.trim().split("=")));
  if (!parts.ts || !parts.v1 || !requestId) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const expected = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return safeEqual(expected, parts.v1);
}

function subscriptionStatus(value: unknown) {
  if (value === "authorized") return "authorized";
  if (value === "paused") return "paused";
  if (value === "cancelled" || value === "canceled") return "cancelled";
  return "pending";
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    const body = await request.json() as { type?: string; data?: { id?: string | number } };
    const dataId = String(body.data?.id ?? new URL(request.url).searchParams.get("data.id") ?? "");
    const config = await credentials();
    if (!dataId || !(await validSignature(request, dataId, config.webhook_secret))) return json({ error: "Assinatura inválida." }, 401);
    if (body.type && body.type !== "subscription_preapproval") return json({ received: true });
    const response = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(dataId)}`, { headers: { Authorization: `Bearer ${config.access_token}` } });
    const remote = await response.json() as Record<string, unknown>;
    if (!response.ok) return json({ error: "O Mercado Pago recusou a consulta." }, 502);
    const tenantId = String(remote.external_reference || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) return json({ error: "Referência inválida." }, 400);
    const { error } = await service.from("subscriptions").update({
      provider_subscription_id: String(remote.id || dataId),
      status: subscriptionStatus(remote.status),
      current_period_end: typeof remote.next_payment_date === "string" ? remote.next_payment_date : null,
      updated_at: new Date().toISOString(),
    }).eq("tenant_id", tenantId);
    if (error) throw error;
    return json({ received: true });
  } catch {
    return json({ error: "Falha ao processar a notificação." }, 500);
  }
});
