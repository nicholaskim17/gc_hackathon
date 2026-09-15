# Rally — Perspective Pong

A two-laptop, webcam-controlled ping-pong game. Each laptop faces one player, tracks
that player's body with MediaPipe Pose, turns their hand into a racket, and renders the
same authoritative rally from that player's end of the table. First to 7 points.

Full design and implementation spec: [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md).

- **No API keys, no accounts, no cloud.** The pose model and WebAssembly runtime are
  served from the app itself; the only network needed is between the two laptops.
- **Webcam frames never leave the laptop.** Only derived racket input is sent.

---

## Install (both laptops)

Requires **Node.js 24+** and current **Chrome**.

```bash
npm install
```

`postinstall` copies the MediaPipe model and WASM runtime into `apps/client/public/`,
so the game does not depend on conference Wi-Fi at demo time.

---

## Run

### Host laptop (runs the game server *and* its own client)

```bash
npm run dev
```

This starts the authoritative server on port **3001** and the client on **5173**. The
server prints the address the other laptop needs:

```
Rally multiplayer server: http://localhost:3001
Teammate server address: http://192.168.1.123:3001
```

Open <http://localhost:5173> on the host.

### Second laptop (client only)

```bash
npm run dev:client
```

Open <http://localhost:5173>, then enter the host's **Teammate server address** in the
*Game server address* field.

> Always open each client on its own `localhost`. Browsers only grant webcam access in a
> secure context, and a plain `http://192.168.x.x` page is not one — so do **not** serve
> the second laptop's page from the host.

### Pairing

1. On one laptop press **Play together**, confirm the server address, press **Create a room**.
2. A five-character room code appears. Enter it on the other laptop and press **Join room**.
3. Both players calibrate, then press **Ready to rally**.

The server hosts one table at a time. To start a fresh one, press **Leave room** first.

### Camera permissions

Chrome asks once per laptop — choose **Allow**. If Chrome also asks for permission to
find devices on the local network, allow that too. To change it later: the camera icon in
the address bar, or Chrome Settings → Privacy and security → Site settings → Camera.

### Calibration

Stand far enough back that your shoulders, elbows and wrists are visible, then:

1. **Step into view** — hold still until your shoulders register.
2. **Raise your playing hand** — hold it above your shoulder; that picks your hand.
3. **Lower your hand comfortably** — this becomes your racket's neutral position.

---

## Playing without a camera

Handy for testing alone, or if a webcam fails mid-demo.

- **Try without camera** — one keyboard, practice against the house.
- **Two players, one keyboard** — local duo on a single laptop.
- **Use keyboard instead** — switch mid-setup or from the pause menu, keeping the room.

| Action | Player 1 | Player 2 |
| --- | --- | --- |
| Move racket | `W` `A` `S` `D` | Arrow keys |
| Swing | `Space` | `Enter` |

`Esc` pauses, `M` mutes.

---

## Debug / simulation mode

Append `?debug=1` (for example <http://localhost:5173/?debug=1>) for a simulator panel
with live telemetry: FPS, CV FPS, socket state, RTT, racket position, wrist speed, elbow
angle, ball position and active power-ups.

| Key | Action |
| --- | --- |
| `D` | Show/hide the panel |
| Mouse | Drive the racket directly |
| `Space` | Serve / reset the ball |
| `1` `2` `3` | Grant Big Racket / Smash / Shield |
| `P` | Spawn a table target |
| `7` | Award a point |
| `R` | Reset the round |

The power and score tools apply to local practice only — the server stays authoritative
in a networked match. Keep the panel hidden during the real presentation.

### Vision diagnostic

<http://localhost:5173/vision-smoke.html> loads the real model in the real game worker and
runs one generated frame, with no camera involved. Use it to separate "the model is
broken" from "the camera is broken". Dev server only; it is not part of the build.

---

## Checks

```bash
npm run typecheck   # both client and server
npm test            # engine, pose and room unit tests
npm run test:e2e    # Playwright: gameplay, camera denial, layout, real model load
npm run build       # production client bundle
```

`npm run test:e2e` needs browsers once: `npx playwright install chromium`. It starts its
own client on 5174 and its own server on 3101, so it will not disturb a running demo.

### Two-laptop rehearsal

Before presenting, test the actual hardware rather than relying only on the automated
suite:

1. Put both laptops on the same phone hotspot or trusted Wi-Fi and turn off VPNs.
2. From the second laptop, open `http://<host-ip>:3001/health` and confirm it returns
   an `ok` response.
3. Run <http://localhost:5173/vision-smoke.html> on both laptops.
4. Calibrate both cameras and play for at least two minutes with the laptops back to back.
5. Open <http://localhost:5173/?debug=1>, press `D`, and check that CV FPS stays near
   30 and LAN RTT remains stable.
6. Rehearse one camera retry, one keyboard fallback, and one browser refresh.

---

## Troubleshooting

**`npm run dev` exits immediately.**
Almost always a server left running from an earlier session still holding port 3001. The
server now says so and names the fix; `concurrently -k` stops the client too, which is why
the whole command appears to die. Clear it with `lsof -ti tcp:3001 | xargs kill`, or start
on another port with `PORT=3002 npm run dev` and give the other laptop the new address.
If npm instead says it cannot find package.json, you are not in the project folder — `cd`
into the repo first.

**Camera permission was denied.**
The setup screen says so and offers **Use keyboard instead**, which keeps you in the room.
To re-grant, use the camera icon in Chrome's address bar, reload, then **Recalibrate camera**.

**Motion tracking won't start.**
Open the vision diagnostic above. If it fails there, the model or WASM runtime is the
problem, not your webcam — re-run `npm install` to restore `apps/client/public/wasm/` and
`apps/client/public/models/`. The worker tries the GPU delegate first and falls back to
CPU on its own, so a GPU failure alone should not stop the game.

*If you are changing this code:* MediaPipe's WASM runtime is classic Emscripten output and
must be evaluated in sloppy mode. The worker loads it through a `self.import` hook that
fetches and runs it via indirect eval, because a module worker's `importScripts()` throws
and MediaPipe's own fallback would evaluate it as an ES module — which fails with
`ReferenceError: custom_dbg is not defined`. Don't remove that hook.

**The second laptop can't reach the server.**
Check both laptops are on the same Wi-Fi or hotspot, and that no VPN is active. Use the
exact address the server printed, including `http://` and `:3001`. Confirm the server is
reachable by opening `http://<host-ip>:3001/health` — it should return `{"ok":true,...}`.

**Windows Firewall prompt.**
When Node asks to communicate on private networks, choose **Allow**. If it was dismissed,
allow Node.js for private networks in Windows Defender Firewall settings.

**Tracking is jittery or drops out.**
Improve front lighting and avoid a bright window behind you. Step back so your shoulders
and hips stay in frame, and keep your playing arm unobstructed. Then **Recalibrate camera**.
If it is still unstable, the keyboard path is always one click away.

**A player disconnected or refreshed.**
The match pauses rather than scoring against the missing player. Their seat is held for
about a minute and reclaimed automatically by the same browser, so a refresh is safe.
Both players must be ready again to resume.
