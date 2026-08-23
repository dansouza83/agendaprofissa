import { edgeJson } from "../../../lib/billing-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  return edgeJson(request, "agenda-developer-users", { action: "list" });
}

export async function POST(request: Request) {
  try {
    return edgeJson(request, "agenda-developer-users", await request.json() as Record<string, unknown>);
  } catch {
    return Response.json({ error: "Solicitação inválida." }, { status: 400 });
  }
}
