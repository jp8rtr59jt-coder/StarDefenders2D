# Milestone 3A: intelligent combat tuning

Launch with `python3 offline/launch.py`, then open
`http://127.0.0.1:8000/?mode=combat` in Chrome/Chromium and start the arena.
The existing spawn buttons select Basic, Intermediate and Advanced soldiers.
Toggle **AI diagnostics** to show awareness, target ID, remaining reaction time
and angular error envelope; this display is hidden by default. Compare soldiers
with Reset between runs, or equip the same weapon using the existing test API
`sdCombatSandbox.equip(enemy, 'rifle')` for a controlled comparison.

## Implementation and scope

`game/combat/humanoid-ai.js` exports the configuration table and an opt-in policy.
Four small hook sites in `sdCharacter.AILogic` run it only for explicitly
attached combat-test actors. The original random-ray acquisition, valid entity
visibility, movement models, jumping, obstacle recovery, attack decisions, reloads,
weapons and projectile damage still run. Unattached actors and the original
offline/server configurations follow the original path. Nothing is changed in
weapon definitions, physics, damage, jetpack, building or ragdolls.

Inspection found that native aiming continued to interpolate toward a retained
actor's live coordinates independently of fresh wall visibility checks, and the
native attack window could sustain firing between decisions. The new policy
checks LOS at most once per 80 simulated milliseconds per actor and gates the
final fire key after the native decisions. It uses the engine's same-frame tap
reset option so a suppressed trigger cannot leak a one-frame shot.

Awareness begins only after a valid visible detection. The soldier turns its
normal articulated aim toward the observed position while reacting, then may
fire when both its reaction deadline and aim alignment permit it. LOS loss stops
fire within the bounded 80 ms sample interval and resets tracking confidence.
Only the last sampled position is used for searching; hidden coordinates and
velocity do not feed aim or pursuit. On memory expiry the target reference is
cleared. Reacquisition requires another reaction period. Damage/teammate alerts
cannot bypass these gates.

## Configuration

Edit `skills` in `game/combat/humanoid-ai.js`; times below are milliseconds of
simulation time, angles are degrees. State time integrates `GSPEED / 30`, not
new wall-clock timers. Seeded reaction jitter and correlated aim sway are
repeatable for an actor ID; the original AI still contains its native randomness.

| Parameter | Basic | Intermediate | Advanced |
| --- | ---: | ---: | ---: |
| Reaction range | 450–650 | 320–500 | 250–380 |
| Tracking settle time | 1100 | 850 | 650 |
| Initial / settled error | 12 / 3.5 | 8 / 2 | 5 / 1 |
| Maximum turn degrees/second | 150 | 230 | 320 |
| Own speed penalty coefficient | 1 | 0.65 | 0.4 |
| Target speed penalty coefficient | 1 | 0.65 | 0.4 |
| Sustained trigger maximum extra error | 5 | 3.5 | 2 |
| Last-position memory | 1100 | 1500 | 1800 |
| Preferred distance band, world units | 100–220 | 130–260 | 160–300 |
| Health | 250 | 250 | 250 |

Own/target speeds use native velocity units. The displayed error is an envelope,
not a promise that every shot deviates by that amount. Settling reduces it;
moving, following faster targets and sustained trigger effort increase it. Effort
decays when not firing or reloading. No projectile spread or damage is altered.
Existing weapon differences remain: pistol, rifle and railgun respectively.
The previous 300/400-health tier bonuses are removed.

Movement uses existing A/D/W inputs and the native random/obstacle movement.
Soldiers approach or retreat to their distance band, strafe while engaged, and
try the existing jump when a sampled obstruction coincides with stalled progress.
During occlusion they approach the last observed point rather than following a
hidden actor. This is not tactical cover selection or a navigation rewrite.

## Validation

`offline/intelligent-test.cjs` exercises the policy in Chromium against real arena
actors and LOS geometry. Controlled synchronous steps isolate simulated timing,
turn limits, confidence settling, moving/sustained-fire penalties, memory expiry,
reacquisition and clean state reset. It separately runs actual browser frames
until each of the three tiers causes native projectile damage. Only disposable
test players receive extra health. The test hides the WebGL canvas during live
timing checks to avoid software-GPU stalls; the preserved combat regression
suite separately exercises rendering and gameplay.

Run it with the same `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` variables as the
existing tests. `offline/test.cjs`, `offline/combat-test.cjs` and
`offline/combat-storage-test.cjs` are retained. The committed
`intelligent-validation.json` records the measurements and regression outcomes.

The controlled run sampled reactions of approximately 467 / 351 / 284 ms for
Basic / Intermediate / Advanced; first permitted trigger at 567 / 400 / 333 ms.
Settled angular envelopes were 3.5 / 2 / 1 degrees, increasing to 8.5 / 5.25 / 3
at own speed 5 and 7.35 / 4.69 / 2.54 after the sustained-trigger input test.
Real-frame engagements caused 29.7 / 33 / 140.25 damage to disposable test
players with the native pistol / rifle / railgun. Those weapon-specific samples
are not damage or accuracy averages. Three hostile reset cycles also passed,
with entity counts 213 / 214 / 213 in that run and original save sentinels intact.

## Limitations and playtesting

- Reaction measurements start at detection, not when a player first enters an
  unseen ray or walks into the arena. Native random-ray discovery may take longer.
- Firing can occur later than the reaction deadline because of turning, native
  decision cadence, ammo/reloads and weapon cooldowns. The unit timing numbers
  measure permission to fire, not projectile impact latency.
- Occlusion has up to 80 simulated ms detection latency; there is no hearing,
  field-of-view simulation, suppression, squad coordination or predictive lead.
- Stalls, doors, vertical paths and complex player-built cover remain limitations
  of the original navigation. Strafing can be constrained by geometry. Soldiers
  do not choose or reason about cover, and may abandon cover while repositioning.
- Trigger effort is an approximation of sustained fire, not a per-shot recoil
  simulation. Original weapon recoil/spread remains in addition to aim error.
- Synthetic timing and live damage checks are measurable correctness tests,
  not proof of human-like feel or balanced win rates. Playtest exposed stationary
  targets versus running, jumping and breaking LOS before tuning these defaults.
- Tests run in Linux Chromium with software WebGL. macOS hardware feel, Safari,
  long sessions and large enemy counts are not benchmarked. Existing missing
  upstream ambient sound and Milestone 2 limitations remain.
