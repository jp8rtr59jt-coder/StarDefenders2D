#!/usr/bin/env python3
"""Build and serve static files on loopback; no game simulation or multiplayer."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser
import socket


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--serve', type=Path, help='Serve an existing export without rebuilding')
    parser.add_argument('--listen-fd', type=int, help=argparse.SUPPRESS)
    parser.add_argument('--no-cache', action='store_true', help='Always serve current assets without browser caching')
    parser.add_argument('--quiet', action='store_true', help='Only log HTTP errors')
    args = parser.parse_args()
    if args.serve:
        root = args.serve.resolve()
    else:
        from build import build
        root = build()

    class Handler(SimpleHTTPRequestHandler):
        extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                          '.js': 'text/javascript', '.cjs': 'text/javascript'}

        def send_head(self):
            if args.no_cache:
                for header in ('If-Modified-Since', 'If-None-Match'):
                    if header in self.headers:
                        del self.headers[header]
            return super().send_head()

        def end_headers(self):
            if args.no_cache:
                self.send_header('Cache-Control', 'no-store')
            super().end_headers()

        def log_request(self, code='-', size='-'):
            if not args.quiet or (isinstance(code, int) and code >= 400):
                super().log_request(code, size)

    try:
        handler = partial(Handler, directory=str(root))
        if args.listen_fd is None:
            server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
        else:
            # The playtest supervisor reserves the address before updates/builds,
            # then transfers the exact listening socket: no port ownership race.
            listener = socket.socket(fileno=args.listen_fd)
            if listener.getsockname() != ('127.0.0.1', args.port):
                listener.close()
                raise OSError('Inherited listener does not match the requested loopback address')
            server = ThreadingHTTPServer(('127.0.0.1', args.port), handler, bind_and_activate=False)
            server.socket.close()
            server.socket = listener
            server.server_address = listener.getsockname()
            server.server_name, server.server_port = server.server_address
    except OSError as error:
        parser.exit(1, f'Cannot start localhost launcher: {error}\nClose the previous game launcher or the service using this port; no process was stopped.\nKeep your usual hostname/port to preserve the browser storage origin.\n')
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
