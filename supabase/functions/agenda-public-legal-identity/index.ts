import { createClient } from "npm:@supabase/supabase-js@2";

type LegalIdentityRow = {
  legal_name: string;
  document: string;
  address: string;
  support_email: string;
  privacy_email: string;
  configured: boolean;
};

const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async request => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const { data, error } = await service.rpc("admin_get_legal_identity");
  if (error) return json({ error: "Não foi possível carregar a identificação." }, 500);
  const identity = data?.[0] as LegalIdentityRow | undefined;
  return json({
    legalName: identity?.legal_name || "[PREENCHER RAZÃO SOCIAL OU NOME DO RESPONSÁVEL]",
    document: identity?.document || "[PREENCHER CNPJ OU CPF]",
    address: identity?.address || "[PREENCHER ENDEREÇO COMERCIAL]",
    supportEmail: identity?.support_email || "[PREENCHER E-MAIL DE SUPORTE]",
    privacyEmail: identity?.privacy_email || "[PREENCHER E-MAIL DE PRIVACIDADE]",
    configured: Boolean(identity?.configured),
  });
});
