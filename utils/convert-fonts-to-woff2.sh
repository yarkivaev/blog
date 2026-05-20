#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WOFF2="$(command -v woff2_compress || true)"
if [[ -z "$WOFF2" ]]; then
  echo "woff2_compress not found; install with: brew install woff2" >&2
  exit 1
fi
for otf in "$ROOT"/assets/fonts/xcharter/*.otf; do
  [[ -f "$otf" ]] || continue
  woff2_compress "$otf"
done
for otf in "$ROOT"/assets/fonts/Asiana.otf; do
  [[ -f "$otf" ]] || continue
  woff2_compress "$otf"
done
echo "Done. Update _includes/custom-fonts.html if you add new faces."
