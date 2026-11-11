# Milestone 2: experimental combat sandbox

Start on macOS with Python 3 and Chrome/Chromium:

```sh
python3 offline/launch.py
```

Open `http://127.0.0.1:8000/?mode=combat`, then **Start combat sandbox**.
Alternatively choose **Experimental combat sandbox** from the original menu.
The original **Play Offline** mode is still at `http://127.0.0.1:8000/`.
The existing `Start Offline.command` launcher also works. No internet, Node game
server, npm installation or new game dependency is required.

## Environment

A fixed 1,920-unit-wide arena replaces procedural terrain only in this mode:
flat spawn/build bay on the left, three elevated platforms and steps, a small
enclosed combat room with a sensor-operated door, destructible cover/crates and
an open shooting range on the right. Boundary blocks and platform geometry are
fixed; other objects use their normal damage/destruction behavior. The existing
block Damage entry point is disabled on fixed geometry instances only.

The map has no new art, campaign, story or faction design. The humanoid AI uses
existing internal team IDs to distinguish hostile targets and the friendly door.
Weather/events, procedural expansion, initial terrain generation, tutorial
delivery vehicles and scheduled world backups are disabled by the mode config.

## Controls

Original controls: A/D move, W/Space jump, S crouch, mouse aim/fire, R reload,
number keys/wheel switch weapons, B opens the original build menu, Escape opens
the existing character menu.

The small bottom control bar offers:

- **Reset:** clear enemies, corpses, dropped guns and player-built structures;
  restore original props and respawn. Fixed geometry remains.
- **Respawn:** replace the player and reissue equipment.
- **Spawn basic/intermediate/advanced:** existing humanoid AI with respectively
  pistol / rifle / railgun, AI skill 0 / 2 / 4, health 250 / 300 / 400, and
  standard / aggressive / distant behavior. No enemies spawn automatically.
- **Hostility:** enable/disable AI actions on existing and future enemies.
  Already fired bullets continue travelling normally.
- **Restore objects:** replace the door, crates and destructible cover without
  clearing player-built structures or enemies.
- **pistol / rifle / shotgun / railgun / build:** equip existing weapons. Their
  normal firing, ammunition, reload, damage and projectile rules remain intact.
- **Original sandbox:** navigate back to the Milestone 1 entry point.

The left bay (x < -480) is reserved for optional building experiments. It uses
the original construction tool, shop, placement checks and costs. The player has
build-tool level 5, a large matter reserve and existing matter regeneration, so
resource progression is unnecessary. This does not unlock every advanced shop
item: normal workbench and upgrade requirements still apply.

## Save isolation and module boundary

Combat worlds are disposable and start fresh on reload. The mode uses the
separate localForage database `sd-combat-experimental`, ignores the original
legacy world fallback, and never invokes normal snapshot loading or saving.
Original offline world snapshots remain in the original database. Menu/character
preferences still use the original settings system; this is world isolation,
not a separate browser profile.

Implementation lives in `game/combat/sandbox.js`, loaded only for `?mode=combat`.
The offline startup accepts its config through a small optional hook. Original
movement, physics, collision, weapon, projectile, AI, ragdoll and render modules
are reused. Remove the module/hook and menu link to reverse this addition.
Milestone 1 notices, music exclusions, launcher and original mode remain.

## Validation and limitations

Run `offline/combat-test.cjs` and `offline/combat-storage-test.cjs` with the same
Playwright/Chromium environment variables documented in `TEST_RESULTS.md`.
The original `offline/test.cjs` remains the regression suite. See the committed
combat validation records for observed results.

Actual macOS hardware is not available in this environment; Chromium validation
runs on Linux with software WebGL. The upstream missing `rocket_loop.wav` remains.
Optional music, remote video and the Ace editor remain excluded from launch.
Long sessions and large numbers of spawned actors/structures are not benchmarked.
The interface intentionally leaves normal gameplay balance intact: the player
can die quickly against advanced enemies. Reset/respawn are always available.

The existing systems already provide movement, crouching, weapon switching,
distinct projectile behavior, reloads, collisions, destructible cover and
ragdolls without replacement systems. AI can be slow to acquire targets and may
hesitate around cover/platforms; its movement/accuracy and encounter geometry
need playtesting before deciding on final combat feel. Normal resource-based
weapon costs (including the railgun's matter cost) remain visible. Camera/zoom
and UI scaling deserve macOS playtesting; no performance claims are made from
the software-rendered test environment.
