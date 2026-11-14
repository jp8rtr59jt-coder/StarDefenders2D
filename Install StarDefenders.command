#!/bin/bash
# One-time bootstrap. Only the explicitly approved public GitHub branch is cloned.
set -u
repository='https://github.com/jp8rtr59jt-coder/StarDefenders2D.git'
destination="$HOME/Games/StarDefenders2D"
launch=1
fail() {
    printf '\nInstallation stopped: %s\n' "$1" >&2
    if [ -t 0 ]; then read -r -p 'Press Return to close. '; fi
    exit 1
}
while [ "$#" -gt 0 ]; do
    case "$1" in
        --no-launch) launch=0; shift ;;
        --destination) [ "$#" -gt 1 ] || fail 'Missing destination.'; destination="$2"; shift 2 ;;
        *) fail "Unknown option: $1" ;;
    esac
done
command -v git >/dev/null 2>&1 || fail 'Git is required. Install Apple Command Line Tools (xcode-select --install), then try again.'
git --version >/dev/null 2>&1 || fail 'Git is not ready. Complete the Apple Command Line Tools installation, then try again.'
command -v python3 >/dev/null 2>&1 || fail 'Python 3.9+ is required. Install Python 3 from python.org, then try again.'
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3,9) else 1)' || fail 'A working Python 3.9+ installation is required.'
destination="$(python3 -c 'import os,sys; print(os.path.abspath(os.path.expanduser(sys.argv[1])))' "$destination")" || fail 'Invalid installation path.'
parent_dir="$(dirname -- "$destination")"
mkdir -p -- "$parent_dir" || fail 'Cannot create your Games folder. No administrator privileges are needed by this installer.'
temporary=''
cleanup() { if [ -n "$temporary" ] && [ -d "$temporary" ]; then rm -rf -- "$temporary"; fi; }
trap cleanup EXIT
trap 'exit 130' INT TERM
if [ -e "$destination" ]; then
    [ -d "$destination/.git" ] || fail "An unrelated folder already exists at $destination. It was not changed. Choose another destination."
    branch="$(git -C "$destination" branch --show-current)" || fail 'Cannot read the existing checkout.'
    origin="$(git -C "$destination" config --get remote.origin.url)" || fail 'Cannot verify the existing repository.'
    [ "$branch" = 'playtest' ] && [ "$origin" = "$repository" ] || fail 'The existing folder is not the intended playtest installation. It was not changed.'
    printf 'Existing playtest installation found; no files were replaced.\n'
else
    temporary="$(mktemp -d "$parent_dir/.StarDefenders-install.XXXXXX")" || fail 'Cannot create a temporary installation folder.'
    printf 'Installing the approved playtest from GitHub…\n'
    GIT_TERMINAL_PROMPT=0 GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null \
        git -c credential.helper= -c core.hooksPath=/dev/null clone --depth 1 --single-branch --branch playtest -- \
        "$repository" "$temporary/game" || fail 'GitHub could not be reached or playtest could not be cloned. No existing installation was changed.'
    [ -f "$temporary/game/Play StarDefenders.command" ] && [ -f "$temporary/game/offline/playtest.py" ] || fail 'The approved branch does not contain the launcher.'
    python3 - "$temporary/game" "$destination" <<'PY' || fail 'The installation destination became occupied; existing files were not replaced.'
import os,sys
if os.path.lexists(sys.argv[2]):
    raise SystemExit('Destination already exists')
os.rename(sys.argv[1], sys.argv[2])
PY
fi
[ -f "$destination/Play StarDefenders.command" ] || fail 'The permanent launcher is missing from this checkout.'
chmod +x "$destination/Play StarDefenders.command" || fail 'Cannot set launcher executable permission.'
printf '\nInstalled at: %s\nFrom now on, double-click Play StarDefenders.command in that folder.\n' "$destination"
if [ "$launch" -eq 1 ]; then
    if [ "$(uname -s)" = 'Darwin' ]; then
        /usr/bin/open "$destination/Play StarDefenders.command" || fail 'Finder could not open the permanent launcher. Open it from your Games folder.'
    else
        printf 'Automatic Finder opening is available on macOS. Run the permanent launcher manually for developer testing.\n'
    fi
fi
