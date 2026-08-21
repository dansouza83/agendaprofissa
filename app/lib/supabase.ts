import { createClient, type AuthChangeEvent, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Appointment, Client, Identity, Service, WorkspaceData } from "../domain";

export type AccountType = "professional" | "client";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
export const supabaseConfigured = Boolean(url && publishableKey);
let singleton: SupabaseClient | null = null;
const rememberKey = "agenda-facil-remember-access";

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
  if (error) throw error;
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

export async function sendPasswordRecovery(email: string) {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "");
  const { error } = await client().auth.resetPasswordForEmail(email, { redirectTo: `${baseUrl}/sistema?recuperar-senha=1` });
  if (error) throw error;
}

export async function updateRecoveredPassword(password: string) {
  const { error } = await client().auth.updateUser({ password });
  if (error) throw error;
}

export async function updateDeveloperPassword(password: string) {
  const { error } = await client().auth.updateUser({ password, data: { force_password_change: false } });
  if (error) throw error;
}

export async function signUpOnline(email: string, password: string, fullName: string, businessName: string, accountType: AccountType) {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "");
  const { data, error } = await client().auth.signUp({ email, password, options: { emailRedirectTo: `${baseUrl}/sistema`, data: { full_name: fullName, business_name: businessName, account_type: accountType, legal_acceptance: true, terms_version: "2026-08-17", privacy_version: "2026-08-17" } } });
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
  return { active: Boolean(result.active), prices: result.prices ?? { monthly: 49.9, annual: 478.8 } };
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
    const { data: linkedClients, error: clientsError } = await api.from("clients").select("id, tenant_id, name, phone, email, notes").eq("user_id", userData.user.id).order("name");
    if (clientsError) throw clientsError;
    const clientIds = (linkedClients ?? []).map((row) => row.id);
    const appointmentResult = clientIds.length ? await api.from("appointments").select("id, tenant_id, client_id, service_id, starts_at, status, notes").in("client_id", clientIds).order("starts_at") : { data: [], error: null };
    if (appointmentResult.error) throw appointmentResult.error;
    const serviceIds = [...new Set((appointmentResult.data ?? []).map((row) => row.service_id))];
    const serviceResult = serviceIds.length ? await api.from("services").select("id, tenant_id, name, duration_minutes, price_cents, color, active").in("id", serviceIds) : { data: [], error: null };
    if (serviceResult.error) throw serviceResult.error;
    const tenantIds = [...new Set((linkedClients ?? []).map((row) => row.tenant_id))];
    const tenantResult = tenantIds.length ? await api.from("tenants").select("id, timezone").in("id", tenantIds) : { data: [], error: null };
    if (tenantResult.error) throw tenantResult.error;
    const zones = new Map((tenantResult.data ?? []).map((row) => [row.id, row.timezone]));
    const data: WorkspaceData = {
      clients: (linkedClients ?? []).map((row) => ({ id: row.id, tenantId: row.tenant_id, name: row.name, phone: row.phone, email: row.email, notes: row.notes })),
      services: (serviceResult.data ?? []).map((row) => ({ id: row.id, tenantId: row.tenant_id, name: row.name, duration: row.duration_minutes, price: row.price_cents / 100, color: row.color, active: row.active })),
      appointments: (appointmentResult.data ?? []).map((row) => ({ id: row.id, tenantId: row.tenant_id, clientId: row.client_id, serviceId: row.service_id, ...localParts(row.starts_at, zones.get(row.tenant_id) ?? "America/Sao_Paulo"), status: row.status, notes: row.notes } as Appointment)),
    };
    return { tenantId: `client-${userData.user.id}`, identity: { name, business: "Área do aluno/cliente", email: userData.user.email ?? "", initials: initials(name), role: "client" } satisfies Identity, data };
  }
  const { data: membership, error: membershipError } = await api.from("memberships").select("tenant_id, role").eq("user_id", userData.user.id).limit(1).maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) throw new Error("Seu usuário ainda não está vinculado a um negócio.");
  const tenantId = membership.tenant_id as string;
  const [tenantResult, clientsResult, servicesResult, appointmentsResult] = await Promise.all([
    api.from("tenants").select("id, name, timezone").eq("id", tenantId).single(),
    api.from("clients").select("id, tenant_id, name, phone, email, notes").eq("tenant_id", tenantId).order("name"),
    api.from("services").select("id, tenant_id, name, duration_minutes, price_cents, color, active").eq("tenant_id", tenantId).order("name"),
    api.from("appointments").select("id, tenant_id, client_id, service_id, starts_at, status, notes").eq("tenant_id", tenantId).order("starts_at"),
  ]);
  const error = tenantResult.error || clientsResult.error || servicesResult.error || appointmentsResult.error;
  if (error) throw error;
  const tenant = tenantResult.data;
  const identity: Identity = { name, business: tenant.name, email: userData.user.email ?? "", initials: initials(name), role: membership.role };
  const clients: Client[] = (clientsResult.data ?? []).map((row) => ({ id: row.id, tenantId: row.tenant_id, name: row.name, phone: row.phone, email: row.email, notes: row.notes }));
  const services: Service[] = (servicesResult.data ?? []).map((row) => ({ id: row.id, tenantId: row.tenant_id, name: row.name, duration: row.duration_minutes, price: row.price_cents / 100, color: row.color, active: row.active }));
  const appointments: Appointment[] = (appointmentsResult.data ?? []).map((row) => ({ id: row.id, tenantId: row.tenant_id, clientId: row.client_id, serviceId: row.service_id, ...localParts(row.starts_at, tenant.timezone), status: row.status, notes: row.notes } as Appointment));
  return { tenantId, identity, data: { clients, services, appointments } satisfies WorkspaceData };
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
