# SHADOW LANTERN — 3 levels, 9 guards, 18 gems, vision cones + shadow/bush/coin stealth — top-down stealth, offline

[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/people871/makefun-best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/people871/makefun-best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

**SHADOW LANTERN** is an original top-down 2D stealth game: slip past patrolling guards, pocket the gems, and reach the glowing green EXIT unseen. Every guard carries a raycast vision cone — yellow on patrol, red when chasing — and the detection meter gives you a chance to recover before you are SPOTTED.

## What is in the game

- **3 hand-designed levels** — Moonlit Museum (easy, 3 guards, 4 gems, 4:00), The Gilded Vault (medium, 3 guards, 6 gems, 5:00, deep shadow lanes), Midnight Manor (hard, 3 guards, 8 gems, 5:00, tight patrols). 18 gems in all.
- **Guard AI with 5 states** — patrol → suspicious (a glimpse or a noise) → chase → search → return to patrol. Patrol waypoints, pauses at each post, a "?" when suspicious and "!" when chasing.
- **Vision cones with line of sight** — each cone is a 26-ray fan that stops at walls and crates, so cover reads exactly as it plays. Detection fills faster up close and centred; it drains when you break sight.
- **Cover you can read at a glance** — dark shadow tiles shrink a guard's range and slow detection; bushes hide you completely unless a guard is almost on top of you; crates block sight and movement.
- **Coin distractions** — click (or F) to throw a coin; the nearest guard in earshot goes to investigate the landing spot. 3 coins per level (4 in the Manor).
- **Sneak (Shift)** — half speed, quiet footsteps, harder to spot. Walking makes noise a nearby guard can hear.
- **Scoring and ratings** — 100 points per gem, a time bonus, +500 for a GHOST clear (never spotted). Per-level ratings: GHOST / SHADOW (spotted once) / LOUD. Best score per level in localStorage.
- **HUD + minimap** — level name and objective, a live detection meter, loot / coins / timer / score, and a minimap with guards, gems and the exit.
- **Synthesised sound only** — footsteps, coin clinks, alert stings, the spotted alarm, win jingle and a night drone, all WebAudio oscillators and filtered noise. No audio files. M to mute.
- **Pause (P/Esc), restart (R), level select (L), next level (N)**.

## How to run it (offline, no build step)

```sh
node serve.ts
# open http://localhost:8080 — WASD/arrows to move, SHIFT to sneak,
# click (or F) to throw a coin, P to pause, R to restart, L for levels
```

The game is vanilla JavaScript ES modules under `game/` — no dependencies, no network requests, no assets.

## Files

| File | Job |
|---|---|
| `game/index.html` | Page shell: the 1280×720 canvas, loads `src/main.js` + `src/shots.js` |
| `game/src/config.js` | Board geometry, tuning numbers, palette |
| `game/src/random.js` | Seeded RNG (deterministic fireflies for screenshots) |
| `game/src/input.js` | Keyboard + mouse state |
| `game/src/audio.js` | Synthesised WebAudio sounds + night drone |
| `game/src/levels.js` | The 3 hand-designed tile maps + tile/BFS helpers |
| `game/src/guards.js` | Guard AI: patrol/suspicious/chase/search/return, vision cone + line of sight |
| `game/src/render.js` | All canvas drawing: level, cones, actors, HUD, minimap, screens |
| `game/src/main.js` | Game loop, state machine, detection meter, coins, loot, exit, scoring |
| `game/src/shots.js` | Deterministic `?shot=` staging + the `?selftest=1` scripted play-through |
| `main.ts` | The make.fun hand-in program (copies `game/` + `screenshots/`, writes `dossier.json`) |
| `serve.ts` | Tiny static server for `game/` on port 8080 |

## Tests

`?selftest=1` runs a 26-assertion scripted play-through (title → move → sneak speed → wall block → patrol → cone detection → shadow slowdown → bush hide → crate sight-block → coin distraction → loot → spotted → caught → exit win → GHOST rating → best saved → pause/resume → restart → mute → level select → levels 2/3 → timer loss). An interactive Playwright playtest with real keyboard + mouse covers the same loop live. See `capture/` in the build directory.

## License

MIT — see [LICENSE](LICENSE).
