const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  if (!supabaseUrl || !publishableKey) {
    return Response.json(
      { monthlyPrice: 50, annualPrice: 350, currency: "BRL" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const response = await fetch(`${supabaseUrl}/functions/v1/agenda-public-pricing`, {
    method: "GET",
    cache: "no-store",
    headers: { apikey: publishableKey, "Cache-Control": "no-store" },
  });
  return new Response(await response.text(), {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
