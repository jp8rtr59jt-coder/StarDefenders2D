#!/bin/bash
# Permanent Finder entry point; updates/build/server supervision use Python stdlib.
set -u
fail() {
    printf '\n%s\n' "$1" >&2
    if [ -t 0 ]; then read -r -p 'Press Return to close. '; fi
    exit 1
}
command -v python3 >/dev/null 2>&1 || fail 'Python 3.9+ is required. Install Python 3 from python.org, then double-click this launcher again.'
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3,9) else 1)' || fail 'A working Python 3.9+ installation is required. No game files were changed.'
launcher_path="$0"
links=0
while [ -L "$launcher_path" ]; do
    links=$((links + 1))
    [ "$links" -lt 40 ] || fail 'The launcher symlink chain is invalid.'
    parent_dir="$(cd -- "$(dirname -- "$launcher_path")" && pwd -P)" || fail 'Cannot find the launcher folder.'
    launcher_path="$(readlink "$launcher_path")"
    case "$launcher_path" in /*) ;; *) launcher_path="$parent_dir/$launcher_path" ;; esac
done
install_dir="$(cd -- "$(dirname -- "$launcher_path")" && pwd -P)" || fail 'Cannot find the installation folder.'
# A copied desktop launcher can still find the standard installation. Finder
# aliases/symlinks also work; no dependence on Terminal's current directory.
if [ ! -f "$install_dir/offline/playtest.py" ]; then install_dir="$HOME/Games/StarDefenders2D"; fi
[ -f "$install_dir/offline/playtest.py" ] || fail 'Installation not found. Run Install StarDefenders.command once.'
python3 "$install_dir/offline/playtest.py" "$@"
result=$?
if [ "$result" -ne 0 ] && [ -t 0 ]; then read -r -p 'Launch failed. Press Return to close. '; fi
exit "$result"
