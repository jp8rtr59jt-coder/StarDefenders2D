# Milestone 1 validation

Tested 2026-11-11 against upstream commit `801a2b05` plus the standalone startup
changes. Environment: Linux, Python 3.12.14, Chromium 156.0.8078.79, headless
Playwright with software WebGL. Actual macOS hardware and Safari were not available.

## Passed

The final `offline/test.cjs` run completed successfully with 15 checks:

| Check | Observed result |
| --- | --- |
| Static startup | Ready menu; Socket.IO disconnected; music disabled |
| Original sandbox startup | Single-player and local authoritative simulation enabled; 4,413 entities |
| Gravity / floor | Player landed and stood on existing block geometry; vertical velocity zero |
| A/D movement | Keyboard D moved the player about 99 world units over the checked interval |
| Jump | Space raised the player about 18.6 world units in the initial checked interval |
| Crouch / animation | S reached crouch intensity 1; articulated ragdoll remained present |
| Wall collision | Player stopped five units before the wall origin, consistent with its hitbox |
| Aim | Mouse movement updated world-space aim above and to the right |
| Fire / projectile | Pistol ammunition decreased 12 → 11 and an owned projectile was created |
| Reload | R activated the reload animation and restored 12/12 ammunition |
| Enemy AI | Existing humanoid AI acquired the player and fired its existing pistol |
| Incoming damage | Enemy projectiles reduced player health and armor |
| Outgoing damage / death | Player shots reduced enemy health below zero; ragdoll present |
| Save | Original Save & quit action wrote the world snapshot to IndexedDB |
| Reload saved world | Same player ID and a unique block's ID, position and hue survived page reload |

The browser recorded **zero page exceptions and zero non-local request attempts**.
All non-local requests were intercepted and would have failed the test. The only
HTTP errors were requests for the upstream-missing `audio/rocket_loop.wav`.
The test also checked the engine's displayed service message for swallowed
simulation/render errors before saving.

Gameplay input tests send actual browser keyboard/mouse events. For repeatable
collisions/combat, the harness temporarily clears a small region of the generated
sandbox and instantiates existing blocks, a pistol and an existing humanoid AI.
After verifying incoming damage, it increases only the disposable test player's
health to avoid random death invalidating the save test. These fixtures and
values are confined to the test browser context; no level, weapon or production
mechanic was added or changed. The context is discarded afterward.

## Other validation

- The export's own `offline-source/launch.py --serve .` ran from `dist/offline`.
  HTML, JavaScript (correct MIME type), and the corrected sprite URL returned 200.
  No `node index.js` process was running.
- Audited 1,814 entity, AI, library, asset, audio, meSpeak, shared-server,
  interface and Socket.IO files against the source: byte-for-byte matches.
  Core world, input, sound and renderer files also match.
- Export contains 145 entity/interface manifest entries, all local dependencies,
  original GPL/credit notices and supplemental library/font license texts.
- Optional music files and music manager are absent from the export. The original
  files remain in the repository.
- JavaScript syntax checks, Python compilation, and `git diff --check` passed.

## Reproduce

Start the launcher in one terminal:

```sh
python3 offline/launch.py --no-browser
```

With Playwright installed separately from the game, run in another terminal:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/node_modules/playwright \
CHROMIUM_PATH=/absolute/path/to/chromium node offline/test.cjs
```

`CHROMIUM_PATH` can be omitted when using Playwright's installed Chromium.
`GAME_URL` overrides the default `http://127.0.0.1:8000/`.
The harness writes `results.json`, `sandbox.png` and `combat.png` to the ignored
`offline/test-output/` directory. Playwright/Node are test tools only, never
required by the launcher or exported game.

## Remaining limitations

- macOS launcher behavior is implemented but not hardware-tested; use Chromium /
  Chrome. Safari and Firefox compatibility/performance remain unverified.
- Upstream lacks `audio/rocket_loop.wav`; that ambient loop is silent and logs a
  local 404. No replacement sound was invented. Other rare sandbox entities and
  their assets have not received exhaustive coverage.
- The upstream `buildtool_upgrade2` sprite had an incorrect root URL. The export
  supplies an alias to the identical existing `assets/guns/` sprite.
- Optional music, remote video, voice recognition, multiplayer services and the
  Ace editor are unavailable in this offline launch path. Local speech synthesis
  through the bundled meSpeak engine and ordinary game sounds remain local.
- Browser saves are origin-specific and subject to browser storage clearing and
  quota. Save & quit/reload passed; long-duration saves, crashes and migration of
  existing online-origin saves were not tested.
- This is the original offline sandbox, with its original balance and existing
  unsupported single-player commands. No campaign or mission content was added.
- Upstream's npm lockfile mismatch remains outside this milestone; the standalone
  launcher does not use npm or the Node server's dependencies.
