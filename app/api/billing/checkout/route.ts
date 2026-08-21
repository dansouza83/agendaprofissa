import { edgeJson, publicSiteUrl } from "../../../lib/billing-server";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { plan?: string };
    return edgeJson(request, "agenda-billing", { action: "checkout", plan: body.plan, siteUrl: publicSiteUrl(request) });
  } catch {
    return Response.json({ error: "Solicitação inválida." }, { status: 400 });
  }
}
