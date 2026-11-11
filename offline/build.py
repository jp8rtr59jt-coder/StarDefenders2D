#!/usr/bin/env python3
"""Export the existing engine as static files. Python standard library only."""
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'dist' / 'offline'


def build():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    # Rebuild only this generated directory; never touch source or browser saves.
    for path in OUTPUT.iterdir():
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()
    def excluded(directory, names):
        directory = Path(directory)
        if directory == ROOT / 'game':
            return [name for name in names if name in ('music', 'index.html')
                    or name.startswith(('index_old', 'style_old'))]
        if directory == ROOT / 'game' / 'client':
            return [name for name in names if name in ('sdMusic.js', 'sdTheatreAPIs.js')]
        return []

    shutil.copytree(ROOT / 'game', OUTPUT, dirs_exist_ok=True, ignore=excluded)
    classes = [f'./{folder}/{p.stem}' for folder in ('entities', 'interfaces')
               for p in sorted((ROOT / 'game' / folder).glob('*.js'))]
    (OUTPUT / 'get_classes.txt').write_text(','.join(classes), encoding='utf-8')
    # Upstream references this sprite at assets/ although it lives under guns/.
    # Supply the same existing art at that URL, without changing sdGunClass.
    shutil.copy2(OUTPUT / 'assets/guns/buildtool_upgrade2.png',
                 OUTPUT / 'assets/buildtool_upgrade2.png')

    html = (ROOT / 'game' / 'index.html').read_text(encoding='utf-8')
    html = re.sub(r'<\?\s*print\( discord_url \)\s*\?>',
                  'https://discord.gg/rX4xEc2Y9E', html)
    html = re.sub(r'<\?.*?\?>', '', html, flags=re.S)
    html = re.sub(r'<script\b[^>]*src="(?:https?://[^\"]+|client/sdMusic.js|client/sdTheatreAPIs.js)"[^>]*>\s*</script>',
                  '', html)
    # Keep the original page and credits; remove only online launch actions.
    html = re.sub(r'<menu_button\b[^>]*>.*?</menu_button>',
                  lambda m: '' if any(s in m[0] for s in
                  ('Play Story Mode', 'Play Together', 'Get Notificator App', 'ServerButtonPressed')) else m[0],
                  html, flags=re.S)
    html = re.sub(r'<div id="section_menu">.*?</div>',
                  '<div id="section_menu"><section_btn onclick="GoToScreen(\'screen_menu\')">Menu</section_btn></div>',
                  html, flags=re.S)
    html = html.replace("<menu_button onclick=\"sdWorld.StartOffline( 'globalThis.GetPlayerSettings()' );\">",
                        "<menu_button id=\"offline_play\" onclick=\"sdWorld.StartOffline( 'globalThis.GetPlayerSettings()' );\">")
    html = html.replace('but offline world is associated with current online server.',
                        'at this localhost address.')
    html = html.replace('Connecting to server', 'Loading offline engine')
    html = html.replace('<span id="game_title_text">...</span>', '<span id="game_title_text">Star Defenders 2D</span>')
    html = html.replace('<span id="server_playing">...</span>', '<span id="server_playing">Single player</span>')
    html = html.replace('<span id="server_online">...</span>', '<span id="server_online">Local saves</span>')
    # Deny accidental remote requests from retained optional engine features.
    csp = ("default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
           "style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'none'; object-src 'none'")
    html = html.replace('<head>', '<head>\n<meta http-equiv="Content-Security-Policy" content="' + csp + '">')
    # The adapter needs the original menu elements, before deferred module code.
    html = html.replace('</body>', '<script src="offline-bootstrap.js"></script>\n</body>')
    (OUTPUT / 'index.html').write_text(html, encoding='utf-8')
    shutil.copy2(ROOT / 'offline' / 'bootstrap.js', OUTPUT / 'offline-bootstrap.js')
    for name in ('LICENSE', 'README.md'):
        shutil.copy2(ROOT / name, OUTPUT / name)
    shutil.copy2(ROOT / 'offline' / 'NOTICES.md', OUTPUT / 'NOTICES.md')
    shutil.copytree(ROOT / 'offline' / 'licenses', OUTPUT / 'licenses')
    # Include the changed source and build/launch instructions with the export.
    shutil.copytree(ROOT / 'offline', OUTPUT / 'offline-source',
                    ignore=shutil.ignore_patterns('__pycache__', 'test-output'))
    shutil.copy2(ROOT / 'game' / 'index.html', OUTPUT / 'offline-source' / 'upstream-index.html')
    # The portable folder can launch itself without the original checkout.
    command = (ROOT / 'Start Offline.command').read_text(encoding='utf-8')
    command = command.replace('python3 offline/launch.py',
                              'python3 offline-source/launch.py --serve .')
    (OUTPUT / 'Start Offline.command').write_text(command, encoding='utf-8')
    (OUTPUT / 'Start Offline.command').chmod(0o755)
    (OUTPUT / 'START-HERE.txt').write_text(
        'Star Defenders 2D — standalone offline engine\n\n'
        'Requires Python 3 and Chrome/Chromium with WebGL. No npm or Node server.\n'
        'On macOS: double-click Start Offline.command, or from this directory run:\n'
        '  python3 offline-source/launch.py --serve .\n'
        'Open http://127.0.0.1:8000/ in Chrome and click Play Offline.\n'
        'Use the same address/port to retain browser saves. Escape opens the menu;\n'
        'choose Save & quit before closing. Control-C stops the launcher.\n\n'
        'Detailed instructions, limitations and test results: offline-source/\n'
        'Licenses: LICENSE, NOTICES.md, licenses/, and retained library notices.\n',
        encoding='utf-8')
    print(f'Offline export: {OUTPUT}')
    return OUTPUT


if __name__ == '__main__':
    build()
