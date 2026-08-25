import { createClient, type AuthChangeEvent, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Appointment, ChatMessage, Client, Identity, Service, WorkspaceData } from "../domain";

export type AccountType = "professional" | "client";
export const developerEmail = "dansouzafloripa@gmail.com";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
const allowLocalSignupWithoutCaptcha = process.env.NEXT_PUBLIC_ALLOW_LOCAL_SIGNUP_WITHOUT_CAPTCHA === "true";
export const supabaseConfigured = Boolean(url && publishableKey);
export const captchaProtectionConfigured = Boolean(turnstileSiteKey);
let singleton: SupabaseClient | null = null;
const rememberKey = "agenda-facil-remember-access";

function isLocalHostname(hostname: string) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

/**
 * Demonstration data is useful while developing locally, but it must never
 * become a public fallback when a production deployment is missing config.
 */
export function localDemoModeEnabled() {
  if (supabaseConfigured || typeof window === "undefined") return false;
  return isLocalHostname(window.location.hostname);
}

function localSignupBypassAllowed() {
  if (!allowLocalSignupWithoutCaptcha || typeof window === "undefined") return false;
  return isLocalHostname(window.location.hostname);
}

/** CAPTCHA stays mandatory for every published address. The bypass is limited to an explicit local test build. */
export function shouldRequireCaptcha() {
  return captchaProtectionConfigured || !localSignupBypassAllowed();
}

export const passwordSafetyHint = "Use ao menos 8 caracteres, com letras e números.";

export function passwordSafetyError(password: string) {
  if (password.length < 8) return "Use uma senha com pelo menos 8 caracteres.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return passwordSafetyHint;
  return null;
}

function requireSafePassword(password: string) {
  const issue = passwordSafetyError(password);
  if (issue) throw new Error(issue);
}

function throwEmailDeliveryError(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (error.code === "over_email_send_rate_limit" || /email rate limit exceeded/i.test(error.message ?? "")) {
    throw new Error("O limite temporário de envio de e-mails foi atingido. Aguarde até uma hora e tente novamente apenas uma vez.");
  }
  throw error;
}

const authStorage = {
  getItem(key: string) {
    const storage = localStorage.getItem(rememberKey) === "false" ? sessionStorage : localStorage;
    return storage.getItem(key);
  },
  setItem(key: string, value: string) {
    const persistent = localStorage.getItem(rememberKey) !== "false";
    (persistent ? localStorage : sessionStorage).setItem(key, value);
    (persistent ? sessionStorage : localStorage).removeItem(key);
  },
  removeItem(key: string) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

function client() {
  if (!supabaseConfigured) throw new Error("Supabase ainda não foi configurado.");
  singleton ??= createClient(url!, publishableKey!, { auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return singleton;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "AF";
}

function localParts(startsAt: string, timeZone: string) {
  const value = new Date(startsAt);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export async function signInOnline(email: string, password: string) {
  const { error } = await client().auth.signInWithPassword({ email, password });
  if (error?.code === "email_not_confirmed" || /email not confirmed/i.test(error?.message || "")) {
    throw new Error("E-mail ainda não confirmado. Verifique sua caixa de entrada ou solicite um novo envio.");
  }
  if (error) throw error;
}

export async function resendSignupConfirmation(email: string) {
  const { error } = await client().auth.resend({ type: "signup", email });
  throwEmailDeliveryError(error);
}

export async function currentAccessToken() {
  const { data } = await client().auth.getSession();
  return data.session?.access_token ?? null;
}

export function setRememberAccess(remember: boolean) {
  localStorage.setItem(rememberKey, String(remember));
}

export function getRememberAccess() {
  return localStorage.getItem(rememberKey) !== "false";
}

export async function sendPasswordRecovery(email: string, redirectPath = "/sistema?recuperar-senha=1") {
  const baseUrl = window.location.origin.replace(/\/$/, "");
  const safePath = redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`;
  const { error } = await client().auth.resetPasswordForEmail(email, { redirectTo: `${baseUrl}${safePath}` });
  throwEmailDeliveryError(error);
}

export async function sendDeveloperPasswordRecovery() {
  await sendPasswordRecovery(developerEmail, "/desenvolvedor?recuperar-senha=1");
}

export async function updateRecoveredPassword(password: string) {
  requireSafePassword(password);
  const { error } = await client().auth.updateUser({ password });
  if (error) throw error;
}

export async function updateDeveloperPassword(password: string) {
  requireSafePassword(password);
  const { error } = await client().auth.updateUser({ password, data: { force_password_change: false } });
  if (error) throw error;
}

export async function signUpOnline(email: string, password: string, fullName: string, businessName: string, accountType: AccountType, captchaToken: string) {
  requireSafePassword(password);
  const captchaRequired = shouldRequireCaptcha();
  if (captchaRequired && !captchaProtectionConfigured) throw new Error("O cadastro online está temporariamente indisponível enquanto a proteção anti-bot é configurada.");
  if (captchaRequired && !captchaToken) throw new Error("Conclua a verificação anti-bot antes de criar sua conta.");
  const baseUrl = window.location.origin.replace(/\/$/, "");
  const { data, error } = await client().auth.signUp({ email, password, options: { ...(captchaRequired ? { captchaToken } : {}), emailRedirectTo: `${baseUrl}/sistema`, data: { full_name: fullName, business_name: businessName, account_type: accountType, legal_acceptance: true, terms_version: "2026-08-17", privacy_version: "2026-08-17" } } });
  if (error) throw error;
  return Boolean(data.session);
}

export async function currentOnlineUser() {
  if (!supabaseConfigured) return null;
  const { data, error } = await client().auth.getUser();
  if (error) return null;
  return data.user;
}

async function billingRequest(path: string, init?: RequestInit) {
  const { data } = await client().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) } });
  const body = await response.json() as { error?: string; active?: boolean; checkoutUrl?: string; prices?: { monthly: number; annual: number } };
  if (!response.ok) throw new Error(body.error || "Não foi possível processar sua assinatura.");
  return body;
}

export async function subscriptionStatus() {
  const result = await billingRequest("/api/billing/status");
  return { active: Boolean(result.active), prices: result.prices ?? { monthly: 50, annual: 350 } };
}

export async function startSubscriptionCheckout(plan: "monthly" | "annual") {
  const result = await billingRequest("/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan }) });
  if (!result.checkoutUrl) throw new Error("O Mercado Pago não retornou o endereço de pagamento.");
  window.location.assign(result.checkoutUrl);
}

export async function signOutOnline() {
  if (supabaseConfigured) await client().auth.signOut({ scope: "local" });
}

export function onOnlineAuthChange(callback: (event: AuthChangeEvent, user: User | null) => void) {
  if (!supabaseConfigured) return () => undefined;
  const { data } = client().auth.onAuthStateChange((event, session) => callback(event, session?.user ?? null));
  return () => data.subscription.unsubscribe();
}

export async function loadOnlineWorkspace() {
  const api = client();
  const { data: userData, error: userError } = await api.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error("Sessão não encontrada.");
  const { data: profile, error: profileError } = await api.from("profiles").select("full_name, account_type").eq("id", userData.user.id).maybeSingle();
  if (profileError) throw profileError;
  const name = profile?.full_name || userData.user.email?.split("@")[0] || "Usuário";
  if (profile?.account_type === "client") {
    const { data: linkedClients, error: clientsError } = await api.from("clients").select("id, tenant_id, user_id, name, phone, email, notes").eq("user_id", userData.user.id).order("name");
    if (clientsError) throw clientsError;
    const clientIds = (linkedClients ?? []).map((row) => row.id);
    const appointmentResult = clientIds.length ? await api.from("appointments").select("id, tenant_id, client_id, service_id, starts_at, status, notes").in("client_id", clientIds).order("starts_at") : { data: [], error: null };
    if (appointmentResult.error) throw appointmentResult.error;
    const serviceIds = [...new Set((appointmentResult.data ?? []).map((row) => row.service_id))];
    const serviceResult = serviceIds.length ? await api.from("services").select("id, tenant_id, name, duration_minutes, price_cents, color, active").in("id", serviceIds) : { data: [], error: null };
    if (serviceResult.error) throw serviceResult.error;
    const tenantIds = [...new Set((linkedClients ?? []).map((row) => row.tenant_id))];
    const tenantResult = tenantIds.length ? await api.from("tenants").select("id, name, timezone").in("id", tenantIds) : { data: [], error: null };
    if (tenantResult.error) throw tenantResult.error;
    const messageResult = clientIds.length ? await api.from("chat_messages").select("id, tenant_id, client_id, sender_user_id, body, read_at, created_at").in("client_id", clientIds).order("created_at") : { data: [], error: null };
    if (messageResult.error) throw messageResult.error;
    const zones = new Map((tenantResult.data ?? []).map((row) => [row.id, row.timezone]));
    const businessNames = new Map((tenantResult.data ?? []).map((row) => [row.id, row.name]));
    const data: WorkspaceData = {
      clients: (linkedClients ?? []).map((row) => ({ id: row.id, tenantId: row.tenant_id, userId: row.user_id ?? undefined, businessName: businessNames.get(row.tenant_id), name: row.name, phone: row.phone, email: row.email, notes: row.notes })),
      services: (serviceResult.data ?? []).map((row) => ({ id: row.id, tenantId: row.tenant_id, name: row.name, duration: row.duration_minutes, price: row.price_cents / 100, color: row.color, active: row.active })),
      appointments: (appointmentResult.data ?? []).map((row) => ({ id: row.id, tenantId: row.tenant_id, clientId: row.client_id, serviceId: row.service_id, ...localParts(row.starts_at, zones.get(row.tenant_id) ?? "America/Sao_Paulo"), status: row.status, notes: row.notes } as Appointment)),
      messages: (messageResult.data ?? []).map((row) => ({ id: row.id, tenantId: row.tenant_id, clientId: row.client_id, senderUserId: row.sender_user_id, body: row.body, readAt: row.read_at, createdAt: row.created_at, mine: row.sender_user_id === userData.user.id } as ChatMessage)),
    };
    return { tenantId: `client-${userData.user.id}`, identity: { name, business: "Área do aluno/cliente", email: userData.user.email ?? "", initials: initials(name), role: "client" } satisfies Identity, data };
  }
  const { data: membership, error: membershipError } = await api.from("memberships").select("tenant_id, role").eq("user_id", userData.user.id).limit(1).maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) throw new Error("Seu usuário ainda não está vinculado a um negócio.");
  const tenantId = membership.tenant_id as string;
  const [tenantResult, clientsResult, servicesResult, appointmentsResult, messagesResult] = await Promise.all([
    api.from("tenants").select("id, name, timezone").eq("id", tenantId).single(),
    api.from("clients").select("id, tenant_id, user_id, name, phone, email, notes").eq("tenant_id", tenantId).order("name"),
    api.from("services").select("id, tenant_id, name, duration_minutes, price_cents, color, active").eq("tenant_id", tenantId).order("name"),
    api.from("appointments").select("id, tenant_id, client_id, service_id, starts_at, status, notes").eq("tenant_id", tenantId).order("starts_at"),
    api.from("chat_messages").select("id, tenant_id, client_id, sender_user_id, body, read_at, created_at").eq("tenant_id", tenantId).order("created_at"),
  ]);
  const error = tenantResult.error || clientsResult.error || servicesResult.error || appointmentsResult.error || messagesResult.error;
  if (error) throw error;
  const tenant = tenantResult.data;
  const identity: Identity = { name, business: tenant.name, email: userData.user.email ?? "", initials: initials(name), role: membership.role };
  const clients: Client[] = (clientsResult.data ?? []).map((row) => ({ id: row.id, tenantId: row.tenant_id, userId: row.user_id ?? undefined, name: row.name, phone: row.phone, email: row.email, notes: row.notes }));
  const services: Service[] = (servicesResult.data ?? []).map((row) => ({ id: row.id, tenantId: row.tenant_id, name: row.name, duration: row.duration_minutes, price: row.price_cents / 100, color: row.color, active: row.active }));
  const appointments: Appointment[] = (appointmentsResult.data ?? []).map((row) => ({ id: row.id, tenantId: row.tenant_id, clientId: row.client_id, serviceId: row.service_id, ...localParts(row.starts_at, tenant.timezone), status: row.status, notes: row.notes } as Appointment));
  const messages: ChatMessage[] = (messagesResult.data ?? []).map((row) => ({ id: row.id, tenantId: row.tenant_id, clientId: row.client_id, senderUserId: row.sender_user_id, body: row.body, readAt: row.read_at, createdAt: row.created_at, mine: row.sender_user_id === userData.user.id }));
  return { tenantId, identity, data: { clients, services, appointments, messages } satisfies WorkspaceData };
}

export async function sendOnlineMessage(tenantId: string, clientId: string, body: string) {
  const api = client();
  const { data: userData, error: userError } = await api.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error("Sessão não encontrada.");
  const cleanBody = body.trim();
  if (!cleanBody || cleanBody.length > 2000) throw new Error("A mensagem deve ter entre 1 e 2.000 caracteres.");
  const { data, error } = await api.from("chat_messages").insert({ tenant_id: tenantId, client_id: clientId, sender_user_id: userData.user.id, body: cleanBody }).select("id, tenant_id, client_id, sender_user_id, body, read_at, created_at").single();
  if (error) throw error;
  return { id: data.id, tenantId: data.tenant_id, clientId: data.client_id, senderUserId: data.sender_user_id, body: data.body, readAt: data.read_at, createdAt: data.created_at, mine: true } satisfies ChatMessage;
}

export async function markOnlineMessagesRead(tenantId: string, clientId: string) {
  const api = client();
  const { data: userData, error: userError } = await api.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error("Sessão não encontrada.");
  const { error } = await api.from("chat_messages").update({ read_at: new Date().toISOString() }).eq("tenant_id", tenantId).eq("client_id", clientId).neq("sender_user_id", userData.user.id).is("read_at", null);
  if (error) throw error;
}

export async function saveOnlineClient(record: Client, exists: boolean) {
  const api = client();
  const values = { name: record.name, phone: record.phone, email: record.email, notes: record.notes, updated_at: new Date().toISOString() };
  const result = exists ? await api.from("clients").update(values).eq("id", record.id).eq("tenant_id", record.tenantId) : await api.from("clients").insert({ id: record.id, tenant_id: record.tenantId, ...values });
  if (result.error) throw result.error;
}

export async function saveOnlineService(record: Service, exists: boolean) {
  const api = client();
  const values = { name: record.name, duration_minutes: record.duration, price_cents: Math.round(record.price * 100), color: record.color, active: record.active, updated_at: new Date().toISOString() };
  const result = exists ? await api.from("services").update(values).eq("id", record.id).eq("tenant_id", record.tenantId) : await api.from("services").insert({ id: record.id, tenant_id: record.tenantId, ...values });
  if (result.error) throw result.error;
}

export async function saveOnlineAppointment(record: Appointment, exists: boolean) {
  const api = client();
  const values = { client_id: record.clientId, service_id: record.serviceId, starts_at: new Date(`${record.date}T${record.time}:00`).toISOString(), status: record.status, notes: record.notes };
  const result = exists ? await api.from("appointments").update({ ...values, updated_at: new Date().toISOString() }).eq("id", record.id).eq("tenant_id", record.tenantId) : await api.from("appointments").insert({ id: record.id, tenant_id: record.tenantId, ...values });
  if (result.error) throw result.error;
}
