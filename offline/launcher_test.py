#!/usr/bin/env python3
"""Launcher reliability tests. Real Git and HTTP, isolated approved-repo fixtures."""
import importlib.util
import json
import os
import pty
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
import urllib.request

SOURCE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('playtest', SOURCE / 'offline/playtest.py')
app = importlib.util.module_from_spec(spec); spec.loader.exec_module(app)
GIT = shutil.which('git')
REPORT = {'tests': [], 'platform': sys.platform, 'nativeMacOSTested': False}
FIXTURE_BUILD = '''import argparse,json,shutil
from pathlib import Path
def build(output=None,playtest=False):
 root=Path(__file__).resolve().parents[1];out=Path(output);out.mkdir(exist_ok=True)
 counter=root/'.playtest/count';counter.write_text(str(int(counter.read_text())+1) if counter.exists() else '1')
 for name in {required!r}:
  f=out/name;f.parent.mkdir(parents=True,exist_ok=True);f.write_text('fixture export')
 shutil.copy2(root/'offline/launch.py',out/'offline-source/launch.py')
 (out/'version.txt').write_text((root/'version.txt').read_text())
 return out
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output');p.add_argument('--playtest',action='store_true');a=p.parse_args();build(a.output,a.playtest)
'''.format(required=app.REQUIRED)


def real_git(root, *args):
    env = dict(os.environ, GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL=os.devnull)
    return subprocess.check_output([GIT, '-c', 'core.hooksPath=/dev/null', '-C', str(root), *args],
                                   env=env, text=True, stderr=subprocess.PIPE).strip()


def free_port():
    with socket.socket() as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1); s.bind((app.HOST, app.PORT))


class Workflow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        free_port()  # Refuse to touch any unrelated listener, including older games.
        cls.temp = tempfile.TemporaryDirectory(prefix='star defenders launcher ')
        cls.base = Path(cls.temp.name); cls.upstream = cls.base / 'approved source'
        cls.upstream.mkdir(); real_git(cls.upstream, 'init', '-b', 'playtest')
        real_git(cls.upstream, 'config', 'user.name', 'Launcher test')
        real_git(cls.upstream, 'config', 'user.email', 'launcher-test@example.invalid')
        (cls.upstream / 'offline').mkdir()
        for name in ['playtest.py', 'launch.py']:
            shutil.copy2(SOURCE / 'offline' / name, cls.upstream / 'offline' / name)
        for name in ['Play StarDefenders.command', 'Install StarDefenders.command']:
            shutil.copy2(SOURCE / name, cls.upstream / name)
        (cls.upstream / '.gitignore').write_text('.playtest/\n')
        (cls.upstream / 'version.txt').write_text('v1')
        (cls.upstream / 'offline/build.py').write_text(FIXTURE_BUILD)
        real_git(cls.upstream, 'add', '.'); real_git(cls.upstream, 'commit', '-m', 'Approved fixture v1')
        cls.v1 = real_git(cls.upstream, 'rev-parse', 'HEAD')
        cls.remote = cls.base / 'approved.git'
        subprocess.run([GIT, 'clone', '--bare', str(cls.upstream), str(cls.remote)], check=True,
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        cls.bin = cls.base / 'tools'; cls.bin.mkdir()
        cls.log = cls.base / 'git-calls.jsonl'
        # Production still requests only the canonical HTTPS URL. This test-only
        # executable records it, then maps it to a private real Git fixture.
        wrapper = '''#!{python}
import json,os,subprocess,sys,time
args=sys.argv[1:]
with open(os.environ['TEST_GIT_LOG'],'a') as f:f.write(json.dumps(args)+'\\n')
if os.environ.get('TEST_OFFLINE') and ('fetch' in args or 'clone' in args):
 print('GitHub unreachable (controlled test)',file=sys.stderr);sys.exit(128)
if os.environ.get('TEST_SLEEP') and 'fetch' in args:time.sleep(5)
mapped=[('file://'+os.environ['TEST_REMOTE']) if x=={url!r} else ('protocol.file.allow=always' if x=='protocol.file.allow=never' else x) for x in args]
r=subprocess.run([{git!r},*mapped])
if 'clone' in args and r.returncode==0:
 subprocess.run([{git!r},'-C',args[-1],'config','remote.origin.url',{url!r}],check=True)
sys.exit(r.returncode)
'''.format(python=sys.executable, url=app.REMOTE, git=GIT)
        (cls.bin / 'git').write_text(wrapper); (cls.bin / 'git').chmod(0o755)
        (cls.bin / 'python3').symlink_to(sys.executable)
        cls.env = dict(os.environ, PATH=str(cls.bin) + os.pathsep + os.defpath,
                       TEST_GIT_LOG=str(cls.log), TEST_REMOTE=str(cls.remote))
        cls.install = cls.base / 'Games with spaces' / 'StarDefenders2D'

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def note(self, name, **data):
        REPORT['tests'].append({'name': name, **data})

    def run_installer(self, dest=None, env=None):
        return subprocess.run(['/bin/bash', str(SOURCE / 'Install StarDefenders.command'),
                               '--no-launch', '--destination', str(dest or self.install)],
                              env=env or self.env, text=True, stdout=subprocess.PIPE,
                              stderr=subprocess.STDOUT, timeout=30)

    def run_game(self, commit, env=None):
        log = self.base / ('run-' + str(time.monotonic_ns()) + '.log')
        handle = log.open('w')
        p = subprocess.Popen([sys.executable, str(self.install / 'offline/playtest.py'), '--no-browser'],
                             env=env or self.env, stdout=handle, stderr=subprocess.STDOUT)
        deadline = time.monotonic() + 20
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        while time.monotonic() < deadline:
            if p.poll() is not None:
                handle.close(); self.fail(log.read_text())
            try:
                with opener.open('http://127.0.0.1:8001/playtest-version.json', timeout=.3) as q:
                    meta = json.load(q)
                    if meta['commit'] == commit:
                        self.assertEqual(meta['repository'], app.REMOTE)
                        self.assertEqual(q.headers['Cache-Control'], 'no-store')
                        return p, handle, log
            except OSError:
                pass
            time.sleep(.05)
        self.stop_game((p, handle, log)); self.fail('No matching ready game: ' + log.read_text())

    def stop_game(self, running, signum=signal.SIGINT):
        p, handle, log = running
        p.send_signal(signum)
        code = p.wait(timeout=8); handle.close()
        self.assertEqual(code, 0, log.read_text()); free_port()
        return log.read_text()

    def advance(self, version, broken=False):
        (self.upstream / 'version.txt').write_text(version)
        (self.upstream / 'offline/build.py').write_text(
            "import sys\nfrom pathlib import Path\np=Path(sys.argv[sys.argv.index('--output')+1]);(p/'index.html').write_text('partial')\nsys.exit(1)\n"
            if broken else FIXTURE_BUILD)
        if broken:
            (self.upstream / 'offline/launch.py').write_text("raise SystemExit('new server broken')\n")
        else:
            shutil.copy2(SOURCE / 'offline/launch.py', self.upstream / 'offline/launch.py')
        real_git(self.upstream, 'add', '.'); real_git(self.upstream, 'commit', '-m', 'Approved ' + version)
        real_git(self.upstream, 'push', str(self.remote), 'playtest')
        return real_git(self.upstream, 'rev-parse', 'HEAD')

    def test_01_install_and_updates(self):
        installed = self.run_installer()
        self.assertEqual(installed.returncode, 0, installed.stdout)
        self.assertEqual(real_git(self.install, 'branch', '--show-current'), 'playtest')
        self.assertTrue(os.access(self.install / 'Play StarDefenders.command', os.X_OK))
        self.note('Initial installation', pathHasSpaces=True, branch='playtest')
        first = self.run_game(self.v1)
        request = urllib.request.Request('http://127.0.0.1:8001/version.txt',
                                         headers={'If-Modified-Since': 'Wed, 31 Dec 2099 23:59:59 GMT'})
        with urllib.request.urlopen(request) as q:
            self.assertEqual(q.status, 200); self.assertEqual(q.read(), b'v1')
        # The lock refuses a second instance; it never opens an outdated server.
        second = subprocess.run([sys.executable, str(self.install / 'offline/playtest.py'), '--no-browser'],
                                env=self.env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        self.assertNotEqual(second.returncode, 0); self.assertIn('already running', second.stdout)
        output = self.stop_game(first)
        self.assertIn(app.URL, output); self.assertIn('Up to date', output)
        self.assertEqual((self.install / '.playtest/count').read_text(), '1')
        self.note('First launch, fixed address, fresh assets, duplicate refusal and clean stop')
        output = self.stop_game(self.run_game(self.v1))
        self.assertIn('cached export', output)
        self.assertEqual((self.install / '.playtest/count').read_text(), '1')
        self.note('Subsequent launch checks GitHub without rebuilding unchanged files')
        hook = self.install / '.git/hooks/post-merge'; sentinel = self.base / 'hook-ran'
        hook.write_text('#!/bin/sh\ntouch "' + str(sentinel) + '"\n'); hook.chmod(0o755)
        v2 = self.advance('v2')
        self.stop_game(self.run_game(v2))
        self.assertEqual(real_git(self.install, 'rev-parse', 'HEAD'), v2)
        self.assertFalse(sentinel.exists())
        self.assertEqual((self.install / '.playtest/count').read_text(), '2')
        self.note('New approved commit fetched and fast-forwarded; local hook not run')
        output = self.stop_game(self.run_game(v2, dict(self.env, TEST_OFFLINE='1')))
        self.assertIn('Update check failed', output)
        self.note('GitHub failure/offline launch retains complete installed version')
        v3 = self.advance('v3', broken=True)
        (self.install / 'version.txt').write_text('my uncommitted changes')
        calls = len(self.log.read_text().splitlines())
        output = self.stop_game(self.run_game(v2))
        self.assertIn('Local changes detected', output)
        self.assertEqual((self.install / 'version.txt').read_text(), 'my uncommitted changes')
        later = [json.loads(x) for x in self.log.read_text().splitlines()[calls:]]
        self.assertFalse(any('fetch' in x or 'merge' in x for x in later))
        self.assertEqual(real_git(self.install, 'rev-parse', 'HEAD'), v2)
        self.note('Local tracked edits prevent fetch/update/rebuild and remain unchanged')
        (self.install / 'version.txt').write_text('v2')  # Restore this owned fixture, never the user's checkout.
        untracked = self.install / 'local-notes.txt'; untracked.write_text('keep my notes')
        output = self.stop_game(self.run_game(v2))
        self.assertIn('Local changes detected', output); self.assertEqual(untracked.read_text(), 'keep my notes')
        untracked.unlink()
        self.note('Untracked local files also prevent updates and remain intact')
        output = self.stop_game(self.run_game(v2))
        self.assertIn('Build failed', output)
        self.assertEqual(real_git(self.install, 'rev-parse', 'HEAD'), v3)
        self.assertFalse((self.install / '.playtest/exports' / v3).exists())
        self.assertFalse(list((self.install / '.playtest/exports').glob('.building-*')))
        self.note('Failed partial exporter and broken new server cannot replace cached working game/server')
        v4 = self.advance('v4')
        self.stop_game(self.run_game(v4), signal.SIGTERM)
        self.assertEqual(sorted(p.name for p in (self.install / '.playtest/exports').iterdir()), sorted([v2, v4]))
        self.note('Later approved version recovers, retains one rollback, SIGTERM leaves port free')
        no_git = self.base / 'without git'; no_git.mkdir(); (no_git / 'python3').symlink_to(sys.executable)
        output = self.stop_game(self.run_game(v4, dict(self.env, PATH=str(no_git))))
        self.assertIn('Git is missing', output)
        self.note('Missing Git reports problem and uses verified cached export')
        # A feature checkout and unapproved local commits cannot silently become playtests.
        real_git(self.install, 'switch', '-c', 'local-feature')
        output = self.stop_game(self.run_game(v4))
        self.assertIn('only runs the approved playtest checkout', output)
        self.assertEqual(real_git(self.install, 'branch', '--show-current'), 'local-feature')
        real_git(self.install, 'switch', 'playtest')
        real_git(self.install, 'config', 'user.name', 'Local fixture')
        real_git(self.install, 'config', 'user.email', 'local@example.invalid')
        (self.install / 'version.txt').write_text('unapproved local commit')
        real_git(self.install, 'add', 'version.txt'); real_git(self.install, 'commit', '-m', 'Local work')
        local_head = real_git(self.install, 'rev-parse', 'HEAD')
        v5 = self.advance('v5')
        output = self.stop_game(self.run_game(v4))
        self.assertIn('diverges', output)
        self.assertEqual(real_git(self.install, 'rev-parse', 'HEAD'), local_head)
        self.note('Wrong branch/divergent local history preserved; only last approved cache runs')
        calls = [json.loads(x) for x in self.log.read_text().splitlines()]
        for args in calls:
            if 'fetch' in args:
                self.assertIn(app.REMOTE, args)
                self.assertIn('refs/heads/playtest:' + app.REF, args)
                self.assertNotIn('--force', args)
        self.assertFalse(any('reset' in args or 'checkout' in args or 'stash' in args for args in calls))
        self.note('Updater uses only intended repository/ref, no force/reset/checkout/stash')
        before = time.monotonic()
        with patch.dict(os.environ, dict(self.env, TEST_SLEEP='1')):
            with self.assertRaisesRegex(app.LaunchError, 'timed out'):
                app.git(self.install, 'fetch', app.REMOTE, timeout=.1)
        self.assertLess(time.monotonic() - before, 3)
        self.note('Hung Git fetch times out and is terminated')
        desktop = self.base / 'Desktop'; desktop.mkdir()
        link = desktop / 'Game alias.command'; link.symlink_to(self.install / 'Play StarDefenders.command')
        status = subprocess.run(['/bin/bash', str(link), '--status'], cwd='/', env=self.env,
                                text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        self.assertEqual(status.returncode, 0, status.stdout); self.assertIn(v4, status.stdout)
        self.assertIn(app.URL, status.stdout)
        home = self.base / 'custom home'; (home / 'Games').mkdir(parents=True)
        (home / 'Games/StarDefenders2D').symlink_to(self.install, target_is_directory=True)
        copied = desktop / 'Copied Game.command'; shutil.copy2(SOURCE / 'Play StarDefenders.command', copied)
        status = subprocess.run(['/bin/bash', str(copied), '--status'], cwd='/', env=dict(self.env, HOME=str(home)),
                                text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        self.assertEqual(status.returncode, 0, status.stdout); self.assertIn(v4, status.stdout)
        self.note('Version status, symlink, desktop copy and arbitrary working directory locate the install')

    def test_02_failures(self):
        unrelated = self.base / 'unrelated'; unrelated.mkdir(); (unrelated / 'keep').write_text('keep')
        failure = self.run_installer(unrelated)
        self.assertNotEqual(failure.returncode, 0); self.assertEqual((unrelated / 'keep').read_text(), 'keep')
        fail_dest = self.base / 'offline install'
        failure = self.run_installer(fail_dest, dict(self.env, TEST_OFFLINE='1'))
        self.assertNotEqual(failure.returncode, 0); self.assertFalse(fail_dest.exists())
        self.assertFalse(list(self.base.glob('.StarDefenders-install.*')))
        self.note('Installer preserves unrelated folder and cleans failed clone')
        empty = self.base / 'empty-tools'; empty.mkdir()
        env = dict(self.env, PATH=str(empty))
        failure = subprocess.run(['/bin/bash', str(SOURCE / 'Play StarDefenders.command')], env=env,
                                 text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        self.assertNotEqual(failure.returncode, 0); self.assertIn('Python 3.9+', failure.stdout)
        master, slave = pty.openpty()
        paused = subprocess.Popen(['/bin/bash', str(SOURCE / 'Play StarDefenders.command')],
                                  env=env, stdin=slave, stdout=slave, stderr=slave)
        os.close(slave); output = b''
        while b'Press Return' not in output:
            output += os.read(master, 4096)
        self.assertIsNone(paused.poll()); os.write(master, b'\n')
        self.assertEqual(paused.wait(timeout=3), 1); os.close(master)
        failure = self.run_installer(self.base / 'missing git', env)
        self.assertNotEqual(failure.returncode, 0); self.assertIn('Git is required', failure.stdout)
        self.note('Missing Python/initial Git give actionable errors; a real PTY error remains open until Return')
        with socket.socket() as conflict:
            conflict.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            conflict.bind((app.HOST, app.PORT)); conflict.listen()
            failure = subprocess.run([sys.executable, str(self.install / 'offline/playtest.py'), '--no-browser'],
                                     env=self.env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            self.assertNotEqual(failure.returncode, 0); self.assertIn('Port 8001 is already occupied', failure.stdout)
            conflict.setblocking(False)
            with self.assertRaises(BlockingIOError):
                conflict.accept()
        self.note('Unrelated occupied port refused before network/update/browser; not killed or probed')


class BrowserAndSafety(unittest.TestCase):
    def test_failed_browser_or_readiness_stops_child(self):
        for point in ['wait_ready', 'open_chrome']:
            with patch.object(app.subprocess, 'Popen') as popen, patch.object(app, 'wait_ready'), patch.object(app, 'open_chrome'):
                child = popen.return_value; child.poll.return_value = None; child.wait.return_value = 0
                getattr(app, point).side_effect = app.LaunchError('controlled failure')
                listener = unittest.mock.Mock(); listener.fileno.return_value = 7
                with self.assertRaises(app.LaunchError):
                    app.serve(SOURCE, SOURCE, 'a' * 40, listener, False)
                child.terminate.assert_called_once()
                if point == 'wait_ready':
                    app.open_chrome.assert_not_called()
        REPORT['tests'].append({'name': 'Readiness/Chrome failure always stops supervised server; no premature browser'})

    def test_invalid_cache_pointer(self):
        with tempfile.TemporaryDirectory() as folder:
            data = Path(folder)
            for payload in [[], None, {'commit': None}, {'commit': '../wrong'}]:
                (data / 'current.json').write_text(json.dumps(payload))
                self.assertEqual(app.read_state(data), {})
        REPORT['tests'].append({'name': 'Invalid cache metadata is refused without using arbitrary paths'})

    def test_chrome(self):
        with patch.object(app.sys, 'platform', 'darwin'), patch.object(app.subprocess, 'run') as run:
            run.return_value = subprocess.CompletedProcess([], 0, '', '')
            app.open_chrome()
            self.assertEqual(run.call_args.args[0], ['/usr/bin/open', '-a', 'Google Chrome', app.URL])
            run.return_value = subprocess.CompletedProcess([], 1, '', 'not found')
            with self.assertRaisesRegex(app.LaunchError, 'Chrome could not be opened'):
                app.open_chrome()
        REPORT['tests'].append({'name': 'macOS Chrome command and missing-Chrome errors (mocked, not native Finder)'})

    def test_readiness_before_browser(self):
        events = []
        with patch.object(app.subprocess, 'Popen') as popen, patch.object(app, 'wait_ready', side_effect=lambda *x: events.append('ready')), patch.object(app, 'open_chrome', side_effect=lambda: events.append('chrome')):
            child = popen.return_value; child.wait.return_value = 0; child.poll.return_value = 0
            listener = unittest.mock.Mock(); listener.fileno.return_value = 7
            app.serve(SOURCE, SOURCE, 'a' * 40, listener, False)
        self.assertEqual(events, ['ready', 'chrome'])
        REPORT['tests'].append({'name': 'Verified readiness precedes Chrome opening'})

    def test_custom_export_does_not_delete_files(self):
        with tempfile.TemporaryDirectory() as folder:
            keep = Path(folder) / 'keep'; keep.write_text('keep')
            result = subprocess.run([sys.executable, str(SOURCE / 'offline/build.py'), '--output', folder],
                                    text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            self.assertNotEqual(result.returncode, 0); self.assertEqual(keep.read_text(), 'keep')
        REPORT['tests'].append({'name': 'Exporter refuses nonempty custom output; existing files preserved'})


if __name__ == '__main__':
    suite = unittest.TestSuite([unittest.defaultTestLoader.loadTestsFromTestCase(Workflow),
                               unittest.defaultTestLoader.loadTestsFromTestCase(BrowserAndSafety)])
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    REPORT.update(passed=result.wasSuccessful(), testMethods=result.testsRun,
                  failures=[text for _, text in result.failures + result.errors])
    output = Path(os.environ.get('LAUNCHER_TEST_OUTPUT', 'docs/macos-launcher/validation.json'))
    output.parent.mkdir(parents=True, exist_ok=True); output.write_text(json.dumps(REPORT, indent=2) + '\n')
    raise SystemExit(0 if result.wasSuccessful() else 1)
