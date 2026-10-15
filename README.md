# Carom

A top-down paddle duel with a little spin. Move through contact to curve the
ball, read the two swaying, rotating obstacles, and bank a shot past the other
paddle. Play the machine in **Solo**, or share a keyboard in **Versus**. First
to 11 wins, with a two-point lead.

Everything is drawn on canvas and every sound is synthesized in the browser.
Carom runs on the supplied Simple 2D engine and needs no server-side services or
runtime downloads.

## Run locally

Requires a current Node.js version supported by Vite (Node 22.12+ recommended).

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite.

## Production

```sh
npm run build
```

The complete static site is emitted to `dist/`, with `dist/index.html` as its
entry point. Serve that directory at the root of a static host. Use
`npm run preview` to check the production build locally.

## Controls

| Action | Keyboard |
| --- | --- |
| Solo paddle | W / S or ↑ / ↓ |
| Versus left paddle | W / S |
| Versus right paddle | ↑ / ↓ |
| Navigate menus | W / S or ↑ / ↓ |
| Select | Enter or Space |
| Pause / resume | P or Escape |
| Back | Escape |
| Toggle sound | M |
| Engine debug overlay | Backtick |

Menus also support mouse and touch. On a touchscreen, the engine displays two
vertical paddle sliders and menu controls. The field scales and letterboxes to
fit the screen while keeping its full play area visible.

**Spin:** a moving paddle adds spin when it hits the ball. Contact near a
paddle's end produces a steeper outgoing angle. Spin fades gradually, while
wall and obstacle bounces preserve it. The amber obstacles continuously sway
and rotate, so watch the angle of the face you are aiming at.

## Development checks

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

The unit suite creates real Simple 2D engines over Node canvases and advances
counted frames. It covers menus, debug poses, serving, AI, spin, oriented
collisions, scoring, and agreement across frame lengths. Coverage and test
reports are written to `coverage/`.

The game state and debug types are exported from `src/game.ts`. Simulation,
menus, rendering, and debug operations live in separate modules beside it.
Debug poses run through `engine.apply`; snapshots read `engine.state`. No debug
object is installed on the page.

See `showcase/` for screenshots and an engine-recorded replay of live play.
