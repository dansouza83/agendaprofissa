import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

async function render(path) {
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("renderiza a landing page pública em português", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Sua rotina organizada/);
  assert.match(html, /Criar perfil profissional/);
  assert.match(html, /Sou aluno ou cliente/);
  assert.match(html, /Perguntas frequentes/);
  assert.match(html, /aria-label="Atalhos da página"/);
  assert.match(html, /href="\/#para-quem"/);
  assert.match(html, /<html[^>]*class="dark"/);
  assert.match(html, /Alternar entre tema claro e escuro/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("renderiza cadastro de profissional e aluno ou cliente", async () => {
  const professionalResponse = await render("/sistema?cadastro=profissional");
  const clientResponse = await render("/sistema?cadastro=cliente");
  assert.equal(professionalResponse.status, 200);
  assert.equal(clientResponse.status, 200);
  assert.match(await professionalResponse.text(), /cadastro.*profissional/);
  assert.match(await clientResponse.text(), /cadastro.*cliente/);
  const source = await readFile(new URL("../app/sistema/client.tsx", import.meta.url), "utf8");
  assert.match(source, /Crie seu espaço/);
  assert.match(source, /Nome do negócio/);
  assert.match(source, /Criar perfil de aluno\/cliente/);
  assert.match(source, /Termos de Uso/);
});

test("mantém todas as páginas jurídicas acessíveis", async () => {
  const expected = new Map([
    ["/legal", "Centro jurídico e de confiança"],
    ["/termos", "Termos de Uso"],
    ["/privacidade", "Aviso de Privacidade"],
    ["/cookies", "Política de Cookies"],
    ["/diretrizes", "Diretrizes de Uso"],
    ["/seguranca", "Segurança"],
    ["/direitos-do-titular", "Direitos do Titular"],
    ["/faq", "Perguntas frequentes"],
  ]);
  for (const [path, heading] of expected) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), new RegExp(heading, "i"), path);
  }
});

test("abre o aplicativo instalado diretamente no sistema", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.lang, "pt-BR");
  assert.equal(manifest.start_url, "/sistema");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.background_color, "#08140f");
  assert.equal(manifest.theme_color, "#08140f");
});
