#!/usr/bin/env bash
# Solr Playground — first boot creates cores + seeds data, then runs Solr in foreground.
#
# Bind-mounting ./var onto /var/solr (see docker-compose.yml) replaces the image tree with an
# empty host directory, so /var/solr/data does not exist and Solr aborts. When running as root,
# recreate the layout, hand ownership to solr, and continue as that user.
if [[ "$(id -u)" -eq 0 ]]; then
  mkdir -p /var/solr/data /var/solr/logs
  if id solr &>/dev/null; then
    chown -R solr:solr /var/solr
  fi
  exec runuser -u solr -- /bin/bash "$0" "$@"
fi

set -euo pipefail

MARKER=/var/solr/.playground_bootstrapped

if [[ ! -f "$MARKER" ]]; then
  echo "[bootstrap] Starting Solr (one-time setup)…"
  /opt/solr/bin/solr start

  # /solr/admin/ping returns 404 until at least one core exists on Solr 9; use a core-agnostic URL.
  for i in $(seq 1 120); do
    if curl -fsS "http://127.0.0.1:8983/solr/admin/info/system" >/dev/null 2>&1; then
      break
    fi
    if [[ "$i" -eq 120 ]]; then
      echo "[bootstrap] Solr did not become ready in time." >&2
      exit 1
    fi
    sleep 1
  done

  bash /bootstrap/01-create-cores.sh
  bash /bootstrap/02-seed-data.sh

  touch "$MARKER"
  echo "[bootstrap] One-time setup complete; restarting Solr in foreground…"
  /opt/solr/bin/solr stop || true
  sleep 3
fi

exec /opt/solr/bin/solr start -f
