import { edgeJson } from "../../../lib/billing-server";

export async function GET(request: Request) {
  return edgeJson(request, "agenda-billing", { action: "status" });
}
