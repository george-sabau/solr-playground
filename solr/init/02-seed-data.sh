#!/usr/bin/env bash
set -euo pipefail

echo "[seed] Clearing existing documents (idempotent re-seed on wiped volume)…"
for core in products customers; do
  curl -sS "http://127.0.0.1:8983/solr/${core}/update?commit=true" \
    -H "Content-Type: application/json" \
    --data-binary '{"delete":{"query":"*:*"}}' >/dev/null || true
done

echo "[seed] Posting showcase documents…"
# Avoid bin/post / SimplePostTool (classpath issues on some Solr 9.x images); use the JSON update API.
for core in products customers; do
  curl -fsS "http://127.0.0.1:8983/solr/${core}/update?commit=true" \
    -H "Content-Type: application/json" \
    --data-binary "@/seed-data/${core}.json" >/dev/null
  echo "[seed] Indexed ${core}."
done
