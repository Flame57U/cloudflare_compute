#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -d venv ]; then
  python3 -m venv venv
  ./venv/bin/pip install --upgrade pip
  ./venv/bin/pip install -r requirements.txt
fi
export OBSIDIAN_VAULT_PATH="${OBSIDIAN_VAULT_PATH:-/root/obsidian-vault}"
exec ./venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8765
