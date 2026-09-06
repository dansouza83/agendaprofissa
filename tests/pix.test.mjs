import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildPixPayload, normalizePixKey, pixCrc16, pixPaymentStage, validatePixReceipt, validatePixSettings } from "../app/lib/pix.ts";
import { appointmentWhatsAppUrl } from "../app/lib/whatsapp.ts";

const settings = { tenantId: "test", pixKey: "123e4567-e12b-12d1-a456-426655440000", pixKeyType: "random", pixHolderName: "Fulano de Tal", pixHolderCity: "BRASILIA", updatedAt: null };
function fields(payload) {
  const result = {};
  for (let at = 0; at < payload.length;) {
    const id = payload.slice(at, at + 2), length = Number(payload.slice(at + 2, at + 4));
    result[id] = payload.slice(at + 4, at + 4 + length); at += length + 4;
    assert.ok(at <= payload.length);
  }
  return result;
}

test("CRC16 matches official Banco Central static QR sample (section 2.6.3)", () => {
  const sample = "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
  assert.equal(pixCrc16(sample), "1D3D");
  assert.equal(pixCrc16("123456789"), "29B1");
});

test("PIX encodes exact amount, professional key and appointment reference", () => {
  const payload = buildPixPayload(settings, 4501, "booking001");
  const data = fields(payload);
  assert.equal(data["54"], "45.01");
  assert.equal(data["53"], "986");
  assert.equal(data["58"], "BR");
  assert.equal(data["59"], "Fulano de Tal");
  assert.equal(fields(data["26"])["01"], settings.pixKey);
  assert.equal(fields(data["62"])["05"], "booking001");
  assert.equal(data["63"], pixCrc16(payload.slice(0, -4)));
  assert.notEqual(payload, buildPixPayload(settings, 4501, "booking002"));
});

test("PIX rejects missing recipient, unsupported key, invalid amount and txid", () => {
  for (const value of [0, -1, NaN, Infinity, 1.5, 100000000000]) assert.throws(() => buildPixPayload(settings, value, "booking"));
  for (const txid of ["", "a".repeat(26), "booking-1", "a<script>"]) assert.throws(() => buildPixPayload(settings, 100, txid));
  for (const patch of [{ pixKey: "" }, { pixKey: "invalid" }, { pixKeyType: "" }, { pixHolderName: "" }, { pixHolderCity: "" }]) assert.throws(() => buildPixPayload({ ...settings, ...patch }, 100, "booking"));
});

test("key normalization does not confuse phone and CPF", () => {
  assert.equal(normalizePixKey("(48) 99999-9999", "phone"), "+5548999999999");
  assert.equal(normalizePixKey("123.456.789-09", "cpf"), "12345678909");
  assert.equal(normalizePixKey("TESTE@EXAMPLE.COM", "email"), "teste@example.com");
  assert.throws(() => normalizePixKey("+5548999999999", "cpf"));
  assert.throws(() => normalizePixKey("x".repeat(80) + "@example.com", "email"));
});

test("recipient text is normalized and disabled PIX stays disabled", () => {
  const clean = validatePixSettings({ ...settings, pixHolderName: "João da Silva", pixHolderCity: "Florianópolis" });
  assert.equal(clean.pixHolderName, "Joao da Silva");
  assert.equal(clean.pixHolderCity, "Florianopolis");
  assert.equal(validatePixSettings({ ...settings, pixKey: " " }).pixKey, "");
  assert.throws(() => validatePixSettings({ ...settings, pixHolderName: "a".repeat(26) }));
});

test("upload and review never imply payment confirmation", () => {
  const appointment = { paymentStatus: "pending" };
  assert.equal(pixPaymentStage(appointment), 0);
  assert.equal(pixPaymentStage(appointment, { status: "submitted" }), 1);
  assert.equal(pixPaymentStage(appointment, { status: "submitted", reviewStartedAt: "2026-09-02" }), 2);
  assert.equal(pixPaymentStage(appointment, { status: "rejected", reviewStartedAt: "2026-09-02" }), 0);
  assert.notEqual(pixPaymentStage(appointment, { status: "confirmed" }), 3);
  assert.equal(pixPaymentStage({ paymentStatus: "paid" }, { status: "confirmed" }), 3);
});

test("receipts allow bounded images and PDF, not empty or executable files", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) validatePixReceipt({ type, size: 5242880 });
  for (const file of [{ type: "text/html", size: 10 }, { type: "image/svg+xml", size: 10 }, { type: "application/pdf", size: 0 }, { type: "application/pdf", size: 5242881 }]) assert.throws(() => validatePixReceipt(file));
});

test("PIX text and status colors meet 4.5:1 in light and dark themes", () => {
  const luminance = hex => {
    const c = hex.match(/\w\w/g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  };
  for (const [fg, bg] of [["435b51", "f4f8f6"], ["b3cbc1", "0c1c16"], ["176b55", "e3f3ec"], ["91e1c7", "193b2f"], ["614400", "fff2d6"], ["f3d799", "342a16"]]) {
    const [a, b] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
    assert.ok((a + .05) / (b + .05) >= 4.5, fg + " on " + bg);
  }
});

test("regular appointment edits cannot reset payment status", async () => {
  const source = await readFile(new URL("../app/lib/supabase.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source.slice(source.indexOf("export async function saveOnlineAppointment")), /payment_status:/);
});

test("receipt upload policy uses the Storage path, never the client name", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260903112338_fix_payment_receipt_upload_policy.sql", import.meta.url), "utf8");
  assert.doesNotMatch(sql, /storage\.foldername\((?:name|c\.name)\)/);
  assert.match(sql, /a\.tenant_id::text = \(storage\.foldername\(storage\.objects\.name\)\)\[1\]/);
  assert.match(sql, /a\.id::text = \(storage\.foldername\(storage\.objects\.name\)\)\[2\]/);
  assert.match(sql, /\[3\] = \(select auth\.uid\(\)::text\)/);
  assert.match(sql, /c\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /a\.payment_status = 'pending'/);
  assert.match(sql, /a\.status <> 'cancelado'/);
});

test("orphan receipt cleanup keeps owner and participant access checks", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260903112936_fix_orphan_receipt_cleanup.sql", import.meta.url), "utf8");
  assert.match(sql, /bucket_id = 'appointment-payment-receipts'/);
  assert.match(sql, /owner_id = \(select auth\.uid\(\)::text\)\s+and not exists/);
  assert.match(sql, /orphan_check\.receipt_path = storage\.objects\.name/);
  assert.match(sql, /private\.has_active_subscription\(s\.tenant_id\)/);
  assert.match(sql, /m\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /c\.user_id = \(select auth\.uid\(\)\)/);
  assert.doesNotMatch(sql, /for delete|disable row level security|security definer/i);
});

test("manual WhatsApp links preserve recipient, schedule and pending status", () => {
  const link = new URL(appointmentWhatsAppUrl({ phone: "(11) 99999-9999", clientName: "João Silva", serviceName: "Pilates & mobilidade", date: "2026-09-03", time: "14:30", paymentStatus: "pending", businessName: "Studio Teste" }));
  assert.equal(link.origin, "https://wa.me");
  assert.equal(link.pathname, "/5511999999999");
  assert.deepEqual([...link.searchParams.keys()], ["text"]);
  const message = link.searchParams.get("text");
  for (const text of ["João", "Pilates & mobilidade", "03/09/2026", "14:30", "Studio Teste", "O pagamento ainda está pendente de confirmação"]) assert.ok(message.includes(text));
  assert.doesNotMatch(message, /pagamento foi confirmado/);
});

test("manual WhatsApp confirmation uses paid status and rejects a missing phone", () => {
  const input = { phone: "+55 11 99999-9999", clientName: "Cliente", serviceName: "Atendimento", date: "2026-09-03", time: "14:30", paymentStatus: "paid", businessName: "Studio Teste" };
  const message = new URL(appointmentWhatsAppUrl(input)).searchParams.get("text");
  assert.match(message, /Seu pagamento foi confirmado/);
  assert.doesNotMatch(message, /pagamento ainda está pendente/);
  assert.equal(appointmentWhatsAppUrl({ ...input, phone: "" }), null);
  assert.equal(appointmentWhatsAppUrl({ ...input, phone: "sem telefone" }), null);
});
