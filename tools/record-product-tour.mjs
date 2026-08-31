import { chromium } from "@playwright/test";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const temporary = path.join(root, ".tour-video-temp");
const output = path.join(root, "public", "videos");
await mkdir(temporary, { recursive: true });
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: temporary, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
const video = page.video();
await page.goto("http://localhost:3000/tour-video", { waitUntil: "networkidle" });
await page.locator("[data-tour-ready='true']").waitFor();
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(output, "agenda-profissa-tour-poster.png") });
await page.waitForTimeout(21400);
await page.close();
await context.close();
await browser.close();

if (!video) throw new Error("A gravação não foi iniciada.");
const recorded = await video.path();
await copyFile(recorded, path.join(output, "agenda-profissa-tour.webm"));
console.log("Vídeo criado em public/videos/agenda-profissa-tour.webm");
