#!/usr/bin/env python3
"""Approved Git playtests, transactional exports and a supervised loopback server."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
REMOTE = 'https://github.com/jp8rtr59jt-coder/StarDefenders2D.git'
BRANCH = 'playtest'
REF = 'refs/remotes/origin/playtest'
HOST, PORT = '127.0.0.1', 8001
URL = 'http://127.0.0.1:8001/?mode=combat&movement=1&art=1&physical=1'
VERSION_FILE = 'playtest-version.json'
SHA = re.compile(r'[0-9a-f]{40}')
REQUIRED = ('index.html', 'offline-bootstrap.js', 'playtest-start.js',
            'get_classes.txt', 'combat/physical.js', 'combat/humanoid-ai.js',
            'movement/slide.js', 'art-lab/presentation.js', 'LICENSE', 'NOTICES.md',
            'offline-source/launch.py')


class LaunchError(Exception):
    pass


def say(message):
    print(message, flush=True)


def git(root, *args, timeout=25):
    env = dict(os.environ, GIT_TERMINAL_PROMPT='0', GIT_CONFIG_NOSYSTEM='1',
               GIT_CONFIG_GLOBAL=os.devnull)
    # Public HTTPS only, no credential prompts, hooks or submodule downloads.
    cmd = ['git', '-c', 'credential.helper=', '-c', 'core.hooksPath=/dev/null',
           '-c', 'protocol.ext.allow=never', '-c', 'protocol.file.allow=never',
           '-c', 'protocol.ssh.allow=never', '-c', 'protocol.http.allow=never',
           '-C', str(root), *args]
    process = None
    try:
        process = subprocess.Popen(cmd, env=env, text=True, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, start_new_session=True)
        try:
            stdout, stderr = process.communicate(timeout=timeout)
        except (subprocess.TimeoutExpired, KeyboardInterrupt):
            # Include Git's HTTPS helper, not just its parent process.
            try:
                os.killpg(process.pid, signal.SIGTERM)
                process.communicate(timeout=5)
            except (ProcessLookupError, subprocess.TimeoutExpired):
                if process.poll() is None:
                    os.killpg(process.pid, signal.SIGKILL)
                process.communicate()
            raise
        return subprocess.CompletedProcess(cmd, process.returncode, stdout, stderr)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise LaunchError('Git is unavailable or timed out: ' + str(error)) from error


def git_text(root, *args):
    result = git(root, *args)
    if result.returncode:
        raise LaunchError(result.stderr.strip() or 'Git command failed: ' + ' '.join(args))
    return result.stdout.strip()


def check_checkout(root):
    if Path(git_text(root, 'rev-parse', '--show-toplevel')).resolve() != root:
        raise LaunchError('This is not the installed game checkout.')
    if git_text(root, 'branch', '--show-current') != BRANCH:
        raise LaunchError('This launcher only runs the approved playtest checkout. '
                          'Use the installer for ~/Games/StarDefenders2D; no branch was changed.')
    if git_text(root, 'remote', 'get-url', 'origin').rstrip('/') != REMOTE:
        raise LaunchError('The installation origin is not the intended GitHub repository; no update was attempted.')
    if git(root, 'config', '--local', '--get-regexp', r'^url\..*\.insteadof$').returncode == 0:
        raise LaunchError('Local Git URL rewrites prevent verified updates; no update was attempted.')


def approved_local(root, commit):
    # A local ahead/divergent commit is not automatically an approved playtest.
    return git(root, 'merge-base', '--is-ancestor', commit, REF).returncode == 0


def update(root):
    check_checkout(root)
    before = git_text(root, 'rev-parse', 'HEAD')
    say('Installed checkout: ' + before)
    if git_text(root, 'status', '--porcelain', '--untracked-files=all'):
        say('Local changes detected. Updates and rebuilding are skipped; all local files are preserved.')
        return None
    try:
        say('Checking GitHub for approved playtest updates…')
        fetched = git(root, 'fetch', '--no-tags', '--no-recurse-submodules', '--',
                      REMOTE, 'refs/heads/playtest:' + REF)
    except LaunchError as error:
        say('Update check failed: ' + str(error))
        return before if approved_local(root, before) else None
    if fetched.returncode:
        say('Update check failed; keeping the installed checkout.\n' + fetched.stderr.strip())
        return before if approved_local(root, before) else None
    target = git_text(root, 'rev-parse', REF)
    if target == before:
        say('Up to date with the approved playtest branch.')
        return before
    if not approved_local(root, before):
        say('The local branch is ahead of or diverges from playtest. No checkout or reset was performed.')
        return None
    # Recheck edits immediately before Git's own fast-forward protections.
    if git_text(root, 'status', '--porcelain', '--untracked-files=all'):
        say('Local files changed during the check. Update skipped.')
        return None
    merged = git(root, 'merge', '--ff-only', '--no-edit', REF)
    if merged.returncode:
        say('Fast-forward failed; source files were not reset.\n' + merged.stderr.strip())
        return None
    commit = git_text(root, 'rev-parse', 'HEAD')
    if commit != target or git_text(root, 'status', '--porcelain', '--untracked-files=all'):
        say('Checkout changed during the update. Rebuilding skipped.')
        return None
    say('Updated to approved commit: ' + commit)
    return commit


def read_state(data):
    try:
        state = json.loads((data / 'current.json').read_text())
        if not isinstance(state, dict) or not SHA.fullmatch(state.get('commit', '')):
            return {}
        previous = state.get('previous')
        if not isinstance(previous, str) or not SHA.fullmatch(previous):
            state['previous'] = None
        return state
    except (OSError, ValueError, TypeError):
        return {}


def valid_export(folder, commit):
    if not SHA.fullmatch(commit or '') or not all((folder / p).is_file() for p in REQUIRED):
        return False
    try:
        meta = json.loads((folder / VERSION_FILE).read_text())
        return meta == {'repository': REMOTE, 'branch': BRANCH, 'commit': commit}
    except (OSError, ValueError):
        return False


def save_state(data, commit):
    old = read_state(data).get('commit')
    state = {'commit': commit, 'previous': old if old != commit else read_state(data).get('previous')}
    with tempfile.NamedTemporaryFile(mode='w', dir=data, delete=False, prefix='.state-') as f:
        json.dump(state, f); f.write('\n')
        temporary = f.name
    os.replace(temporary, data / 'current.json')
    # Only remove our own completed generated exports, retaining one rollback.
    for folder in (data / 'exports').iterdir():
        if folder.name not in (commit, state['previous']) and valid_export(folder, folder.name):
            try:
                shutil.rmtree(folder)
            except OSError as error:
                say('Old generated cache could not be removed: ' + str(error))


def export(root, data, commit):
    exports = data / 'exports'; exports.mkdir(exist_ok=True)
    final = exports / commit
    if valid_export(final, commit):
        save_state(data, commit)
        say('Using complete cached export: ' + commit)
        return final
    stage = Path(tempfile.mkdtemp(prefix='.building-', dir=exports))
    try:
        say('Building the approved game in a separate staging folder…')
        # A fresh process reads the updated exporter; an in-place rebuild never
        # destroys the last working game. No uncommitted script is run.
        process = subprocess.Popen([sys.executable, str(root / 'offline/build.py'),
                                    '--output', str(stage), '--playtest'], cwd=root)
        try:
            result = process.wait()
        finally:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill(); process.wait()
        if result:
            raise LaunchError('The offline exporter failed.')
        if git_text(root, 'rev-parse', 'HEAD') != commit or git_text(root, 'status', '--porcelain', '--untracked-files=all'):
            raise LaunchError('Source changed during the build. The staged export was discarded; local files were kept.')
        meta = {'repository': REMOTE, 'branch': BRANCH, 'commit': commit}
        (stage / VERSION_FILE).write_text(json.dumps(meta) + '\n')
        if not valid_export(stage, commit):
            raise LaunchError('The new export is incomplete; it will not be served.')
        if final.exists():
            raise LaunchError('An incomplete cache already exists for this commit; it was left untouched: ' + str(final))
        os.rename(stage, final)
        save_state(data, commit)
        return final
    finally:
        if stage.exists():
            shutil.rmtree(stage)


def last_working(data):
    state = read_state(data)
    for commit in (state.get('commit'), state.get('previous')):
        if commit and valid_export(data / 'exports' / commit, commit):
            return data / 'exports' / commit, commit
    raise LaunchError('No complete previous export is available. Resolve the reported problem and launch again. '
                      'Local source files and browser saves were not deleted.')


def reserve_port():
    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        listener.bind((HOST, PORT)); listener.listen(128)
    except OSError as error:
        listener.close()
        raise LaunchError('Port 8001 is already occupied or unavailable. No browser was opened and no process was stopped. '
                          'Close the previous game Terminal with Control-C, or quit the service using 8001, then retry. '
                          'The launcher will not switch ports because that would change your browser saves.') from error
    return listener


def wait_ready(process, commit, timeout=15):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise LaunchError('The local server exited before becoming ready.')
        try:
            with opener.open('http://127.0.0.1:8001/' + VERSION_FILE, timeout=.5) as response:
                if json.load(response) == {'repository': REMOTE, 'branch': BRANCH, 'commit': commit}:
                    return
                raise LaunchError('The local server reported a different game version; Chrome was not opened.')
        except (OSError, ValueError):
            time.sleep(.1)
    raise LaunchError('The local server did not become ready; Chrome was not opened.')


def open_chrome():
    if sys.platform != 'darwin':
        raise LaunchError('Automatic Google Chrome opening requires macOS. Developer testing can use --no-browser.')
    try:
        result = subprocess.run(['/usr/bin/open', '-a', 'Google Chrome', URL],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=15)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise LaunchError('Could not open Google Chrome: ' + str(error)) from error
    if result.returncode:
        raise LaunchError('Google Chrome could not be opened. Install it in Applications and try again.\n' + result.stderr.strip())


def serve(root, folder, commit, listener, no_browser):
    # A failed update must not make the last good export depend on a newly
    # broken exporter/server module in the checkout. Serve with its cached copy.
    child = subprocess.Popen([sys.executable, str(folder / 'offline-source/launch.py'),
                              '--serve', str(folder), '--port', str(PORT), '--no-browser',
                              '--quiet', '--no-cache', '--listen-fd', str(listener.fileno())],
                             cwd=root, pass_fds=(listener.fileno(),))
    try:
        wait_ready(child, commit)
        say('Running game commit: ' + commit)
        say(URL)
        if not no_browser:
            open_chrome()
        say('Keep this Terminal open. Control-C stops the game server cleanly.')
        code = child.wait()
        if code:
            raise LaunchError('The local server stopped with exit code ' + str(code))
    finally:
        if child.poll() is None:
            child.terminate()
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            child.kill(); child.wait()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--no-browser', action='store_true', help='Developer/manual browser testing; port stays 8001')
    parser.add_argument('--status', action='store_true', help='Show installed/cached versions without updating or serving')
    args = parser.parse_args(argv)
    if sys.version_info < (3, 9):
        raise LaunchError('Python 3.9 or newer is required. Install Python 3 from python.org; the game was not changed.')
    root, data = ROOT, ROOT / '.playtest'
    data.mkdir(exist_ok=True)
    if args.status:
        say('Repository: ' + REMOTE + '\nApproved branch: playtest\nGame address: ' + URL)
        say('Last complete export: ' + str(read_state(data).get('commit', 'none')))
        if shutil.which('git'):
            say('Checkout: ' + git_text(root, 'rev-parse', 'HEAD'))
        return 0
    with (data / 'launcher.lock').open('a+') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise LaunchError('A launcher is already running for this installation. '
                              'Use its Terminal/Chrome window; stop it with Control-C before relaunching.') from error
        with reserve_port() as listener:
            commit = None
            if shutil.which('git'):
                try:
                    commit = update(root)
                except LaunchError as error:
                    say('Update unavailable: ' + str(error))
            else:
                say('Git is missing. Install Apple Command Line Tools to enable updates. Trying the last complete game.')
            if commit:
                try:
                    folder = export(root, data, commit)
                except (LaunchError, OSError) as error:
                    say('Build failed; previous exports were kept. ' + str(error))
                    folder, commit = last_working(data)
            else:
                folder, commit = last_working(data)
                say('Updates/rebuilding were skipped. Running the last complete installed export.')
            serve(root, folder, commit, listener, args.no_browser)
    return 0


if __name__ == '__main__':
    def stop(signum, frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGHUP, stop)
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        say('\nGame server stopped.'); sys.exit(0)
    except (LaunchError, OSError) as error:
        print('\nCannot launch StarDefenders: ' + str(error), file=sys.stderr)
        sys.exit(1)
