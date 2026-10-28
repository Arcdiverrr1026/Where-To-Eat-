#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_root"
target="${WTE_SSH_TARGET:-lucent@20.48.103.233}"
key="${WTE_SSH_KEY:-$HOME/Documents/lucent-azure_key.pem}"
ssh_options=(-i "$key" -o BatchMode=yes -o ConnectTimeout=15)
if [[ "$(uname -s)" == Darwin && "${WTE_DIRECT:-1}" == 1 ]]; then
  ssh_options+=(-o "ProxyCommand=python3 '$project_root/deploy/ssh-direct-proxy.py' %h %p")
fi
if [[ ! -f .env.remote ]]; then
  echo 'Missing .env.remote (remote database/account secrets and AMap key).' >&2
  exit 1
fi
# Only deploy application source and build configuration, never local node_modules/data.
ssh "${ssh_options[@]}" "$target" 'sudo -n install -d -m 755 -o lucent -g lucent /srv/where_to_eat'
COPYFILE_DISABLE=1 tar -czf - package.json package-lock.json backend frontend/src frontend/index.html frontend/package.json frontend/vite.config.js frontend/Dockerfile frontend/nginx.conf compose.yaml compose.server.yaml .dockerignore deploy/where_to_eat.nginx.conf |
  ssh "${ssh_options[@]}" "$target" 'tar -xzf - -C /srv/where_to_eat'
# SSH encrypts the secret transfer. Do not echo the file or interpolate keys in commands.
ssh "${ssh_options[@]}" "$target" 'umask 077; cat > /srv/where_to_eat/.env' < .env.remote
ssh "${ssh_options[@]}" "$target" 'set -eu
  cd /srv/where_to_eat
  sudo -n docker compose -f compose.yaml -f compose.server.yaml up -d --build --wait --wait-timeout 180
  sudo -n install -m 644 deploy/where_to_eat.nginx.conf /etc/nginx/snippets/where_to_eat.conf
  sudo -n python3 - <<"PY"
from pathlib import Path
from datetime import datetime
path=Path("/etc/nginx/sites-available/default")
text=path.read_text()
include="    include /etc/nginx/snippets/where_to_eat.conf;"
if include not in text:
    anchor="    include /etc/nginx/snippets/fso-notes.conf;"
    if anchor not in text:
        raise SystemExit("Expected existing nginx include not found; config unchanged")
    backup=path.with_name("default.wte-backup-"+datetime.now().strftime("%Y%m%d%H%M%S"))
    backup.write_text(text)
    path.write_text(text.replace(anchor, anchor+"\n"+include,1))
PY
  sudo -n nginx -t
  sudo -n systemctl reload nginx
  sudo -n docker compose -f compose.yaml -f compose.server.yaml ps
'
