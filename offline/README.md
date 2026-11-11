# Standalone offline engine — milestone 1

For the optional experimental arena, see [Milestone 2 combat sandbox](COMBAT_SANDBOX.md).
It is separate from the original world and opens at `/?mode=combat`.

Uses the original Star Defenders 2D offline sandbox. No Node game server,
multiplayer account, npm installation, internet connection, new level or new
weapon is required. Requires Python 3 and a WebGL-capable Chromium/Chrome browser.

## Start on macOS

From the repository directory:

```sh
python3 offline/launch.py
```

Or double-click `Start Offline.command` (macOS may require allowing a downloaded
script, or run the terminal command above). The launcher builds `dist/offline`,
serves only that directory on `127.0.0.1:8000`, and opens your default browser.
Use Chrome/Chromium if your default browser is Safari; Safari is not yet verified.
Click **Play Offline** after the loading status says ready.

The Python process only serves static files. Stop it with Control-C. Opening
`index.html` via `file://` is unsupported because the engine uses ES modules,
fetch and browser storage.

## Portable static export

```sh
python3 offline/build.py
python3 offline/launch.py --serve dist/offline --no-browser
```

`dist/offline` is self-contained and excludes optional music. It can be copied
to another machine and hosted by a static server (JavaScript MIME types required).
For example, in that directory: `python3 -m http.server 8000 --bind 127.0.0.1`.
No dynamic endpoints or original `index.js` process are needed.
The exported folder also includes its own `Start Offline.command`; that copy
serves the export directly. Instructions and helper source are in `offline-source/`.

## Controls and saves

- A/D: move; W or Space: jump; S: crouch; mouse: aim; left click: fire.
- R: reload; number keys / wheel: select weapon; B: original build menu.
- Escape: pause menu; use **Save & quit to main menu** before closing.
- Progress uses the original localForage/IndexedDB save system. Use the same
  hostname and port each time. `localhost` and `127.0.0.1` have separate saves.
  Browser-data clearing/private browsing can erase progress. Back up important saves.

## Scope

The build pre-renders upstream HTML and writes its entity/interface class list
as a local file. A standalone flag skips multiplayer connection setup. Original
shared entities, physics, weapons, AI, animation, renderer and save code remain.
The offline adapter disables optional remote video and music; settings and credits
are retained. Content Security Policy prevents remote resources from loading.
The original repository and multiplayer entry point are still present separately.
Remote speech recognition is disabled. The browser memory diagnostic has a
fallback for browsers without Chromium's `performance.memory` API.

Online chat, server switching, theatre streaming and the optional Ace code editor
are outside this offline launch path. Shared engine modules are retained. Original
sandbox content, balance and offline-mode limitations still apply.

See `NOTICES.md` for licensing and `TEST_RESULTS.md` for validation and limitations.

The source base is https://github.com/Eric-Gurt/StarDefenders2D at commit
`801a2b05f7e5cdfce433de3a19b0c749a7335186`. In the export, JavaScript source
remains readable at the static root; `offline-source/upstream-index.html` retains
the original HTML input to the export builder. The builder expects the repository
layout; use the export's launcher with `--serve .` to run the portable copy.
