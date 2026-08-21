import { edgeJson, publicSiteUrl } from "../../../lib/billing-server";

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("environment");
  return edgeJson(request, "agenda-billing", { action: "developerPlans", environment: requested });
}

export async function POST(request: Request) {
  try {
    return edgeJson(request, "agenda-billing", { action: "savePlans", siteUrl: publicSiteUrl(request), ...(await request.json() as Record<string, unknown>) });
  } catch {
    return Response.json({ error: "Solicitação inválida." }, { status: 400 });
  }
}
