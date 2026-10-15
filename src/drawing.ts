import type { DeepReadonly } from "ts-essentials";
import type { RenderApi } from "@clockwyrks/simple-2d";
import type { CaromState } from "./game";
import * as C from "./constants";
import { menuItemRect, menuItems } from "./menus";

const P = {
  ink: "#101c22",
  panel: "#15252c",
  line: "#30434a",
  muted: "#91a5aa",
  white: "#ecf0df",
  mint: "#b5f5ce",
  coral: "#ff947e",
  amber: "#efc475",
};
type Context = CanvasRenderingContext2D;
type State = DeepReadonly<CaromState>;

function text(
  ctx: Context,
  copy: string,
  x: number,
  y: number,
  size = 14,
  color = P.white,
  align: CanvasTextAlign = "left",
  weight = 400,
  mono = false,
): void {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${mono ? '"Courier New", monospace' : '"Arial", sans-serif'}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(copy, x, y);
}
function line(
  ctx: Context,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color = P.line,
  width = 1,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
function round(
  ctx: Context,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  r = 6,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function circle(
  ctx: Context,
  x: number,
  y: number,
  r: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function key(
  ctx: Context,
  label: string,
  x: number,
  y: number,
  width = 31,
): void {
  round(ctx, x, y - 14, width, 28, P.panel, 4);
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y - 13.5, width - 1, 27);
  text(ctx, label, x + width / 2, y + 1, 12, P.white, "center", 400, true);
}
function emblem(ctx: Context, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.35);
  round(ctx, 0, 0, 5, 24, P.mint, 2);
  round(ctx, 20, 0, 5, 24, P.mint, 2);
  circle(ctx, 12.5, 12, 3.5, P.white);
  ctx.restore();
}
function chrome(ctx: Context, s: State): void {
  emblem(ctx, 52, 43);
  text(
    ctx,
    "CAROM / RACQUET EXPERIMENTS",
    94,
    56,
    12,
    P.muted,
    "left",
    400,
    true,
  );
  circle(ctx, 1062, 56, 3, s.muted ? P.muted : P.mint);
  text(
    ctx,
    s.muted ? "SOUND OFF" : "SOUND ON",
    1076,
    56,
    11,
    P.muted,
    "left",
    400,
    true,
  );
  key(ctx, "M", 1180, 56, 28);
  line(ctx, 52, 91, 1228, 91);
}
function footer(ctx: Context, left: string, right: string): void {
  line(ctx, 52, 655, 1228, 655);
  text(ctx, left, 54, 685, 11, P.muted, "left", 400, true);
  text(ctx, right, 1226, 685, 11, P.muted, "right", 400, true);
}
function menus(ctx: Context, s: State): void {
  const descriptions = [
    "YOU vs THE MACHINE",
    "TWO PLAYERS · ONE KEYBOARD",
    "LEARN THE ANGLES",
  ];
  menuItems(s).forEach((item, i) => {
    const r = menuItemRect(s, i);
    if (!r) return;
    const selected = i === s.menuIndex;
    if (selected) round(ctx, r.x, r.y, r.w, r.h, P.mint, 5);
    else line(ctx, r.x, r.y + r.h, r.x + r.w, r.y + r.h, P.line);
    const color = selected ? P.ink : P.white;
    text(
      ctx,
      `0${i + 1}`,
      r.x + 18,
      r.y + r.h / 2,
      11,
      selected ? P.ink : P.muted,
      "left",
      400,
      true,
    );
    text(ctx, item, r.x + 56, r.y + r.h / 2, 18, color, "left", 700);
    text(
      ctx,
      selected ? "↗" : "+",
      r.x + r.w - 23,
      r.y + r.h / 2,
      22,
      color,
      "center",
    );
    if (s.screen === "title" && selected) {
      text(ctx, descriptions[i], r.x, 603, 11, P.muted, "left", 400, true);
    }
  });
}

/** A static, code-drawn bank-shot diagram; the title never advances the world. */
function titleDiagram(ctx: Context): void {
  const x = 667,
    y = 168,
    w = 545,
    h = 387;
  round(ctx, x, y, w, h, P.panel, 10);
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 22.5, y + 23.5, w - 45, h - 47);
  ctx.save();
  ctx.setLineDash([5, 9]);
  line(ctx, x + w / 2, y + 24, x + w / 2, y + h - 24);
  ctx.restore();
  ctx.strokeStyle = "#273b42";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 70, 0, Math.PI * 2);
  ctx.stroke();
  round(ctx, x + 38, y + 215, 9, 66, P.mint, 4);
  round(ctx, x + w - 47, y + 98, 9, 66, P.coral, 4);
  for (const [ox, oy, angle] of [
    [207, 113, -0.4],
    [338, 274, -0.4],
  ]) {
    ctx.save();
    ctx.translate(x + ox, y + oy);
    ctx.rotate(angle);
    round(ctx, -5, -42, 10, 84, P.amber, 4);
    ctx.restore();
  }
  ctx.save();
  ctx.setLineDash([4, 7]);
  ctx.strokeStyle = "#8dbea6";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 50, y + 247);
  ctx.bezierCurveTo(x + 140, y + 245, x + 192, y + 184, x + 213, y + 153);
  ctx.lineTo(x + 369, y + 330);
  ctx.lineTo(x + 489, y + 172);
  ctx.stroke();
  ctx.restore();
  // A short solid curve and bright ball make spin legible in the illustration.
  ctx.strokeStyle = P.mint;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + 104, y + 237);
  ctx.quadraticCurveTo(x + 151, y + 221, x + 181, y + 190);
  ctx.stroke();
  circle(ctx, x + 181, y + 190, 8, P.white);
  text(ctx, "A", x + 172, y + 96, 10, P.amber, "center", 400, true);
  text(ctx, "B", x + 375, y + 280, 10, P.amber, "center", 400, true);
  text(
    ctx,
    "THE SHORTEST PATH ISN’T ALWAYS STRAIGHT.",
    x + w / 2,
    y + h + 30,
    10,
    P.muted,
    "center",
    400,
    true,
  );
}
function title(ctx: Context, s: State): void {
  chrome(ctx, s);
  text(ctx, "01 / A GAME OF ANGLES", 106, 170, 12, P.amber, "left", 400, true);
  text(ctx, C.TITLE_TEXT, 95, 255, 118, P.white, "left", 900);
  text(ctx, "Put a little spin on it.", 106, 330, 23, P.muted);
  titleDiagram(ctx);
  menus(ctx, s);
  footer(
    ctx,
    "W / S  OR  ↑ / ↓  NAVIGATE     ENTER  SELECT",
    "SOLO OR LOCAL DUEL  /  FIRST TO " + C.WIN_SCORE,
  );
}

function field(ctx: Context, s: State): void {
  // Fine court markings stay well below the contrast of collidable bodies.
  ctx.strokeStyle = "#182a32";
  ctx.lineWidth = 1;
  for (let x = 160; x < C.FIELD_W; x += 160)
    line(ctx, x, 0, x, C.FIELD_H, "#18272e");
  for (let y = 120; y < C.FIELD_H; y += 120)
    line(ctx, 0, y, C.FIELD_W, y, "#18272e");
  ctx.save();
  ctx.setLineDash([5, 13]);
  line(ctx, C.NET_X, 0, C.NET_X, C.FIELD_H, "#3b4b50", 2);
  ctx.restore();
  ctx.strokeStyle = "#283b42";
  ctx.beginPath();
  ctx.arc(C.FIELD_CX, C.FIELD_CY, 84, 0, Math.PI * 2);
  ctx.stroke();
  line(ctx, 0, 1, C.FIELD_W, 1, "#758b8d", 2);
  line(ctx, 0, C.FIELD_H - 1, C.FIELD_W, C.FIELD_H - 1, "#758b8d", 2);
  for (const o of s.obstacles) {
    ctx.save();
    ctx.translate(o.cx, o.cy);
    ctx.rotate(o.theta);
    ctx.shadowColor = "#efc47533";
    ctx.shadowBlur = 18;
    round(
      ctx,
      -C.OBSTACLE_HW,
      -C.OBSTACLE_HH,
      C.OBSTACLE_W,
      C.OBSTACLE_H,
      P.amber,
      5,
    );
    ctx.shadowBlur = 0;
    line(ctx, -3, -7, 3, -7, "#9b7d48");
    line(ctx, -3, 0, 3, 0, "#9b7d48");
    line(ctx, -3, 7, 3, 7, "#9b7d48");
    ctx.restore();
  }
  for (const side of ["left", "right"] as const) {
    const p = s.paddles[side];
    const x = side === "left" ? C.P1_X0 : C.P2_X0;
    const color = side === "left" ? P.mint : P.coral;
    ctx.save();
    ctx.shadowColor = color + "55";
    ctx.shadowBlur = 22;
    round(ctx, x, p.cy - C.PADDLE_HALF, C.PADDLE_W, C.PADDLE_H, color, 7);
    ctx.restore();
  }
  if (s.ball) {
    const b = s.ball;
    for (let i = 1; i < b.trail.length; i++) {
      const a = b.trail[i - 1],
        p = b.trail[i];
      const age = Math.max(0, 1 - (s.simTime - p.t) / C.TRAIL_TIME);
      ctx.save();
      ctx.globalAlpha = age * 0.5;
      ctx.lineCap = "round";
      line(ctx, a.x, a.y, p.x, p.y, P.mint, C.BALL_R * age * 1.7);
      ctx.restore();
    }
    ctx.save();
    ctx.shadowColor = "#ecf0df77";
    ctx.shadowBlur = 20;
    circle(ctx, b.x, b.y, C.BALL_R, P.white);
    ctx.restore();
    if (Math.abs(b.spin) > 40) {
      ctx.strokeStyle = P.mint;
      ctx.lineWidth = 1.5;
      const angle = (b.spin / C.SPIN_CLAMP) * Math.PI;
      ctx.beginPath();
      ctx.arc(b.x, b.y, C.BALL_R + 7, angle, angle + Math.PI * 1.2);
      ctx.stroke();
    }
  }
  // Keep HUD lettering unboxed: the moving obstacles remain visible everywhere.
  text(ctx, "PLAYER 01", 542, 39, 10, P.mint, "center", 400, true);
  text(
    ctx,
    s.mode === "solo" ? "MACHINE" : "PLAYER 02",
    738,
    39,
    10,
    P.coral,
    "center",
    400,
    true,
  );
  text(
    ctx,
    String(s.score.p1).padStart(2, "0"),
    542,
    83,
    58,
    P.white,
    "center",
    700,
  );
  text(
    ctx,
    String(s.score.p2).padStart(2, "0"),
    738,
    83,
    58,
    P.white,
    "center",
    700,
  );
  text(ctx, ":", C.FIELD_CX, 80, 28, P.muted, "center", 400, true);
  text(ctx, C.TITLE_TEXT, 106, 38, 19, P.white, "left", 900);
  text(
    ctx,
    s.mode === "solo" ? "SOLO / HUMAN vs MACHINE" : "VERSUS / LOCAL DUEL",
    106,
    63,
    10,
    P.muted,
    "left",
    400,
    true,
  );
  text(
    ctx,
    "FIRST TO " + C.WIN_SCORE + " · WIN BY " + C.WIN_LEAD,
    1174,
    38,
    10,
    P.muted,
    "right",
    400,
    true,
  );
  text(
    ctx,
    s.muted ? "M  SOUND OFF" : "M  SOUND ON",
    1174,
    62,
    10,
    P.muted,
    "right",
    400,
    true,
  );
  text(
    ctx,
    s.mode === "solo" ? "W / S  OR  ↑ / ↓" : "W / S",
    106,
    686,
    11,
    P.muted,
    "left",
    400,
    true,
  );
  text(
    ctx,
    "P / ESC  PAUSE",
    C.FIELD_CX,
    686,
    10,
    P.muted,
    "center",
    400,
    true,
  );
  text(
    ctx,
    s.mode === "solo" ? "READ THE ANGLE. MAKE THE SHOT." : "↑ / ↓",
    1174,
    686,
    11,
    P.muted,
    "right",
    400,
    true,
  );
  if (s.screen === "countdown" && s.ball) {
    round(ctx, 520, 419, 240, 66, P.panel, 5);
    text(ctx, "GET READY", C.FIELD_CX, 441, 16, P.mint, "center", 700);
    text(
      ctx,
      s.receiver === "left"
        ? "← SERVING TO PLAYER 01"
        : "SERVING TO PLAYER 02 →",
      C.FIELD_CX,
      465,
      10,
      P.muted,
      "center",
      400,
      true,
    );
    const progress = 1 - s.ball.holdTimer / C.HOLD_TIME;
    round(ctx, 540, 494, 200 * Math.max(0, progress), 3, P.mint, 1);
  }
}
function overlay(ctx: Context, s: State): void {
  ctx.fillStyle = "#101c22dc";
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  round(ctx, 378, 142, 524, 464, P.panel, 12);
  text(
    ctx,
    s.screen === "paused" ? "TAKE A BREATHER" : "THAT’S THE MATCH",
    C.FIELD_CX,
    188,
    11,
    P.amber,
    "center",
    400,
    true,
  );
  const heading =
    s.screen === "paused"
      ? "PAUSED"
      : s.winner === "left"
        ? "PLAYER 01 WINS"
        : s.mode === "solo"
          ? "MACHINE WINS"
          : "PLAYER 02 WINS";
  text(
    ctx,
    heading,
    C.FIELD_CX,
    250,
    s.screen === "paused" ? 56 : 38,
    P.white,
    "center",
    900,
  );
  text(
    ctx,
    s.screen === "paused"
      ? "Your next angle can wait."
      : `${s.score.p1}  —  ${s.score.p2}   /   FINAL SCORE`,
    C.FIELD_CX,
    302,
    14,
    P.muted,
    "center",
    400,
    s.screen === "matchover",
  );
  menus(ctx, s);
  text(
    ctx,
    "↑ / ↓  NAVIGATE     ENTER  SELECT",
    C.FIELD_CX,
    574,
    10,
    P.muted,
    "center",
    400,
    true,
  );
}
function howto(ctx: Context, s: State): void {
  chrome(ctx, s);
  text(ctx, "THE FIELD GUIDE", 104, 143, 12, P.amber, "left", 400, true);
  text(ctx, "Play the angle.", 101, 203, 53, P.white, "left", 900);
  text(
    ctx,
    `Get the ball past your opponent. First to ${C.WIN_SCORE}, with a lead of ${C.WIN_LEAD}, takes the match.`,
    106,
    255,
    18,
    P.muted,
  );
  const cols = [104, 502, 900];
  const headings = ["01 / MOVE", "02 / ADD SPIN", "03 / BANK IT"];
  cols.forEach((x, i) => {
    line(ctx, x, 295, x + 275, 295);
    text(
      ctx,
      headings[i],
      x,
      323,
      12,
      i === 2 ? P.amber : P.mint,
      "left",
      400,
      true,
    );
  });
  key(ctx, "W", 104, 369);
  key(ctx, "S", 142, 369);
  text(ctx, "PLAYER 01", 191, 369, 12, P.white, "left", 700);
  key(ctx, "↑", 104, 411);
  key(ctx, "↓", 142, 411);
  text(ctx, "PLAYER 02", 191, 411, 12, P.white, "left", 700);
  text(ctx, "Solo? Either pair moves you.", 104, 461, 16, P.muted);
  text(ctx, "Touch? Use the side sliders.", 104, 489, 16, P.muted);
  text(ctx, "Move as you hit to bend the ball.", 502, 369, 16, P.white);
  text(ctx, "Up adds upward spin; down", 502, 405, 16, P.muted);
  text(ctx, "adds downward spin. Edge hits", 502, 433, 16, P.muted);
  text(ctx, "make sharper angles.", 502, 461, 16, P.muted);
  text(ctx, "Spin fades. Your timing matters.", 502, 505, 14, P.mint);
  text(ctx, "The amber bars sway and turn.", 900, 369, 16, P.white);
  text(ctx, "Read their faces. Bounce off", 900, 405, 16, P.muted);
  text(ctx, "them to find a new route past", 900, 433, 16, P.muted);
  text(ctx, "the other paddle.", 900, 461, 16, P.muted);
  text(ctx, "Every rally is a new geometry.", 900, 505, 14, P.amber);
  menus(ctx, s);
  footer(ctx, "P / ESC  PAUSE     M  MUTE", "ENTER / ESC  BACK TO MENU");
}
export function drawGame(s: State, api: RenderApi): void {
  const ctx = api.ctx;
  ctx.save();
  ctx.lineCap = "butt";
  ctx.globalAlpha = 1;
  if (s.screen === "title") title(ctx, s);
  else if (s.screen === "howto") howto(ctx, s);
  else {
    field(ctx, s);
    if (s.screen === "paused" || s.screen === "matchover") overlay(ctx, s);
  }
  ctx.restore();
}
