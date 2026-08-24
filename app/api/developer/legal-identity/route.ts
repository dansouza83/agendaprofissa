import { edgeJson } from "../../../lib/billing-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  return edgeJson(request, "agenda-billing", { action: "developerLegalIdentity" });
}

export async function POST(request: Request) {
  try {
    return edgeJson(request, "agenda-billing", { action: "saveLegalIdentity", ...(await request.json() as Record<string, unknown>) });
  } catch {
    return Response.json({ error: "Solicitação inválida." }, { status: 400 });
  }
}
