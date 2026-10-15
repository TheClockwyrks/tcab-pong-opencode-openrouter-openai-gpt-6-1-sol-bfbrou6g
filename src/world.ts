import type { DeepReadonly } from "ts-essentials";
import type { UpdateApi } from "@clockwyrks/simple-2d";
import type {
  BallState,
  CaromState,
  Mode,
  ObstacleState,
  PaddleState,
  Side,
} from "./game";
import * as C from "./constants";

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));
export const drawServeSign = (): 1 | -1 => (Math.random() < 0.5 ? -1 : 1);
export function parkedBall(): BallState {
  return {
    x: C.FIELD_CX,
    y: C.FIELD_CY,
    vx: 0,
    vy: 0,
    spin: 0,
    held: true,
    holdTimer: C.HOLD_TIME,
    serveSign: drawServeSign(),
    trail: [],
  };
}
export function obstaclePose(index: number, t: number): ObstacleState {
  const base = C.OBSTACLE_CENTERS[index];
  if (!base || !Number.isInteger(index))
    throw new RangeError(`No obstacle ${index}`);
  return {
    index,
    cx: base.x,
    cy:
      base.y +
      (index === 0 ? 1 : -1) *
        C.OBSTACLE_SWAY_AMP *
        Math.sin((2 * Math.PI * t) / C.OBSTACLE_SWAY_PERIOD),
    theta: C.OBSTACLE_SPIN_RATE * t,
  };
}
export function initialState(muted: boolean): CaromState {
  const paddle: PaddleState = {
    cy: C.FIELD_CY,
    vy: 0,
    driven: false,
    drivenVy: 0,
  };
  return {
    screen: "title",
    mode: "solo",
    menuIndex: 0,
    titleIndex: 0,
    resumeScreen: "playing",
    score: { p1: 0, p2: 0 },
    winner: null,
    paddles: { left: { ...paddle }, right: { ...paddle } },
    ai: { tracking: true, movement: true },
    receiver: "left",
    ball: parkedBall(),
    obstacles: C.OBSTACLE_CENTERS.map((_, i) => obstaclePose(i, 0)),
    obstacleClock: 0,
    obstacleClockRunning: true,
    simTime: 0,
    muted,
  };
}
export function startMatch(
  s: DeepReadonly<CaromState>,
  mode: Mode,
): CaromState {
  return {
    ...s,
    mode,
    screen: "countdown",
    resumeScreen: "playing",
    menuIndex: 0,
    score: { p1: 0, p2: 0 },
    winner: null,
    receiver: "left",
    ball: parkedBall(),
    paddles: {
      left: { ...s.paddles.left, cy: C.FIELD_CY, vy: 0 },
      right: { ...s.paddles.right, cy: C.FIELD_CY, vy: 0 },
    },
    obstacleClock: 0,
    obstacleClockRunning: true,
    obstacles: s.obstacles.map((o) => obstaclePose(o.index, 0)),
    menuPresses: {},
  };
}
export function returnToTitle(s: DeepReadonly<CaromState>): CaromState {
  return {
    ...initialState(s.muted),
    titleIndex: s.titleIndex,
    menuIndex: s.titleIndex,
    simTime: s.simTime,
  };
}
function movePaddle(p: PaddleState, vy: number, dt: number): PaddleState {
  const raw = p.cy + vy * dt;
  const cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  return { ...p, cy, vy: cy !== raw && dt > 0 ? (cy - p.cy) / dt : vy };
}
function advancePaddles(
  s: DeepReadonly<CaromState>,
  api: UpdateApi,
  dt: number,
): CaromState["paddles"] {
  const held = (name: C.ActionName): boolean => api.input.value(name) > 0;
  const leftUp = held("p1-up") || (s.mode === "solo" && held("p2-up"));
  const leftDown = held("p1-down") || (s.mode === "solo" && held("p2-down"));
  const leftVy = (Number(leftDown) - Number(leftUp)) * C.PADDLE_SPEED;
  let rightVy =
    (Number(held("p2-down")) - Number(held("p2-up"))) * C.PADDLE_SPEED;
  if (s.mode === "solo") {
    const defending =
      s.ai.tracking &&
      s.screen === "playing" &&
      s.ball !== null &&
      s.ball.vx > 0;
    const target =
      defending && s.ball ? s.ball.y - s.ball.vy * C.AI_REACT : C.AI_HOME_Y;
    const deadzone = defending ? C.AI_DEADZONE : C.AI_HOME_DEADZONE;
    const diff = target - s.paddles.right.cy;
    rightVy =
      s.ai.movement && Math.abs(diff) > deadzone && dt > 0
        ? Math.sign(diff) * Math.min(C.AI_SPEED, Math.abs(diff) / dt)
        : 0;
  }
  return {
    left: movePaddle(
      s.paddles.left,
      s.paddles.left.driven ? s.paddles.left.drivenVy : leftVy,
      dt,
    ),
    right: movePaddle(
      s.paddles.right,
      s.paddles.right.driven ? s.paddles.right.drivenVy : rightVy,
      dt,
    ),
  };
}
// Local working values never alias the read-only incoming ball.
type Flight = { -readonly [K in keyof BallState]: BallState[K] };
function collidePaddle(
  b: Flight,
  p: PaddleState,
  side: Side,
  cues: Set<C.CueName>,
): void {
  const x0 = side === "left" ? C.P1_X0 : C.P2_X0;
  const x1 = side === "left" ? C.P1_X1 : C.P2_X1;
  const y0 = p.cy - C.PADDLE_HALF,
    y1 = p.cy + C.PADDLE_HALF;
  const depths = [
    b.x - (x0 - C.BALL_R),
    x1 + C.BALL_R - b.x,
    b.y - (y0 - C.BALL_R),
    y1 + C.BALL_R - b.y,
  ];
  if (depths.some((d) => d <= 0)) return;
  const face = depths.indexOf(Math.min(...depths));
  if (face < 2) {
    const speed = Math.min(Math.hypot(b.vx, b.vy) * C.SPEED_MULT, C.SPEED_CAP);
    const theta =
      clamp((b.y - p.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE;
    b.vx = (side === "left" ? 1 : -1) * speed * Math.cos(theta);
    b.vy = speed * Math.sin(theta);
    b.spin = clamp(
      b.spin + p.vy * C.SPIN_FROM_PADDLE,
      -C.SPIN_CLAMP,
      C.SPIN_CLAMP,
    );
    b.x = side === "left" ? C.P1_X1 + C.BALL_R : C.P2_X0 - C.BALL_R;
    cues.add(C.CUES.paddleHit);
  } else {
    b.y = face === 2 ? y0 - C.BALL_R : y1 + C.BALL_R;
    if ((face === 2 && b.vy > 0) || (face === 3 && b.vy < 0)) {
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    }
  }
}
function collideObstacle(
  b: Flight,
  o: ObstacleState,
  cues: Set<C.CueName>,
): void {
  const cos = Math.cos(o.theta),
    sin = Math.sin(o.theta);
  const dx = b.x - o.cx,
    dy = b.y - o.cy;
  const lx = dx * cos + dy * sin,
    ly = -dx * sin + dy * cos;
  const qx = clamp(lx, -C.OBSTACLE_HW, C.OBSTACLE_HW);
  const qy = clamp(ly, -C.OBSTACLE_HH, C.OBSTACLE_HH);
  const distance = Math.hypot(lx - qx, ly - qy);
  if (distance >= C.BALL_R) return;
  let nlx: number, nly: number, push: number;
  if (distance > 0) {
    nlx = (lx - qx) / distance;
    nly = (ly - qy) / distance;
    push = C.BALL_R - distance;
  } else {
    const depths = [
      lx + C.OBSTACLE_HW,
      C.OBSTACLE_HW - lx,
      ly + C.OBSTACLE_HH,
      C.OBSTACLE_HH - ly,
    ];
    const face = depths.indexOf(Math.min(...depths));
    nlx = face === 0 ? -1 : face === 1 ? 1 : 0;
    nly = face === 2 ? -1 : face === 3 ? 1 : 0;
    push = depths[face] + C.BALL_R;
  }
  const nx = nlx * cos - nly * sin,
    ny = nlx * sin + nly * cos;
  const dot = b.vx * nx + b.vy * ny;
  if (dot < 0) {
    b.vx -= 2 * dot * nx;
    b.vy -= 2 * dot * ny;
    cues.add(C.CUES.obstacleBounce);
  }
  b.x += nx * push;
  b.y += ny * push;
}
export function flyBall(
  ball: DeepReadonly<BallState>,
  s: DeepReadonly<CaromState>,
  dt: number,
  cues: Set<C.CueName>,
): BallState {
  const b: Flight = { ...ball };
  const n = Math.max(
    1,
    Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
  );
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const angle = (b.spin / speed) * h;
      const cos = Math.cos(angle),
        sin = Math.sin(angle);
      const vx = b.vx * cos - b.vy * sin;
      b.vy = b.vx * sin + b.vy * cos;
      b.vx = vx;
    }
    b.spin *= Math.pow(0.5, h / C.SPIN_HALFLIFE);
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.y - C.BALL_R < 0 && b.vy < 0) {
      b.y = C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    } else if (b.y + C.BALL_R > C.FIELD_H && b.vy > 0) {
      b.y = C.FIELD_H - C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    }
    collidePaddle(b, s.paddles.left, "left", cues);
    collidePaddle(b, s.paddles.right, "right", cues);
    for (const o of s.obstacles) collideObstacle(b, o, cues);
  }
  return b;
}
export function advanceWorld(
  s: DeepReadonly<CaromState>,
  api: UpdateApi,
  dt: number,
): CaromState {
  if (s.screen !== "countdown" && s.screen !== "playing") return s;
  const paddles = advancePaddles(s, api, dt);
  let next: CaromState = { ...s, paddles };
  const cues = new Set<C.CueName>();
  let ball = s.ball;
  if (ball) {
    if (s.screen === "countdown") {
      const holdTimer = Math.max(0, ball.holdTimer - dt);
      ball = { ...ball, holdTimer };
      if (holdTimer <= 0) {
        ball = {
          ...ball,
          held: false,
          trail: [],
          vx:
            (s.receiver === "left" ? -1 : 1) *
            C.SERVE_SPEED *
            Math.cos(C.SERVE_ANGLE),
          vy: ball.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
        };
        next = { ...next, screen: "playing" };
      }
    } else if (!ball.held) ball = flyBall(ball, next, dt, cues);
    ball = {
      ...ball,
      trail: [
        ...ball.trail.filter((p) => s.simTime - p.t <= C.TRAIL_TIME),
        { x: ball.x, y: ball.y, t: s.simTime },
      ],
    };
    next = { ...next, ball };
    if (
      s.screen === "playing" &&
      (ball.x - C.BALL_R > C.FIELD_W || ball.x + C.BALL_R < 0)
    ) {
      const scorer: Side = ball.x > C.FIELD_W ? "left" : "right";
      const score = {
        p1: s.score.p1 + Number(scorer === "left"),
        p2: s.score.p2 + Number(scorer === "right"),
      };
      const wins =
        Math.max(score.p1, score.p2) >= C.WIN_SCORE &&
        Math.abs(score.p1 - score.p2) >= C.WIN_LEAD;
      next = {
        ...next,
        score,
        ...(wins
          ? { winner: scorer, screen: "matchover" as const, menuIndex: 0 }
          : {
              ball: parkedBall(),
              receiver:
                scorer === "left" ? ("right" as const) : ("left" as const),
              screen: "countdown" as const,
            }),
      };
      cues.add(C.CUES.score);
    }
  }
  const obstacleClock = s.obstacleClock + (s.obstacleClockRunning ? dt : 0);
  next = {
    ...next,
    obstacleClock,
    obstacles: s.obstacles.map((o) => obstaclePose(o.index, obstacleClock)),
  };
  for (const cue of cues) api.audio.play(cue);
  return next;
}
