import { expect, test } from "@playwright/test";

test.setTimeout(120_000);

const publicRoutes = [
  "/", "/faq", "/legal", "/termos", "/privacidade", "/cookies",
  "/diretrizes", "/seguranca", "/direitos-do-titular",
];

const sections = ["inicio", "segmentos", "recursos", "como-funciona", "para-quem", "planos", "seguranca", "faq"];
const sectionLabels = {
  inicio: "Início", segmentos: "Segmentos", recursos: "Recursos", "como-funciona": "Como funciona",
  "para-quem": "Para quem", planos: "Planos", seguranca: "Segurança", faq: "FAQ",
};

function monitorPage(page) {
  const issues = [];
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") issues.push(`console: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.url().startsWith("http://localhost:3000") && response.status() >= 400) {
      issues.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });
  return issues;
}

async function createLocalProfessional(page, suffix = "e2e") {
  await page.goto("/sistema?cadastro=profissional");
  await page.getByLabel("Seu nome").fill("Pessoa Teste");
  await page.getByLabel("Nome do negócio").fill("Negócio Teste");
  await page.getByLabel("E-mail").fill(`profissional-${suffix}@teste.local`);
  await page.locator("#access-password").fill("TesteSeguro2026");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta profissional" }).click();
  await expect(page.getByRole("heading", { name: "Seu dia, num relance" })).toBeVisible();
}

async function createLocalClient(page, suffix = "e2e") {
  await page.goto("/sistema?cadastro=cliente");
  await page.getByLabel("Seu nome").fill("Aluno Teste");
  await page.getByLabel("E-mail").fill(`aluno-${suffix}@teste.local`);
  await page.locator("#access-password").fill("TesteSeguro2026");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar perfil de aluno/cliente" }).click();
  await expect(page.getByText("Área pessoal", { exact: true })).toBeVisible();
}

async function expectPath(page, href) {
  const expected = new URL(href, "http://localhost:3000");
  await expect.poll(() => {
    const current = new URL(page.url());
    return `${current.pathname}${current.search}${current.hash}`;
  }).toBe(`${expected.pathname}${expected.search}${expected.hash}`);
}

test("todos os links internos renderizados apontam para destinos válidos", async ({ page }) => {
  const discovered = new Set();

  for (const route of publicRoutes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBeLessThan(400);
    const hrefs = await page.locator("a[href]").evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href")).filter(Boolean));
    for (const href of hrefs) if (href.startsWith("/")) discovered.add(href);
  }

  for (const href of discovered) {
    const url = new URL(href, "http://localhost:3000");
    const response = await page.request.get(`${url.pathname}${url.search}`);
    expect(response.status(), href).toBeLessThan(400);
    if (url.hash) {
      await page.goto(`${url.pathname}${url.search}${url.hash}`);
      await expect(page.locator(url.hash), `Âncora ausente: ${href}`).toHaveCount(1);
    }
  }
});

test("todos os tópicos do menu executam a rolagem e atualizam a URL", async ({ page }, testInfo) => {
  const issues = monitorPage(page);
  const navigationName = testInfo.project.name === "mobile" ? "Atalhos da página" : "Navegação principal";

  for (const id of sections) {
    await page.goto("/");
    await page.getByRole("navigation", { name: navigationName }).getByRole("link", { name: sectionLabels[id], exact: true }).click();
    await expectPath(page, `/#${id}`);
    const top = await page.locator(`#${id}`).evaluate((element) => element.getBoundingClientRect().top);
    expect(top, id).toBeGreaterThanOrEqual(0);
    expect(top, id).toBeLessThan(180);
  }

  expect(issues).toEqual([]);
});

test("todos os links de ação da landing page abrem a tela correta", async ({ page }, testInfo) => {
  const cases = [
    ...(testInfo.project.name === "mobile" ? [] : [[".public-header a[href='/sistema']", "/sistema"]]),
    [".public-header a[href='/sistema?cadastro=profissional']", "/sistema?cadastro=profissional"],
    ["#inicio a[href='/sistema?cadastro=profissional']", "/sistema?cadastro=profissional"],
    ["#inicio a[href='/sistema?cadastro=cliente']", "/sistema?cadastro=cliente"],
    ["#para-quem a[href='/sistema?cadastro=profissional']", "/sistema?cadastro=profissional"],
    ["#para-quem a[href='/sistema?cadastro=cliente']", "/sistema?cadastro=cliente"],
    ["#planos .pricing-card:nth-of-type(1) a[href='/sistema?cadastro=profissional']", "/sistema?cadastro=profissional"],
    ["#planos .pricing-card:nth-of-type(2) a[href='/sistema?cadastro=profissional']", "/sistema?cadastro=profissional"],
    ["#seguranca a[href='/seguranca']", "/seguranca"],
    ["#faq a[href='/faq']", "/faq"],
    [".landing-cta a[href='/sistema?cadastro=profissional']", "/sistema?cadastro=profissional"],
    [".landing-cta a[href='/sistema']", "/sistema"],
  ];

  for (const [selector, href] of cases) {
    await page.goto("/");
    await page.locator(selector).click();
    await expectPath(page, href);
  }
});

test("landing apresenta os preços ativos e o benefício do plano anual", async ({ page }) => {
  await page.goto("/#planos");
  const plans = page.locator("#planos");
  await expect(plans.getByText("R$ 50,00", { exact: true })).toBeVisible();
  await expect(plans.getByText("R$ 350,00", { exact: true })).toBeVisible();
  await expect(plans.getByText("Economize R$ 250,00 por ano (42%)", { exact: true })).toBeVisible();
  await expect(plans.getByText("Melhor custo-benefício", { exact: true })).toBeVisible();
  await expect(plans.getByRole("link", { name: /Criar conta profissional/ })).toHaveCount(2);
});

test("todos os links do rodapé navegam ao destino declarado", async ({ page }) => {
  await page.goto("/");
  const links = await page.locator(".public-footer a[href]").evaluateAll((anchors) => anchors.map((anchor, index) => ({ index, href: anchor.getAttribute("href") })));

  for (const link of links) {
    await page.goto("/");
    await page.locator(".public-footer a[href]").nth(link.index).click();
    await expectPath(page, link.href);
  }
});

test("FAQ abre todas as respostas e o centro jurídico abre todos os documentos", async ({ page }) => {
  await page.goto("/");
  const questions = page.locator("#faq details");
  for (let index = 0; index < await questions.count(); index += 1) {
    const item = questions.nth(index);
    await item.locator("summary").click();
    await expect(item).toHaveAttribute("open", "");
  }

  await page.goto("/legal");
  const legalLinks = await page.locator(".legal-toc a[href]").evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href")));
  for (const href of legalLinks) {
    await page.goto("/legal");
    await page.locator(`.legal-toc a[href='${href}']`).click();
    await expectPath(page, href);
    await expect(page.locator("h1")).toBeVisible();
  }
});

test("breadcrumbs orientam e permitem retornar aos níveis anteriores", async ({ page }) => {
  await page.goto("/privacidade");
  const legalTrail = page.getByRole("navigation", { name: "Trilha de navegação" });
  await expect(legalTrail.getByRole("link", { name: "Início" })).toBeVisible();
  await expect(legalTrail.getByRole("link", { name: "Centro jurídico" })).toBeVisible();
  await expect(legalTrail.getByText("Aviso de Privacidade", { exact: true })).toHaveAttribute("aria-current", "page");
  await legalTrail.getByRole("link", { name: "Centro jurídico" }).click();
  await expectPath(page, "/legal");

  await page.goto("/sistema");
  const accessTrail = page.getByRole("navigation", { name: "Trilha de navegação" });
  await expect(accessTrail.getByText("Acessar sistema", { exact: true })).toHaveAttribute("aria-current", "page");
  await accessTrail.getByRole("link", { name: "Início" }).click();
  await expectPath(page, "/");

  await page.goto("/desenvolvedor");
  const developerTrail = page.getByRole("navigation", { name: "Trilha de navegação" });
  await expect(developerTrail.getByRole("link", { name: "Painel do desenvolvedor" })).toBeVisible();
  await expect(developerTrail.getByText("Mercado Pago", { exact: true })).toHaveAttribute("aria-current", "page");
});

test("login, tema, visualização de senha e recuperação funcionam", async ({ page }) => {
  const issues = monitorPage(page);
  await page.goto("/sistema");
  await expect(page.getByRole("heading", { name: "Acesse sua conta" })).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Alternar entre tema claro e escuro" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Alternar entre tema claro e escuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  const password = page.locator("#access-password");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Mostrar senha" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Ocultar senha" }).click();
  await expect(password).toHaveAttribute("type", "password");

  await page.getByRole("button", { name: "Esqueci minha senha" }).click();
  await expect(page.getByRole("heading", { name: "Esqueceu a senha?" })).toBeVisible();
  await page.getByLabel("E-mail").fill("pessoa@teste.local");
  await page.getByRole("button", { name: "Enviar link de recuperação" }).click();
  await expect(page.getByText("No ambiente local, crie uma conta de teste para acessar o painel.")).toBeVisible();
  await page.getByRole("button", { name: "Voltar para o login" }).click();
  await expect(page.getByRole("heading", { name: "Acesse sua conta" })).toBeVisible();
  expect(issues).toEqual([]);
});

test("cadastro alterna perfis, abre termos e valida aceite", async ({ page }) => {
  await page.goto("/sistema");
  await page.getByRole("button", { name: "Ainda não tenho conta" }).click();
  await expect(page.getByRole("heading", { name: "Crie seu espaço" })).toBeVisible();
  await page.getByRole("button", { name: /Aluno ou cliente/ }).click();
  await expect(page.getByRole("heading", { name: "Crie seu perfil" })).toBeVisible();
  await page.getByRole("button", { name: /Profissional/ }).click();
  await expect(page.getByRole("heading", { name: "Crie seu espaço" })).toBeVisible();

  for (const name of ["Termos de Uso", "Aviso de Privacidade"]) {
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("link", { name }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState();
    await expect(popup.locator("h1")).toBeVisible();
    await popup.close();
  }

  await page.getByLabel("Seu nome").fill("Pessoa Teste");
  await page.getByLabel("Nome do negócio").fill("Negócio Teste");
  await page.getByLabel("E-mail").fill("pessoa@teste.local");
  await page.locator("#access-password").fill("senha1234");
  await page.getByRole("button", { name: "Criar conta profissional" }).click();
  await expect(page.getByText(/Você precisa aceitar os Termos/)).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta profissional" }).click();
  await expect(page.getByRole("heading", { name: "Seu dia, num relance" })).toBeVisible();
  const savedBusiness = await page.evaluate(() => JSON.parse(localStorage.getItem("agenda-facil-local-account")).identity.business);
  expect(savedBusiness).toBe("Negócio Teste");
});

test("todos os botões de navegação do painel profissional abrem a área correta", async ({ page }, testInfo) => {
  await createLocalProfessional(page, `navegacao-${testInfo.project.name}`);
  const destinations = [
    ["Início", "Seu dia, num relance"], ["Agenda", "Agenda"], ["Clientes", "Clientes"],
    ["Serviços", "Serviços"], ["Mais", "Mais opções"],
  ];
  for (const [button, heading] of destinations) {
    await page.getByRole("button", { name: new RegExp(`${button}$`) }).filter({ visible: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }

  await page.getByRole("button", { name: /Agenda$/ }).filter({ visible: true }).click();
  const trail = page.getByRole("navigation", { name: "Trilha de navegação" });
  await expect(trail.getByText("Agenda", { exact: true })).toHaveAttribute("aria-current", "page");
  await trail.getByRole("button", { name: "Início" }).click();
  await expect(page.getByRole("heading", { name: "Seu dia, num relance" })).toBeVisible();
  await expectPath(page, "/sistema");
  if (testInfo.project.name === "desktop") {
    const activeItem = page.getByRole("button", { name: /Início$/ }).filter({ visible: true });
    const colors = await activeItem.evaluate((element) => {
      const style = getComputedStyle(element);
      return { color: style.color, backgroundColor: style.backgroundColor };
    });
    expect(colors).toEqual({ color: "rgb(22, 72, 61)", backgroundColor: "rgb(255, 255, 255)" });
  }
});

test("conta profissional local abre o painel com acesso de teste", async ({ page }, testInfo) => {
  await createLocalProfessional(page, `acesso-${testInfo.project.name}`);
  await page.getByRole("button", { name: /Mais$/ }).filter({ visible: true }).click();
  await expect(page.getByRole("main").getByText("Negócio Teste", { exact: true })).toBeVisible();
  await expect(page.getByText(/Pagamento confirmado — assinatura ativa/)).toBeVisible();
});

test("cliente local vê somente o próprio portal", async ({ page }, testInfo) => {
  await createLocalClient(page, `portal-${testInfo.project.name}`);
  await expect(page.getByText("Área pessoal", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Olá, Aluno." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nenhum horário vinculado" })).toBeVisible();
  await expect(page.getByTestId("client-appointment")).toHaveCount(0);
  await expect(page.getByPlaceholder("Buscar cliente ou serviço")).toHaveCount(0);
  const clientTrail = page.getByRole("navigation", { name: "Trilha de navegação" });
  await expect(clientTrail.getByText("Meus horários", { exact: true })).toHaveAttribute("aria-current", "page");
  await clientTrail.getByRole("button", { name: "Início" }).click();
  await expectPath(page, "/sistema");
  await expect(page.getByRole("heading", { name: "Meus agendamentos" })).toBeVisible();

  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page.getByRole("heading", { name: "Acesse sua conta" })).toBeVisible();
});

test("ações de agenda, clientes e serviços abrem, salvam e cancelam corretamente", async ({ page }, testInfo) => {
  await createLocalProfessional(page, `acoes-${testInfo.project.name}`);
  const headerAction = testInfo.project.name === "mobile" ? /Novo$/ : null;

  await page.getByRole("button", { name: headerAction ?? /Novo agendamento/ }).click();
  await expect(page.getByRole("dialog", { name: "Novo agendamento" })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /Clientes$/ }).click();
  await page.getByRole("button", { name: headerAction ?? /Novo cliente/ }).click();
  await page.getByLabel("Nome completo").fill("Cliente Teste");
  await page.getByLabel("Telefone").fill("(11) 90000-0000");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Cliente salvo.")).toBeVisible();
  await page.getByRole("button", { name: /Cliente Teste/ }).click();
  await expect(page.getByRole("dialog", { name: "Editar cliente" })).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  await page.getByRole("button", { name: /Serviços$/ }).click();
  await page.getByRole("button", { name: headerAction ?? /Novo serviço/ }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Serviço Teste");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Serviço salvo.")).toBeVisible();
  await page.getByRole("button", { name: /Serviço Teste/ }).click();
  await expect(page.getByRole("dialog", { name: "Editar serviço" })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();

  const professionalNavigation = testInfo.project.name === "mobile"
    ? page.getByRole("navigation", { name: "Navegação do painel profissional" })
    : page.locator(".professional-workspace aside");
  await professionalNavigation.getByRole("button", { name: /Início$/ }).click();
  await page.getByRole("button", { name: "Ver agenda" }).click();
  await expect(page.getByRole("heading", { name: "Agenda", exact: true })).toBeVisible();
  await page.getByRole("button", { name: headerAction ?? /Novo agendamento/ }).click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Agendamento salvo e alerta criado.")).toBeVisible();

  await page.getByRole("button", { name: /Mais$/ }).click();
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page.getByRole("heading", { name: "Acesse sua conta" })).toBeVisible();
});

test("área do aluno mantém documentos em preparação ocultos e encerra a sessão", async ({ page }, testInfo) => {
  await createLocalClient(page, `documentos-${testInfo.project.name}`);

  await expect(page.getByRole("link", { name: "Aviso de Privacidade" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Meus direitos" })).toHaveCount(0);
  await expect(page.getByText("Mensagens internas")).toBeVisible();
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page.getByRole("heading", { name: "Acesse sua conta" })).toBeVisible();
});
