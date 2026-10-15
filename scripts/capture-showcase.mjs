import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

// Run against `npm run dev -- --port 5173` from the project root.
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.goto("http://localhost:5173");
await page.waitForTimeout(250);
await page.screenshot({ path: "showcase/title.png" });

// Exercise the actual entry point using the browser's normal event stream.
await page.keyboard.press("ArrowDown");
await page.keyboard.press("Enter");
await page.waitForTimeout(1150);
await page.keyboard.down("KeyW");
await page.keyboard.down("ArrowDown");
await page.waitForTimeout(120);
await page.keyboard.up("KeyW");
await page.keyboard.up("ArrowDown");
await page.keyboard.press("Escape");
await page.waitForTimeout(60);
await page.screenshot({ path: "/tmp/opencode/paused.png" });
await page.keyboard.press("Escape");
await page.keyboard.press("KeyM");

// A second engine gives the capture a counted clock and the public debug API.
// This handle exists in this automation context only, never in the shipped game.
const result = await page.evaluate(async () => {
  const { createEngine, ConstantClock } =
    await import("/node_modules/@clockwyrks/simple-2d/dist/index.js");
  const { game, BACKGROUND } = await import("/src/game.ts");
  const C = await import("/src/constants.ts");
  const document = globalThis.document;
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:100vw;height:100vh;display:block";
  document.querySelector("canvas").replaceWith(canvas);
  const e = createEngine({
    canvas,
    width: C.FIELD_W,
    height: C.FIELD_H,
    game,
    background: BACKGROUND,
    layout: C.LAYOUT,
    clock: new ConstantClock(1000 / 60),
  });
  await e.initialize();
  const d = e.debug;
  e.apply((s) => d.setScreen(s, "playing"));
  e.apply((s) => d.setMode(s, "versus"));
  e.apply((s) => d.setScore(s, 7, 6));
  e.apply((s) => d.setBallHeld(s, false));
  e.apply((s) => d.setBallPosition(s, 130, 420));
  e.apply((s) => d.setBallVelocity(s, 690, -180));
  e.apply((s) => d.setBallSpin(s, -380));
  e.apply((s) => d.setObstacleClock(s, 0.58));
  e.apply((s) => d.setPaddleCy(s, "left", 445));
  e.apply((s) => d.setPaddleCy(s, "right", 300));
  await e.advance(30);
  // Retain a short-lived capture handle only in the browser evaluation world.
  globalThis.captureEngine = e;
  e.startRecording();
  const cues = [];
  e.events.on("cue:played", (event) => cues.push(event.cue));
  // Follow the ball with human-speed scripted paddles to keep the rally alive.
  for (let frame = 0; frame < 300; frame++) {
    for (const side of ["left", "right"]) {
      const ball = e.state.ball;
      if (!ball) continue;
      const diff = ball.y - e.state.paddles[side].cy;
      e.apply((s) => d.setPaddleDriven(s, side, true));
      e.apply((s) =>
        d.setPaddleVy(
          s,
          side,
          Math.max(-C.PADDLE_SPEED, Math.min(C.PADDLE_SPEED, diff * 7)),
        ),
      );
    }
    await e.advance(1);
  }
  return { recording: e.stopRecording(), cues, snapshot: d.snapshot(e.state) };
});
writeFileSync(
  "showcase/rally.json.gz",
  gzipSync(JSON.stringify(result.recording)),
);

// Capture a real frame with a readable curve in flight.
await page.evaluate(async () => {
  const e = globalThis.captureEngine,
    d = e.debug;
  e.apply((s) => d.setScreen(s, "playing"));
  e.apply((s) => d.setBallHeld(s, false));
  e.apply((s) => d.setPaddleCy(s, "left", 390));
  e.apply((s) => d.setPaddleCy(s, "right", 280));
  e.apply((s) => d.setPaddleVy(s, "left", 0));
  e.apply((s) => d.setPaddleVy(s, "right", 0));
  e.apply((s) => d.setObstacleClock(s, 0.65));
  e.apply((s) => d.setBallPosition(s, 850, 320));
  e.apply((s) => d.setBallVelocity(s, 860, -140));
  e.apply((s) => d.setBallSpin(s, 800));
  await e.advance(12);
});
await page.screenshot({ path: "showcase/rally.png" });

// Check the engine fit at portrait dimensions and a high pixel density too.
await page.setViewportSize({ width: 600, height: 900 });
await page.evaluate(async () => {
  await globalThis.captureEngine.advance(1);
});
await page.screenshot({ path: "/tmp/opencode/portrait.png" });
await browser.close();
if (errors.length) throw new Error(errors.join("\n"));
globalThis.console.log(
  JSON.stringify(
    {
      frames: result.recording.frames.length,
      cues: result.cues,
      score: result.snapshot.score,
      browserErrors: errors,
    },
    null,
    2,
  ),
);
