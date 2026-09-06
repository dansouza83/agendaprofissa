import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { subscriptionPrices } from "../app/lib/subscription-plans.ts";

const source = await readFile(new URL("../supabase/functions/agenda-billing/index.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source.replace(/^import .*?;\s*/s, ""), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function checkoutHarness({ professional = true, active = false } = {}) {
  let handler;
  const providerCalls = [], stored = [];
  const service = {
    auth: { async getUser() { return { data: { user: { id: "test-user", email: "payer@example.test" } }, error: null }; } },
    async rpc(name) {
      assert.equal(name, "admin_get_mp_credentials");
      return { data: [{ access_token: "test-only-provider-token", monthly_price: 35, annual_price: 350 }], error: null };
    },
    from(table) {
      assert.ok(["memberships", "subscriptions"].includes(table), "Checkout must never use appointment payment settings");
      return {
        select() { return this; }, eq() { return this; }, limit() { return this; },
        async maybeSingle() {
          return { data: table === "memberships" ? professional ? { tenant_id: "professional-tenant", role: "owner" } : null : active ? { status: "authorized", payment_status: "approved" } : null, error: null };
        },
        async upsert(values) { stored.push(values); return { error: null }; },
      };
    },
  };
  new Function("createClient", "Deno", "fetch", code)(
    () => service,
    { env: { get: name => name === "SUPABASE_URL" ? "https://test.supabase.co" : "test-only-server-key" }, serve: callback => { handler = callback; } },
    async (url, options) => {
      assert.equal(url, "https://api.mercadopago.com/preapproval");
      assert.equal(options.method, "POST");
      providerCalls.push(JSON.parse(options.body));
      return Response.json({ id: "provider-subscription", init_point: "https://www.mercadopago.com.br/checkout/test" });
    },
  );
  return {
    providerCalls, stored,
    run: (plan, authenticated = true) => handler(new Request("https://example.test/billing", {
      method: "POST", headers: { "Content-Type": "application/json", ...(authenticated ? { Authorization: "Bearer test-only-session" } : {}) },
      // Deliberately untrusted prices/recipient: the backend must ignore them.
      body: JSON.stringify({ action: "checkout", plan, siteUrl: "https://example.test", amount: 1, tenantId: "other", pixKey: "untrusted@example.test" }),
    })),
  };
}

test("monthly and annual subscriptions use server prices and preserve hosted payment choice", async () => {
  assert.deepEqual(subscriptionPrices, { monthly: 35, annual: 350 });
  for (const [plan, amount, frequency] of [["monthly", 35, 1], ["annual", 350, 12]]) {
    const harness = checkoutHarness();
    const response = await harness.run(plan);
    assert.equal(response.status, 200);
    assert.deepEqual(harness.providerCalls[0].auto_recurring, { frequency, frequency_type: "months", transaction_amount: amount, currency_id: "BRL" });
    assert.equal(harness.providerCalls[0].external_reference, "professional-tenant");
    assert.equal(harness.providerCalls[0].status, "pending");
    assert.equal(harness.stored[0].amount_cents, amount * 100);
    assert.equal(harness.stored[0].payment_status, "pending");
    assert.doesNotMatch(JSON.stringify(harness.providerCalls), /untrusted@example|application_fee|marketplace_fee|payment_methods_allowed/);
  }
});

test("clients, missing sessions and invalid plans cannot create platform charges", async () => {
  for (const [options, plan, auth, expected] of [[{ professional: false }, "monthly", true, 403], [{}, "monthly", false, 401], [{}, "invalid", true, 400]]) {
    const harness = checkoutHarness(options);
    assert.equal((await harness.run(plan, auth)).status, expected);
    assert.equal(harness.providerCalls.length, 0);
    assert.equal(harness.stored.length, 0);
  }
});

test("an active subscription is neither recreated nor repriced", async () => {
  const harness = checkoutHarness({ active: true });
  assert.equal((await harness.run("monthly")).status, 409);
  assert.equal(harness.providerCalls.length, 0);
  assert.equal(harness.stored.length, 0);
});
