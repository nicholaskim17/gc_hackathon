# Contributing

Keep changes focused. Rally is a local, two-laptop game, so preserve the webcam,
networking, and low-latency behavior when working on the project.

## Before opening a pull request

Install dependencies and run the checks that match your change:

```bash
npm install
npm run typecheck
npm test
npm run build
```

Run `npm run test:e2e` for changes that affect the browser, camera setup, multiplayer
pairing, or layout. The Playwright browser may need to be installed once:

```bash
npx playwright install chromium
```

## Making a change

- Use a short branch name that describes the change.
- Keep unrelated formatting and refactors out of the same change.
- Update the README when setup or user-facing behavior changes.
- Do not commit generated build output or local machine settings.
- Include a short description of what changed and how it was tested.

For multiplayer changes, test two browser windows or two laptops when possible. Check
the `/health` endpoint before debugging the game itself.
