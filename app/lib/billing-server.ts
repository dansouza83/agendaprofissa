const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

function configured() {
  if (!supabaseUrl || !publishableKey) throw new Error("Supabase não configurado.");
  return { supabaseUrl, publishableKey };
}

export async function edgeJson(request: Request, functionName: string, payload: Record<string, unknown>) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Sessão inválida." }, { status: 401 });
  const env = configured();
  const response = await fetch(`${env.supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      apikey: env.publishableKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return new Response(await response.text(), {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
  });
}

export async function edgeWebhook(request: Request) {
  const env = configured();
  const response = await fetch(`${env.supabaseUrl}/functions/v1/agenda-mp-webhook${new URL(request.url).search}`, {
    method: "POST",
    headers: {
      apikey: env.publishableKey,
      "Content-Type": request.headers.get("content-type") || "application/json",
      "x-request-id": request.headers.get("x-request-id") || "",
      "x-signature": request.headers.get("x-signature") || "",
    },
    body: await request.text(),
  });
  return new Response(await response.text(), {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
  });
}

export function publicSiteUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
}
