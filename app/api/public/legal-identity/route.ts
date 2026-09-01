import { publicEdgeJson } from "../../../lib/billing-server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET() {
  if (!supabaseUrl || !publishableKey) {
    return Response.json({
      legalName: "[PREENCHER RAZÃO SOCIAL OU NOME DO RESPONSÁVEL]",
      document: "[PREENCHER CNPJ OU CPF]",
      address: "[PREENCHER ENDEREÇO COMERCIAL]",
      supportEmail: "[PREENCHER E-MAIL DE SUPORTE]",
      privacyEmail: "[PREENCHER E-MAIL DE PRIVACIDADE]",
      configured: false,
    }, { headers: { "Cache-Control": "no-store" } });
  }
  return publicEdgeJson("agenda-public-legal-identity", {});
}
