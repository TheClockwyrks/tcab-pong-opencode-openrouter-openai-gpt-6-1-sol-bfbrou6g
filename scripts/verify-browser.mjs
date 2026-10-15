import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (error) => errors.push(error.message));
await page.goto("http://localhost:5173");
await page.waitForTimeout(120);
const title = await page.screenshot();
await page.mouse.move(250, 460);
await page.waitForTimeout(40);
assert.ok(
  !title.equals(await page.screenshot()),
  "Pointer hover highlights Versus",
);
await page.mouse.click(250, 460);
await page.waitForTimeout(1100);
const live = await page.screenshot();
await page.waitForTimeout(90);
assert.ok(!live.equals(await page.screenshot()), "The live field advances");
await page.keyboard.press("Escape");
await page.waitForTimeout(60);
const paused = await page.screenshot();
await page.waitForTimeout(160);
assert.ok(
  paused.equals(await page.screenshot()),
  "Pause freezes the visible field",
);
await page.keyboard.press("Escape");
await page.waitForTimeout(80);
assert.ok(!paused.equals(await page.screenshot()), "Escape resumes");

const touchContext = await browser.newContext({
  viewport: { width: 900, height: 600 },
  deviceScaleFactor: 2,
  hasTouch: true,
});
const touch = await touchContext.newPage();
touch.on("pageerror", (error) => errors.push(error.message));
await touch.goto("http://localhost:5173");
await touch.waitForTimeout(100);
const canvas = touch.locator("canvas");
assert.equal(await canvas.evaluate((el) => el.width), 1800);
assert.equal(await canvas.evaluate((el) => el.height), 1200);
// The 16:9 field is letterboxed inside a 900x600 CSS-pixel surface.
await touch.touchscreen.tap(
  (220 * 900) / 1280,
  (390 * 900) / 1280 + (600 - (900 * 720) / 1280) / 2,
);
await touch.waitForTimeout(100);
assert.equal(
  await touch.locator('[data-touch-controls="dual-vertical"]').isVisible(),
  true,
);
const slider = touch.locator('[data-actions="p1-up p1-down"]');
assert.equal(await slider.count(), 1);
const bounds = await slider.boundingBox();
assert.ok(bounds);
await slider.dispatchEvent("pointerdown", {
  pointerId: 12,
  pointerType: "touch",
  isPrimary: true,
  button: 0,
  buttons: 1,
  clientX: bounds.x + bounds.width / 2,
  clientY: bounds.y + bounds.height - 5,
});
await touch.waitForTimeout(80);
await slider.dispatchEvent("pointerup", {
  pointerId: 12,
  pointerType: "touch",
  isPrimary: true,
  button: 0,
  buttons: 0,
  clientX: bounds.x + bounds.width / 2,
  clientY: bounds.y + bounds.height - 5,
});
await touch.keyboard.press("KeyW");
await touch.waitForTimeout(60);
assert.equal(
  await touch.locator('[data-touch-controls="dual-vertical"]').isVisible(),
  false,
);
await touch.setViewportSize({ width: 600, height: 900 });
await touch.waitForTimeout(60);
assert.equal(await canvas.evaluate((el) => el.width), 1200);
assert.equal(await canvas.evaluate((el) => el.height), 1800);
assert.deepEqual(errors, []);
await browser.close();
globalThis.console.log(
  "Browser checks passed: mouse menus, live play, pause/resume, touch sliders, DPR 2, and portrait resize.",
);
