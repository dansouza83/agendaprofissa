import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function createLocalProfessional(page, projectName) {
  await page.goto("/sistema?cadastro=profissional");
  await page.getByLabel("Seu nome").fill("Profissional Contraste");
  await page.getByLabel("Nome do negócio").fill("Agenda Profissa QA");
  await page.getByLabel("E-mail").fill(`contraste-${projectName}@teste.local`);
  await page.locator("#access-password").fill("Contraste2026");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta profissional" }).click();
  await expect(page.getByRole("heading", { name: "Seu dia, num relance" })).toBeVisible();
}

async function expectProfessionalContrast(page, context) {
  const results = await new AxeBuilder({ page })
    .include(".professional-workspace")
    .withRules(["color-contrast"])
    .analyze();
  expect(results.violations, context).toEqual([]);
}

test("painel profissional mantém contraste nos temas escuro e claro", async ({ page }, testInfo) => {
  await createLocalProfessional(page, testInfo.project.name);
  const destinations = ["Início", "Agenda", "Clientes", "Serviços", "Mensagens", "Mais"];
  const navigation = testInfo.project.name === "mobile"
    ? page.getByRole("navigation", { name: "Navegação do painel profissional" })
    : page.locator(".professional-workspace aside");

  for (const dark of [true, false]) {
    if ((await page.locator("html").getAttribute("class"))?.includes("dark") !== dark) {
      await page.getByRole("button", { name: "Alternar entre tema claro e escuro" }).click();
    }
    for (const destination of destinations) {
      await navigation.getByRole("button", { name: new RegExp(`${destination}$`) }).click();
      await expectProfessionalContrast(page, `${testInfo.project.name} / ${dark ? "escuro" : "claro"} / ${destination}`);
    }
  }
});
