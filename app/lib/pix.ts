import type { Appointment, PaymentSubmission, PixKeyType, TenantPaymentSettings } from "../domain";

export function normalizePixKey(value: string, type: PixKeyType | "" = "") {
  let key = value.trim();
  if (type === "cpf" || type === "cnpj") key = key.replace(/[.\-/\s]/g, "");
  if (type === "phone") {
    key = key.replace(/[()\s-]/g, "");
    if (/^\d{10,11}$/.test(key)) key = `+55${key}`;
  }
  if (type === "email" || type === "random") key = key.toLowerCase();
  const patterns: Record<PixKeyType, RegExp> = {
    cpf: /^\d{11}$/, cnpj: /^[A-Z\d]{12}\d{2}$/i,
    email: /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i,
    phone: /^\+[1-9]\d{7,14}$/, random: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
  };
  if (!type || key.length > 77 || !patterns[type]?.test(key)) {
    throw new Error("Confira o tipo e o formato da chave PIX cadastrada no seu banco.");
  }
  return key;
}

function receiverText(value: string, limit: number, label: string) {
  const clean = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 .'-]/g, "").replace(/\s+/g, " ").trim();
  if (!clean || clean.length > limit) throw new Error(`${label}: preencha até ${limit} caracteres, sem acentos ou símbolos especiais.`);
  return clean;
}

export function validatePixSettings(settings: TenantPaymentSettings): TenantPaymentSettings {
  if (!settings.pixKey.trim()) return { ...settings, pixKey: "", pixKeyType: "", pixHolderName: "", pixHolderCity: "" };
  return { ...settings, pixKey: normalizePixKey(settings.pixKey, settings.pixKeyType),
    pixHolderName: receiverText(settings.pixHolderName ?? "", 25, "Nome do recebedor"),
    pixHolderCity: receiverText(settings.pixHolderCity ?? "", 15, "Cidade do recebedor") };
}

// BR Code/EMV TLV and CRC16/CCITT-FALSE, per Banco Central's Pix initiation manual.
function field(id: string, value: string) {
  const length = new TextEncoder().encode(value).length;
  if (length > 99) throw new Error("Campo PIX excede o tamanho permitido.");
  return `${id}${String(length).padStart(2, "0")}${value}`;
}

export function pixCrc16(value: string) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(value)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = ((crc << 1) ^ ((crc & 0x8000) ? 0x1021 : 0)) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildPixPayload(settings: TenantPaymentSettings, amountCents: number, transactionId: string) {
  const clean = validatePixSettings(settings);
  if (!clean.pixKey) throw new Error("Chave PIX não cadastrada.");
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 99999999999) throw new Error("O valor do agendamento não é válido para pagamento PIX.");
  if (!/^[a-zA-Z0-9]{1,25}$/.test(transactionId)) throw new Error("Identificador do agendamento inválido.");
  const payload = field("00", "01") + field("26", field("00", "br.gov.bcb.pix") + field("01", clean.pixKey))
    + field("52", "0000") + field("53", "986") + field("54", (amountCents / 100).toFixed(2))
    + field("58", "BR") + field("59", clean.pixHolderName!) + field("60", clean.pixHolderCity!)
    + field("62", field("05", transactionId)) + "6304";
  return payload + pixCrc16(payload);
}

export function pixPaymentStage(appointment: Appointment, receipt?: PaymentSubmission) {
  if (appointment.paymentStatus === "paid") return 3;
  if (!receipt || receipt.status === "rejected") return 0;
  return receipt.reviewStartedAt ? 2 : 1;
}

export function validatePixReceipt(file: Pick<File, "type" | "size">) {
  if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) throw new Error("Envie uma imagem JPG, PNG, WebP ou um PDF.");
  if (file.size < 1 || file.size > 5 * 1024 * 1024) throw new Error("O comprovante deve ter entre 1 byte e 5 MB.");
}
