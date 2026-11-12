# Art laboratory — technical review and options

## Reviewed baseline

Base: `advanced-movement`, `d25efbd43ceb6d62096fdab800798311b4837b1c`.
Reviewed visual experiment: `f853cf47a4c39267530c3cd254f48a4625a0ac0f`;
its [assessment](https://github.com/jp8rtr59jt-coder/StarDefenders2D/blob/visual-experiments/docs/visual-experiments/README.md)
and [implementation](https://github.com/jp8rtr59jt-coder/StarDefenders2D/blob/visual-experiments/game/visual/preview.js)
remain on their separate branch. No branch-wide merge was performed.

The earlier work demonstrated that cached higher-density canvases could replace
seven limb slots, a head, the pistol and selected materials through native draw
transforms. Its rectangular clothing panels did not establish varied anatomy or
an art style; its single-player-only coverage omitted NPC presentation. Its baked
background/lighting and native muzzle timing were useful bounded techniques.
It reported CPU Render medians of 0.8 ms original / 2.0 ms prototype on SwiftShader,
explicitly not GPU time or FPS. Those numbers use a different scene/framing and
cannot be directly compared with this milestone's measurements.

This lab adapts the small optional draw-hook approach and logical pivots after
review, and authors new curves/ink/facet families. It adds NPC presentation,
cargo materials, impact styling, controlled comparisons and explicit framebuffer
visibility checks. It does not copy the previous character rectangles or change
the simulation to accommodate a visual treatment.

## Retained graphics architecture

- `sdRenderer.js`: existing camera, world/entity/foreground/HUD passes, depth
  offsets and native lighting/source collection. Only background/foreground
  adapter calls are added. The background is a flat plane behind the native
  actor plane; context primitive/depth state is explicitly restored.
- `FakeCanvasContext.js`: unchanged Canvas-like submissions to Three.js/WebGL.
  Its `save()` does not preserve every custom renderer field; the adapters restore
  palette, tint, shading, depth and primitive fields explicitly.
- `sdAtlasMaterial.js`: unchanged canvas-backed atlases, nearest min/mag sampling,
  no mipmaps and padded allocations. Source sprites are 256×256 with 32-unit
  logical destinations. Background images are 512 wide so their gutters fit the
  1024-wide atlas; the previous 1024-wide prototype backdrop did not fit.
- `sdCharacterRagdoll.js`: unchanged spring transforms, length constraints and
  death simulation. Two draw calls can substitute artwork. The native live draw
  method also integrates pose corrections, so a rigorous frozen capture must
  freeze `GSPEED`, as well as world updates. The harness does so; gameplay does not.
- `sdCharacter.js`, sliding and AI: unchanged from the base. Native size, crouch
  bounds, standing clearance, jetpack, hurt reactions and ragdoll physics remain.
- `sdGun.js` / `sdEffect.js`: native gun transform, shot/projectile behavior,
  muzzle timer and wall-hit lifecycle are retained. Only drawing is substituted.
  Impact styling stays in the tested range; other effect types remain native.

There are 75 cached canvases across all families, about **18.23 MiB** of raw RGBA
source pixel storage. This is not total GPU memory: atlas canvases/textures,
framebuffers, native art and browser overhead are additional. A 1024×16384 RGBA
atlas alone is roughly 64 MiB. No runtime art generation occurs each frame.
Higher sampling density supports the authored contours and material detail;
it does not itself create better anatomy, staging, lighting or animation.

## One inherited control lifecycle repair

The preserved combat suite initially timed out waiting for damage after spawning
passive enemies and switching hostility on. An observer recorded the world
advancing from frame 429 to 1200 while two living soldiers' AI timers remained
at zero. The art module was absent. A focused check against an export with the
unchanged `advanced-movement` renderer/startup reproduced the underlying condition:
the hostility button changed the model from 0 to 1 but left hibernation at 1 and
AI time at zero. Passive characters can legitimately sleep; the old control did
not schedule them again when enabling their model.

The only shared non-drawing change is in `sdCombatSandbox.toggleHostility`: enabling
hostility calls existing `SetHiberState(HIBERSTATE_ACTIVE)` for live test enemies.
It repairs the control's lifecycle contract; it does not change AI decisions,
reaction/aim parameters, navigation, weapon behavior, damage or physics formulas.
`art-lab-control-test.cjs` covers the dormant transition and native damage. The
original combat regression assertions remain unchanged, and failed pre-fix
attempts/baseline evidence are retained in the regression report.

## Direction comparison

These are qualitative engineering/art observations for discussion, not an
automated quality ranking or creative approval. The rig scale, actor positions,
native pistol, geometry and simulation state are fixed across the gameplay views.
All new treatments share a neutral architectural bay and upper-left material
lighting; softness, shadow shapes and value organization differ intentionally.

| Criterion | A — Cinematic Realism study | B — Graphic Novel | C — Modern 2.5D |
| --- | --- | --- | --- |
| Visual construction | Curved/tapered limbs, profiled face/hands, cloth folds, seams, subdued grain and gradients | Cut silhouettes, contour hierarchy, large ink masses, cross-hatching, angular flashes | Separate faceted contours, broad plane shading, bevels and a layered composition |
| Readability | Softer silhouette and natural values need more actor/background separation in production | Strongest deliberate outline/value hierarchy; dense hatching can become noise at gameplay zoom | Broad planes separate surfaces; small facets can shimmer or merge under nearest sampling |
| Animation | Native poses work; realistic anatomy remains constrained by existing short limb ratios | Native articulated poses read as a cutout/ink study; elbows need authored overlap cleanup | Facets rotate with limbs; joint continuity and consistent light direction need attention |
| Ragdolls | Organic pieces remain attached to native springs; no anatomical deformation or injury variants | Contours preserve part separation, but intersections can reveal the modular cutout | Facet seams can expose rotations/intersections; same solver and bones |
| Environments | Natural surfaces are flexible, but realistic lighting/material consistency is costly | Graphic material vocabulary can cover many environments; avoid indiscriminate hatch density | Reusable layered planes and simple bevelled props; sorting and silhouette discipline matter |
| Different settings | Plain clothing/materials can be reauthored for many eras; none selected | Line/value language is setting-independent; palette and shapes remain open | Depth/composition method is setting-independent; avoid conflating facets with a specific genre |
| Runtime | Cached art, two background layers; source/atlas memory is the primary new budget | Similar sprite count; large ink regions are cheap, transparent overdraw still matters | Similar rig, extra foreground/parallax submission; layered overdraw must be budgeted |
| Production effort | Highest anatomy, cloth, face, damage/animation-variant authoring burden | Strong style guide and consistent line/shadow design needed across all asset families | Moderate per-part facets plus substantial layer/prop/depth composition work |
| Maintainability | Shared logical contract is stable; realistic consistency is artist-intensive | Stable contract; hatching/outline rules should be centralized in an asset specification | Stable gameplay contract; more depth-layer metadata and cross-asset lighting rules |

## Technical recommendation, pending creative evaluation

Keep authored 2D parts on the existing articulated rig and atlas path, and use
bounded layered depth where it improves composition. That foundation supports
all three creative directions. Preserve A's interest in organic contours/materials,
B's silhouette/value hierarchy and C's spatial separation as combinable techniques.
Do not select a final style, change the game's setting or begin a full asset family
from this prototype. Artist-authored tests should follow the creative director's
evaluation, with logical pivots and measurable texture/overdraw budgets.

No full 3D character system is justified by this experiment. C is 2D artwork with
3D-inspired facets and the renderer's existing depth passes/parallax, not new mesh
animation, dynamic normal maps or a physically based lighting/shadow system.

## Limits requiring judgment or future work

- A does **not** deliver production cinematic realism. It is a stylized illustrative
  study made with original paths; fixed native bone lengths still constrain human
  proportions. New facial/body art, hand/weapon alignment and joint cleanup need
  an artist and human motion review. Higher resolution does not resolve those issues.
- B/C are more visibly differentiated by ink construction and faceted surfaces,
  but all three still use the same native poses. No new expressive animation,
  deformation, blinking, gore/injury variants or per-limb relighting was authored.
- Cloth, skin and broad lighting are baked, with local palette/shading bypassed
  for the substituted art. Native transient hit feedback remains. Lighting is not
  physically correct when a limb rotates, and the prototype is not a PBR demo.
- The environment patch is bounded to the existing range. Extreme zoom can clip
  the large backdrop plane and expose the native sky; close-ups inspect characters,
  not full-scene depth quality. No renderer rewrite was attempted to solve that
  inherited limitation. Native perspective/extrusion can also exaggerate contact
  shadow/foot separation at extreme zoom.
- Only the existing held pistol, humanoid parts, range blocks/cargo and selected
  wall impacts are treated. Other guns, dropped weapons, equipment, jetpack art,
  UI and world content keep original presentation. Custom skin/helmet choices are
  hidden by the active treatment and return with Original/native modes.
- A static image cannot demonstrate C's parallax or prove motion readability.
  Automated motion checks and captured pose crops establish compatibility; human
  evaluation on macOS remains necessary. No final visual-quality claim is made.

See [the comparison package](README.md), raw validation and the performance table
for the actual measurements, test conditions and remaining hardware limitations.
