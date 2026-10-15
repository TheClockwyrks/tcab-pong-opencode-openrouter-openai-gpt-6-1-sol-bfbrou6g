import type { DeepReadonly } from "ts-essentials";
import type {
  BallState,
  CaromDebugApi,
  CaromState,
  PaddleState,
  Side,
} from "./game";
import { CAROM_DEBUG_VERSION } from "./constants";
import { drawServeSign, initialState, obstaclePose, parkedBall } from "./world";
import { menuItemRect } from "./menus";

function patchBall(
  s: DeepReadonly<CaromState>,
  patch: Partial<BallState>,
): CaromState {
  if (s.ball === null) throw new Error("No ball on the field");
  return { ...s, ball: { ...s.ball, ...patch } };
}
function patchPaddle(
  s: DeepReadonly<CaromState>,
  side: Side,
  patch: Partial<PaddleState>,
): CaromState {
  return {
    ...s,
    paddles: { ...s.paddles, [side]: { ...s.paddles[side], ...patch } },
  };
}
export function createDebugApi(): CaromDebugApi {
  return {
    version: CAROM_DEBUG_VERSION,
    clearWorld: (s) => ({ ...s, ball: null, obstacles: [] }),
    spawnBall: (s) => ({ ...s, ball: parkedBall() }),
    spawnObstacle(s, index) {
      const pose = obstaclePose(index, s.obstacleClock);
      return {
        ...s,
        obstacles: [...s.obstacles.filter((o) => o.index !== index), pose].sort(
          (a, b) => a.index - b.index,
        ),
      };
    },
    reset: (s) => initialState(s.muted),
    reconcile: (s) => ({
      ...s,
      obstacles: s.obstacles.map((o) => obstaclePose(o.index, s.obstacleClock)),
    }),
    setScreen: (s, screen) => ({ ...s, screen }),
    setMode: (s, mode) => ({ ...s, mode }),
    setMenuIndex: (s, menuIndex) => ({ ...s, menuIndex }),
    setTitleIndex: (s, titleIndex) => ({ ...s, titleIndex }),
    setResumeScreen: (s, resumeScreen) => ({ ...s, resumeScreen }),
    setScore: (s, p1, p2) => ({ ...s, score: { p1, p2 } }),
    setWinner: (s, winner) => ({ ...s, winner }),
    setReceiver: (s, receiver) => ({ ...s, receiver }),
    setPaddleCy: (s, side, cy) => patchPaddle(s, side, { cy }),
    setPaddleVy: (s, side, drivenVy) => patchPaddle(s, side, { drivenVy }),
    setPaddleDriven: (s, side, driven) => patchPaddle(s, side, { driven }),
    setBallPosition: (s, x, y) => patchBall(s, { x, y }),
    setBallVelocity: (s, vx, vy) => patchBall(s, { vx, vy }),
    setBallSpin: (s, spin) => patchBall(s, { spin }),
    setBallHeld: (s, held) => patchBall(s, { held }),
    setBallHoldTimer: (s, holdTimer) => patchBall(s, { holdTimer }),
    setBallServeSign: (s, serveSign) => patchBall(s, { serveSign }),
    drawBallServeSign: (s) => patchBall(s, { serveSign: drawServeSign() }),
    setAiTracking: (s, tracking) => ({ ...s, ai: { ...s.ai, tracking } }),
    setAiMovement: (s, movement) => ({ ...s, ai: { ...s.ai, movement } }),
    setMuted: (s, muted) => ({ ...s, muted }),
    setObstacleClock: (s, obstacleClock) => ({
      ...s,
      obstacleClock,
      obstacles: s.obstacles.map((o) => obstaclePose(o.index, obstacleClock)),
    }),
    setObstacleClockRunning: (s, obstacleClockRunning) => ({
      ...s,
      obstacleClockRunning,
    }),
    snapshot(s) {
      const { menuPresses: _menuPresses, ...declared } = s;
      return {
        ...declared,
        version: CAROM_DEBUG_VERSION,
        score: { ...s.score },
        paddles: { left: { ...s.paddles.left }, right: { ...s.paddles.right } },
        ai: { ...s.ai },
        ball: s.ball
          ? {
              ...s.ball,
              speed: Math.hypot(s.ball.vx, s.ball.vy),
              trail: s.ball.trail.map((p) => ({ ...p })),
            }
          : null,
        obstacles: s.obstacles.map((o) => ({
          ...obstaclePose(o.index, s.obstacleClock),
        })),
      };
    },
    menuItemRect,
  };
}
