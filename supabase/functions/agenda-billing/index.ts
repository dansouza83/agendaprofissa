import { createClient } from "npm:@supabase/supabase-js@2";

type Environment = "test" | "production";
type PlanCode = "monthly" | "annual";
type CredentialRow = {
  environment: Environment;
  public_key: string;
  access_token: string;
  client_id: string;
  client_secret: string;
  webhook_secret: string;
  monthly_price: number;
  annual_price: number;
  monthly_plan_id: string;
  annual_plan_id: string;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

async function currentUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("UNAUTHORIZED");
  const { data, error } = await service.auth.getUser(token);
  if (error || !data.user) throw new Error("UNAUTHORIZED");
  return data.user;
}

async function tenantFor(userId: string) {
  const { data, error } = await service.from("memberships").select("tenant_id, role").eq("user_id", userId).limit(1).maybeSingle();
  if (error || !data) throw new Error("PROFESSIONAL_REQUIRED");
  return String(data.tenant_id);
}

async function credentials(environment?: Environment) {
  const { data, error } = await service.rpc("admin_get_mp_credentials", { requested_environment: environment ?? null });
  if (error) throw error;
  const row = data?.[0] as CredentialRow | undefined;
  if (!row) throw new Error("Configure as credenciais do Mercado Pago.");
  return row;
}

async function mercadoPago(token: string, path: string, init?: RequestInit) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : "O Mercado Pago recusou a solicitação.");
  return body;
}

function subscriptionStatus(value: unknown) {
  if (value === "authorized") return "authorized";
  if (value === "paused") return "paused";
  if (value === "cancelled" || value === "canceled") return "cancelled";
  return "pending";
}

function environmentOf(value: unknown): Environment | undefined {
  return value === "test" || value === "production" ? value : undefined;
}

const mask = (value: string) => value ? `${value.slice(0, 7)}••••${value.slice(-4)}` : "Não configurada";

async function syncPlan(token: string, id: string, reason: string, amount: number, frequency: number, backUrl: string) {
  const body = JSON.stringify({ reason, auto_recurring: { frequency, frequency_type: "months", transaction_amount: amount, currency_id: "BRL" }, back_url: backUrl });
  return id
    ? mercadoPago(token, `/preapproval_plan/${encodeURIComponent(id)}`, { method: "PUT", body })
    : mercadoPago(token, "/preapproval_plan", { method: "POST", body });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    const user = await currentUser(request);
    const input = await request.json() as Record<string, unknown>;
    const action = String(input.action || "");

    if (action === "checkout") {
      const plan = input.plan as PlanCode;
      if (plan !== "monthly" && plan !== "annual") return json({ error: "Plano inválido." }, 400);
      const tenantId = await tenantFor(user.id);
      const config = await credentials();
      if (!config.access_token) return json({ error: "Pagamento ainda não configurado." }, 503);
      const siteUrl = String(input.siteUrl || "").replace(/\/$/, "");
      if (!/^https?:\/\//.test(siteUrl)) return json({ error: "Endereço de retorno inválido." }, 400);
      const frequency = plan === "monthly" ? 1 : 12;
      const amount = Number(plan === "monthly" ? config.monthly_price : config.annual_price);
      const subscription = await mercadoPago(config.access_token, "/preapproval", {
        method: "POST",
        headers: { "X-Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          reason: `Agenda Profissa — Plano ${plan === "monthly" ? "mensal" : "anual"}`,
          external_reference: tenantId,
          payer_email: user.email,
          auto_recurring: { frequency, frequency_type: "months", transaction_amount: amount, currency_id: "BRL" },
          back_url: `${siteUrl}/sistema?pagamento=retorno`,
          notification_url: `${supabaseUrl}/functions/v1/agenda-mp-webhook?source_news=webhooks`,
          status: "pending",
        }),
      });
      const { error } = await service.from("subscriptions").upsert({
        tenant_id: tenantId,
        provider: "mercado_pago",
        provider_subscription_id: String(subscription.id || "") || null,
        plan_code: plan,
        status: "pending",
        payer_email: user.email || "",
        current_period_end: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "tenant_id" });
      if (error) throw error;
      return json({ checkoutUrl: subscription.init_point });
    }

    if (action === "status") {
      const tenantId = await tenantFor(user.id);
      const { data, error } = await service.from("subscriptions").select("provider_subscription_id, plan_code, status, current_period_end").eq("tenant_id", tenantId).maybeSingle();
      if (error) throw error;
      if (data?.provider_subscription_id && data.status !== "authorized") {
        const config = await credentials();
        const remote = await mercadoPago(config.access_token, `/preapproval/${encodeURIComponent(data.provider_subscription_id)}`);
        const status = subscriptionStatus(remote.status);
        if (status !== data.status) {
          const currentPeriodEnd = typeof remote.next_payment_date === "string" ? remote.next_payment_date : null;
          const update = await service.from("subscriptions").update({ status, current_period_end: currentPeriodEnd, updated_at: new Date().toISOString() }).eq("tenant_id", tenantId);
          if (update.error) throw update.error;
          data.status = status;
          data.current_period_end = currentPeriodEnd;
        }
      }
      const config = await credentials();
      return json({ active: data?.status === "authorized", subscription: data ?? null, prices: { monthly: Number(config.monthly_price), annual: Number(config.annual_price) } });
    }

    if (user.email?.toLowerCase() !== "dansouzafloripa@gmail.com") return json({ error: "Acesso permitido somente ao desenvolvedor autorizado." }, 403);

    if (action === "developerCredentials") {
      const [test, production, active] = await Promise.all([credentials("test"), credentials("production"), credentials()]);
      const summary = (item: CredentialRow) => ({ publicKey: mask(item.public_key), accessToken: mask(item.access_token), clientId: mask(item.client_id), clientSecret: mask(item.client_secret), webhookSecret: mask(item.webhook_secret), configured: Boolean(item.access_token) });
      return json({ activeEnvironment: active.environment, test: summary(test), production: summary(production) });
    }

    if (action === "saveCredentials") {
      const environment = environmentOf(input.environment);
      if (!environment) return json({ error: "Escolha o ambiente." }, 400);
      const accessToken = String(input.accessToken || "").trim();
      if (accessToken) {
        const validation = await fetch("https://api.mercadopago.com/users/me", { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!validation.ok) return json({ error: "O Access Token foi recusado pelo Mercado Pago." }, 400);
      }
      const { error } = await service.rpc("admin_save_mp_credentials", {
        selected_environment: environment,
        public_key: String(input.publicKey || "").trim(),
        access_token: accessToken,
        client_id: String(input.clientId || "").trim(),
        client_secret: String(input.clientSecret || "").trim(),
        webhook_secret: String(input.webhookSecret || "").trim(),
        make_active: Boolean(input.makeActive),
        administrator_email: user.email,
      });
      if (error) throw error;
      return json({ saved: true });
    }

    if (action === "developerPlans") {
      const config = await credentials(environmentOf(input.environment));
      return json({ environment: config.environment, monthlyPrice: Number(config.monthly_price), annualPrice: Number(config.annual_price), monthlyPlanConfigured: Boolean(config.monthly_plan_id), annualPlanConfigured: Boolean(config.annual_plan_id) });
    }

    if (action === "savePlans") {
      const environment = environmentOf(input.environment);
      const monthly = Number(input.monthlyPrice);
      const annual = Number(input.annualPrice);
      if (!environment || !Number.isFinite(monthly) || !Number.isFinite(annual) || monthly < 1 || annual < 1) return json({ error: "Informe valores válidos a partir de R$ 1,00." }, 400);
      const config = await credentials(environment);
      if (!config.access_token) return json({ error: "Configure primeiro o Access Token deste ambiente." }, 400);
      const backUrl = `${String(input.siteUrl || "").replace(/\/$/, "")}/sistema?pagamento=retorno`;
      const [monthlyPlan, annualPlan] = await Promise.all([
        syncPlan(config.access_token, config.monthly_plan_id, "Agenda Profissa — Plano mensal", monthly, 1, backUrl),
        syncPlan(config.access_token, config.annual_plan_id, "Agenda Profissa — Plano anual", annual, 12, backUrl),
      ]);
      const { error } = await service.rpc("admin_save_mp_plans", {
        selected_environment: environment,
        new_monthly_price: monthly,
        new_annual_price: annual,
        monthly_plan_id: String(monthlyPlan.id || config.monthly_plan_id),
        annual_plan_id: String(annualPlan.id || config.annual_plan_id),
        administrator_email: user.email,
      });
      if (error) throw error;
      return json({ saved: true });
    }

    return json({ error: "Operação desconhecida." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha interna.";
    if (message === "UNAUTHORIZED") return json({ error: "Sessão inválida." }, 401);
    if (message === "PROFESSIONAL_REQUIRED") return json({ error: "Acesso exclusivo para profissionais." }, 403);
    return json({ error: message }, 500);
  }
});
