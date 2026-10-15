import type { DeepReadonly } from "ts-essentials";
import type { UpdateApi } from "@clockwyrks/simple-2d";
import type { CaromState, MenuRect } from "./game";
import {
  ACTIONS,
  TITLE_ITEMS,
  PAUSE_ITEMS,
  MATCHOVER_ITEMS,
} from "./constants";
import { returnToTitle, startMatch } from "./world";

export function menuItems(s: DeepReadonly<CaromState>): readonly string[] {
  switch (s.screen) {
    case "title":
      return TITLE_ITEMS;
    case "paused":
      return PAUSE_ITEMS;
    case "matchover":
      return MATCHOVER_ITEMS;
    case "howto":
      return ["BACK TO MENU"];
    default:
      return [];
  }
}
export function menuItemRect(
  s: DeepReadonly<CaromState>,
  index: number,
): MenuRect | null {
  if (!Number.isInteger(index) || index < 0 || index >= menuItems(s).length)
    return null;
  if (s.screen === "title")
    return { x: 104, y: 365 + index * 67, w: 422, h: 57 };
  if (s.screen === "howto") return { x: 440, y: 590, w: 400, h: 57 };
  return { x: 440, y: 352 + index * 67, w: 400, h: 57 };
}
function hit(s: DeepReadonly<CaromState>, x: number, y: number): number {
  return menuItems(s).findIndex((_, i) => {
    const r = menuItemRect(s, i);
    return (
      r !== null && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
    );
  });
}
function confirm(s: DeepReadonly<CaromState>): CaromState {
  switch (s.screen) {
    case "title": {
      const next = { ...s, titleIndex: s.menuIndex, menuPresses: {} };
      return s.menuIndex === 2
        ? { ...next, screen: "howto", menuIndex: 0 }
        : startMatch(next, s.menuIndex === 0 ? "solo" : "versus");
    }
    case "howto":
      return returnToTitle(s);
    case "paused":
      return s.menuIndex === 0
        ? { ...s, screen: s.resumeScreen, menuPresses: {} }
        : s.menuIndex === 1
          ? startMatch(s, s.mode)
          : returnToTitle(s);
    case "matchover":
      return s.menuIndex === 0 ? startMatch(s, s.mode) : returnToTitle(s);
    default:
      return s;
  }
}
export function readControls(
  state: DeepReadonly<CaromState>,
  api: UpdateApi,
): CaromState {
  const edges = Object.fromEntries(
    ACTIONS.map((name) => [name, api.input.pressed(name)]),
  );
  const samples = api.input.pointerSamples();
  const contacts = api.input.pointerContacts();
  let s: CaromState = state;
  if (edges.mute) {
    api.audio.setMuted(!api.audio.muted());
    s = { ...s, muted: api.audio.muted() };
  }
  if (state.screen === "countdown" || state.screen === "playing") {
    return edges.pause
      ? {
          ...s,
          resumeScreen: state.screen,
          screen: "paused",
          menuIndex: 0,
          menuPresses: {},
        }
      : s;
  }
  if (state.screen === "paused" && (edges.pause || edges.back))
    return { ...s, screen: s.resumeScreen, menuPresses: {} };
  if ((state.screen === "howto" || state.screen === "matchover") && edges.back)
    return returnToTitle(s);
  const count = menuItems(s).length;
  const up = edges["p1-up"] || edges["p2-up"];
  const down = edges["p1-down"] || edges["p2-down"];
  const movement = state.screen !== "howto" && (up || down);
  if (movement)
    s = { ...s, menuIndex: (s.menuIndex + (up ? -1 : 1) + count) % count };
  if (!movement && edges.confirm) return confirm(s);
  let presses = { ...s.menuPresses };
  let pointerConfirm = false;
  for (const sample of samples) {
    if (sample.button !== null && sample.button !== "primary") continue;
    const index = hit(s, sample.x, sample.y);
    if (index >= 0) s = { ...s, menuIndex: index };
    if (sample.type === "down") presses[sample.id] = index;
    if (sample.type === "up") {
      if (index >= 0 && presses[sample.id] === index) pointerConfirm = true;
      const { [sample.id]: _released, ...remaining } = presses;
      presses = remaining;
    }
  }
  for (const contact of contacts) {
    const index = hit(s, contact.x, contact.y);
    if (index >= 0) s = { ...s, menuIndex: index };
  }
  s = { ...s, menuPresses: presses };
  return pointerConfirm ? confirm(s) : s;
}
