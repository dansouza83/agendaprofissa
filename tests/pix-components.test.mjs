import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Render the real UI without a browser, credentials or remote requests.
const source = await readFile(new URL("../app/sistema/pix-payments.tsx", import.meta.url), "utf8");
let js = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const networkStub = "data:text/javascript," + encodeURIComponent("export const prepareOnlinePixReceipt = () => { throw new Error('Unexpected network'); }; export const reviewOnlinePixReceipt = prepareOnlinePixReceipt, saveOnlinePixSettings = prepareOnlinePixReceipt, uploadOnlinePixReceipt = prepareOnlinePixReceipt;");
for (const dependency of ["react", "react/jsx-runtime", "qrcode.react"]) js = js.replaceAll('from "' + dependency + '"', 'from "' + import.meta.resolve(dependency) + '"');
js = js.replace('from "../lib/pix"', 'from "' + new URL("../app/lib/pix.ts", import.meta.url).href + '"').replace('from "../lib/supabase"', 'from "' + networkStub + '"');
const { ClientPixPayment, ProfessionalPixManagement } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const appointment = { id: "123e4567-e12b-12d1-a456-426655440001", tenantId: "t", clientId: "c", serviceId: "s", date: "2026-09-03", time: "10:00", amountCents: 4501, status: "pendente", paymentStatus: "pending" };
const settings = { tenantId: "t", pixKey: "123e4567-e12b-12d1-a456-426655440000", pixKeyType: "random", pixHolderName: "Teste", pixHolderCity: "BRASILIA" };
const receipt = { id: "r", tenantId: "t", appointmentId: appointment.id, clientId: "c", paymentMethod: "pix", receiptOriginalName: "receipt.pdf", status: "submitted", createdAt: "2026-09-02T12:00:00Z" };
const props = { appointment, settings, client: { id: "c" }, submissions: [], online: true, onSubmitted() {} };
const render = extra => renderToStaticMarkup(createElement(ClientPixPayment, { ...props, ...extra }));

test("client checkout renders a local QR, copy button and labeled file input", () => {
  const html = render();
  assert.match(html, /<svg/);
  assert.match(html, /Copiar PIX Copia e Cola/);
  assert.match(html, /45,01/);
  assert.match(html, /aria-current="step"/);
  assert.match(html, /type="file"/);
  assert.doesNotMatch(html, /<img[^>]+https:/);
});
test("uploaded and paid states no longer present another payment action", () => {
  for (const extra of [{ submissions: [receipt] }, { appointment: { ...appointment, paymentStatus: "paid", paymentConfirmedAt: receipt.createdAt }, submissions: [{ ...receipt, status: "confirmed" }] }]) {
    const html = render(extra);
    assert.doesNotMatch(html, /<svg|type="file"|Copiar PIX/);
    assert.match(html, /Histórico de comprovantes/);
  }
});
test("requested replacement preserves reason, prevents duplicate payment and permits upload", () => {
  const html = render({ submissions: [{ ...receipt, status: "rejected", rejectionReason: "Arquivo ilegível <script>" }] });
  assert.match(html, /Reenviar comprovante/);
  assert.match(html, /não pague novamente/);
  assert.match(html, /Enviar novo comprovante/);
  assert.match(html, /Arquivo ilegível &lt;script&gt;/);
  assert.doesNotMatch(html, /<svg|Copiar PIX/);
});
test("legacy settings show key fallback rather than an invalid QR", () => {
  const html = render({ settings: { pixKey: "legacy@example.com" } });
  assert.match(html, /QR Code indisponível/);
  assert.match(html, /Copiar chave/);
  assert.doesNotMatch(html, /<svg/);
});
test("professional view shows review controls, statuses and rejection history", () => {
  const data = { clients: [{ id: "c", name: "Cliente" }], services: [{ id: "s", name: "Serviço" }], appointments: [appointment], messages: [], paymentSettings: [settings], paymentSubmissions: [receipt, { ...receipt, id: "old", status: "rejected", rejectionReason: "Arquivo ilegível" }] };
  const html = renderToStaticMarkup(createElement(ProfessionalPixManagement, { data, tenantId: "t", online: true, onData() {}, onRefresh() {}, onConfirm() {}, notify() {} }));
  assert.match(html, /Solicitar novo comprovante/);
  assert.match(html, /Iniciar conferência/);
  assert.match(html, /Confirmar recebimento/);
  assert.match(html, /Arquivo ilegível/);
});
