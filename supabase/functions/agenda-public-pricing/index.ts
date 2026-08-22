import { createClient } from "npm:@supabase/supabase-js@2";

const service = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
});

Deno.serve(async (request) => {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const { data, error } = await service.rpc("admin_get_mp_credentials", { requested_environment: null });
  if (error) return json({ error: "Não foi possível consultar os planos." }, 500);
  const current = data?.[0];
  if (!current) return json({ error: "Planos ainda não configurados." }, 404);
  return json({
    monthlyPrice: Number(current.monthly_price),
    annualPrice: Number(current.annual_price),
    currency: "BRL",
  });
});
