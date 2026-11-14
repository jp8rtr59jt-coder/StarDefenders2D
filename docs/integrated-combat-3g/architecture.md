# Milestone 3G architectural review

Review date: 2026-11-14. Reviewer: supported `gpt-6-astra` architecture subagent. Source assessment performed before substantial 3G combat edits; source references below describe the starting implementation, not a claim that recommendations have already been implemented. The implementation lead retains ownership of integration and validation. This reviewer changed only this report.

## Decision

Keep native entities, projectile movement, armor accounting, health/death, ragdolls, weapon instances, resource pool, AI and offline runtime. Extend the existing opt-in physical-combat policy with explicit equipment configuration and damage accounting. Add a small independent helmet ledger because native helmet selection is visual rather than a localized protection ledger. Configure six data-driven loadouts without changing existing faction or gun identifiers.

The principal risks are two independent shield interception routes, discarded shield overflow, biological head amplification before protection, internally generated bleeding being absorbed by shields, and faction/appearance helpers overwriting unrelated gameplay properties.

## Inspected systems and reuse decisions

| Source/system | Classification | Evidence and decision |
| --- | --- | --- |
| `game/entities/sdEntity.js` | Reuse directly | `DamageWithEffect` (~6241) owns safe-area checks, attacker tracking and native damage-number effects; `Damage` remains the actual health owner. Entity registration, snapshots, collision/hash updates and matter transfer are existing infrastructure. Do not duplicate them. |
| `game/entities/sdCharacter.js`: health, death, stability, ragdoll | Reuse directly | `Damage` (~2923) performs size scaling, immunity, attribution, armor, native death/drop logic and stability. Preserve these operations and route biological damage through them once. |
| `sdCharacter`: native armor | Reuse with modification | `armor`, `armor_max`, `_armor_absorb_perc`, `armor_speed_reduction`, repair, pickup/drop snapshots and `RemoveArmor` already exist. Native depletion correctly transfers unabsorbed overflow to health. Use localized coverage/penetration to supply per-hit absorption; retain the native ledger and break lifecycle. |
| `sdCharacter`: helmet visuals / hit localization | Reuse with modification | `GetHitDamageMultiplier` is the authoritative existing head test. Existing physical region logic approximates legs/arms inside that same collision box. Add independent helmet integrity; do not enlarge the collision box or pretend rendered hands are independent hitboxes. |
| `game/entities/sdBullet.js` | Reuse with modification | Keep filtering, precise collision test, hit permissions, critical-range damage, projectile callbacks, bounce/penetration, impulse and explosions. Narrow hooks must prevent shield interception from consuming an overflow projectile before it can reach the body. |
| `game/entities/sdGun.js` | Reuse directly | Instances own `extra` upgrades, dynamic projectiles, reloads, magazine state, matter costs and native muzzle/pose. `GetBulletCost` (~877), reload expenditure (~1035) and per-shot expenditure (~1158) already distinguish magazine and energy weapons. |
| `game/entities/sdGunClass.js` | Reuse directly | Stable class registrations explicitly warn against unstable reindexing. Select existing weapons rather than adding a parallel arsenal. Armor pickup classes contain reusable armor properties. A static `_damage:1` is often a placeholder; dynamic properties and `onMade` supply real damage. |
| `game/entities/sdBubbleShield.js` | Reuse with modification | Native entity already follows owner, renders animated shield, stores capacity, handles hit sound, duration, depletion, regen and removal. Add opt-in finite equipment configuration and numeric absorption results; preserve native player shield semantics outside the opt-in policy. |
| `game/entities/sdBaseShieldingUnit.js` | Preserve for future milestones | Protects construction through `_shielded` and `TestIfDamageShouldPass`; crystal, matter, timed and faction modes support bases. This is distinct from personal `_shield_ent`; combining them would incorrectly import ownership/claim and infrastructure immunity rules into infantry. |
| `game/entities/sdUpgradeStation.js` | Preserve for future milestones | Existing `UpgradeCharacter`, equipment production and armor auto-build consume station matter and use `InstallUpgrade`/shop options. Valuable mission resupply infrastructure; a full station economy is unnecessary for 3G. |
| `game/entities/sdWeaponBench.js` | Preserve for future milestones | Existing upgrade actions mutate actual weapon extras and debit native matter. Reuse when needed; do not create a second weapon-modification format. Keycard text moderation and retrieval features require separate offline audit. |
| `game/client/sdShop.js`: upgrades | Reuse directly | Native shield allowance/cost, jetpack power/fuel reduction, armor repair multiplier and matter-regeneration properties already drive character logic. Limited-resource tests should configure these properties and avoid unintentional free regeneration. |
| `sdShop` / build tool / construction | Preserve for future milestones | Build tool placement validation, matter costs and entity construction lifecycle already exist. Retain the existing laboratory build bay. Do not turn 3G into a crafting/progression milestone. |
| `game/entities/sdFactions.js` | Reuse with modification | Existing presets spawn native gun instances and assign native skin/team/AI. Keep all IDs. New opt-in data can reuse character/gun creation and team behavior while avoiding old factions' fixed statistical bundles. |
| `game/entities/sdFactionskin.js` | Reuse with modification | `SetHumanoidSkinClass` is NOT cosmetic: e.g. Star Defender preset sets 250 HP, 500 armor, matter, AI level/team, regeneration and jetpack. Apply independent loadout properties after any preset, or use the underlying visual settings conversion directly. |
| `game/entities/sdFactionTools.js` | Preserve for future milestones | A broad catalogue of equipped humanoid spawn tools, useful for future editor/spawn integration. Reuse patterns and native entities, but do not expose a huge unrelated spawn catalogue in the 3G lab. |
| `game/entities/sdFactionSpawner.js` | Preserve for future milestones | Counts native characters/drones by team, caps population and calls faction presets; good basis for mission reinforcements. Current type/team mappings are legacy-specific and need explicit extension for new factions. |
| `game/combat/humanoid-ai.js` / native `AILogic` | Reuse with modification | Existing training policy separately controls reaction, settling, aim error, turning, heat, memory and distances around native movement/AI. Keep skill independent of faction and equipment. Add doctrine offsets through this policy rather than a replacement decision loop. |
| `game/combat/physical.js` | Reuse with modification | Already delegates health/armor to native damage and adds biological injury only from actual HP loss. Preserve seeded critical/visual behavior, blood limits, weak-map opt-in, limb effects and finite critical endpoints. Extend `attach`, hit context and diagnostics rather than layering a second injury module. |
| `game/combat/sandbox.js` | Reuse with modification | Retain geometry, native crates, reset, hostile toggle, equip/supply and three legacy 250-HP presets. Add a compact faction panel/lane and limited-resource preset. Current `equip` only knows five weapon names and inventory slots can collide when adding new guns. |
| `game/movement/slide.js` | Reuse with modification | Existing player-only slide controls momentum and posture and refreshes cached hitboxes. Fix native walking penalty from effective posture, while keeping slide's ground-motion override. |
| `game/art-lab/presentation.js`, `assets.js` | Reuse with modification | Cinematic A is current default and preserves original cargo crates. Its `part`/`head` hooks replace all sandbox enemies with the same art and clear native color filters: native skin colors alone cannot distinguish the six new loadouts. Add small profile/equipment-aware drawing or overlays using existing rig transforms. |
| `game/entities/sdTurret.js` | Preserve for future milestones | Includes stationary, portable, sentry, repair/weld and faction variants. Type 0 uses matter/com access; type 1 targets other teams and bypasses ordinary supply assumptions. Good mission defense support, but explicitly choose economy behavior later. |
| `game/entities/sdDrone.js` | Preserve for future milestones | Numerous native combat/repair/scout variants have native teams, collision and structural HP. Future non-biological opponents should use these existing entities, not receive humanoid bleeding accidentally. |
| `game/entities/sdHover.js` / vehicles | Preserve for future milestones | Native driver/passenger slots, mounted weapons and vehicle targeting exist. Entering vehicles affects character targetability and player abilities; vehicle damage must stay outside humanoid localized protection until designed and tested. |
| `game/entities/sdMatterContainer.js` | Preserve for future milestones | Stores/transfers finite matter; `MatterGlow` and cables already support resupply. It is not a generator. A mission resupply object can reuse it without inventing another currency. |
| `game/entities/sdMatterAmplifier.js`, `sdMatterMatrix.js` | Preserve for future milestones | Crystal amplification and crystal-fed matrix generation provide native infrastructure. Keep these available to original mode; no need for a new generator or production chain in 3G. |
| `game/entities/sdBot.js`, `sdBotFactory.js`, `sdBotCharger.js` | Preserve for future milestones | Repair/attack bots use `sdProgram`, native target/entity wrappers and matter. Factory costs 600 matter per bot; chargers transfer matter and repair structural HP. Programmable UI/moderation paths need offline-specific validation before becoming a mission dependency. |
| Native `sdSound`, `sdEffect`, `sdStatusEffect` | Reuse directly | Existing shield hit, armor break, wall impact, damage numbers, muzzle and blood effects are adequate. Reuse bounded effects and distinct timing/colors; do not blanket scenes with new particles. |
| `offline/bootstrap.js`, `sdWorld.StartOffline` | Reuse directly | Actual offline mode executes authoritative simulation in-browser. `StartOffline` sets both `is_server=true` and `is_singleplayer=true` (~5724); a server guard alone is not an offline incompatibility. |
| Online-only integrations | Incompatible or not currently functional in offline mode | Bootstrap deliberately disables remote theatre players and optional music. Offline socket handles a finite command set and reports unsupported commands. Cross-server services, online account/storage and unbridged database features must not become 3G dependencies. |

No wholesale native system replacement is justified. Replace only the defective opt-in shield full-block/overflow policy, with backward compatibility for untouched native modes.

## Exact damage conflicts

1. **Two shield entry points.** `sdBullet.RegularCollisionFiltering` (~817) ignores owner shields and depleted shields. Other bubble collisions proceed through the non-biological branch, which damages the bubble and normally zeroes/removes the projectile (~1640). Separately, `sdCharacter.Damage` (~2942) calls `DidShieldProtectFromDamage`. Fixing only the character fallback leaves actual shots stopping at the bubble; fixing only projectile collisions leaves direct damage inconsistent.
2. **Boolean shield overflow loss.** `DidShieldProtectFromDamage` returns true for any initially positive shield HP after subtracting the entire attack. A shield with 1 HP absorbs an arbitrarily powerful hit. STAR_DEFENDER shield damage clamps negative HP to -150 and later recovers; other types remove. Capacity accounting must return `{absorbed, remaining}` for opted-in equipment.
3. **Head amplification precedes protection.** Bullet computes `limb_mult * critical_hit_mult * _damage`; physical context then multiplies head damage by 3.4. This is deliberately strong biological vulnerability in the previous lab but is inappropriate as shield/helmet incoming energy. Separate base impact energy, native localization and biological amplification; never accidentally multiply twice again.
4. **Armor is already correct.** Character damage's partial-capacity calculation (~3043–3089) preserves overflow and calls native `RemoveArmor` on depletion. Physical policy temporarily changes `_armor_absorb_perc` and restores it in `finally`. Preserve this pattern carefully: after armor breaks, do not resurrect armor capacity or movement penalty by restoring stale state. The absorption coefficient can remain configured with zero capacity, but diagnostics must use actual capacity.
5. **Bleeding can be shielded.** Both physical critical ticking and native `_dying` use positive `Damage(...,false,false)`. The fourth argument disables armor only; shield interception happens earlier. A recharging shield may postpone or defeat the guaranteed critical endpoint. Internal biological injury needs an explicit, narrow shield bypass, while falls/explosions/direct attacks must have deliberate documented policy.
6. **Native impulse versus biological injury.** `DamageWithEffect` returns true for accepted calls even when no HP is lost. Bullet impulse can therefore still happen after absorption. Physical injuries correctly derive severity from before/after HP, while armor impacts additionally reduce stability. Keep one impulse owner, and add capped protected-impact feedback without applying biological injuries to absorbed energy.
7. **Explosion semantics are real projectiles.** `sdWorld.SendEffect` (~1657) emits multiple `_wave` bullets for explosions. They follow normal projectile collision routes. Do not add an independent radial health debit; do not accidentally grant these fragments the rifle profile merely because they lack `_gun`. Test overlapping bubble/body volumes, low capacity, interior explosions and multiple wave fragments.
8. **Penetration is overloaded terminology.** Native `_armor_penetration_level` is primarily a binary world-object protection threshold; `penetrating` controls continuing through objects; `_rail` describes rail behavior. The physical policy's resistance/penetration numbers are a separate localized equipment calculation. Keep names/diagnostics clear, do not alter native world penetration globally, and explicitly classify selected weapons.
9. **Shield lifecycle hazards.** `ApplyShield` on an existing bubble refills `hea` and duration but does not update `_hmax` when switching type. New STAR_DEFENDER bubbles start at 10% HP to prevent E-toggle spam. Equipment setup must configure maximum/current capacity once, not call ApplyShield each tick. Owner-removal cleanup must remain native; additionally decide whether corpse shields immediately disable.
10. **Defaults reset loadouts.** Current physical `attach` resets health, native armor, speed reduction, repair and respawn protection; `tick` rewrites mobility from `baseMobility`. An archetype setup call after or before this method can silently lose data. Extend `attach` with explicit configuration and record intended base mobility before injuries.

## Minimal recommended damage design

The existing engine remains authoritative for projectile travel and native health. The physical policy owns localized equipment interpretation and the injury record for opted-in characters only.

Suggested configuration contract (exact names may be refined by implementation):

```js
physical.attach(character, {
  health: 90,
  armor: { integrity, absorb, resistance, coverage, speedReduction },
  helmet: { integrity, absorb, resistance },
  shield: { capacity, recharge, delay, matterCost },
  mobility
});
```

Retain `attach(character, 'light')` and the other legacy laboratory profiles. Keep faction ID, archetype ID, training tier, doctrine, weapon class, visuals and matter loadout outside the damage layer; configure them through a single loadout application function. Avoid copying raw preset objects into native fields without validation.

For a projectile, obtain region from the native collision/hit test, classify ammunition, then process incoming energy through shield, localized helmet/body armor and native biological damage. Apply biological head vulnerability to the energy that reaches the head, rather than draining shield capacity according to exposed-head lethality. Call native `DamageWithEffect` once for the body health transaction. Record actual differences in shield, helmet, armor and HP; use those measurements for effects and injuries.

For actual bubble interception, the preferred narrow hook is after regular filtering and before the non-biological generic collision branch. Consume at most available opted-in capacity. If overflow remains, reduce projectile raw `_damage` by the residual energy ratio and let the original trajectory continue. A per-projectile shield/owner marker prevents a second charge if the body fallback observes the same encounter. Verify the movement sweep's collision response rather than assuming an early return alone guarantees continuation. Do not immediately damage the protected character when its bubble is struck: the projectile may graze the bubble and miss the body.

A smaller alternative, if native sweep continuation proves unreliable, is to make only opted-in personal bubbles transparent to projectile collision and process protection at the actual body contact. This preserves native bubble lifecycle/visuals and accurate body hits, but changes interception at the bubble's outer edge; document and explicitly test that choice. Do not globally disable all native bubble collision.

`Character.Damage` must still support attacks without a projectile context. A numeric residual helper handles opted-in shields there, with a narrow internal-injury/already-processed bypass. Do not recursively call `Damage` through the same shield interception or temporarily remove the owner pointer. Keep legacy signature/default behavior unchanged for original modes. If using synchronous scoped policy state, restore it in `finally` and make nested calls safe.

For helmets, one small capacity ledger plus resistance/coverage is enough. Head protection must not silently use native body armor too. Body armor remains native; use native depletion and break callbacks. Armor/helmet hits can stagger via capped impact energy even when health loss is zero. Once equipment fails, the same 90-ish biological HP should be exposed, regardless of rank.

Shield regeneration must be finite, delayed after hits, bounded by capacity and equipment/matter rules. The current native player ability spends 20 activation matter and 0.6 matter per simulation tick times its cost multiplier while enabled. Native jetpack spends the same matter pool. Reuse those concepts; do not invent a second energy pool in 3G. Record whether NPC shields use active upkeep, recharge expenditure or both, and ensure finite NPC matter cannot accidentally imply infinite regeneration.

## Weapons and resources

Starting candidates are native pistol (class 0), rifle (1), shotgun (2), railgun (3), sniper (63), and one clearly identified energy weapon such as laser pistol (23) or a native faction rifle. The first four are already equipped in the lab. Baseline dynamic pistol damage is 18 with 12 rounds and 5-tick interval; rifle is 20 with 30 rounds and 3 ticks; shotgun is 20 per pellet, five pellets, eight rounds and 20 ticks plus native close-range amplification; railgun is 85, no magazine and 30 ticks. These are source baselines, not measured hit-to-defeat results. Native upgrades modify them.

Do not infer energy weapon cost from class purchase `matter_cost`. Use `GetBulletCost`, reload expenditure and actual gun firing. `ammo_capacity=-1` consumes matter per shot; magazine guns spend matter on replenishment and may start with loaded rounds. Limited tests must account for starting magazines. Switching to limited matter should reset both regeneration strength and regeneration multiplier, not only reduce `matter_max`; verify no dropped nearby resource refills the test silently. Preserve the 10,000-matter laboratory configuration as an explicit alternative.

Native level-1 light/medium/heavy armor classes expose 130/190/250 integrity, .3/.4/.5 absorption and 0/5/10% movement penalties. Reuse native storage/lifecycle while tuning opt-in profiles for desired combat. Do not claim these native values alone provide ballistic stop behavior: localized penetration must be measured against chosen ammo.

## Offline, save and art boundaries

Server guards are valid in offline authoritative simulation. `StartOffline` bridges context commands, service messages and `CommandFromEntityClass`; consequently a socket mention alone is not proof that an entity cannot work locally. However, some bench/bot text operations directly refer to `sdModeration`; confirm the browser adapter supplies it before exposing those paths. Remote theatre/music are explicitly disabled by bootstrap. Network account, database and cross-server facilities are not needed for 3G.

Physical/AI/slide state currently lives in WeakMaps and is deliberately disposable. Combat config skips snapshot loading and uses separated IndexedDB namespaces (`sd-physical-combat-lab`, etc.). Keep original-mode persistence and stable IDs untouched. If new persistent entity fields are introduced, initialize them safely for older snapshots; do not claim a disposable WeakMap is a persisted save format.

Use current articulated transforms for helmet break/armor overlays, keep A's original crates, and preserve B/C/original art switches. A simple native skin change is insufficient under the existing A draw overrides. Equipment absence after depletion must be visible independently of faction color.

## Movement finding

The source confirms the suspected mismatch: `walk_speed_scale *= .5` depends on `act_y_or_unstable` (~5211), while `_crouch_intens` remains crouched when `CanUnCrouch` fails (~5237). Releasing S removes the penalty without changing collision posture. Move the walking penalty to effective posture after crouch resolution or explicitly include constrained crouch, retaining native stability/armor/mobility scaling. Slide ground movement already bypasses normal walking acceleration via the slide hook, so keep that separation. Browser reproduction and regression measurements remain required; this source review is not a reproduction claim.

## Required evidence before acceptance

- Live projectile and direct-call paths: full shield absorption, exact depletion, 1-HP shield versus heavy shot, repeated hits, partial overflow, corpse cleanup and recharging failure/recovery.
- Actual trajectories at bubble edges, owner shots, rail penetration, shotgun pellets, interior/exterior explosion waves and safe-area/respawn immunity. No health debit from a bubble graze.
- Head/torso/limb distinction; helmet destruction and subsequent exposed head; native body-armor depletion; no double subtraction and no immunity from stale equipment values.
- Critical bleeding expires even if shield recharges; absorbed damage does not create biological bleeding; native death/ragdoll remains intact; protected impact remains readable.
- Configuration independence: changing training does not alter HP/equipment; changing equipment does not reset training; faction visuals work in Cinematic A and original rendering.
- Measured hit-to-defeat table from real selected weapon projectiles, reporting aim region, starting protection and fire/recovery timing. Do not equate theoretical division with measurements.
- Resource depletion through real reload/energy/jetpack/shield paths; explicit unlimited/limited preset switching and resets.
- Existing regressions, original-mode save round trip, offline export, browser asset/errors, nine requested movement cases and launcher tests. Native macOS Finder testing must be reported separately from Linux checks.

This report establishes the pre-implementation design. Implementation decisions and verified resolutions should be recorded in the milestone validation report and reviewed against these risks before promotion.
