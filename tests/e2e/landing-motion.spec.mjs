import { expect, test } from "@playwright/test";

test("landing revela elementos ao rolar sem criar rolagem lateral", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/landing-motion-ready/);

  const target = page.locator("#segmentos .segment-card").first();
  await expect.poll(() => target.evaluate((element) => getComputedStyle(element).opacity)).toBe("0");
  await target.scrollIntoViewIfNeeded();
  await expect.poll(() => target.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
  await expect(target).toHaveClass(/is-visible/);

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
  await expect.poll(() => page.locator(".landing-ambient").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await expect(page.locator(".hero-depth-scene")).toBeVisible();
  await expect(page.locator(".hero-line-grid")).toHaveCount(1);
  await expect(page.locator(".hero-flow-line")).toHaveCount(0);
  await expect.poll(() => page.locator(".hero-line-grid").evaluate((element) => getComputedStyle(element).animationName)).toBe("hero-grid-side-drift");
  await expect.poll(() => page.locator(".landing-hero").evaluate((element) => getComputedStyle(element).backgroundImage.includes("radial-gradient"))).toBe(true);
  await expect.poll(() => page.locator(".landing-hero .preview-window").evaluate((element) => getComputedStyle(element).transform)).not.toBe("none");
});

test("landing respeita a preferência por movimento reduzido", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const target = page.locator("#segmentos .segment-card").first();
  await expect.poll(() => target.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
  await expect.poll(() => page.locator(".landing-ambient").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await expect.poll(() => page.locator(".hero-line-grid").first().evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
});

test("menu permanece fixo com marca e acessos visíveis durante a rolagem", async ({ page }) => {
  await page.goto("/");
  const header = page.locator(".public-header");
  const brand = header.getByRole("link", { name: /Agenda Profissa/ });
  const login = header.getByRole("link", { name: "Entrar", exact: true });
  const register = header.getByRole("link", { name: "Criar conta", exact: true });

  await expect.poll(() => header.evaluate((element) => getComputedStyle(element).position)).toBe("fixed");
  const initialHeight = await header.evaluate((element) => element.getBoundingClientRect().height);
  const initialBrandWidth = await header.locator(".public-header-brand").evaluate((element) => element.getBoundingClientRect().width);
  await page.locator("#planos").scrollIntoViewIfNeeded();

  await expect(header).toBeInViewport();
  await expect(header).toHaveClass(/public-header-compact/);
  await expect.poll(() => header.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThan(initialHeight);
  await expect.poll(() => header.locator(".public-header-main").evaluate((element) => getComputedStyle(element).height)).toBe("42px");
  await expect.poll(() => login.evaluate((element) => getComputedStyle(element).minHeight)).toBe("26px");
  await expect.poll(() => login.evaluate((element) => getComputedStyle(element).fontSize)).toBe("8.8px");
  await expect.poll(() => header.locator(".theme-toggle").evaluate((element) => getComputedStyle(element).width)).toBe("25px");
  await expect.poll(() => header.locator(".theme-toggle").evaluate((element) => getComputedStyle(element).height)).toBe("25px");
  await expect.poll(() => header.locator(".public-header-brand").evaluate((element) => element.getBoundingClientRect().width)).toBeLessThan(initialBrandWidth);
  await expect.poll(() => header.evaluate((element) => {
    const main = element.querySelector(".public-header-main")?.getBoundingClientRect();
    const logo = element.querySelector(".public-header-brand")?.getBoundingClientRect();
    return Boolean(main && logo && Math.abs((main.top + main.height / 2) - (logo.top + logo.height / 2)) < 1);
  })).toBe(true);
  await expect(brand).toBeVisible();
  await expect(login).toBeVisible();
  await expect(register).toBeVisible();
  await expect(header).not.toHaveClass(/public-header-condensed/);
});

test("demonstração do painel responde ao menu e alterna as telas automaticamente", async ({ page }) => {
  await page.goto("/");
  const preview = page.locator(".preview-window");

  await expect(preview).toHaveClass(/professional-workspace/);
  await expect(preview).toHaveClass(/system-theme/);
  await expect(preview.locator(".panel-demo-header")).toContainText("Bem-vindo,");
  await expect(preview.locator(".panel-demo-workspace")).toContainText("Studio Aurora");
  await expect(preview).toHaveAttribute("data-preview-tab", "inicio");
  await preview.getByRole("button", { name: "Agenda", exact: true }).click();
  await expect(preview).toHaveAttribute("data-preview-tab", "agenda");
  await expect(preview.getByRole("button", { name: "Agenda", exact: true })).toHaveClass(/system-side-nav-active/);
  await expect(preview.getByRole("heading", { name: "Agenda", exact: true })).toBeVisible();
  await expect(preview.locator(".panel-demo-search")).toHaveClass(/input/);

  await preview.getByRole("button", { name: "Clientes", exact: true }).click();
  await expect(preview).toHaveAttribute("data-preview-tab", "clientes");
  await expect(preview.getByRole("heading", { name: "Clientes", exact: true })).toBeVisible();
  await expect(preview.locator(".panel-demo-client-grid .card")).toHaveCount(4);

  await preview.getByRole("button", { name: "Serviços", exact: true }).click();
  await expect(preview).toHaveAttribute("data-preview-tab", "servicos");
  await expect(preview.locator(".panel-demo-service-grid .status.confirmado")).toHaveCount(4);
  await expect.poll(() => preview.getAttribute("data-preview-tab"), { timeout: 5_000 }).toBe("inicio");
});

test("modo escuro alterna superfícies distintas entre as seções", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  const selectors = [".landing-trust", "#segmentos", "#recursos", "#como-funciona", "#para-quem", "#planos", "#seguranca", "#faq"];
  const backgrounds = await page.evaluate((items) => items.map((selector) => getComputedStyle(document.querySelector(selector)).backgroundImage), selectors);

  expect(backgrounds.every((background) => background !== "none")).toBe(true);
  expect(new Set(backgrounds).size).toBe(selectors.length);
});

test("nova identidade usa o símbolo AP e a tipografia Manrope", async ({ page }) => {
  await page.goto("/");
  const headerLogo = page.locator(".public-header .brand-symbol-tile img");
  const wordmark = page.locator(".public-header .brand-wordmark");

  await expect(headerLogo).toHaveAttribute("src", "/brand/agenda-profissa-symbol-v2.png");
  await expect.poll(() => headerLogo.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(wordmark).toContainText("Agenda Profissa");
  await expect.poll(() => wordmark.evaluate((element) => getComputedStyle(element).fontFamily)).toContain("Manrope Variable");
  await expect(wordmark.locator(".brand-wordmark-accent")).toHaveText("Profissa");
});
