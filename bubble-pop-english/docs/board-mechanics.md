# Bubble board mechanics (task: board & physics rebuild)

This document is the rule book for the puzzle board. Every displayed bubble is
real puzzle state, participates in collision logic, and behaves according to a
rule below. Physics and validation live in `js/world.js` (swept-circle
geometry), `js/solver.js` (bounded planner over that exact geometry) and
`js/board.js` (grid logic + generator + structural validator).

## Board model

The board is an offset-row hex grid (rows 0–5, odd rows one cell shorter).
World geometry: `CELL = 60` world units per bubble diameter; the cannon sits
`2.1 × D` below the deepest row so the loaded projectile, guide and flight
corridor never overlap bubbles.

### Bubble categories

| Kind | Colour | Label | Rule |
|---|---|---|---|
| **Answer** | always the question's loaded colour | the answer word (inside the designated bubble or an attached tag — `labels.js`) | four 3-cell clusters, one per option id. Popping a group that contains a cluster resolves the question with that cluster's answer. |
| **Neutral** | one of the other three colours | none | genuine physical obstacles, placed as connected same-colour groups of ≥ 3 so every group is clearable with one accurate shot. Popping them awards a puzzle bonus and continues the same question — it is never a wrong English answer. |

Neutral bubbles never carry answer words and never use the answer colour, so
colour alone never reveals the correct choice, and a loaded-colour shot can
only ever join answer clusters.

### Support and falling

- Support anchors are **every occupied row-0 cell** and **every answer
  bubble**. Answer clusters are anchors by design, so a chain reaction can
  never silently drop a question target and answer groups never fall
  spontaneously at load.
- After any pop, the grid is updated **atomically first** (group cells
  removed), then `HexBoard.dropUnsupported()` removes bubbles with no support
  path to an anchor; those fall with a gravity animation and score bonus.

### Separation guarantee

Generator + validator enforce: no two answer clusters touch, and **no cell
(empty or occupied) is adjacent to cells of two different clusters**. A
landing bubble can therefore never join two clusters, and a popped group can
never contain two options — question selection is always unambiguous, and an
incidental chain reaction through the board can never be mistaken for an
answer (falls only ever remove neutral bubbles).

## Ammunition queue

- The cannon holds `queue[0]`; the HUD **Next** preview shows `queue[1]`.
- The queue is deterministic per question seed and alternates
  `loaded, X, loaded, Y, …` where X/Y are colours that match real ≥3-cell
  neutral groups on the board; the tail is loaded colour, so the queue never
  runs dry of winning shots.
- Every resolved shot shifts the queue. Exhaustion extensions stay on the
  loaded colour — always useful, because the solver gate guarantees a direct
  winning shot with it.
- Rainbow power-up: matches any colour; the engine picks the neighbour colour
  with the best group (preferring groups containing an answer cluster).

## Shot outcomes (all four are distinct)

| Outcome | Trigger | Effect |
|---|---|---|
| **Correct** | popped group contains the correct answer's cluster | +100 + 25×combo, next question |
| **Wrong answer** | popped group contains a *different* answer's cluster | −1 heart, board restored for a retry |
| **Neutral clear** | popped group is all neutral (+ any bubbles that fall as a result) | puzzle bonus (+30, +10 per fallen bubble), same question continues, no heart lost |
| **Miss** | landed bubble joined no group of 3 | −1 heart, board restored |

A shot that cannot legally resolve (fizzle) is recovered without penalty.

## Solvability certificate

At question setup the generator produces up to 10 candidate boards; each must
pass, in order:

1. `validateBoard` — bounds, overlaps, cluster size/connectivity, separation,
   100 % support at load, neutral groups ≥ 3, density window (per-level and
   per-layout targets: beginner 20–28, intermediate 28–38, advanced 35–46 on
   desktop; 18–30 phone portrait).
2. `checkBoardSolvable` — real-physics simulation (same `sweepShot` /
   `resolveLanding` as the live projectile and aim guide):
   - every option poppable directly through at least
     `LEVEL_CONFIG.minDirectAngles` distinct aim windows;
   - clearing any single neutral group keeps the correct answer directly
     winnable (a clearing shot may never close the board);
   - every queue colour matches a real neutral group and loaded shots are
     never scarce (no two consecutive non-loaded entries).
3. Label gate (`computeLabelLayouts`) — every cluster keeps an overlap-free,
   readable answer label.

The first candidate passing all three is used. Otherwise the curated,
physics-audited template family (`TEMPLATES` in board.js, verified by
`tools/search-templates.mjs`) is the guaranteed fallback. `minDirectAngles`,
`obstacleBudget` and per-level power-ups come from `js/levels.js`.

## Development tests

`node tools/test-boards.mjs` builds boards for all 15 levels × multiple seeds
× every responsive board width (8/9/10/11 cols) and checks: overlaps,
boundaries, support, cluster separation, neutral group sizes, density,
ammunition invariants, and the full physics gate (direct windows for all four
options, single-clear robustness). It also depth-checks selectability
(depth ≤ 2) for every option.

## Physics guarantees (unchanged systems, re-verified)

- 120 Hz fixed-timestep physics; swept-circle collision — no tunneling at any
  frame rate; bounded substeps.
- Aim guide, real projectile and solver all share `sweepShot` geometry:
  identical wall reflections, ceiling and bubble-hit events.
- `resolveLanding` snaps only to a valid empty in-grid cell (nearest empty
  neighbour of the hit bubble, or a free ceiling cell).
- At most one projectile in flight (`state.shot` guard + phase gating); input
  during `PROJECTILE_FLYING`/`RESOLVING` cannot fire.
