# SUMMIT BLOCKS — Climb the Mountain!

[![make.fun bounty](https://make.fun/bounty/best-game-01)](https://make.fun/bounty/best-game-01)

A blocky 3D mountain climb: a voxel climber ascends an 88-metre mountain
through three zones — forest foothills, rocky cliffs, and snowy summit —
jumping between floating block platforms, dodging lava and wind gusts,
collecting gold coins and reaching checkpoints, until the golden summit
flag. Built with three.js (vendored), all textures and sounds generated
procedurally from code.

## How to play

- **WASD / Arrow keys** — move (camera-relative)
- **Space** — jump (hold **Shift** to sprint for longer jumps)
- **Drag mouse** — rotate the camera
- **P / Esc** — pause · **R** — restart · **M** — mute · **B** — market

Fall off the mountain and you lose a life and respawn at the last
checkpoint flag. Lose all 3 lives and the run ends. Reach the summit flag
to win — your score comes from time, coins and lives left.

## Coins and the market

Every coin you grab goes straight into your wallet (saved in
localStorage, so it survives reloads). Spend coins in the **MARKET**
(left-side popup, also opened with **B** from the title screen, the pause
screen, or mid-climb):

- **SKINS** — repaint the climber's shirt (Default, Crimson, Ocean Blue,
  Forest Green, Royal Purple, Golden)
- **HATS** — blocky hats worn on the climber's head (Cap, Crown, Helmet,
  Party Hat)
- **TRAILS** — particle trails while moving (Sparkle, Snowflakes, Embers)
- **GEAR** — permanent upgrades for every run: Extra Life (start with 4
  lives), Coin Magnet (coins pulled in from farther away), Double Jump
  (jump again in mid-air)

Bought items stay owned forever; equip them from the market and the
climber changes in the game immediately.

## Structure

- `game/index.html` — canvas + HUD + overlays + market popup, one import map for three.js
- `game/vendor/three.module.min.js` — three.js 0.187.0 (npm build, vendored)
- `game/src/main.js` — entry: renderer, state machine, camera, wind, lives, wallet
- `game/src/data/shop.js` — market catalog, wallet and loadout persistence
- `game/src/data/levels.js` — seeded spiral climb: 3 zones, ~30 coins, lava gap
- `game/src/engine/` — loop, input, procedural Web Audio, AABB physics
- `game/src/world/` — procedural textures, sky/sun/fog, mountain + platforms, props
- `game/src/entities/` — blocky player (skins, hats, double jump), coins, checkpoints, trails
- `game/src/scenes/` — title/pause, HUD, victory/game-over, market popup
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=climb|market|summit|end`)
- `main.ts` — hands the entry in (copies `game/` + `screenshots/`, writes `dossier.json`)
- `serve.ts` — `node serve.ts`, then open http://localhost:8080

## Screenshots

- `1-climb.jpg` (cover) — mid-ascent gameplay in the cliff zone
- `2-market.jpg` — title screen with the market popup open on the left
- `3-summit.jpg` — arriving at the summit flag
- `4-victory.jpg` — victory screen with time and score

An entry for the [make.fun "Make the best game" bounty](https://make.fun/bounty/best-game-01).
