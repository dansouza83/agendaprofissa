import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.setTimeout(180_000);

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const publicRoutes = [
  ["landing page", "/"],
  ["FAQ", "/faq"],
  ["legal center", "/legal"],
  ["terms", "/termos"],
  ["privacy", "/privacidade"],
  ["cookies", "/cookies"],
  ["guidelines", "/diretrizes"],
  ["security", "/seguranca"],
  ["data rights", "/direitos-do-titular"],
];

async function setTheme(page, theme) {
  await page.evaluate((selectedTheme) => {
    document.documentElement.classList.toggle("dark", selectedTheme === "dark");
  }, theme);
}

async function collectContrastIssues(page, label, issues) {
  const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  for (const violation of results.violations) {
    for (const node of violation.nodes) {
      const summary = (node.failureSummary ?? violation.help).replace(/\s+/g, " ");
      const detail = summary.match(/contrast of ([\d.]+).*foreground color: ([^,]+), background color: ([^,]+)/i);
      issues.push(
        `${label}: ${node.target.join(" ")} — ${
          detail ? `ratio ${detail[1]}, foreground ${detail[2]}, background ${detail[3]}` : summary
        }`,
      );
    }
  }
}

async function auditBothThemes(page, label, issues) {
  for (const theme of ["dark", "light"]) {
    await setTheme(page, theme);
    await page.waitForTimeout(400);
    await collectContrastIssues(page, `${label} (${theme})`, issues);
  }
}

function expectNoIssues(issues) {
  const uniqueIssues = [...new Set(issues)];
  expect(uniqueIssues, uniqueIssues.join("\n")).toEqual([]);
}

test("public and legal pages meet WCAG AA color contrast", async ({ page }) => {
  const issues = [];
  for (const [label, route] of publicRoutes) {
    await page.goto(route);
    await auditBothThemes(page, label, issues);
  }
  expectNoIssues(issues);
});

test("login, registration, recovery, subscription and developer states meet WCAG AA color contrast", async ({ page }) => {
  const issues = [];

  await page.goto("/sistema");
  await auditBothThemes(page, "login", issues);

  await page.getByRole("button", { name: "Ainda não tenho conta" }).click();
  await auditBothThemes(page, "professional registration", issues);
  await page.getByRole("button", { name: /Aluno ou cliente/ }).click();
  await auditBothThemes(page, "customer registration", issues);

  await page.getByRole("button", { name: "Já tenho conta" }).click();
  await page.getByRole("button", { name: "Esqueci minha senha" }).click();
  await auditBothThemes(page, "password recovery", issues);

  await page.goto("/desenvolvedor");
  await auditBothThemes(page, "developer access", issues);

  await page.goto("/sistema?cadastro=profissional");
  await page.getByLabel("Seu nome").fill("Contraste Teste");
  await page.getByLabel("Nome do negócio").fill("Estúdio Contraste");
  await page.getByLabel("E-mail").fill("contraste@teste.local");
  await page.locator("#access-password").fill("senha1234");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta profissional" }).click();
  await auditBothThemes(page, "subscription gate", issues);

  expectNoIssues(issues);
});

test("every professional dashboard section and dialog meets WCAG AA color contrast", async ({ page }) => {
  const issues = [];
  await page.goto("/sistema");
  await page.getByLabel("E-mail").fill("marina@demo.com");
  await page.locator("#access-password").fill("demo123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  const sections = [
    ["Início", "professional dashboard"],
    ["Agenda", "professional agenda"],
    ["Clientes", "professional customers"],
    ["Serviços", "professional services"],
    ["Mais", "professional account"],
  ];
  for (const [button, label] of sections) {
    await page.getByRole("button", { name: new RegExp(`${button}$`) }).filter({ visible: true }).click();
    await auditBothThemes(page, label, issues);
  }

  const dialogCases = [
    ["Agenda", /Novo agendamento/, "new appointment dialog"],
    ["Clientes", /Novo cliente/, "new customer dialog"],
    ["Serviços", /Novo serviço/, "new service dialog"],
  ];
  for (const [section, action, label] of dialogCases) {
    await page.getByRole("button", { name: new RegExp(`${section}$`) }).filter({ visible: true }).click();
    const actionButton = page.getByRole("button", { name: action }).filter({ visible: true });
    if (await actionButton.count()) await actionButton.click();
    else await page.getByRole("button", { name: /Novo$/ }).filter({ visible: true }).click();
    await auditBothThemes(page, label, issues);
    await page.getByRole("button", { name: "Fechar" }).click();
  }

  expectNoIssues(issues);
});

test("customer portal meets WCAG AA color contrast", async ({ page }) => {
  const issues = [];
  await page.goto("/sistema");
  await page.getByLabel("E-mail").fill("cliente.agendado@demo.com");
  await page.locator("#access-password").fill("demo123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await auditBothThemes(page, "customer appointments portal", issues);
  expectNoIssues(issues);
});
