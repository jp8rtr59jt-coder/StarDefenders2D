# Milestone 3B — advanced movement prototype

This optional experiment branches from `intelligent-combat`. It does not include
or change `visual-experiments`. No artwork, weapons, enemy policy, damage values,
ragdoll simulation or collision solver has been replaced.

## Start on macOS

Requires Python 3 and Chrome/Chromium with WebGL. From this checkout:

```sh
git switch advanced-movement
python3 offline/launch.py --no-browser
```

For a fresh checkout instead:

```sh
git clone --branch advanced-movement https://github.com/jp8rtr59jt-coder/StarDefenders2D.git
cd StarDefenders2D
python3 offline/launch.py --no-browser
```

Open **http://127.0.0.1:8000/?mode=combat&movement=1** in Chrome, then click
**Start combat sandbox**. No Node game server, npm install or internet access is
needed. Control-C in Terminal stops the static localhost launcher. Safari and
macOS hardware have not been tested in the Linux test environment.

- A/D: run. While grounded and moving, press **H** to slide in your current
  momentum direction. Release H before initiating another slide.
- Mouse: aim; left click: fire; R: reload. Shooting remains available in a slide.
- W or Space: native jump; continue holding to use the supplied native jetpack
  once airborne. Jump interrupts sliding immediately; recovery does not lock it.
- S: native crouch. B: native building. Other controls are unchanged.
- **Traversal lane** moves the player to the optional raised testing section.
  It contains open ground, a 24-unit corridor, an 8-unit obstacle, raised platforms
  and an end wall. Jump over obstacles that exceed the native crouched step height.
- **Movement diagnostics** toggles state, velocity, ground/jetpack status, cached
  collision bounds, standing clearance and simulated timers. Hidden by default.
- Existing spawn, hostility, weapons, reset and AI diagnostics controls remain.
  Reset returns to the combat spawn; click Traversal lane to revisit the test area.

Original combat presentation and behavior: **http://127.0.0.1:8000/?mode=combat**.
Original persistent sandbox: **http://127.0.0.1:8000/**. Neither imports the movement
module. The experiment uses `sd-movement-experimental` browser storage; combat
keeps `sd-combat-experimental`, and the original keeps its existing storage and
legacy data. Map resets are disposable and do not load an existing saved world.

## Inspection and smallest implementation path

`sdCharacter.onThink` already supplies ground friction/acceleration, A/D airborne
control, jumping, ledge behavior and matter-consuming jetpack thrust. Its native
`GSPEED` uses 30 simulation units per second. Crouching interpolates
`_crouch_intens`; native `CanUnCrouch()` checks standing clearance before expansion.
At ordinary scale, standing bounds are x = −5..5, y = −12..16. Native full crouch
uses y = −6..16: height falls from 28 to 22 while the feet stay anchored. Existing
`ApplyVelocityAndCollisions`, collision filters and `GetStepHeight` resolve walls,
platforms and obstacles. The articulated ragdoll supplies the crouched live pose
and continues to simulate death independently.

The implementation reuses those paths. Small guarded hooks in `sdCharacter.js`
call `game/movement/slide.js` only for explicitly attached local test players.
While sliding it forces native full crouch, substitutes bounded momentum friction
for the normal ground acceleration/friction branch, and uses the existing
3-unit crouched step height. Normal jumping, airborne control, weapons, physics
integration, collision filters, damage and AI still run. It refreshes the native
cached box/hash after posture changes, including same-frame simulation steps.
Standing up still goes through native clearance; ending a slide beneath a ceiling
retains crouch until there is room. No immunity or damage modifier is introduced.

State lives in a WeakMap, outside entity snapshots. Respawn, reset and the testing
lane initialize fresh state. H is appended to existing input IDs without
reindexing them. No new dependency, sprite, final animation or navigation system
is introduced. Future rendering experiments can read the movement state or
replace its presentation without changing the simulation or collision box.

## Playtest parameters

Edit the exported `tuning` table in `game/movement/slide.js`, or temporarily adjust
`sdMovementPrototype.tuning` in DevTools. Defaults are starting points, not final
balance decisions. Time integrates `GSPEED`, with no wall-clock movement timers.

| Parameter | Default | Meaning |
| --- | ---: | --- |
| `minStartSpeed` | 3 | Minimum absolute horizontal velocity to start |
| `minEndSpeed` | 1.2 | End slide below this velocity |
| `maxSpeed` | 8 | Cap incoming slide velocity; never adds a launch boost |
| `durationMs` | 1100 | Maximum simulated duration |
| `deceleration` | 0.18 | Velocity removed per GSPEED unit; speed units are world units per 1/30 s |
| `recoveryMs` | 300 | Delay before another slide; running/jumping/firing remain available |

Prioritize testing friction/distance, minimum start speed, duration and recovery
together. Direction stays tied to initial momentum; A/D does not accelerate or
steer an active grounded slide. Changing that is a later reversible design choice.
Holding H does not auto-repeat or buffer a slide on landing. Leaving ground,
jumping, water, driving, freezing, instability, death or a blocking collision ends
the state. Native external impulses, jetpack thrust and knockback still apply;
the slide itself supplies no acceleration. The speed cap applies on entry.

## Prone investigation and limitations

Prone is **not implemented**. Existing crouch safely reduces height by six units;
it does not supply a horizontal crawl silhouette or wider horizontal hitbox.
The native unstable/fallen pose and X ragdoll behavior are not a reliable controllable
crawl. A safe prototype needs transition-specific width/height clearance, animated
torso/limb and gun pivot targets, front/back wall handling, crawling acceleration
and tests for standing/crouching from narrow spaces. Those are larger changes
than this isolated slide and should be evaluated separately.

Sliding intentionally looks like a low crouched glide, using original articulated
art. It does not duck beneath passages shorter than the native 22-unit crouch box,
and 8-unit obstacles can stop it because the native crouched step height is 3.
No predictive sweep, special obstacle forgiveness or new slide animation is added.
The testing section is disposable stock block geometry, not a new level direction.
Multiplayer and non-humanoid player forms are outside this opt-in offline test.

## Validation and captures

See [the frame sequence and recorded results](../docs/advanced-movement/README.md).
Automated checks verify behavior and regressions; they do **not** establish that
the mechanic feels enjoyable. Human playtesting on macOS is still required,
especially H ergonomics, crouch readability, entry responsiveness and aim during
jetpack recovery.

With the launcher running, Playwright available separately, and a Chromium binary:

```sh
CHROMIUM_PATH=/path/to/chromium node offline/movement-test.cjs
CHROMIUM_PATH=/path/to/chromium node offline/movement-isolation-test.cjs
CHROMIUM_PATH=/path/to/chromium node offline/combat-test.cjs
CHROMIUM_PATH=/path/to/chromium node offline/combat-storage-test.cjs
CHROMIUM_PATH=/path/to/chromium node offline/intelligent-test.cjs
CHROMIUM_PATH=/path/to/chromium node offline/test.cjs
```

`PLAYWRIGHT_MODULE` can point to a separately installed Playwright module. These
development tools are not game dependencies. Do not rebuild the export while a
browser suite is loading or reloading it. Screenshots use the native renderer;
the harness freezes its world clock and manually steps the native character
between captures to avoid screenshot latency changing the compared state.
