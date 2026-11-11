#!/usr/bin/env python3
"""Build and serve static files on loopback; no game simulation or multiplayer."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser
from build import build


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--serve', type=Path, help='Serve an existing export without rebuilding')
    args = parser.parse_args()
    root = args.serve.resolve() if args.serve else build()

    class Handler(SimpleHTTPRequestHandler):
        extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                          '.js': 'text/javascript', '.cjs': 'text/javascript'}

    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(root)))
    except OSError as error:
        parser.exit(1, f'Cannot start localhost launcher: {error}\nTry --port 8001 (a different port has separate saves).\n')
    url = f'http://127.0.0.1:{server.server_port}/'
    print(f'Open {url} in Chromium or Chrome. Press Control-C here to stop.', flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
