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
  updated_at: string;
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
  if (!response.ok) {
    const message = typeof body.message === "string" ? body.message : "O Mercado Pago recusou a solicitação.";
    if (/back_?url/i.test(message)) throw new Error("O Mercado Pago recusou a URL de retorno. O endereço público HTTPS do Agenda Profissa será usado.");
    throw new Error(message);
  }
  return body;
}

function subscriptionStatus(value: unknown) {
  if (value === "authorized") return "authorized";
  if (value === "paused") return "paused";
  if (value === "cancelled" || value === "canceled") return "cancelled";
  return "pending";
}

type StoredSubscription = {
  provider_subscription_id: string | null;
  provider_payment_id: string | null;
  plan_code: PlanCode;
  status: "pending" | "authorized" | "paused" | "cancelled";
  payment_status: "pending" | "approved" | "rejected" | "cancelled" | "refunded";
  payment_confirmed_at: string | null;
  amount_cents: number;
  current_period_end: string | null;
};

function approvedPayment(invoice: Record<string, unknown>, expectedCents: number) {
  const payment = invoice.payment as Record<string, unknown> | undefined;
  const amountCents = Math.round(Number(invoice.transaction_amount) * 100);
  return invoice.currency_id === "BRL"
    && amountCents === expectedCents
    && payment?.status === "approved"
    && typeof payment.id !== "undefined";
}

async function confirmedInvoice(token: string, subscriptionId: string, expectedCents: number) {
  const search = await mercadoPago(token, `/authorized_payments/search?preapproval_id=${encodeURIComponent(subscriptionId)}&limit=20`);
  const invoices = Array.isArray(search.results) ? search.results as Record<string, unknown>[] : [];
  return invoices.find((invoice) => String(invoice.preapproval_id || "") === subscriptionId && approvedPayment(invoice, expectedCents)) ?? null;
}

function paymentDetails(invoice: Record<string, unknown>) {
  const payment = invoice.payment as Record<string, unknown>;
  return {
    provider_payment_id: String(payment.id),
    payment_status: "approved" as const,
    payment_confirmed_at: typeof invoice.last_modified === "string" ? invoice.last_modified : new Date().toISOString(),
  };
}

function activeSubscription(subscription: Pick<StoredSubscription, "status" | "payment_status"> | null | undefined) {
  return subscription?.status === "authorized" && subscription.payment_status === "approved";
}

function isSeedSubscription(subscriptionId: string | null) {
  return Boolean(subscriptionId?.startsWith("test-"));
}

function environmentOf(value: unknown): Environment | undefined {
  return value === "test" || value === "production" ? value : undefined;
}

function publicHttpsOrigin(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
    if (url.protocol !== "https:" || localHost || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function paymentReturnUrl(value: unknown) {
  const origin = publicHttpsOrigin(value);
  return origin ? new URL("/sistema?pagamento=retorno", origin).toString() : null;
}

const mask = (value: string) => value ? `${value.slice(0, 7)}••••${value.slice(-4)}` : "Não configurada";
const credentialSummary = (item: CredentialRow) => ({
  publicKey: mask(item.public_key),
  accessToken: mask(item.access_token),
  clientId: mask(item.client_id),
  clientSecret: mask(item.client_secret),
  webhookSecret: mask(item.webhook_secret),
  configured: Boolean(item.access_token),
  updatedAt: item.updated_at,
});

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
      const { data: existing, error: existingError } = await service.from("subscriptions").select("status, payment_status").eq("tenant_id", tenantId).maybeSingle();
      if (existingError) throw existingError;
      if (activeSubscription(existing as Pick<StoredSubscription, "status" | "payment_status"> | null)) return json({ error: "Este painel já possui uma assinatura com pagamento confirmado." }, 409);
      const returnUrl = paymentReturnUrl(input.siteUrl);
      if (!returnUrl) return json({ error: "Endereço de retorno inválido. Acesse o Agenda Profissa pelo endereço público HTTPS." }, 400);
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
          back_url: returnUrl,
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
        provider_payment_id: null,
        payment_status: "pending",
        payment_confirmed_at: null,
        amount_cents: Math.round(amount * 100),
        payer_email: user.email || "",
        current_period_end: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "tenant_id" });
      if (error) throw error;
      return json({ checkoutUrl: subscription.init_point });
    }

    if (action === "status") {
      const tenantId = await tenantFor(user.id);
      const { data, error } = await service.from("subscriptions").select("provider_subscription_id, provider_payment_id, plan_code, status, payment_status, payment_confirmed_at, amount_cents, current_period_end").eq("tenant_id", tenantId).maybeSingle();
      if (error) throw error;
      const current = data as StoredSubscription | null;
      const config = await credentials();
      if (current?.provider_subscription_id && !isSeedSubscription(current.provider_subscription_id)) {
        const remote = await mercadoPago(config.access_token, `/preapproval/${encodeURIComponent(current.provider_subscription_id)}`);
        const status = subscriptionStatus(remote.status);
        const currentPeriodEnd = typeof remote.next_payment_date === "string" ? remote.next_payment_date : null;
        const changes: Record<string, unknown> = { status, current_period_end: currentPeriodEnd, updated_at: new Date().toISOString() };
        if (status === "authorized" && current.payment_status !== "approved") {
          const invoice = await confirmedInvoice(config.access_token, current.provider_subscription_id, Number(current.amount_cents));
          if (invoice) Object.assign(changes, paymentDetails(invoice));
        }
        const update = await service.from("subscriptions").update(changes).eq("tenant_id", tenantId);
        if (update.error) throw update.error;
        current.status = status;
        current.current_period_end = currentPeriodEnd;
        if (changes.payment_status === "approved") {
          current.payment_status = "approved";
          current.provider_payment_id = String(changes.provider_payment_id);
          current.payment_confirmed_at = String(changes.payment_confirmed_at);
        }
      }
      return json({ active: activeSubscription(current), subscription: current ?? null, prices: { monthly: Number(config.monthly_price), annual: Number(config.annual_price) } });
    }

    if (user.email?.toLowerCase() !== "dansouzafloripa@gmail.com") return json({ error: "Acesso permitido somente ao desenvolvedor autorizado." }, 403);

    if (action === "developerCredentials") {
      const [test, production, active] = await Promise.all([credentials("test"), credentials("production"), credentials()]);
      return json({ activeEnvironment: active.environment, test: credentialSummary(test), production: credentialSummary(production) });
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
      const stored = await credentials(environment);
      const expected = {
        publicKey: String(input.publicKey || "").trim(),
        accessToken,
        clientId: String(input.clientId || "").trim(),
        clientSecret: String(input.clientSecret || "").trim(),
        webhookSecret: String(input.webhookSecret || "").trim(),
      };
      const verified = (!expected.publicKey || stored.public_key === expected.publicKey)
        && (!expected.accessToken || stored.access_token === expected.accessToken)
        && (!expected.clientId || stored.client_id === expected.clientId)
        && (!expected.clientSecret || stored.client_secret === expected.clientSecret)
        && (!expected.webhookSecret || stored.webhook_secret === expected.webhookSecret);
      if (!verified) return json({ error: "As credenciais não puderam ser confirmadas após a gravação." }, 500);
      return json({ saved: true, environment, credentials: credentialSummary(stored) });
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
      const backUrl = paymentReturnUrl(input.siteUrl);
      if (!backUrl) return json({ error: "Endereço de retorno inválido. Reabra o painel pelo endereço público HTTPS e tente novamente." }, 400);
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
