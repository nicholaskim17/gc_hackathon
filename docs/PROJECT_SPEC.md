# Perspective Pong

## Complete Planning, System Design, Implementation, and Codex Handoff Specification

## 1. Project objective

Build a two-player physical-computing ping-pong game using two laptops positioned back-to-back.

Each laptop:

* faces one player,
* uses its webcam to track that player's body and playing hand,
* displays the same virtual ping-pong table from that player's perspective,
* renders the ball approaching or receding in perspective,
* converts real hand motion into a virtual paddle,
* evaluates each successful swing,
* displays feedback such as `PERFECT`, `GREAT`, `OK`, `WEAK`, or `MISS`,
* supports arcade-style power-ups.

The game must prioritize:

1. reliability,
2. low perceived latency,
3. visual impact,
4. rapid implementation,
5. autonomous development by Codex,

over physically accurate table-tennis simulation.

This is an arcade game controlled by computer vision, not a scientific reconstruction of real table-tennis physics.

---

# 2. Final scope

## Required features

The finished MVP must contain:

### Computer vision

* Webcam input on both laptops.
* Local pose estimation.
* Automatic detection of:

  * shoulders,
  * elbow,
  * wrist.
* Automatic selection of the player's active hand.
* Hand position converted into virtual paddle position.
* Wrist velocity estimated from landmark history.
* Elbow angle calculated for form scoring.
* Basic smoothing to suppress tracking jitter.

### 3D game

* Perspective 3D ping-pong table.
* Virtual paddle representing each player's tracked hand.
* Ball rendered as a real 3D object.
* Player A sees the table from one side.
* Player B sees the same world from the opposite side.
* Ball naturally appears larger as it approaches the player.
* Ball trail.
* Hit/miss effects.
* Score.

### Multiplayer

* Two laptops on the same network.
* One laptop runs the authoritative game server.
* Both laptops run their own local frontend.
* Socket.IO transports player input and game state.
* Server owns:

  * ball state,
  * scoring,
  * collisions,
  * power-ups,
  * match state.
* Clients own:

  * webcam,
  * pose tracking,
  * local paddle rendering,
  * UI effects.

### Form system

Each successful collision gets evaluated using:

* impact accuracy,
* swing speed,
* timing,
* elbow extension,
* follow-through.

Outputs:

* PERFECT
* GREAT
* OK
* WEAK
* MISS

Form quality fills a power meter.

### Power-ups

Implement exactly these three initially:

**BIG RACKET**

* Temporarily increases paddle collision radius.

**SMASH**

* Next successful return receives a large speed multiplier.

**SHIELD**

* Automatically saves one missed return.

Power-ups are acquired through either:

1. filling the form meter through strong hits, or
2. hitting a glowing target on the table with the ball.

---

# 3. Explicit non-goals

Do not implement the following unless the entire MVP is already working:

* true monocular depth reconstruction,
* actual physical racket detection,
* custom machine-learning model training,
* WebRTC,
* video transmission between laptops,
* realistic racket orientation,
* physically accurate spin,
* professional table-tennis technique evaluation,
* account systems,
* databases,
* cloud hosting,
* matchmaking,
* multiple rooms,
* mobile support,
* physics engines such as Rapier unless custom physics completely fails,
* complex particle engines,
* elaborate menus.

The project should remain deliberately small.

---

# 4. Technology stack

Use:

```text
Frontend
React 19
TypeScript
Vite
Three.js
@react-three/fiber v9
@mediapipe/tasks-vision
socket.io-client

Backend
Node.js 24 LTS
TypeScript
Socket.IO
tsx

Optional
@react-three/drei
Zustand
concurrently
```

As of September 2026, Node 24 is an LTS release. React Three Fiber's current compatibility guidance pairs R3F 9 with React 19.

React Three Fiber should be used rather than raw Three.js because it integrates Three.js directly into React while still exposing the underlying Three.js scene graph.

Do not introduce Next.js.

Do not introduce a database.

Do not introduce a cloud backend.

---

# 5. External services and API keys

## Required API keys

**None.**

The entire application can run locally.

MediaPipe's browser Pose Landmarker can run using the downloadable model and WebAssembly runtime without any Google API credential. Google's current example initializes the Pose Landmarker with `@mediapipe/tasks-vision`, a `.task` model, and a GPU delegate.

Socket.IO also runs directly between the laptops and does not require an account or hosted service. Its current implementation is designed for bidirectional low-latency communication, normally over WebSocket, with automatic reconnection if the connection drops.

## Internet dependency

During development, it is acceptable to load MediaPipe WASM/model resources from the official/CDN URLs.

Once the game works, Codex should preferably copy the required `.task` model and WASM assets into the project's `public/` directory so the final demo does not depend on conference/hackathon Wi-Fi.

That is a hardening step, not a prerequisite.

---

# 6. Overall system architecture

```text
                         SAME WI-FI / HOTSPOT

 ┌──────────────────────────────┐
 │          LAPTOP A            │
 │                              │
 │  Webcam                      │
 │    │                         │
 │    ▼                         │
 │ MediaPipe Pose               │
 │    │                         │
 │    ▼                         │
 │ Input Processing             │
 │    │                         │
 │    ├──── Local Paddle ────►  │
 │    │                     R3F │
 │    │                         │
 │    └──── Socket.IO ─────┐    │
 └─────────────────────────│────┘
                           │
                           ▼
                 ┌─────────────────┐
                 │ AUTHORITATIVE   │
                 │ NODE SERVER     │
                 │                 │
                 │ Ball physics    │
                 │ Collision       │
                 │ Score           │
                 │ Power-ups       │
                 │ Match state     │
                 └─────────────────┘
                           ▲
                           │
 ┌─────────────────────────│────┐
 │          LAPTOP B       │    │
 │                        Socket │
 │ Webcam                  │    │
 │   │                     │    │
 │   ▼                     │    │
 │ MediaPipe Pose ─────────┘    │
 │                              │
 │ R3F opposite camera          │
 └──────────────────────────────┘
```

The Node server normally runs on Laptop A.

Both browser applications run locally on their respective laptops.

---

# 7. Why clients must run locally

The browser webcam API `navigator.mediaDevices.getUserMedia()` requires a secure context.

`localhost` is treated as a trustworthy/secure context even when using HTTP. A random `http://192.168.x.x/...` LAN page generally should not be relied upon for webcam access.

Therefore:

```text
Laptop A frontend:
http://localhost:5173

Laptop B frontend:
http://localhost:5173
```

Laptop B connects its Socket.IO client to:

```text
http://<LAPTOP_A_IP>:3001
```

Do not serve Laptop B's frontend directly from Laptop A over plain LAN HTTP.

---

# 8. Repository architecture

Use one npm workspace/monorepo.

```text
perspective-pong/
│
├── package.json
├── package-lock.json
├── README.md
│
├── apps/
│   ├── client/
│   │   ├── index.html
│   │   ├── package.json
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       │
│   │       ├── game/
│   │       │   ├── Game.tsx
│   │       │   ├── GameScene.tsx
│   │       │   ├── Table.tsx
│   │       │   ├── Ball.tsx
│   │       │   ├── Paddle.tsx
│   │       │   ├── PowerupTarget.tsx
│   │       │   └── effects/
│   │       │
│   │       ├── vision/
│   │       │   ├── poseTracker.ts
│   │       │   ├── poseMath.ts
│   │       │   ├── poseFilter.ts
│   │       │   ├── calibration.ts
│   │       │   ├── formScorer.ts
│   │       │   └── types.ts
│   │       │
│   │       ├── networking/
│   │       │   └── socket.ts
│   │       │
│   │       ├── store/
│   │       │   └── gameStore.ts
│   │       │
│   │       ├── ui/
│   │       │   ├── SetupScreen.tsx
│   │       │   ├── CalibrationScreen.tsx
│   │       │   ├── HUD.tsx
│   │       │   ├── FormFeedback.tsx
│   │       │   └── ConnectionStatus.tsx
│   │       │
│   │       └── styles/
│   │
│   └── server/
│       ├── package.json
│       └── src/
│           ├── index.ts
│           ├── gameServer.ts
│           ├── physics.ts
│           ├── collision.ts
│           ├── powerups.ts
│           ├── match.ts
│           └── network.ts
│
└── packages/
    └── shared/
        └── src/
            ├── protocol.ts
            ├── gameTypes.ts
            └── config.ts
```

All important gameplay constants must live in:

```text
packages/shared/src/config.ts
```

Do not scatter tuning constants through the codebase.

---

# 9. Game coordinate system

Use one consistent world coordinate system.

```text
X = horizontal across table
Y = vertical
Z = table length
```

Recommended initial dimensions:

```ts
TABLE_WIDTH = 3.0
TABLE_LENGTH = 5.4
TABLE_HEIGHT = 0

NET_Z = 0
NET_HEIGHT = 0.38

PLAYER_A_HIT_Z = 3.1
PLAYER_B_HIT_Z = -3.1

BALL_RADIUS = 0.06

BASE_PADDLE_RADIUS_X = 0.42
BASE_PADDLE_RADIUS_Y = 0.34
```

Player A lives on the positive-Z end.

Player B lives on the negative-Z end.

---

# 10. Camera architecture

The same game state is rendered from two cameras.

Player A:

```text
camera Z > 0
looks toward -Z
```

Player B:

```text
camera Z < 0
looks toward +Z
```

Example starting points:

```ts
A: [0, 2.2, 6.4]
B: [0, 2.2, -6.4]
```

Both look toward approximately:

```ts
[0, 0.3, 0]
```

Use a `PerspectiveCamera`.

Perspective alone causes the ball to shrink as it moves away and grow as it approaches.

Do not manually scale the ball according to distance.

Tune FOV around:

```text
45–60 degrees
```

until the table creates a convincing "ball coming out of the screen" illusion.

---

# 11. Computer vision

Use MediaPipe Pose Landmarker Lite first.

MediaPipe provides 33 pose landmarks, including left/right shoulder, elbow, wrist, hip, and hand-related landmarks.

Required landmarks:

```text
LEFT_SHOULDER
RIGHT_SHOULDER

LEFT_ELBOW
RIGHT_ELBOW

LEFT_WRIST
RIGHT_WRIST

LEFT_HIP
RIGHT_HIP
```

Do not run segmentation.

Only detect one pose.

Suggested configuration:

```ts
numPoses: 1
minPoseDetectionConfidence: 0.5
minPosePresenceConfidence: 0.5
minTrackingConfidence: 0.5
```

MediaPipe exposes these detection/tracking confidence controls directly.

Start with:

```text
Pose Landmarker Lite
GPU delegate
```

If GPU initialization fails:

```text
fall back to CPU
```

Do not allow GPU failure to crash the app.

---

# 12. Webcam configuration

Request approximately:

```ts
{
  video: {
    width: { ideal: 640 },
    height: { ideal: 360 },
    frameRate: { ideal: 30 }
  },
  audio: false
}
```

Higher camera resolution usually adds unnecessary CV cost.

Render the game at full display resolution independently from the webcam inference resolution.

Target:

```text
CV = ~30 FPS
3D rendering = ~60 FPS
```

They do not need to operate at the same frequency.

---

# 13. Pose normalization

Never map raw webcam pixels directly into world coordinates.

Normalize relative to the player's body.

Calculate:

```ts
shoulderMid =
  (leftShoulder + rightShoulder) / 2

hipMid =
  (leftHip + rightHip) / 2

shoulderWidth =
  distance(leftShoulder, rightShoulder)

torsoHeight =
  distance(shoulderMid, hipMid)
```

For the active wrist:

```ts
xRelative =
  (wrist.x - shoulderMid.x) / shoulderWidth

yRelative =
  (shoulderMid.y - wrist.y) / torsoHeight
```

Account for webcam mirroring.

The visible webcam setup preview should feel like a mirror.

Test the final mapping with a simple requirement:

> If the user moves their hand to their right, the virtual paddle must move to their right on the screen.

Add a single configurable `MIRROR_INPUT` constant if necessary.

---

# 14. Calibration flow

Avoid complicated calibration.

Use this sequence.

## Stage 1 — body detection

Display:

```text
STEP INTO VIEW

✓ Camera
✓ Body detected
✓ Shoulders detected
```

Require stable shoulder tracking for approximately 500 ms.

## Stage 2 — choose playing hand

Display:

```text
RAISE YOUR PLAYING HAND
```

If one wrist remains above its corresponding shoulder for roughly 400–600 ms:

```text
activeHand = LEFT or RIGHT
```

## Stage 3 — center position

Display:

```text
HOLD YOUR HAND COMFORTABLY IN FRONT OF YOU
```

Average roughly one second of wrist position.

Store that as:

```ts
neutralWristX
neutralWristY
```

This becomes the paddle's neutral position.

## Stage 4

Display:

```text
READY
```

Send readiness to the server.

When both clients are ready:

```text
3
2
1
GO
```

---

# 15. Paddle mapping

Map normalized body-relative movement into a restricted paddle plane.

Pseudo-code:

```ts
normalizedX =
  (xRelative - neutralX) * X_SENSITIVITY

normalizedY =
  (yRelative - neutralY) * Y_SENSITIVITY

normalizedX = clamp(normalizedX, -1, 1)
normalizedY = clamp(normalizedY, -1, 1)
```

Convert to world coordinates:

```ts
paddleX = normalizedX * PADDLE_WORLD_X_RANGE

paddleY =
  PADDLE_CENTER_Y +
  normalizedY * PADDLE_WORLD_Y_RANGE
```

The paddle's Z does not come from the webcam.

It is fixed:

```ts
Player A paddle Z = PLAYER_A_HIT_Z
Player B paddle Z = PLAYER_B_HIT_Z
```

This is the major simplification that makes the system reliable.

---

# 16. Tracking smoothing

Avoid over-smoothing because latency is worse than jitter for this game.

Implement a lightweight filter.

A basic exponential smoothing approach is acceptable:

```ts
filtered =
  previous + alpha * (raw - previous)
```

Start around:

```text
alpha = 0.45–0.65
```

Use a slightly higher alpha when movement velocity increases.

The result should:

* smooth stationary jitter,
* respond rapidly during swings.

Calculate velocity from filtered positions, not raw positions.

---

# 17. Input sampling

Maintain a client-side circular history buffer of approximately:

```text
500–700 ms
```

Each pose sample should contain:

```ts
interface PoseSample {
  sequence: number
  time: number

  wristX: number
  wristY: number

  paddleX: number
  paddleY: number

  wristVX: number
  wristVY: number
  wristSpeed: number

  elbowAngle: number

  shoulderWidth: number
}
```

Keep approximately 30 samples/second.

---

# 18. Elbow angle

Calculate the angle:

```text
shoulder → elbow → wrist
```

using the vector dot product.

```ts
angle =
  acos(
    dot(a, b) /
    (length(a) * length(b))
  )
```

Return degrees.

Do not use a machine-learning classifier for swing form.

---

# 19. Client input packet

Approximately 30 times per second send:

```ts
interface PlayerInput {
  playerId: string
  sequence: number

  paddleX: number
  paddleY: number

  wristVX: number
  wristVY: number
  wristSpeed: number

  elbowAngle: number

  trackingConfidence: number
}
```

Do not send:

* webcam frames,
* full skeleton arrays,
* images,
* video.

Only send derived gameplay input.

---

# 20. Server authority

The server is authoritative for:

```text
ball
score
current rally
serve
collision
power-up targets
power-up ownership
match state
```

The client must never independently decide that it hit the ball.

It only sends paddle/input state.

This prevents the two screens from disagreeing.

---

# 21. Networking protocol

Suggested client → server events:

```text
join
player_ready
player_input
form_result
restart
```

Suggested server → client events:

```text
player_assigned
room_state
countdown
game_state
hit
miss
point
powerup_spawn
powerup_awarded
form_confirmed
match_over
```

High-frequency events such as:

```text
player_input
game_state
```

may use Socket.IO volatile messages.

Discrete events such as:

```text
point
powerup_awarded
match_over
```

must be reliable normal events.

---

# 22. Player identity

Do not identify players using only Socket.IO connection IDs.

Generate a persistent client ID:

```ts
crypto.randomUUID()
```

Store it in:

```text
localStorage
```

Client sends it during `join`.

Server assigns:

```text
first unique client = Player A
second unique client = Player B
```

On a short disconnect/reload, preserve that seat for that client ID.

This makes refreshing a browser much less dangerous during a demo.

---

# 23. Physics architecture

Do not initially use Rapier.

Implement arcade ball physics manually.

Ball:

```ts
interface BallState {
  x: number
  y: number
  z: number

  vx: number
  vy: number
  vz: number
}
```

Fixed simulation:

```ts
vy -= GRAVITY * dt

x += vx * dt
y += vy * dt
z += vz * dt
```

Table bounce:

```ts
if (
  ball crosses TABLE_HEIGHT &&
  ball is horizontally over table
) {
  ball.y = TABLE_HEIGHT + BALL_RADIUS
  ball.vy = abs(ball.vy) * TABLE_RESTITUTION
}
```

The server should use a fixed timestep/accumulator rather than making physics dependent on timer jitter.

Suggested physics timestep:

```text
1 / 120 second
```

The outer Node timer can run approximately 60 times/second while consuming fixed 120 Hz substeps.

---

# 24. Paddle collision

Do not perform generic 3D sphere/paddle collisions.

Use **hit planes**.

Example for Player A:

```text
z = PLAYER_A_HIT_Z
```

When a ball moving toward A crosses that plane between two physics samples:

```ts
previousZ < hitPlaneZ
newZ >= hitPlaneZ
```

compute the exact crossing percentage:

```ts
t =
  (hitPlaneZ - previousZ) /
  (newZ - previousZ)
```

Interpolate:

```ts
impactX = lerp(previousX, newX, t)
impactY = lerp(previousY, newY, t)
```

Compare that to the latest paddle coordinates.

Use an ellipse:

```ts
dx =
  (impactX - paddleX) /
  effectivePaddleRadiusX

dy =
  (impactY - paddleY) /
  effectivePaddleRadiusY

hit = dx² + dy² <= 1
```

This prevents fast balls from tunneling through paddles.

---

# 25. Generous collision design

The actual collision paddle should be slightly larger than its visible representation.

Example:

```text
visual radius = 100%
collision radius = 115–130%
```

This is intentional.

Webcam latency and imperfect landmarks would otherwise make the game frustrating.

Do not advertise this distinction to players.

---

# 26. Return physics

When a successful hit occurs:

Reverse the main Z direction.

Then influence X velocity using:

```text
impact offset
+
wrist horizontal velocity
```

Influence vertical velocity using:

```text
base lift
+
small amount of wrist vertical velocity
```

Example conceptual formula:

```ts
ball.vz =
  -sign(ball.vz) *
  returnSpeed

ball.vx =
  impactOffsetX * OFFSET_INFLUENCE +
  paddle.wristVX * SWING_X_INFLUENCE

ball.vy =
  BASE_RETURN_LIFT +
  paddle.wristVY * SWING_Y_INFLUENCE
```

Clamp every component.

Also clamp total ball speed.

Gameplay quality is more important than physical realism.

---

# 27. Rally safety rules

To ensure rallies actually happen:

* minimum outgoing vertical lift,
* maximum horizontal angle,
* maximum total velocity,
* generous paddle collision,
* slow initial serve,
* speed increases mildly with rally length.

If a calculated shot would obviously drive immediately into the net, slightly adjust its outgoing lift.

This is an arcade-assist system.

---

# 28. Scoring

Start with a simple game:

```text
first to 7 points
```

Optional:

```text
must win by 2
```

Point awarded when:

* ball passes a player's hit plane without a valid hit,
* unless SHIELD is active.

After a point:

```text
brief pause
reset ball
automatic serve
```

Do not implement complicated official table-tennis service rules.

---

# 29. Local paddle responsiveness

Do not wait for the server to echo the player's own paddle position.

Render the local player's paddle immediately from local CV state.

That path should be:

```text
Webcam
→ Pose
→ Filter
→ Local paddle
```

No network round trip.

Server still receives the same paddle information for authoritative collisions.

This significantly improves perceived latency.

---

# 30. Ball state synchronization

Server broadcasts authoritative ball/game snapshots around:

```text
30 Hz
```

Each snapshot should contain:

```ts
{
  serverTick,

  ball: {
    x, y, z,
    vx, vy, vz
  },

  score,

  rally,

  powerupTarget,

  activePowerups,

  matchState
}
```

Clients render at approximately 60 FPS.

Between snapshots, clients can extrapolate the ball briefly using its velocity.

When a new authoritative snapshot arrives, correct toward the server state rather than allowing long-term drift.

Do not attempt complex rollback netcode.

The machines are on the same LAN.

---

# 31. Hit event and input sequence

Every player input has:

```ts
sequence
```

When the server detects a hit, save which input sample was being used.

Broadcast:

```ts
interface HitEvent {
  hitId: string
  player: "A" | "B"

  inputSequence: number

  impactX: number
  impactY: number

  impactError: number

  ballSpeedBefore: number
  ballSpeedAfter: number
}
```

The client can then find the precise pose sample associated with the collision.

This makes form scoring much easier without synchronizing clocks.

---

# 32. Form evaluation architecture

Form analysis happens primarily on the player's client because the client already owns the pose history.

The server sends:

```text
hit + inputSequence
```

The client locates that pose sample and analyzes the surrounding sequence.

Use roughly:

```text
200–250 ms before contact
150–200 ms after contact
```

Then calculate a score.

The ~150 ms delay before showing the final rating is acceptable and allows real follow-through to be evaluated.

---

# 33. Form metrics

## A. Impact accuracy — 35%

The server already knows the distance from ball impact point to paddle center.

```ts
accuracy =
  clamp(
    1 - impactDistance / effectivePaddleRadius,
    0,
    1
  )
```

Center hits score highest.

## B. Timing — 25%

Find peak wrist speed around impact.

A well-timed swing should contact the ball reasonably close to the fastest part of the motion.

For example:

```ts
timing =
  speedAtContact /
  maxSpeedInSwingWindow
```

Clamp to `[0, 1]`.

Penalize extremely slow swings separately so standing still cannot obtain perfect timing.

## C. Swing speed — 20%

Normalize wrist velocity using shoulder width so camera distance does not dominate.

Conceptually:

```text
shoulder-widths per second
```

Very slow movement:

```text
low score
```

Moderate-fast purposeful swing:

```text
high score
```

Do not reward arbitrarily violent movement beyond a sensible threshold.

## D. Arm extension — 10%

Use elbow angle.

Do not claim to determine professional technique.

Provide a broad acceptable region rather than one exact angle.

## E. Follow-through — 10%

Look at approximately the next 150 ms of wrist movement.

Project post-contact wrist displacement onto the pre-contact swing direction.

Good continued motion:

```text
high score
```

Immediate reversal or complete stop:

```text
lower score
```

---

# 34. Form score

Recommended combined score:

```ts
score =
  accuracy     * 0.35 +
  timing       * 0.25 +
  swingSpeed   * 0.20 +
  extension    * 0.10 +
  followThrough* 0.10
```

Convert to 0–100.

Initial categories:

```text
90–100  PERFECT
75–89   GREAT
55–74   OK
0–54    WEAK

No paddle collision:
MISS
```

All thresholds belong in `config.ts`.

They should be easily tunable during physical testing.

---

# 35. Form feedback UI

On contact, trigger:

```text
impact flash
sound
small particle burst
```

After scoring:

```text
PERFECT
+25 POWER
```

or:

```text
GREAT
+15 POWER
```

or:

```text
OK
+5 POWER
```

or:

```text
WEAK
+0 POWER
```

MISS should be visually distinct.

Keep feedback near the center/top of the screen where the player can see it without looking away from the ball.

---

# 36. Form power meter

Each player has:

```text
0–100
```

Initial rewards:

```text
PERFECT +25
GREAT   +15
OK      +5
WEAK     0
MISS     0
```

When:

```text
meter >= 100
```

the server grants one random power-up and resets/subtracts 100.

Power-up granting must happen on the server after the client submits its form result.

The server should clamp submitted form score/category to the known category enum; do not let arbitrary client data alter unrelated game state.

Security is not important here, but clean authority is.

---

# 37. Table power-up target

At suitable moments during a rally, spawn a glowing circular target on the table.

Represent it as:

```ts
interface PowerupTarget {
  id: string
  x: number
  z: number
  radius: number
  type: PowerupType
}
```

Place it on the half the ball is likely to bounce onto next.

Visual design:

```text
glowing circle
animated ring
icon or short label
```

Examples:

```text
BIG
SMASH
SHIELD
```

When the ball makes a table bounce:

```ts
distance(
  bounceXZ,
  targetXZ
) <= target.radius
```

award the target's power-up to:

```text
last player who hit the ball
```

then remove the target.

---

# 38. Power-up behavior

## BIG RACKET

Effect:

```text
paddle collision radii × 1.6
```

Duration:

```text
approximately 8 seconds
```

Visible paddle should also enlarge so the effect is obvious.

## SMASH

Effect:

```text
next successful hit:
ball return speed × approximately 1.35–1.5
```

Consume immediately after use.

Visual:

```text
paddle glow
special trail
screen shake on hit
large SMASH text
```

## SHIELD

Effect:

```text
next miss is automatically saved
```

When ball reaches player's hit plane and no collision occurs:

```text
if shield:
    consume shield
    generate automatic soft return
else:
    score point
```

Visually show:

```text
SHIELD SAVE!
```

---

# 39. Power-up restrictions

Initially allow at most:

```text
one stored power-up per player
```

If another is earned:

```text
replace current power-up
```

or use it immediately depending on type.

Do not build an inventory UI.

The power-up system should be instantly understandable.

---

# 40. Game state machine

Use explicit states.

```text
LOBBY
    ↓
CALIBRATING
    ↓
READY
    ↓
COUNTDOWN
    ↓
PLAYING
    ↓
POINT_END
    ↓
PLAYING
    ↓
MATCH_END
```

Server controls match-level state.

Client controls camera/calibration substate.

Do not allow physics to run while the match is in:

```text
CALIBRATING
READY
COUNTDOWN
MATCH_END
```

except cosmetic animation.

---

# 41. UI architecture

The main play screen should not look like a webcam application.

During gameplay:

```text
FULLSCREEN 3D TABLE
```

Webcam video should disappear.

HUD:

```text
┌──────────────────────────────────────┐
│ Player A  4              3 Player B │
│                                      │
│       [ POWER ███████░░ ]            │
│                                      │
│               GREAT!                 │
│                                      │
│                                      │
│              3D TABLE                │
│                                      │
│                                      │
│ ACTIVE: BIG RACKET  5.2s             │
└──────────────────────────────────────┘
```

Do not clutter the screen.

---

# 42. Setup screen

Before gameplay, show:

```text
PERSPECTIVE PONG

Connection
● Server connected

Camera
● Ready

Pose tracking
● Ready

Player
PLAYER A

[ BEGIN CALIBRATION ]
```

For the second machine, if a remote server URL is needed:

```text
Server address:
http://192.168.x.x:3001
```

Store it in `localStorage`.

Default to:

```text
http://localhost:3001
```

---

# 43. Debug overlay

Add a toggle:

```text
D
```

that displays:

```text
FPS
CV FPS
socket connected
player side
paddle x/y
wrist speed
elbow angle
ball x/y/z
RTT/ping
active powerup
tracking confidence
```

Also optionally display the webcam skeleton.

The debug overlay is extremely valuable while tuning.

It must be hidden during the real presentation.

---

# 44. Audio

Avoid external audio assets initially.

Use Web Audio API oscillators/noise for:

```text
ball hit
table bounce
point
power-up
perfect hit
```

Sound provides substantial perceived polish for very little engineering.

If Codex finds appropriate royalty-free local assets already available, they may be used, but audio files are not required.

---

# 45. Visual effects priority

Implement visual polish in this order:

1. ball trail,
2. paddle hit flash,
3. large form text,
4. glowing power-up target,
5. SMASH trail,
6. subtle screen shake,
7. small particles.

Do not build expensive postprocessing before these.

---

# 46. Initial tuning constants

All must remain configurable.

Suggested starting values:

```ts
INPUT_HZ = 30
STATE_BROADCAST_HZ = 30
PHYSICS_HZ = 120

FORM_WINDOW_BEFORE_MS = 250
FORM_WINDOW_AFTER_MS = 160

BASE_PADDLE_RADIUS_X = 0.42
BASE_PADDLE_RADIUS_Y = 0.34

BIG_RACKET_MULTIPLIER = 1.6
BIG_RACKET_DURATION_MS = 8000

SMASH_SPEED_MULTIPLIER = 1.4

PERFECT_THRESHOLD = 90
GREAT_THRESHOLD = 75
OK_THRESHOLD = 55

POWER_PER_PERFECT = 25
POWER_PER_GREAT = 15
POWER_PER_OK = 5

MATCH_TARGET_SCORE = 7
```

Physics values should be tuned by actual play rather than treated as immutable specifications.

---

# 47. Performance targets

Target:

```text
3D frame rate:
~60 FPS

Pose tracking:
20–30+ FPS

Input transmission:
30 Hz

Server state:
30 Hz

Physics:
fixed 120 Hz internal steps
```

More importantly:

```text
paddle feels immediate
ball motion is smooth
pose tracking does not freeze rendering
```

If MediaPipe inference noticeably stalls React rendering, move inference work to a worker or lower webcam resolution/inference rate.

Do not introduce a complex worker architecture before verifying whether it is necessary.

---

# 48. MediaPipe loading strategy

First implementation may follow Google's standard browser setup using:

```text
@mediapipe/tasks-vision
FilesetResolver
PoseLandmarker
```

Google's browser sample currently demonstrates loading the WASM runtime, using the Pose Landmarker Lite model, selecting the GPU delegate, and processing webcam video frames.

Once working:

* pin dependency versions,
* keep the package lock,
* preferably host model/WASM assets locally.

---

# 49. Browser target

Target:

```text
current Google Chrome
Windows/macOS laptop browsers
```

Do not spend time supporting every browser.

The user must explicitly approve camera access when prompted by the browser; `getUserMedia()` always requires user permission.

---

# 50. Development order

Codex must implement the project in gated phases.

Do not begin later stages until each gate passes.

## Phase 1 — project scaffold

Create:

```text
React/Vite client
Node/Socket.IO server
shared package
npm scripts
TypeScript configs
```

Gate:

```text
npm install works
npm run dev works
client page loads
server starts
socket connects
```

## Phase 2 — webcam + Pose

Implement:

```text
webcam permission
Pose Landmarker Lite
wrist/shoulder/elbow extraction
debug skeleton
```

Gate:

```text
wrist follows real hand reliably
```

No Three.js required yet.

## Phase 3 — normalized paddle

Implement:

```text
body normalization
active-hand selection
calibration
smoothing
velocity
elbow angle
```

Render a simple 2D circle for the paddle.

Gate:

```text
moving hand left/right/up/down gives responsive stable control
```

## Phase 4 — 3D single-player prototype

Implement:

```text
R3F Canvas
table
net
camera
ball
paddle
```

Create a local test ball repeatedly approaching the user.

Gate:

```text
player can physically swing and hit incoming ball
```

## Phase 5 — custom server physics

Move ball simulation to server.

Implement hit-plane collision.

Gate:

```text
single client still plays correctly from authoritative server
```

## Phase 6 — second client

Implement:

```text
automatic A/B assignment
opposite cameras
shared ball state
```

Gate:

```text
both machines show the same rally from opposite perspectives
```

## Phase 7 — scoring

Implement:

```text
miss
point
serve reset
score HUD
match state
```

Gate:

```text
complete two-player game is playable
```

At this point, the core MVP exists.

## Phase 8 — form scoring

Implement:

```text
pose history
hit input sequence
impact accuracy
swing speed
timing
elbow angle
follow-through
rating
```

Gate:

```text
hits consistently produce plausible PERFECT/GREAT/OK/WEAK feedback
```

## Phase 9 — form meter

Implement power accumulation.

Gate:

```text
repeated strong hits eventually award a power-up
```

## Phase 10 — power-ups

Implement:

```text
BIG RACKET
SMASH
SHIELD
```

Gate:

```text
all three visibly affect gameplay
```

## Phase 11 — table targets

Implement random target spawning and bounce collision.

Gate:

```text
hitting target awards shown power-up
```

## Phase 12 — polish

Implement:

```text
sound
ball trail
hit effects
power-up effects
form animations
fullscreen layout
```

---

# 51. Codex autonomy rules

Codex should proceed autonomously.

It should not stop for user approval for:

```text
file naming
component decomposition
small constants
TypeScript interfaces
CSS decisions
ordinary package installation
lint fixes
minor refactoring
```

It should:

```text
run the application
run typechecking
run linting if configured
fix errors itself
inspect console output
create temporary tests/debug controls
remove obsolete code
```

It should not replace the selected architecture because another architecture appears more sophisticated.

Specifically, it must not spontaneously substitute:

```text
WebRTC
Next.js
Python backend
OpenCV server
Unity
Firebase
Supabase
Rapier
custom ML training
```

without a concrete blocking reason.

---

# 52. Automated testing

Unit tests should focus only on deterministic core logic.

Useful tests:

```text
elbow angle
normalization
form score thresholds
hit-plane crossing
ellipse paddle collision
table bounce
power-up target collision
SMASH consumption
SHIELD save
BIG RACKET expiry
score increment
```

Do not invest heavily in React snapshot tests.

Computer vision must ultimately be manually verified using a real webcam.

---

# 53. Built-in simulation mode

Codex should implement a development mode that allows the game to be tested without two humans.

Add:

```text
?debug=1
```

or a debug toggle.

Capabilities:

```text
mouse controls paddle
keyboard serves ball
force power-up
force score
reset rally
simulate remote opponent
```

Suggested controls:

```text
Mouse       paddle
Space       serve/reset
1           grant BIG RACKET
2           grant SMASH
3           grant SHIELD
P           spawn target
R           reset
D           debug overlay
```

This dramatically increases Codex's ability to test the game autonomously.

Do not skip this feature.

---

# 54. Failure handling

The UI should display clear actionable errors.

## Camera unavailable

```text
CAMERA NOT AVAILABLE
Check browser camera permissions.
```

## Pose model failure

Attempt:

```text
GPU
→ CPU fallback
```

If both fail:

```text
POSE TRACKING FAILED
```

## Server unavailable

```text
DISCONNECTED
Trying to reconnect…
```

Socket.IO already includes automatic reconnection behavior.

## Player leaves

Pause game:

```text
WAITING FOR PLAYER
```

Do not continue scoring against an absent player.

---

# 55. Degradation strategy

If development encounters time pressure, degrade features in this exact order.

First remove:

```text
particles
screen shake
advanced audio
```

Then simplify:

```text
follow-through scoring
```

Then simplify form scoring to:

```text
accuracy
wrist speed
timing
```

Then remove:

```text
table target power-ups
```

but retain meter-generated power-ups.

Never sacrifice:

```text
pose-controlled paddle
two-player networking
perspective ball
reliable hit detection
score
basic form feedback
```

Those are the identity of the project.

---

# 56. If Pose Landmarker performs poorly

First:

```text
reduce camera resolution
```

Then:

```text
reduce CV inference frequency
```

Then:

```text
adjust confidence thresholds
```

Then:

```text
switch GPU/CPU delegate
```

Only after those should Hand Landmarker be investigated.

Do not start by running Pose + Hand simultaneously.

The pose model already exposes the required wrist, elbow, and shoulder landmarks.

---

# 57. If physics feels unfair

Do not make tracking more complicated.

Instead:

```text
increase collision radius
slow the ball
increase outgoing lift
reduce lateral velocity
increase paddle movement range
```

Gameplay tuning should absorb sensor imperfections.

---

# 58. If networking creates visible ball jitter

First:

```text
client-side extrapolate ball between snapshots
```

Then:

```text
smooth small corrections
```

Do not make the ball fully client-authoritative.

Do not implement rollback networking.

---

# 59. Demo-mode robustness

Before final presentation, enable:

```text
local model assets
fixed game constants
automatic server reconnect
automatic player seat recovery
fullscreen UI
hidden debug tools
```

Do not depend on cloud connectivity.

The only required network should ideally be the connection between the two laptops.

A phone hotspot is acceptable if normal Wi-Fi blocks peer-to-peer LAN traffic.

---

# 60. Manual actions required from the user

These are the tasks that cannot reasonably be delegated to Codex.

## Before development

Install **Node.js 24 LTS** if not already installed.

Install/use current Chrome.

No API accounts need to be created.

No API keys need to be generated.

## On both laptops

Obtain the project repository.

Run:

```bash
npm install
```

Both machines should have the same code/version.

## Physical setup

Place laptops:

```text
back-to-back
screens facing opposite directions
webcam facing each player
```

Players should stand far enough back for the webcam to clearly see:

```text
shoulders
elbows
wrists
```

Full-body tracking is not necessary.

## Network setup

Connect both laptops to:

```text
same Wi-Fi
```

or:

```text
same phone hotspot
```

Avoid VPNs during the demo.

## Host laptop

Run the server and frontend.

Expected command:

```bash
npm run dev
```

Codex should configure this command to start both.

The server should print something like:

```text
Game server:
http://192.168.1.123:3001
```

If Windows Firewall asks whether Node.js may communicate on private networks:

```text
ALLOW
```

## Second laptop

Run only the local frontend:

```bash
npm run dev:client
```

Open:

```text
http://localhost:5173
```

Enter the host server address:

```text
http://192.168.1.123:3001
```

## Browser permissions

On both laptops:

```text
Allow camera access
```

If Chrome requests permission to access devices/services on the local network:

```text
Allow
```

## Calibration

Each player:

```text
stand in view
raise playing hand
hold it naturally when asked
```

## Final presentation

Put both browsers into fullscreen mode.

That is the complete expected manual workload.

---

# 61. No-key confirmation

The user does **not** need:

```text
OpenAI API key
Google Cloud API key
MediaPipe API key
Socket.IO account
Firebase account
AWS account
Vercel account
Supabase account
database credentials
```

No paid infrastructure is required.

---

# 62. Definition of done

The project is complete when all of the following are true.

```text
[ ] Both laptops obtain webcam input.

[ ] Both laptops detect a player.

[ ] Playing hand can be selected/calibrated.

[ ] Moving hand moves virtual paddle responsively.

[ ] Two clients connect to one server.

[ ] One becomes Player A and one Player B.

[ ] Both screens render one synchronized virtual table.

[ ] Cameras are opposite.

[ ] The same ball flies away from one player and toward the other.

[ ] Ball size/perspective looks convincing.

[ ] Players can return the ball with their hand.

[ ] Collision is forgiving enough to be playable.

[ ] Misses award points.

[ ] Score stays synchronized.

[ ] Successful hits receive form ratings.

[ ] Better/faster/centered swings generally receive stronger ratings.

[ ] Form ratings charge a meter.

[ ] Meter can award BIG RACKET, SMASH, or SHIELD.

[ ] All three power-ups visibly work.

[ ] Table power-up target can spawn.

[ ] Ball bouncing through target awards its power-up.

[ ] Disconnect/reconnect does not permanently break the game.

[ ] Debug mode exists.

[ ] Mouse/debug testing works without webcam.

[ ] No API key is required.

[ ] The demo can operate without cloud services.
```

---

# 63. Master Codex implementation prompt

Give Codex the complete specification above, followed by this prompt:

```text
You are the primary autonomous engineer for this project.

Implement the Perspective Pong project described in the attached specification from start to finish.

Your priority order is:

1. working webcam pose tracking,
2. responsive hand-to-paddle control,
3. reliable 3D gameplay,
4. two-laptop synchronization,
5. form scoring,
6. power-ups,
7. polish.

Do not overengineer.

Use:
- React 19
- TypeScript
- Vite
- Three.js / @react-three/fiber v9
- @mediapipe/tasks-vision
- Node.js
- Socket.IO

Create a single npm-workspace repository containing:
- apps/client
- apps/server
- packages/shared

Use custom arcade physics rather than Rapier.

The Node server must be authoritative for ball physics, scoring,
collisions, match state, and power-ups.

Each client must perform its own MediaPipe Pose inference locally.

Never transmit webcam frames.

Use body-relative normalized wrist position to control a paddle on a
fixed virtual hit plane.

Use continuous plane-crossing collision detection so fast balls cannot
skip through paddles.

Make collision slightly more forgiving than the visible paddle.

Implement a persistent client UUID so browser refreshes can reclaim
the same A/B player position.

Implement an explicit state machine:
LOBBY -> CALIBRATING -> READY -> COUNTDOWN -> PLAYING ->
POINT_END / MATCH_END.

Implement a debug/simulation mode early so you can test without two
physical players:
- mouse-controlled paddle
- simulated second player
- reset
- serve
- grant power-ups
- spawn target
- debug telemetry

Do not wait until the end to test.

Work in the phase order specified in the project document.

After every meaningful phase:
1. run TypeScript checking,
2. run any relevant tests,
3. start/build the application where possible,
4. fix errors before continuing.

Do not ask me about ordinary implementation choices.
Make reasonable decisions yourself.

Centralize tuning parameters in packages/shared/src/config.ts.

Keep gameplay robust and arcade-like instead of attempting physically
accurate ping-pong.

If CV inaccuracies occur, first compensate through smoothing,
normalization, collision forgiveness, ball speed, and paddle range
before introducing additional ML models.

The UI should be presentation-ready:
- dark modern arcade aesthetic,
- high contrast,
- large score,
- minimal HUD,
- strong hit feedback,
- visible power meter,
- animated power-up target,
- ball trail,
- large PERFECT/GREAT/OK feedback,
- fullscreen responsive layout.

Do not leave TODO placeholders for core features.

Document the final startup process in README.md, including exact
commands for:
1. host laptop,
2. second laptop,
3. finding/entering the host LAN address,
4. camera permissions,
5. debug mode.

Also include a troubleshooting section for:
- camera permission failure,
- MediaPipe model failure,
- LAN connection failure,
- Windows Firewall,
- tracking instability,
- reconnecting a player.

Proceed autonomously until the complete MVP satisfies the Definition
of Done.

If a nonessential feature becomes a blocker, follow the degradation
order from the project specification rather than stopping the project.

Start by scaffolding the repository and proving the webcam/Pose path.
```

---

# 64. Recommended Codex operating strategy

If multiple Codex agents/terminals are available, divide them only after the base repository exists.

Suggested division:

```text
Agent 1
CV + calibration + pose math

Agent 2
Three.js visual scene + UI

Agent 3
server physics + Socket.IO

Agent 4
form scoring + power-ups

Agent 5
tests/debug tooling + integration inspection
```

One primary agent should remain responsible for merging and integration.

Do not have multiple agents independently redesign shared interfaces.

Create `packages/shared` first so every agent works against the same contracts.

---

# 65. Integration priority

If there is any disagreement between visual sophistication and reliable gameplay:

```text
reliable gameplay wins
```

If there is disagreement between realistic physics and satisfying gameplay:

```text
satisfying gameplay wins
```

If there is disagreement between sophisticated CV and low latency:

```text
low latency wins
```

The key experience is:

```text
I moved my hand.
The paddle moved immediately.
I hit the ball.
It flew into the other laptop.
The game understood my swing.
Something exciting happened.
```

Everything in the implementation should serve that experience.
