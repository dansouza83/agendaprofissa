import { edgeWebhook } from "../../../lib/billing-server";

export async function POST(request: Request) {
  return edgeWebhook(request);
}
