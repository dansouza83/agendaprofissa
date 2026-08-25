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
  assert.match(html, /Invista na organização que acompanha o seu negócio todos os dias/);
  assert.match(html, /href="\/#planos"/);
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
  assert.match(source, /monthly:50,annual:350/);
  assert.doesNotMatch(source, /Acesso profissional — assinatura ativa/);
  assert.doesNotMatch(source, /Acesso aluno\/cliente — atendimento pago/);
});

test("publica os preços ativos sem expor credenciais do Mercado Pago", async () => {
  const pricingSource = await readFile(new URL("../app/public-pricing.tsx", import.meta.url), "utf8");
  const functionSource = await readFile(new URL("../supabase/functions/agenda-public-pricing/index.ts", import.meta.url), "utf8");
  const configSource = await readFile(new URL("../supabase/config.toml", import.meta.url), "utf8");
  assert.match(pricingSource, /monthlyPrice: 50/);
  assert.match(pricingSource, /annualPrice: 350/);
  assert.match(pricingSource, /Economize/);
  assert.match(functionSource, /monthlyPrice: Number\(current\.monthly_price\)/);
  assert.match(functionSource, /annualPrice: Number\(current\.annual_price\)/);
  assert.match(functionSource, /currency: "BRL"/);
  assert.doesNotMatch(functionSource, /access_token|client_secret|public_key|monthly_plan_id/i);
  assert.match(configSource, /\[functions\.agenda-public-pricing\]\s+verify_jwt = false/);
});

test("mantém todas as páginas jurídicas acessíveis", async () => {
  const expected = new Map([
    ["/legal", "Centro jurídico e de confiança"],
    ["/termos", "Termos de Uso"],
    ["/antifraude", "Pagamentos e Prevenção a Fraudes"],
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

test("explica proteção contra fraude e preserva direitos do consumidor", async () => {
  const termsSource = await readFile(new URL("../app/termos/page.tsx", import.meta.url), "utf8");
  const antiFraudSource = await readFile(new URL("../app/antifraude/page.tsx", import.meta.url), "utf8");
  assert.match(termsSource, /direito de arrependimento será respeitado nos termos da lei/);
  assert.match(termsSource, /meio eletrônico eficaz para cancelamento/);
  assert.match(antiFraudSource, /não confirmam pagamento, não substituem a validação do processador e não liberam acesso/);
  assert.match(antiFraudSource, /nunca envie senha ou código de acesso/i);
});

test("abre o aplicativo instalado diretamente no sistema", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.lang, "pt-BR");
  assert.equal(manifest.start_url, "/sistema");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.background_color, "#08140f");
  assert.equal(manifest.theme_color, "#08140f");
});

test("preserva o ambiente selecionado e confirma a gravação segura das credenciais", async () => {
  const developerSource = await readFile(new URL("../app/desenvolvedor/client.tsx", import.meta.url), "utf8");
  const billingSource = await readFile(new URL("../supabase/functions/agenda-billing/index.ts", import.meta.url), "utf8");
  assert.match(developerSource, /cache:"no-store"/);
  assert.match(developerSource, /\[selectedEnvironment\]:result\.credentials/);
  assert.match(developerSource, /salvo, relido e confirmado no cofre/);
  assert.match(developerSource, /Credenciais gravadas no cofre/);
  assert.match(developerSource, /os campos são limpos por segurança/);
  assert.match(billingSource, /As credenciais não puderam ser confirmadas após a gravação/);
  assert.match(billingSource, /credentials: credentialSummary\(stored\)/);
});

test("não armazena respostas privadas do painel no cache", async () => {
  const proxySource = await readFile(new URL("../app/lib/billing-server.ts", import.meta.url), "utf8");
  const workerSource = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(proxySource, /private, no-store, max-age=0/);
  assert.match(proxySource, /Vary: "Authorization"/);
  assert.match(workerSource, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(workerSource, /event\.request\.mode === "navigate"/);
});

test("usa a origem HTTPS pública nas URLs de retorno do Mercado Pago", async () => {
  const proxySource = await readFile(new URL("../app/lib/billing-server.ts", import.meta.url), "utf8");
  const authSource = await readFile(new URL("../app/lib/supabase.ts", import.meta.url), "utf8");
  const billingSource = await readFile(new URL("../supabase/functions/agenda-billing/index.ts", import.meta.url), "utf8");
  assert.match(proxySource, /new URL\(request\.url\)\.origin/);
  assert.doesNotMatch(proxySource, /NEXT_PUBLIC_SITE_URL \|\| new URL\(request\.url\)\.origin/);
  assert.match(authSource, /window\.location\.origin\.replace/);
  assert.match(billingSource, /url\.protocol !== "https:"/);
  assert.match(billingSource, /paymentReturnUrl\(input\.siteUrl\)/);
  assert.match(billingSource, /new URL\("\/sistema\?pagamento=retorno", origin\)/);
});

test("só libera o painel após pagamento Mercado Pago aprovado", async () => {
  const systemSource = await readFile(new URL("../app/sistema/client.tsx", import.meta.url), "utf8");
  const billingSource = await readFile(new URL("../supabase/functions/agenda-billing/index.ts", import.meta.url), "utf8");
  const webhookSource = await readFile(new URL("../supabase/functions/agenda-mp-webhook/index.ts", import.meta.url), "utf8");
  const migrationSource = await readFile(new URL("../supabase/migrations/20260822033140_require_confirmed_payment_for_access.sql", import.meta.url), "utf8");
  assert.match(systemSource, /ele não confirma manualmente nem libera o painel/);
  assert.match(systemSource, /Verificar pagamento no Mercado Pago/);
  assert.match(billingSource, /subscription\?\.status === "authorized" && subscription\.payment_status === "approved"/);
  assert.match(billingSource, /isSeedSubscription/);
  assert.match(billingSource, /startsWith\("test-"\)/);
  assert.match(billingSource, /authorized_payments\/search\?preapproval_id=/);
  assert.match(webhookSource, /body\.type === "subscription_authorized_payment"/);
  assert.match(webhookSource, /invoice\.currency_id !== "BRL" \|\| amountCents !== expectedCents/);
  assert.match(migrationSource, /s\.status = 'authorized'\s+and s\.payment_status = 'approved'/);
});

test("exige senhas fortes e configura proteção de autenticação", async () => {
  const authSource = await readFile(new URL("../app/lib/supabase.ts", import.meta.url), "utf8");
  const systemSource = await readFile(new URL("../app/sistema/client.tsx", import.meta.url), "utf8");
  const configSource = await readFile(new URL("../supabase/config.toml", import.meta.url), "utf8");
  assert.match(authSource, /password\.length < 8/);
  assert.match(authSource, /\[A-Za-z\].*\\d/);
  assert.match(systemSource, /passwordSafetyHint/);
  assert.match(configSource, /minimum_password_length = 8/);
  assert.match(configSource, /password_requirements = "letters_digits"/);
  assert.match(configSource, /secure_password_change = true/);
});

test("protege o cadastro online contra automação", async () => {
  const authSource = await readFile(new URL("../app/lib/supabase.ts", import.meta.url), "utf8");
  const systemSource = await readFile(new URL("../app/sistema/client.tsx", import.meta.url), "utf8");
  const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  const configSource = await readFile(new URL("../supabase/config.toml", import.meta.url), "utf8");
  assert.match(authSource, /NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
  assert.match(authSource, /captchaProtectionConfigured/);
  assert.match(authSource, /NEXT_PUBLIC_ALLOW_LOCAL_SIGNUP_WITHOUT_CAPTCHA/);
  assert.match(authSource, /function localSignupBypassAllowed/);
  assert.match(authSource, /\["localhost", "127\.0\.0\.1", "::1"\]/);
  assert.match(authSource, /return captchaProtectionConfigured \|\| !localSignupBypassAllowed\(\)/);
  assert.match(authSource, /captchaRequired \? \{ captchaToken \} : \{\}/);
  assert.match(authSource, /cadastro online está temporariamente indisponível/);
  assert.match(systemSource, /challenges\.cloudflare\.com\/turnstile/);
  assert.match(systemSource, /registration-website/);
  assert.match(systemSource, /Conclua a verificação anti-bot/);
  assert.match(systemSource, /local-captcha-bypass/);
  assert.match(envExample, /NEXT_PUBLIC_TURNSTILE_SITE_KEY=/);
  assert.match(envExample, /NEXT_PUBLIC_ALLOW_LOCAL_SIGNUP_WITHOUT_CAPTCHA=false/);
  assert.match(configSource, /provider = "turnstile"/);
});

test("restringe contas e dados de demonstração ao ambiente local", async () => {
  const authSource = await readFile(new URL("../app/lib/supabase.ts", import.meta.url), "utf8");
  const systemSource = await readFile(new URL("../app/sistema/client.tsx", import.meta.url), "utf8");
  assert.match(authSource, /export function localDemoModeEnabled/);
  assert.match(authSource, /if \(supabaseConfigured \|\| typeof window === "undefined"\) return false/);
  assert.match(authSource, /return isLocalHostname\(window\.location\.hostname\)/);
  assert.match(systemSource, /else if\(localDemoModeEnabled\(\)\)/);
  assert.match(systemSource, /if\(!localDemoModeEnabled\(\)\)throw new Error\("O acesso online está em configuração\. Contas de demonstração não são disponibilizadas neste endereço\."\)/);
  assert.doesNotMatch(systemSource, /demo123|@demo\.com|const users:Record/);
});

test("mantém a administração de usuários restrita ao desenvolvedor", async () => {
  const developerSource = await readFile(new URL("../app/desenvolvedor/client.tsx", import.meta.url), "utf8");
  const usersPageSource = await readFile(new URL("../app/desenvolvedor/usuarios/page.tsx", import.meta.url), "utf8");
  const managerSource = await readFile(new URL("../app/desenvolvedor/user-manager.tsx", import.meta.url), "utf8");
  const routeSource = await readFile(new URL("../app/api/developer/users/route.ts", import.meta.url), "utf8");
  const functionSource = await readFile(new URL("../supabase/functions/agenda-developer-users/index.ts", import.meta.url), "utf8");
  const configSource = await readFile(new URL("../supabase/config.toml", import.meta.url), "utf8");
  assert.match(developerSource, /UserManager/);
  assert.match(developerSource, /href="\/desenvolvedor\/usuarios"/);
  assert.match(developerSource, /Controle de usuários/);
  assert.match(usersPageSource, /section="users"/);
  const usersResponse = await render("/desenvolvedor/usuarios");
  assert.equal(usersResponse.status, 200);
  assert.match(managerSource, /Usuários cadastrados/);
  assert.match(managerSource, /Suspender/);
  assert.match(managerSource, /Excluir permanentemente/);
  assert.match(routeSource, /agenda-developer-users/);
  assert.match(functionSource, /dansouzafloripa@gmail.com/);
  assert.match(functionSource, /service\.auth\.admin\.listUsers/);
  assert.match(functionSource, /service\.auth\.admin\.createUser/);
  assert.match(functionSource, /service\.auth\.admin\.deleteUser/);
  assert.match(functionSource, /proprietário de um negócio/);
  assert.match(configSource, /\[functions\.agenda-developer-users\]\s+verify_jwt = true/);
});

test("recupera a senha do desenvolvedor somente por link enviado ao e-mail autorizado", async () => {
  const developerSource = await readFile(new URL("../app/desenvolvedor/client.tsx", import.meta.url), "utf8");
  const authSource = await readFile(new URL("../app/lib/supabase.ts", import.meta.url), "utf8");
  assert.match(developerSource, /sendDeveloperPasswordRecovery/);
  assert.match(developerSource, /Receber link para criar nova senha/);
  assert.match(developerSource, /A senha atual nunca é enviada nem exibida/);
  assert.match(authSource, /developerEmail = "dansouzafloripa@gmail\.com"/);
  assert.match(authSource, /sendDeveloperPasswordRecovery[\s\S]*sendPasswordRecovery\(developerEmail\)/);
  assert.match(authSource, /resetPasswordForEmail\(email, \{ redirectTo:/);
});

test("guarda a identificação do fornecedor em área interna e publica somente os dados legais", async () => {
  const developerSource = await readFile(new URL("../app/desenvolvedor/client.tsx", import.meta.url), "utf8");
  const migrationSource = await readFile(new URL("../supabase/migrations/20260824163934_add_platform_legal_identity.sql", import.meta.url), "utf8");
  const billingSource = await readFile(new URL("../supabase/functions/agenda-billing/index.ts", import.meta.url), "utf8");
  const publicFunction = await readFile(new URL("../supabase/functions/agenda-public-legal-identity/index.ts", import.meta.url), "utf8");
  const configSource = await readFile(new URL("../supabase/config.toml", import.meta.url), "utf8");
  assert.match(developerSource, /Identificação do fornecedor/);
  assert.match(developerSource, /api\("\/api\/developer\/legal-identity"/);
  assert.match(migrationSource, /private\.platform_legal_identity/);
  assert.match(migrationSource, /enable row level security/);
  assert.match(migrationSource, /revoke all on table private\.platform_legal_identity from public, anon, authenticated/);
  assert.match(migrationSource, /grant execute on function public\.admin_save_legal_identity[\s\S]*to service_role/);
  assert.match(billingSource, /user\.email\?\.toLowerCase\(\) !== "dansouzafloripa@gmail\.com"/);
  assert.match(billingSource, /action === "saveLegalIdentity"/);
  assert.match(publicFunction, /admin_get_legal_identity/);
  assert.doesNotMatch(publicFunction, /access_token|client_secret|webhook_secret/i);
  assert.match(configSource, /\[functions\.agenda-public-legal-identity\]\s+verify_jwt = false/);
});
