#!/usr/bin/env bash
set -euo pipefail

CFG_ROOT="/opt/solr/server/solr/configsets/playground"

create_core_idempotent() {
  local name="$1"
  local conf_dir="$2"
  if /opt/solr/bin/solr create_core -c "${name}" -d "${conf_dir}"; then
    echo "[create-cores] Created core '${name}'."
  else
    echo "[create-cores] Skipped '${name}' (already exists or create failed — check logs if unexpected)."
  fi
}

create_core_idempotent products "${CFG_ROOT}/products"
create_core_idempotent customers "${CFG_ROOT}/customers"
