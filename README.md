# Rally

Rally is a two-player table-tennis game for two laptops placed back to back. Each
laptop uses its own webcam to track one player and turns that player's hand into a
virtual racket. The server keeps both screens on the same match state. Camera video
stays on the laptop that captured it; only racket input is sent over the network.

## Requirements

- Node.js 24 or newer
- Chrome
- Two laptops that can reach each other over a local network or Tailscale
- A webcam on each laptop for camera mode

Keyboard mode is available without a webcam.

## Install

Run this on both laptops:

```bash
npm install
```

This also copies the local pose model and WebAssembly files into the client so the
game can run without downloading them during a demo.

## Run a two-laptop match

On the host laptop:

```bash
npm run dev
```

Open `http://localhost:5173` on the host. The server prints a network address such as
`http://192.168.1.10:3001`. The other laptop will use that address.

On the second laptop:

```bash
npm run dev:client
```

Open `http://localhost:5173`, choose **Play together**, enter the host's server address,
and join the room code created by the host.

Both players then:

1. Allow camera access.
2. Stand far enough back for the shoulders, elbows, and wrists to be visible.
3. Raise the playing hand until it is selected.
4. Lower the hand to a comfortable neutral position.
5. Press **Ready to rally**.

Keep each client open on its own `localhost` URL. This lets Chrome grant camera access
while the Socket.IO connection goes to the host's network address.

## Networking notes

The two laptops do not need to share video, but they do need a working path to the
host laptop's game server. The client connects to the host on TCP port `3001`.

The setup we used was a personal hotspot. Both laptops joined the same hotspot, the
host ran the server, and the second laptop used the host address printed by the
server. A normal private Wi-Fi network works the same way.

Guest Wi-Fi is often different. Hotels, schools, offices, and event venues may allow
every device to reach the internet while blocking devices from reaching one another.
In that case the second laptop cannot connect to the host, even though both laptops
show the same Wi-Fi name. Captive portals and VPNs can cause similar problems.

Tailscale is another option when local Wi-Fi is unreliable. Install Tailscale on both
laptops, sign them into the same tailnet, and start the server on the host. Find the
host's Tailscale IPv4 address with:

```bash
tailscale ip -4
```

On the second laptop, enter `http://<tailscale-ip>:3001` as the game server address.
The two laptops do not have to be on the same physical Wi-Fi when Tailscale can reach
both of them. The host firewall still needs to allow Node.js to accept connections.

Before pairing, test the connection from the second laptop by opening one of these
URLs in Chrome:

```text
http://<host-lan-ip>:3001/health
http://<host-tailscale-ip>:3001/health
```

The working URL returns JSON containing `"ok": true`. If it does not load, fix the
network path before opening the game.

## Power-ups

- **Big Racket** temporarily increases the racket size.
- **Smash** makes the next successful return faster.
- **Shield** saves one missed return.
- **Giga Ball** temporarily makes the ball larger.
- **Decoy Ball** creates a temporary copy of the ball.

Power-ups come from the meter or from the glowing targets on the table.

## Development commands

```bash
npm run dev          # Start the client and multiplayer server
npm run dev:client   # Start only the client
npm run typecheck    # Check client and server TypeScript
npm test             # Run unit tests
npm run test:e2e     # Run Playwright browser tests
npm run build        # Build the client for production
```

The end-to-end tests start their own client on port `5174` and server on port `3101`.
Install the test browser once with:

```bash
npx playwright install chromium
```

## Debug mode

Add `?debug=1` to the client URL:

```text
http://localhost:5173/?debug=1
```

The simulator reports frame rate, pose tracking rate, network round-trip time, racket
state, and ball state. Debug scoring and power-ups are for local practice only. The
server remains authoritative in a networked match.

The vision diagnostic is available at
`http://localhost:5173/vision-smoke.html`. It loads the real tracking worker and pose
model without requiring a camera.

## Troubleshooting

### `npm run dev` exits because a port is in use

An older dev process is probably still running. Check the listeners:

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

Stop a stale process by its PID, then run `npm run dev` again. To use another server
port:

```bash
PORT=3002 npm run dev
```

Give the other laptop the new server address, including `:3002`.

### The second laptop cannot connect

Check that both laptops are on the same network and that no VPN is active. Open
`http://<host-ip>:3001/health` on the second laptop. A working server returns JSON with
`"ok": true`.

### Camera access or tracking fails

Use the camera icon in Chrome's address bar to re-enable permission, then choose
**Recalibrate camera**. Improve the lighting, avoid a bright window behind the player,
and step back until the upper body and playing arm fit in frame. **Use keyboard instead**
is available if the camera is unavailable.

### The game feels jittery

Use the debug panel to check CV FPS and network RTT. Both should remain stable on a
local network. Improve lighting and reduce background motion first. Keyboard mode can
help determine whether a problem comes from tracking or the network.
