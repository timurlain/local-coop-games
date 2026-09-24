# local-coop-games

Small browser games for 2+ players on one computer (keyboard and/or gamepads).

## Games

- **Spy vs Spy** — two spies, one embassy, lots of traps. Split screen, 2 players.
  - Spies carry the kufřík visibly as they walk it out of the embassy.
  - Escaping with all four secrets plays a victory scene (winner laughs on the runway, mob storms the loser's room) before the result screen.

## Develop

    npm install
    npm run dev        # http://localhost:5173
    npm test           # logic tests (Vitest)
    npm run build      # static site in dist/

Add `?seed=123` to a game URL to replay the same embassy. F1 toggles the debug overlay.

## Structure

- `src/shared/` — input, loop, split screen, audio, storage, i18n, RNG (reused by every game)
- `src/games/<game>/logic/` — pure, tested game rules
- `src/games/<game>/render/` — canvas drawing
- `docs/superpowers/` — specs and plans

Pushing to `main` deploys to GitHub Pages (`.github/workflows/pages.yml`).
