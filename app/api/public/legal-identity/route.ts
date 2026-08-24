import { publicEdgeJson } from "../../../lib/billing-server";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET() {
  return publicEdgeJson("agenda-public-legal-identity", {});
}
