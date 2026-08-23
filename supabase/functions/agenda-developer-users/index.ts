import { createClient, type User } from "npm:@supabase/supabase-js@2";

type AccountType = "professional" | "client";

const developerEmail = "dansouzafloripa@gmail.com";
const service = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const value = (input: unknown) => String(input ?? "").trim();
const validEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email);
const validPassword = (password: string) => password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
const accountType = (input: unknown): AccountType | null => input === "professional" || input === "client" ? input : null;

async function requireDeveloper(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("UNAUTHORIZED");
  const { data, error } = await service.auth.getUser(token);
  if (error || !data.user) throw new Error("UNAUTHORIZED");
  if (data.user.email?.toLowerCase() !== developerEmail) throw new Error("FORBIDDEN");
  return data.user;
}

function userView(user: User, profile: { full_name: string; account_type: string } | undefined, membership: { tenant_id: string; role: string } | undefined, tenant: { name: string } | undefined, subscription: { status: string; payment_status: string } | undefined) {
  const bannedUntil = user.banned_until ? new Date(user.banned_until) : null;
  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name || String(user.user_metadata?.full_name ?? "") || user.email?.split("@")[0] || "Usuário",
    accountType: profile?.account_type === "client" ? "client" : "professional",
    business: tenant?.name ?? null,
    role: membership?.role ?? null,
    createdAt: user.created_at,
    emailConfirmed: Boolean(user.email_confirmed_at),
    suspended: Boolean(bannedUntil && bannedUntil.getTime() > Date.now()),
    subscription: subscription?.status === "authorized" && subscription.payment_status === "approved" ? "active" : subscription ? "pending" : null,
  };
}

async function listUsers() {
  const { data: authData, error: authError } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authError) throw authError;
  const users = authData.users;
  const ids = users.map((user) => user.id);
  if (!ids.length) return { users: [], businesses: [] };
  const [profiles, memberships, tenants, subscriptions] = await Promise.all([
    service.from("profiles").select("id, full_name, account_type").in("id", ids),
    service.from("memberships").select("user_id, tenant_id, role").in("user_id", ids),
    service.from("tenants").select("id, name, slug").order("name"),
    service.from("subscriptions").select("tenant_id, status, payment_status"),
  ]);
  const error = profiles.error || memberships.error || tenants.error || subscriptions.error;
  if (error) throw error;
  const profilesById = new Map((profiles.data ?? []).map((item) => [item.id, item]));
  const membershipsByUser = new Map((memberships.data ?? []).map((item) => [item.user_id, item]));
  const tenantsById = new Map((tenants.data ?? []).map((item) => [item.id, item]));
  const subscriptionsByTenant = new Map((subscriptions.data ?? []).map((item) => [item.tenant_id, item]));
  return {
    users: users.map((user) => {
      const membership = membershipsByUser.get(user.id);
      const tenant = membership ? tenantsById.get(membership.tenant_id) : undefined;
      return userView(user, profilesById.get(user.id), membership, tenant, membership ? subscriptionsByTenant.get(membership.tenant_id) : undefined);
    }).sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR")),
    businesses: (tenants.data ?? []).map((tenant) => ({ id: tenant.id, name: tenant.name, slug: tenant.slug })),
  };
}

async function createUser(input: Record<string, unknown>) {
  const email = value(input.email).toLowerCase();
  const fullName = value(input.fullName);
  const password = String(input.password ?? "");
  const type = accountType(input.accountType);
  const businessName = value(input.businessName);
  const tenantId = value(input.tenantId);
  if (!validEmail(email) || fullName.length < 2 || !type) throw new Error("Informe nome, e-mail e tipo de conta válidos.");
  if (!validPassword(password)) throw new Error("A senha temporária precisa ter pelo menos 8 caracteres, com letras e números.");
  if (type === "professional" && businessName.length < 2) throw new Error("Informe o nome do negócio do profissional.");
  if (type === "client" && tenantId) {
    const { data, error } = await service.from("tenants").select("id").eq("id", tenantId).maybeSingle();
    if (error || !data) throw new Error("Escolha um negócio válido para vincular o cliente.");
  }
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      account_type: type,
      business_name: type === "professional" ? businessName : "",
      legal_acceptance: true,
      terms_version: "2026-08-17",
      privacy_version: "2026-08-17",
    },
  });
  if (error || !data.user) throw error ?? new Error("Não foi possível criar a conta.");
  if (type === "client" && tenantId) {
    const { error: clientError } = await service.from("clients").insert({
      tenant_id: tenantId,
      user_id: data.user.id,
      name: fullName,
      phone: value(input.phone),
      email,
      notes: "Cadastro criado pelo painel do desenvolvedor.",
    });
    if (clientError) {
      await service.auth.admin.deleteUser(data.user.id);
      throw clientError;
    }
  }
  return data.user.id;
}

async function updateUser(input: Record<string, unknown>, developerId: string) {
  const userId = value(input.userId);
  const fullName = value(input.fullName);
  const email = value(input.email).toLowerCase();
  const password = String(input.password ?? "");
  if (!userId || userId === developerId) throw new Error("A conta do desenvolvedor não pode ser alterada aqui.");
  if (!validEmail(email) || fullName.length < 2) throw new Error("Informe nome e e-mail válidos.");
  if (password && !validPassword(password)) throw new Error("A nova senha precisa ter pelo menos 8 caracteres, com letras e números.");
  const { data: currentData, error: currentError } = await service.auth.admin.getUserById(userId);
  if (currentError || !currentData.user) throw new Error("Usuário não encontrado.");
  const { error } = await service.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true,
    ...(password ? { password } : {}),
    user_metadata: { ...currentData.user.user_metadata, full_name: fullName, email },
  });
  if (error) throw error;
  const [profileUpdate, clientUpdate] = await Promise.all([
    service.from("profiles").update({ full_name: fullName, updated_at: new Date().toISOString() }).eq("id", userId),
    service.from("clients").update({ name: fullName, email, updated_at: new Date().toISOString() }).eq("user_id", userId),
  ]);
  if (profileUpdate.error || clientUpdate.error) throw profileUpdate.error ?? clientUpdate.error;
}

async function setSuspended(input: Record<string, unknown>, developerId: string) {
  const userId = value(input.userId);
  if (!userId || userId === developerId) throw new Error("A conta do desenvolvedor não pode ser suspensa aqui.");
  const { error } = await service.auth.admin.updateUserById(userId, { ban_duration: input.suspended === true ? "876000h" : "none" });
  if (error) throw error;
}

async function deleteUser(input: Record<string, unknown>, developerId: string) {
  const userId = value(input.userId);
  if (!userId || userId === developerId) throw new Error("A conta do desenvolvedor não pode ser excluída aqui.");
  const { data: owned, error: ownershipError } = await service.from("memberships").select("tenant_id").eq("user_id", userId).eq("role", "owner").limit(1);
  if (ownershipError) throw ownershipError;
  if ((owned ?? []).length) throw new Error("Este profissional é proprietário de um negócio. Transfira a propriedade ou encerre o negócio conscientemente antes de excluir a conta.");
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) throw error;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    const developer = await requireDeveloper(request);
    const input = await request.json() as Record<string, unknown>;
    const action = value(input.action);
    if (action === "list") return json(await listUsers());
    if (action === "create") {
      const userId = await createUser(input);
      return json({ saved: true, userId });
    }
    if (action === "update") {
      await updateUser(input, developer.id);
      return json({ saved: true });
    }
    if (action === "suspend") {
      await setSuspended(input, developer.id);
      return json({ saved: true });
    }
    if (action === "delete") {
      await deleteUser(input, developer.id);
      return json({ saved: true });
    }
    return json({ error: "Operação desconhecida." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha interna.";
    if (message === "UNAUTHORIZED") return json({ error: "Sessão inválida." }, 401);
    if (message === "FORBIDDEN") return json({ error: "Acesso permitido somente ao desenvolvedor autorizado." }, 403);
    return json({ error: message }, 400);
  }
});
