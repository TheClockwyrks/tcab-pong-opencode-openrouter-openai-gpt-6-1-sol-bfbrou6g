import { afterEach, describe, expect, it, vi } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import type { Engine } from "@clockwyrks/simple-2d";
import { BACKGROUND, game } from "./game";
import type { CaromDebugApi, CaromState, Screen } from "./game";
import * as C from "./constants";

const engines: Engine<CaromState, CaromDebugApi>[] = [];
afterEach(() => {
  engines.splice(0).forEach((e) => e.destroy());
  vi.restoreAllMocks();
});

async function harness(step = 8) {
  const target = new EventTarget();
  const canvas = createCanvas(C.FIELD_W, C.FIELD_H);
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    game,
    background: BACKGROUND,
    layout: C.LAYOUT,
    clock: new ConstantClock(step),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => target,
    },
  });
  engines.push(engine);
  await engine.initialize();
  const d = engine.debug;
  function key(code: string, down: boolean) {
    target.dispatchEvent(
      Object.assign(new Event(down ? "keydown" : "keyup"), {
        code,
        repeat: false,
      }),
    );
  }
  async function tap(code: string) {
    key(code, true);
    await engine.advance(1);
    key(code, false);
  }
  function pointer(
    type: "down" | "move" | "up",
    x: number,
    y: number,
    device = "mouse",
    id = 1,
  ) {
    target.dispatchEvent(
      Object.assign(new Event(`pointer${type}`), {
        clientX: x,
        clientY: y,
        pointerId: id,
        pointerType: device,
        isPrimary: id === 1,
        button: type === "move" ? -1 : 0,
        buttons: type === "up" ? 0 : 1,
      }),
    );
  }
  function flight(x: number, y: number, vx: number, vy: number, spin = 0) {
    engine.apply((s) => d.clearWorld(s));
    engine.apply((s) => d.spawnBall(s));
    engine.apply((s) => d.setScreen(s, "playing"));
    engine.apply((s) => d.setMode(s, "versus"));
    engine.apply((s) => d.setBallHeld(s, false));
    engine.apply((s) => d.setBallPosition(s, x, y));
    engine.apply((s) => d.setBallVelocity(s, vx, vy));
    engine.apply((s) => d.setBallSpin(s, spin));
  }
  return {
    engine,
    d,
    key,
    tap,
    pointer,
    flight,
    snapshot: () => d.snapshot(engine.state),
  };
}

describe("state and automation contract", () => {
  it("initializes the complete title state and live diagnostic sources", async () => {
    const { engine, snapshot, d } = await harness();
    const s = snapshot();
    expect(s).toMatchObject({
      version: C.CAROM_DEBUG_VERSION,
      screen: "title",
      mode: "solo",
      menuIndex: 0,
      titleIndex: 0,
      resumeScreen: "playing",
      score: { p1: 0, p2: 0 },
      winner: null,
      ai: { tracking: true, movement: true },
      receiver: "left",
      obstacleClock: 0,
      obstacleClockRunning: true,
      simTime: 0,
      muted: false,
      ball: {
        x: C.FIELD_CX,
        y: C.FIELD_CY,
        vx: 0,
        vy: 0,
        speed: 0,
        spin: 0,
        held: true,
        holdTimer: C.HOLD_TIME,
        trail: [],
      },
    });
    expect(s.obstacles).toHaveLength(2);
    engine.apply((s) => d.setScore(s, 6, 9));
    expect(engine.diagnostics().find((r) => r.name === "p1 score")?.value).toBe(
      6,
    );
    expect(engine.diagnostics().every((r) => r.error === undefined)).toBe(true);
  });
  it("poses every scalar independently, without mutating old state", async () => {
    const { engine: e, d, snapshot } = await harness();
    const before = e.state;
    e.apply((s) => d.setScreen(s, "paused"));
    e.apply((s) => d.setMode(s, "versus"));
    e.apply((s) => d.setMenuIndex(s, 2));
    e.apply((s) => d.setTitleIndex(s, 1));
    e.apply((s) => d.setResumeScreen(s, "countdown"));
    e.apply((s) => d.setScore(s, 10, 11));
    e.apply((s) => d.setWinner(s, "right"));
    e.apply((s) => d.setReceiver(s, "right"));
    e.apply((s) => d.setPaddleCy(s, "left", 42));
    e.apply((s) => d.setPaddleVy(s, "left", 777));
    e.apply((s) => d.setPaddleDriven(s, "left", true));
    e.apply((s) => d.setAiTracking(s, false));
    e.apply((s) => d.setAiMovement(s, false));
    e.apply((s) => d.setBallPosition(s, 500, 60));
    e.apply((s) => d.setBallVelocity(s, 300, -400));
    e.apply((s) => d.setBallSpin(s, 890));
    e.apply((s) => d.setBallHeld(s, false));
    e.apply((s) => d.setBallHoldTimer(s, 0.3));
    e.apply((s) => d.setBallServeSign(s, -1));
    e.apply((s) => d.setMuted(s, true));
    e.apply((s) => d.setObstacleClock(s, 1.2));
    e.apply((s) => d.setObstacleClockRunning(s, false));
    expect(snapshot()).toMatchObject({
      screen: "paused",
      mode: "versus",
      menuIndex: 2,
      titleIndex: 1,
      resumeScreen: "countdown",
      score: { p1: 10, p2: 11 },
      winner: "right",
      receiver: "right",
      paddles: {
        left: { cy: 42, vy: 0, drivenVy: 777, driven: true },
        right: { driven: false },
      },
      ai: { tracking: false, movement: false },
      muted: true,
      obstacleClock: 1.2,
      obstacleClockRunning: false,
      ball: {
        x: 500,
        y: 60,
        vx: 300,
        vy: -400,
        speed: 500,
        spin: 890,
        held: false,
        holdTimer: 0.3,
        serveSign: -1,
      },
    });
    expect(before.screen).toBe("title");
    expect(before.ball?.x).toBe(C.FIELD_CX);
    const posed = snapshot();
    e.apply(d.reconcile);
    e.apply(d.reconcile);
    expect(snapshot()).toEqual(posed);
    e.apply(d.reset);
    expect(snapshot()).toMatchObject({
      screen: "title",
      simTime: 0,
      muted: true,
      obstacleClock: 0,
      ai: { tracking: true, movement: true },
      paddles: { left: { driven: false, drivenVy: 0 } },
    });
  });
  it("removes entities, refuses missing targets and respawns in clock order", async () => {
    const { engine: e, d, snapshot } = await harness();
    e.apply(d.clearWorld);
    expect(snapshot()).toMatchObject({ ball: null, obstacles: [] });
    const missing = [
      () => d.setBallPosition(e.state, 0, 0),
      () => d.setBallVelocity(e.state, 0, 0),
      () => d.setBallSpin(e.state, 0),
      () => d.setBallHeld(e.state, true),
      () => d.setBallHoldTimer(e.state, 0),
      () => d.setBallServeSign(e.state, 1),
      () => d.drawBallServeSign(e.state),
    ];
    for (const pose of missing) expect(pose).toThrow("No ball");
    expect(() => d.spawnObstacle(e.state, 2)).toThrow();
    expect(() => d.spawnObstacle(e.state, 0.5)).toThrow();
    e.apply((s) => d.setObstacleClock(s, 0.9));
    e.apply((s) => d.spawnObstacle(s, 1));
    e.apply((s) => d.spawnObstacle(s, 0));
    e.apply((s) => d.spawnObstacle(s, 0));
    expect(snapshot().obstacles.map((o) => o.index)).toEqual([0, 1]);
    expect(snapshot().obstacles[0].cy).toBeCloseTo(
      C.OBSTACLE_CENTERS[0].y + C.OBSTACLE_SWAY_AMP,
    );
    expect(snapshot().obstacles[1].theta).toBeCloseTo(
      C.OBSTACLE_SPIN_RATE * 0.9,
    );
    e.apply(d.spawnBall);
    expect(snapshot().ball?.held).toBe(true);
  });
  it("draws independent equally likely serve signs on every parking", async () => {
    const { engine: e, d } = await harness();
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0.1);
    e.apply(d.spawnBall);
    expect(e.state.ball?.serveSign).toBe(-1);
    e.apply(d.drawBallServeSign);
    expect(e.state.ball?.serveSign).toBe(1);
    e.apply(d.reset);
    expect(e.state.ball?.serveSign).toBe(-1);
  });
});

describe("screens and menu inputs", () => {
  it("wraps, prioritizes up over down and movement over confirm", async () => {
    const h = await harness();
    h.key("KeyW", true);
    h.key("KeyS", true);
    h.key("Enter", true);
    await h.engine.advance(1);
    expect(h.engine.state.menuIndex).toBe(2);
    expect(h.engine.state.screen).toBe("title");
    h.key("KeyW", false);
    h.key("KeyS", false);
    h.key("Enter", false);
    await h.tap("Enter");
    expect(h.engine.state.screen).toBe("howto");
    await h.tap("Escape");
    expect(h.engine.state.menuIndex).toBe(2);
    await h.tap("KeyS");
    expect(h.engine.state.menuIndex).toBe(0);
    await h.tap("KeyS");
    await h.tap("Enter");
    expect(h.engine.state).toMatchObject({
      mode: "versus",
      screen: "countdown",
      titleIndex: 1,
    });
  });
  it("one Escape opens pause and one Escape resumes, without moving the frozen world", async () => {
    const h = await harness();
    await h.tap("Enter");
    const ball = h.engine.state.ball;
    await h.tap("Escape");
    expect(h.engine.state.screen).toBe("paused");
    expect(h.engine.state.ball).toEqual(ball);
    const clock = h.engine.state.obstacleClock;
    await h.engine.advance(4);
    expect(h.engine.state.obstacleClock).toBe(clock);
    await h.tap("Escape");
    expect(h.engine.state.screen).toBe("countdown");
    expect(h.engine.state.ball?.holdTimer).toBeLessThan(ball?.holdTimer ?? 0);
  });
  it("pause takes priority over menu confirm and restarting preserves driver flags", async () => {
    const h = await harness();
    await h.tap("Enter");
    await h.tap("KeyP");
    h.key("KeyP", true);
    h.key("Enter", true);
    await h.engine.advance(1);
    expect(h.engine.state.screen).toBe("countdown");
    h.key("KeyP", false);
    h.key("Enter", false);
    await h.tap("KeyP");
    await h.tap("KeyS");
    h.engine.apply((s) => h.d.setPaddleDriven(s, "left", true));
    await h.tap("Enter");
    expect(h.engine.state).toMatchObject({
      score: { p1: 0, p2: 0 },
      winner: null,
      screen: "countdown",
      paddles: { left: { driven: true } },
    });
    await h.tap("KeyP");
    await h.tap("KeyW");
    await h.tap("Enter");
    expect(h.engine.state).toMatchObject({
      screen: "title",
      paddles: { left: { driven: false } },
    });
  });
  it.each(["mouse", "touch"])(
    "selects and confirms %s items across frame boundaries",
    async (device) => {
      const h = await harness();
      const r = h.d.menuItemRect(h.engine.state, 1)!;
      h.pointer("down", r.x + 20, r.y + 20, device);
      await h.engine.advance(1);
      expect(h.engine.state.menuIndex).toBe(1);
      h.pointer("up", r.x + 20, r.y + 20, device);
      await h.engine.advance(1);
      expect(h.engine.state).toMatchObject({
        screen: "countdown",
        mode: "versus",
        titleIndex: 1,
      });
    },
  );
  it("rejects mismatched and outside click edges, accepts same-frame clicks", async () => {
    const h = await harness();
    const a = h.d.menuItemRect(h.engine.state, 0)!,
      b = h.d.menuItemRect(h.engine.state, 2)!;
    h.pointer("down", a.x + 5, a.y + 5);
    h.pointer("up", b.x + 5, b.y + 5);
    await h.engine.advance(1);
    expect(h.engine.state.screen).toBe("title");
    h.pointer("down", 0, 0);
    h.pointer("up", a.x + 5, a.y + 5);
    await h.engine.advance(1);
    expect(h.engine.state.screen).toBe("title");
    h.pointer("down", b.x + 5, b.y + 5);
    h.pointer("up", b.x + 5, b.y + 5);
    await h.engine.advance(1);
    expect(h.engine.state.screen).toBe("howto");
  });
  it("applies pointer selection after keyboard movement, but confirms keyboard first", async () => {
    const h = await harness();
    const r = h.d.menuItemRect(h.engine.state, 2)!;
    h.key("KeyS", true);
    h.pointer("move", r.x + 2, r.y + 2);
    await h.engine.advance(1);
    expect(h.engine.state.menuIndex).toBe(2);
    h.key("KeyS", false);
    h.engine.apply((s) => h.d.setMenuIndex(s, 0));
    h.key("Enter", true);
    h.pointer("down", r.x + 2, r.y + 2);
    h.pointer("up", r.x + 2, r.y + 2);
    await h.engine.advance(1);
    expect(h.engine.state).toMatchObject({ screen: "countdown", mode: "solo" });
  });
  it.each([
    "title",
    "howto",
    "paused",
    "matchover",
    "playing",
    "countdown",
  ] as Screen[])("reports menu geometry and renders %s", async (screen) => {
    const h = await harness();
    h.engine.apply((s) => h.d.setScreen(s, screen));
    expect(h.d.menuItemRect(h.engine.state, -1)).toBeNull();
    expect(h.d.menuItemRect(h.engine.state, 99)).toBeNull();
    if (screen === "playing" || screen === "countdown")
      expect(h.d.menuItemRect(h.engine.state, 0)).toBeNull();
    else expect(h.d.menuItemRect(h.engine.state, 0)?.w).toBeGreaterThan(0);
    await h.engine.advance(1);
    expect(h.engine.state.simTime).toBeCloseTo(0.008);
  });
  it("plays again, returns from matchover, and mirrors mute on every screen", async () => {
    const h = await harness();
    h.engine.apply((s) => h.d.setScreen(s, "matchover"));
    h.engine.apply((s) => h.d.setWinner(s, "right"));
    await h.tap("KeyM");
    expect(h.engine.state.muted).toBe(true);
    await h.tap("Enter");
    expect(h.engine.state.screen).toBe("countdown");
    h.engine.apply((s) => h.d.setScreen(s, "matchover"));
    await h.tap("KeyS");
    await h.tap("Enter");
    expect(h.engine.state.screen).toBe("title");
    h.engine.apply((s) => h.d.setScreen(s, "matchover"));
    await h.tap("Escape");
    expect(h.engine.state.screen).toBe("title");
    expect(h.engine.state.muted).toBe(true);
  });
});

describe("simulation", () => {
  it("moves both paddles during countdown and serves without advancing the ball", async () => {
    const h = await harness(10);
    await h.tap("Enter");
    h.engine.apply((s) => h.d.setBallServeSign(s, -1));
    h.engine.apply((s) => h.d.setBallHoldTimer(s, 0.01));
    h.key("ArrowUp", true);
    await h.engine.advance(1);
    expect(h.engine.state.paddles.left.cy).toBeCloseTo(
      C.FIELD_CY - C.PADDLE_SPEED * 0.01,
    );
    expect(h.snapshot().ball).toMatchObject({
      x: C.FIELD_CX,
      y: C.FIELD_CY,
      held: false,
      holdTimer: 0,
      serveSign: -1,
    });
    expect(h.snapshot().ball?.speed).toBeCloseTo(C.SERVE_SPEED);
    expect(h.snapshot().ball?.vx).toBeCloseTo(
      -C.SERVE_SPEED * Math.cos(C.SERVE_ANGLE),
    );
    expect(h.snapshot().ball?.vy).toBeLessThan(0);
    await h.engine.advance(1);
    expect(h.engine.state.ball?.x).toBeLessThan(C.FIELD_CX);
  });
  it("keeps drivenVy independent of actual clamped velocity", async () => {
    const h = await harness(10);
    h.flight(640, 360, 0, 0);
    h.engine.apply((s) => h.d.setPaddleCy(s, "left", C.PADDLE_MAX_CY - 2));
    h.engine.apply((s) => h.d.setPaddleVy(s, "left", 500));
    await h.engine.advance(1);
    expect(h.engine.state.paddles.left.vy).toBe(0);
    h.engine.apply((s) => h.d.setPaddleDriven(s, "left", true));
    h.key("KeyW", true);
    await h.engine.advance(1);
    expect(h.engine.state.paddles.left).toMatchObject({
      cy: C.PADDLE_MAX_CY,
      vy: 200,
      drivenVy: 500,
    });
    await h.engine.advance(1);
    expect(h.engine.state.paddles.left.vy).toBe(0);
  });
  it("moves local players independently and cancels opposing held keys", async () => {
    const h = await harness(10);
    h.flight(640, 360, 0, 0);
    h.key("KeyW", true);
    h.key("ArrowDown", true);
    await h.engine.advance(1);
    expect(h.engine.state.paddles.left.vy).toBe(-C.PADDLE_SPEED);
    expect(h.engine.state.paddles.right.vy).toBe(C.PADDLE_SPEED);
    h.key("KeyS", true);
    await h.engine.advance(1);
    expect(h.engine.state.paddles.left.vy).toBe(0);
  });
  it("gates the AI's tracking and movement independently", async () => {
    const h = await harness(10);
    h.flight(900, 550, 400, 0);
    h.engine.apply((s) => h.d.setMode(s, "solo"));
    await h.engine.advance(1);
    expect(h.engine.state.paddles.right.vy).toBe(C.AI_SPEED);
    h.engine.apply((s) => h.d.setAiMovement(s, false));
    await h.engine.advance(1);
    expect(h.engine.state.paddles.right.vy).toBe(0);
    h.engine.apply((s) => h.d.setPaddleCy(s, "right", 500));
    h.engine.apply((s) => h.d.setAiTracking(s, false));
    h.engine.apply((s) => h.d.setAiMovement(s, true));
    await h.engine.advance(1);
    expect(h.engine.state.paddles.right.vy).toBe(-C.AI_SPEED);
    h.engine.apply((s) => h.d.setPaddleCy(s, "right", C.AI_HOME_Y));
    await h.engine.advance(1);
    expect(h.engine.state.paddles.right.vy).toBe(0);
  });
  it.each([1, -1])(
    "decays spin while rotating velocity with sign %i, conserving speed",
    async (sign) => {
      const h = await harness(8);
      h.flight(500, 360, 400, 0, sign * 600);
      await h.engine.advance(100);
      expect(h.snapshot().ball?.spin).toBeCloseTo(sign * 300, 6);
      expect(h.snapshot().ball?.speed).toBeCloseTo(400, 6);
      expect(Math.sign(h.snapshot().ball?.vy ?? 0)).toBe(sign);
      expect(h.engine.state.ball?.trail.length).toBeGreaterThan(10);
      expect(
        h.engine.state.ball?.trail.every(
          (p) => h.engine.state.simTime - p.t <= C.TRAIL_TIME,
        ),
      ).toBe(true);
    },
  );
  it.each(["left", "right"] as const)(
    "reflects a fast ball off the %s paddle and adds motion spin",
    async (side) => {
      const h = await harness(16);
      h.flight(
        side === "left" ? 90 : 1190,
        360,
        side === "left" ? -980 : 980,
        0,
      );
      h.engine.apply((s) => h.d.setPaddleDriven(s, side, true));
      h.engine.apply((s) => h.d.setPaddleVy(s, side, 100));
      const played: string[] = [];
      h.engine.events.on("cue:played", (e) => played.push(e.cue));
      await h.engine.advance(2);
      expect(Math.sign(h.engine.state.ball?.vx ?? 0)).toBe(
        side === "left" ? 1 : -1,
      );
      expect(h.snapshot().ball?.speed).toBeCloseTo(C.SPEED_CAP);
      expect(h.snapshot().ball?.spin).toBeGreaterThan(0);
      expect(played.filter((c) => c === C.CUES.paddleHit)).toHaveLength(1);
    },
  );
  it("scales speed by paddle hits below the cap and respects edge angle", async () => {
    const h = await harness(8);
    h.flight(76, C.FIELD_CY + 50, -500, 0);
    await h.engine.advance(1);
    expect(h.snapshot().ball?.speed).toBeCloseTo(500 * C.SPEED_MULT);
    expect(
      Math.atan2(h.engine.state.ball!.vy, h.engine.state.ball!.vx),
    ).toBeCloseTo((50 / C.PADDLE_HALF) * C.MAX_BOUNCE_ANGLE);
  });
  it.each(["top", "bottom", "cap-top", "cap-bottom"])(
    "reflects %s without changing speed or spin beyond decay",
    async (where) => {
      const h = await harness(8);
      const cap = where.startsWith("cap");
      const top = where.endsWith("top");
      const y = cap
        ? C.FIELD_CY +
          (top ? -C.PADDLE_HALF - C.BALL_R - 1 : C.PADDLE_HALF + C.BALL_R + 1)
        : top
          ? C.BALL_R + 1
          : C.FIELD_H - C.BALL_R - 1;
      h.flight(
        cap ? (C.P1_X0 + C.P1_X1) / 2 : 300,
        y,
        0,
        top ? (cap ? 500 : -500) : cap ? -500 : 500,
        0,
      );
      await h.engine.advance(1);
      expect(h.snapshot().ball?.speed).toBeCloseTo(500);
      expect(Math.sign(h.engine.state.ball!.vy)).toBe(
        top ? (cap ? -1 : 1) : cap ? 1 : -1,
      );
    },
  );
  it.each([0, 0.5, 1.1])(
    "reflects against an oriented obstacle at clock %f",
    async (clock) => {
      const h = await harness(8);
      h.flight(640, 360, 0, 0, 200);
      h.engine.apply((s) => h.d.setObstacleClock(s, clock));
      h.engine.apply((s) => h.d.setObstacleClockRunning(s, false));
      h.engine.apply((s) => h.d.spawnObstacle(s, 0));
      const o = h.engine.state.obstacles[0],
        nx = Math.cos(o.theta),
        ny = Math.sin(o.theta);
      h.engine.apply((s) =>
        h.d.setBallPosition(s, o.cx - nx * 23, o.cy - ny * 23),
      );
      h.engine.apply((s) => h.d.setBallVelocity(s, 500 * nx, 500 * ny));
      const played: string[] = [];
      h.engine.events.on("cue:played", (e) => played.push(e.cue));
      await h.engine.advance(1);
      expect(
        h.engine.state.ball!.vx * nx + h.engine.state.ball!.vy * ny,
      ).toBeLessThan(0);
      expect(h.snapshot().ball?.speed).toBeCloseTo(500);
      expect(h.engine.state.ball?.spin).toBeCloseTo(
        200 * Math.pow(0.5, 0.008 / C.SPIN_HALFLIFE),
      );
      expect(played).toContain(C.CUES.obstacleBounce);
      expect(h.engine.state.obstacleClock).toBe(clock);
    },
  );
  it("pushes an inside-obstacle pose out even when stationary", async () => {
    const h = await harness();
    h.flight(490, 220, 0, 0);
    h.engine.apply((s) => h.d.spawnObstacle(s, 0));
    await h.engine.advance(1);
    expect(h.engine.state.ball?.x).toBeCloseTo(490 - C.OBSTACLE_HW - C.BALL_R);
  });
  it("reflects a circle off an obstacle corner using its diagonal normal", async () => {
    const h = await harness(8);
    const base = C.OBSTACLE_CENTERS[0];
    const diagonal = Math.SQRT1_2;
    h.flight(
      base.x - C.OBSTACLE_HW - 9,
      base.y - C.OBSTACLE_HH - 9,
      500 * diagonal,
      500 * diagonal,
    );
    h.engine.apply((s) => h.d.spawnObstacle(s, 0));
    h.engine.apply((s) => h.d.setObstacleClockRunning(s, false));
    await h.engine.advance(1);
    expect(h.engine.state.ball!.vx).toBeLessThan(0);
    expect(h.engine.state.ball!.vy).toBeLessThan(0);
    expect(h.snapshot().ball?.speed).toBeCloseTo(500);
    const dx = h.engine.state.ball!.x - (base.x - C.OBSTACLE_HW);
    const dy = h.engine.state.ball!.y - (base.y - C.OBSTACLE_HH);
    expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(C.BALL_R - 1e-9);
  });
  it("plays a cue once per frame even when several substeps bounce", async () => {
    const h = await harness(2000);
    h.flight(300, 360, 0, C.SPEED_CAP);
    const cues: string[] = [];
    h.engine.events.on("cue:played", (e) => cues.push(e.cue));
    await h.engine.advance(1);
    expect(cues).toEqual([C.CUES.wallBounce]);
    expect(h.engine.state.ball!.y).toBeGreaterThanOrEqual(C.BALL_R);
    expect(h.engine.state.ball!.y).toBeLessThanOrEqual(C.FIELD_H - C.BALL_R);
  });
  it.each(["left", "right"] as const)(
    "scores for %s and serves toward the conceding player",
    async (side) => {
      const h = await harness();
      h.flight(
        side === "left" ? C.FIELD_W + C.BALL_R + 2 : -C.BALL_R - 2,
        100,
        0,
        0,
      );
      const cues: string[] = [];
      h.engine.events.on("cue:played", (e) => cues.push(e.cue));
      await h.engine.advance(1);
      expect(h.engine.state.score).toEqual({
        p1: Number(side === "left"),
        p2: Number(side === "right"),
      });
      expect(h.engine.state.receiver).toBe(side === "left" ? "right" : "left");
      expect(h.engine.state).toMatchObject({
        screen: "countdown",
        ball: { held: true, trail: [], spin: 0 },
      });
      expect(cues).toEqual([C.CUES.score]);
    },
  );
  it.each([
    [10, 10, "countdown"],
    [11, 10, "matchover"],
    [9, 10, "countdown"],
  ] as const)("applies win-by-two after %i–%i", async (p1, p2, screen) => {
    const h = await harness();
    h.flight(C.FIELD_W + C.BALL_R + 1, 100, 0, 0);
    h.engine.apply((s) => h.d.setScore(s, p1, p2));
    await h.engine.advance(1);
    expect(h.engine.state.screen).toBe(screen);
    expect(h.engine.state.winner).toBe(screen === "matchover" ? "left" : null);
  });
  it("does not advance an absent world and preserves the old frame value", async () => {
    const h = await harness();
    h.engine.apply(h.d.clearWorld);
    h.engine.apply((s) => h.d.setScreen(s, "playing"));
    const before = h.engine.state;
    await h.engine.advance(3);
    expect(h.engine.state.ball).toBeNull();
    expect(h.engine.state.score).toEqual({ p1: 0, p2: 0 });
    expect(before.simTime).toBe(0);
    expect(before.obstacleClock).toBe(0);
  });
  it("ends a right-side win and leaves the final ball where it scored", async () => {
    const h = await harness();
    h.flight(-C.BALL_R - 5, 130, -500, 0);
    h.engine.apply((s) => h.d.setScore(s, 9, 10));
    await h.engine.advance(1);
    expect(h.engine.state).toMatchObject({
      screen: "matchover",
      winner: "right",
      score: { p1: 9, p2: 11 },
      menuIndex: 0,
    });
    expect(h.engine.state.ball!.x).toBeLessThan(-C.BALL_R);
    const ball = h.engine.state.ball;
    await h.engine.advance(4);
    expect(h.engine.state.ball).toEqual(ball);
  });
  it("agrees in speed and direction for a spinning paddle contact at different frame lengths", async () => {
    async function run(step: number) {
      const h = await harness(step);
      h.flight(180, 350, -600, -30, -100);
      h.engine.apply((s) => h.d.setPaddleDriven(s, "left", true));
      h.engine.apply((s) => h.d.setPaddleVy(s, "left", -120));
      const cues: string[] = [];
      h.engine.events.on("cue:played", (e) => cues.push(e.cue));
      await h.engine.advance(400 / step);
      return { ball: h.snapshot().ball!, cues };
    }
    const a = await run(2),
      b = await run(16);
    expect(a.cues).toEqual(b.cues);
    expect(a.cues).toContain(C.CUES.paddleHit);
    expect(Math.abs(a.ball.speed - b.ball.speed)).toBeLessThan(10);
    expect(Math.sign(a.ball.vx)).toBe(Math.sign(b.ball.vx));
    expect(Math.abs(a.ball.vy) < 120 ? 0 : Math.sign(a.ball.vy)).toBe(
      Math.abs(b.ball.vy) < 120 ? 0 : Math.sign(b.ball.vy),
    );
  });
  it("reaches the same bank shot and point at 2ms and 16ms frame lengths", async () => {
    async function run(step: number) {
      const h = await harness(step);
      h.flight(350, 220, 600, 0, 50);
      h.engine.apply((s) => h.d.spawnObstacle(s, 0));
      h.engine.apply((s) => h.d.setObstacleClockRunning(s, false));
      h.engine.apply((s) => h.d.setPaddleCy(s, "left", C.PADDLE_MAX_CY));
      const cues: string[] = [];
      h.engine.events.on("cue:played", (e) => cues.push(e.cue));
      let frames = 0;
      while (h.engine.state.screen === "playing" && frames * step < 4000) {
        await h.engine.advance(1);
        frames++;
      }
      return { s: h.snapshot(), time: frames * step, cues };
    }
    const a = await run(2),
      b = await run(16);
    expect(a.cues).toEqual(b.cues);
    expect(a.cues).toContain(C.CUES.obstacleBounce);
    expect(a.s.score).toEqual(b.s.score);
    expect(a.s.score.p2).toBe(1);
    expect(Math.abs(a.time - b.time) / a.time).toBeLessThan(0.08);
  });
});
