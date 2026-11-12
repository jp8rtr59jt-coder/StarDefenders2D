# Milestone 3C — art direction laboratory

This is an optional, reversible art study on `art-direction-lab`, based on
`advanced-movement` at `d25efbd43ceb6d62096fdab800798311b4837b1c`. It does not
choose a setting, identity or final visual style. Stop at these experiments and
evaluate them with the creative director before authoring a production asset set.

## macOS startup

Requires Python 3 and Chrome/Chromium with WebGL. For a fresh checkout:

```sh
git clone --branch art-direction-lab https://github.com/jp8rtr59jt-coder/StarDefenders2D.git
cd StarDefenders2D
python3 offline/launch.py --no-browser
```

For an existing checkout, fetch your fork and switch to `art-direction-lab`, then
run the same Python command. Open this complete URL in Chrome:

**http://127.0.0.1:8000/?mode=combat&movement=1&art=1**

Click **Start combat sandbox**. The lab stages the existing right-hand combat
range with one player, one native Basic enemy, the existing pistol, two existing
cargo props and the existing block targets. The enemy uses the existing combat
AI; the original **Hostility** button can make it passive for inspection.

Use the **Art laboratory** selector for Original, A, B or C. Switching styles
changes drawing only, without resetting the encounter. **Comparison range**
resets the disposable test encounter and stages the same actors/objects again.
The cargo props run native `onBuilt()`, normally called by construction; the
lab does not patch the storage simulation to keep them alive.
An inherited sandbox-control bug was also repaired: enabling hostility now wakes
live dormant test enemies using native `SetHiberState(ACTIVE)`. Their existing AI
model/tuning and physics rules are unchanged. This small lifecycle repair also
applies to the original combat sandbox's existing hostility button.

- A/D run, W or Space jump and native jetpack; S crouch; H ground slide.
- Mouse aim, left click fire, R reload; B construction; existing weapon/spawn,
  hostility, movement diagnostics and AI diagnostics controls remain available.
- **Traversal lane** still reaches the Milestone 3B fixture. Its scenery mostly
  retains native art because the environmental study is limited to the range.
- Original combat: `http://127.0.0.1:8000/?mode=combat`.
- Movement prototype: `http://127.0.0.1:8000/?mode=combat&movement=1`.
- Original persistent sandbox: `http://127.0.0.1:8000/`.

No Node game server, npm install or internet connection is needed. Control-C in
Terminal stops the static launcher. Keep the usual hostname/port for existing
saves. The lab uses its own `sd-art-direction-lab` IndexedDB namespace; it does
not load or overwrite original, combat or movement worlds. `art=1` is honored
only in combat mode. Keep `movement=1` in the lab URL to include sliding/jetpack
test supplies. Selecting Original changes appearance within the lab, whereas
the URLs above launch the separate existing modes.

## What is modular

`game/art-lab/assets.js` contains original code-authored paths, material textures,
lighting gradients and cached canvases. A uses tapered curved clothing, a facial
profile and soft material variation; B uses cut contours, ink masses, hatching
and an angular muzzle burst; C uses separately authored faceted contours/planes,
beveled materials, parallax planes and a low foreground layer. These are not
palette replacements of the previous rectangular procedural character.

`game/art-lab/presentation.js` owns the mode selector and small draw adapters.
The shared contract uses 32×32 logical tiles, a (16,16) local pivot and the same
eight native spring image slots. Part artwork is rasterized at 8× source density
once; native transforms still rotate and position it. The held pistol retains
its native transform, projectile origin, firing, recoil, damage and reload.
Muzzle and impact shapes read existing timers and effect positions/lifetimes.
No new light entities, projectiles, collision geometry or gameplay effects are
spawned by rendering. Original palette/shading state is restored after each draw.

There are small guarded draw hooks in the renderer, articulated ragdoll, gun,
block, storage and impact-effect drawing methods. If the lab is absent or Original
is selected, they fall through to native drawing. `sdCharacter.js`, the movement
prototype, AI policy, collision solver, weapon definitions and ragdoll solver are
unchanged from the base branch. Only the explicit staging action positions test
actors; drawing never positions them. Previous milestone screenshots/results
are preserved, and `visual-experiments` is not merged or modified.

## Evidence and evaluation

The [comparison package](../docs/art-direction-lab/README.md) contains actual
engine captures, close-ups, a contact sheet, animation-state crops, measurements
and the technical comparison. No concept illustration is labeled as gameplay.
Direction names describe exploration targets, not achieved production quality.
In particular A is still a stylized anatomical illustration constrained by the
native rig, not finished cinematic-realism artwork or a photorealistic character.

The technically recommended foundation is modular authored 2D parts on this
existing rig, plus bounded layered depth. It can support any of the three visual
identities. A's contour/material work, B's value hierarchy and C's depth separation
are independently reusable strengths. No production art direction is selected,
and no full 3D character/renderer migration is proposed.

## Reproduce validation

Playwright and Chromium are development tools, not game dependencies. With the
launcher serving a stable export:

```sh
CHROMIUM_PATH=/path/to/chromium node offline/art-lab-test.cjs
CHROMIUM_PATH=/path/to/chromium node offline/art-lab-control-test.cjs
CHROMIUM_PATH=/path/to/chromium node offline/movement-test.cjs
CHROMIUM_PATH=/path/to/chromium node offline/combat-test.cjs
CHROMIUM_PATH=/path/to/chromium node offline/intelligent-test.cjs
CHROMIUM_PATH=/path/to/chromium node offline/combat-storage-test.cjs
CHROMIUM_PATH=/path/to/chromium node offline/movement-isolation-test.cjs
CHROMIUM_PATH=/path/to/chromium node offline/test.cjs
```

`PLAYWRIGHT_MODULE` can point to a separately installed module. Run browser suites
sequentially on software rendering. Do not rebuild while tests load/reload assets.
The lab suite writes `docs/art-direction-lab/`; existing movement tests write their
own screenshot/result paths relative to the working directory. Run those existing
scripts by absolute path from a temporary output directory to preserve the prior
milestone's checked-in evidence. Existing tests otherwise remain unchanged.

Capture-time world/rig timing and suppression of individual draw hooks exist
only in the test harness. They establish consistent comparisons and rendered
pixel visibility; they are never installed by the playable module. Rendering
benchmarks report CPU submission, blocking completion and GPU timer availability
separately. They do not validate subjective art quality, movement feel or macOS
hardware performance. Those require human evaluation and native-device tests.
