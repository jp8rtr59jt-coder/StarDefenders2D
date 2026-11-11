#!/bin/bash
cd -- "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
    echo 'Python 3 is required. Install it from python.org, then run this launcher again.'
    read -r -p 'Press Return to close.'
    exit 1
fi
python3 offline/launch.py
