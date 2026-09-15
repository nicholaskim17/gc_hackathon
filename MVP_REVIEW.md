# Rally MVP Implementation Review

Date: 2026-09-15

## Current Status

The software MVP is implemented and the automated suite is green. The architecture matches the intended two-laptop game:

- Each laptop performs local MediaPipe pose tracking.
- Webcam frames remain on the local laptop.
- Only normalized racket input crosses the network.
- The server owns physics, collision, scoring, match state, and power-ups.
- Each player receives the same game state from the opposite table perspective.
- Keyboard control remains available if either camera fails.

## Implemented Hardening

### Latency

- Increased client input from 30 Hz to 45 Hz.
- Increased authoritative snapshots from 30 Hz to 45 Hz.
- Reduced same-room interpolation delay from 50 ms to a configured 35 ms.
- Kept physics at 120 Hz and pose inference at 30 Hz.
- Kept immediate local paddle rendering so the player's own racket does not wait for a server round trip.

### Tracking Reliability

- The real MediaPipe model and WASM runtime are stored locally under `apps/client/public/`.
- GPU initialization now falls back to CPU compatibility mode.
- A stalled GPU worker is terminated and retried in a fresh CPU worker.
- Worker events are generation-guarded so an old camera attempt cannot corrupt a newer retry.
- Worker startup and tracking-loss thresholds are shared configuration values.
- Camera errors now receive the intended visible error state.
- Debug mode reports the active tracking delegate, CV FPS, confidence, and wrist speed.

### Multiplayer Reliability

- Added a six-second input grace period while clients build the 3D scene and enter countdown.
- Normal play still pauses after 1.6 seconds without fresh player input.
- This prevents slower laptops from entering the game and immediately pausing during renderer startup.
- A two-browser end-to-end test now verifies room creation, joining, ready state, synchronized match entry, opposite perspectives, pause propagation, and exit.

### Calibration And Form

- Pose calibration values now derive from the shared tuning config instead of duplicating numbers.
- Existing tests cover sustained body/hand calibration, interruption rejection, camera translation and scale invariance, history expiry, elbow angle, and sequence-associated form scoring.
- The tracking history remains 700 ms, with form evaluation 160 ms after contact.

## Automated Verification

Run from the repository root:

```bash
npm test
npm run typecheck
npm run test:e2e
npm run build
```

Expected results after this implementation:

- Unit tests: 24 passing.
- Browser tests: 5 passing.
- Typecheck: passing.
- Production build: passing.

The production build may still report a chunk-size warning because Three.js and MediaPipe are large dependencies. This does not affect correctness and all model assets are local.

## Physical Demo Gate

These checks require the two actual laptops and cannot be certified by automated tests:

1. Put both laptops on the same phone hotspot or trusted Wi-Fi and turn off VPNs.
2. On the second laptop, open `http://<host-ip>:3001/health` and confirm an `ok` response.
3. Open `http://localhost:5173/vision-smoke.html` on both laptops and run the model check.
4. Place the laptops back to back with each camera facing one player.
5. Confirm shoulders, hips, elbow, and wrist remain visible through a full swing.
6. Calibrate both players and play for at least two minutes.
7. Open `?debug=1`, press `D`, and confirm CV FPS stays near 30 and LAN RTT remains stable.
8. Test one camera retry, one keyboard fallback, and one browser refresh before presenting.

Use front lighting and avoid bright windows behind either player. If peer-to-peer traffic is blocked on venue Wi-Fi, use a phone hotspot.

## Tuning Baseline

```ts
INPUT_HZ: 45
STATE_BROADCAST_HZ: 45
PHYSICS_HZ: 120
CV_HZ: 30
NETWORK_INTERPOLATION_MS: 35
TRACKING_INIT_TIMEOUT_MS: 15000
INPUT_TIMEOUT_MS: 1600
STARTUP_INPUT_TIMEOUT_MS: 6000
PADDLE_SMOOTHING: 24
PADDLE_RADIUS_X: 0.48
PADDLE_RADIUS_Y: 0.58
```

Do not raise `CV_HZ` until both real laptops maintain frame rate during a full match. If hits feel too strict during rehearsal, increase both paddle radii by 10 percent before changing pose mapping or ball physics.

## Remaining Risk

The remaining uncertainty is hardware and environment specific, not an identified software failure. Real camera field of view, room lighting, laptop CPU/GPU performance, and local network policy must still pass the physical demo gate above.
