# Phase C1 — native personal shields

This extends only NPC shields explicitly equipped through the physical combat
policy. The crouch checkpoint is preserved. No helmets, factions, new art, CI
or playtest promotion are included.

## Equipment API

In the existing physical laboratory, choose an encounter and equip it once:

```js
const npc = sdPhysicalCombat.encounter('heavy');
npc.matter_max = npc.matter = 40;
sdPhysicalCombat.equipShield(npc, {
  capacity: 100,
  rechargePerSecond: 10,
  rechargeDelayMs: 1500,
  matterPerPoint: 2
});
```

Capacity must be positive and finite. Recharge rate/delay must be nonnegative;
matter per restored shield point must be positive and finite. Default recharge
is zero, delay 1000 ms, cost 1. Configuration is disposable laboratory equipment,
not a new persistent save format. Duplicate equipment is rejected. Existing
player shields cannot be equipped through this API.

The native `sdBubbleShield` entity owns charge, follows the actor, renders its
existing animation, and retains the native removal lifecycle. It starts with its
configured full capacity once. Depletion leaves it at zero for possible paid
recovery; it disappears when its owner dies or is removed. Native player shields
and unattached/original-mode characters keep their old behavior.

## Interception and damage

The preferred architecture-report path works in the native movement sweep:
finite bubble interception subtracts at most available charge, scales the original
projectile's remaining damage, and lets overflow continue. It never applies health
damage to the owner at the bubble edge. A bubble graze can drain charge but cannot
hit the body indirectly. Native owner-shot filtering is retained.

A per-projectile WeakSet marks which owners have already been shield-processed.
Both bubble interception and body-origin fallback populate it. This prevents
charging again if the same penetrating projectile later encounters the other
volume. Native penetration/critical range, projectile removal, armor, impulse and
ragdoll code remain responsible for their original behavior. Shield charge is
drained by impact energy before biological head multipliers. Overflow reaching
the head still receives the existing native/physical head vulnerability.

Direct `Damage` / `DamageWithEffect` use numeric residual shield damage. The
physical projectile transaction uses a scoped, finally-restored shield bypass
so it calls the native body-health transaction once. Native internal dying loss
and physical critical bleedout pass an explicit internal-injury flag, honored
only for opted-in physical actors. Native player/original bleeding behavior is
unchanged. Fully absorbed hits do not create biological injury; residual hits
feed the existing injury policy using actual health loss.

Recharge uses simulation ticks (30 ticks/second), respects the full delay even
across large steps, caps at capacity and debits the owner's native matter pool.
There is no active upkeep in C1: recovery costs matter, initial equipment is
charged once. Equipping disables the NPC's upgrade-based matter regeneration
and multiplier. Existing world resource transfers can still supply matter; this
is the native shared resource economy, not free shield regeneration.

## Validation

`offline/shield-test.cjs` runs real `sdGun.Shoot` pistol/railgun/shotgun projectiles,
native projectile sweeps including grazing/penetrating/interior wave cases,
direct damage, resource recovery, internal bleedout and original shield checks.
The wave fixtures use actual `sdBullet` explosion-fragment flags and movement;
they do not claim exhaustive validation of every explosive weapon.

Results: [shield-validation.json](shield-validation.json).
Relevant prior suites and observed outcomes: [regressions.json](regressions.json).
Linux Chromium/SwiftShader only; native macOS behavior was not retested.

Use a separate development checkout and the existing
`python3 offline/launch.py --no-browser`, then open
`http://127.0.0.1:8000/?mode=combat&movement=1&art=1&physical=1` and click Play.
The snippet above can be run in Chrome's developer console. Hostility remains
controlled by the existing lab button. No extra UI is introduced in this phase.
The installed Mac launcher still follows unchanged `playtest`; do not reinstall
it for this unfinished milestone.

Remaining scope: no persistent equipment UI/loadouts, no helmets or archetypes,
no new balance commitments. Native legacy shields retain their original boolean
full-block behavior, including discarded overflow; corrected overflow applies
only to finite NPC equipment. Direct non-projectile hits preserve native direct
health behavior and are not assigned fabricated limb localization.
