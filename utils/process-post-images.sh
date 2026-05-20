#!/opt/homebrew/bin/bash
set -euo pipefail

export PATH="/opt/homebrew/bin:${PATH:-/usr/bin:/bin:/usr/sbin:/sbin}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/post-media.sh
source "$SCRIPT_DIR/lib/post-media.sh"
# shellcheck source=lib/image-derivatives.sh
source "$SCRIPT_DIR/lib/image-derivatives.sh"

usage() {
  echo "Usage: $0 [options]" >&2
  echo "       list-post-media.sh post.md | $0 --post post.md" >&2
  echo "       $0 --slug SLUG --from-list paths.txt" >&2
  echo "Options:" >&2
  echo "  --post PATH        Derive slug from post filename" >&2
  echo "  --slug SLUG        Media slug (travel/<slug>/)" >&2
  echo "  --from-list FILE   Read absolute paths from file (default: stdin)" >&2
  echo "  --force            Rebuild even when outputs are newer" >&2
  echo "  --dry-run          Print actions without writing files" >&2
  echo "  --sizes LIST       Comma-separated long edges (default: 1400,2400)" >&2
  echo "  --lqip-width N     LQIP width in px (default: 32)" >&2
  exit 1
}

POST=""
SLUG=""
FROM_LIST=""
FORCE=0
DRY_RUN=0
SIZES="1400,2400"
LQIP_WIDTH=32

while [[ $# -gt 0 ]]; do
  case "$1" in
    --post)
      [[ $# -lt 2 ]] && usage
      POST="$2"
      shift 2
      ;;
    --slug)
      [[ $# -lt 2 ]] && usage
      SLUG="$2"
      shift 2
      ;;
    --from-list)
      [[ $# -lt 2 ]] && usage
      FROM_LIST="$2"
      shift 2
      ;;
    --force) FORCE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --sizes)
      [[ $# -lt 2 ]] && usage
      SIZES="$2"
      shift 2
      ;;
    --lqip-width)
      [[ $# -lt 2 ]] && usage
      LQIP_WIDTH="$2"
      shift 2
      ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1" >&2; usage ;;
  esac
done

if [[ -n "$POST" ]]; then
  [[ -f "$POST" ]] || { echo "Post file not found: $POST" >&2; exit 1; }
  SLUG="$(pm_slug_from_post "$POST")" || exit 1
fi

[[ -z "$SLUG" ]] && usage

REPO="$(pm_repo_root)"
MEDIA_ROOT="$(pm_media_root "$REPO" "$SLUG")"
DERIVED_ROOT="${MEDIA_ROOT}/derived"

if [[ ! -d "$MEDIA_ROOT" ]]; then
  echo "media directory not found: $MEDIA_ROOT" >&2
  exit 1
fi

if [[ -n "$FROM_LIST" ]]; then
  [[ -f "$FROM_LIST" ]] || { echo "List file not found: $FROM_LIST" >&2; exit 1; }
  id_filter_raster_paths < "$FROM_LIST" | id_process_paths \
    "$MEDIA_ROOT" "$DERIVED_ROOT" "$SIZES" "$LQIP_WIDTH" "$FORCE" "$DRY_RUN"
elif [[ ! -t 0 ]]; then
  id_filter_raster_paths | id_process_paths \
    "$MEDIA_ROOT" "$DERIVED_ROOT" "$SIZES" "$LQIP_WIDTH" "$FORCE" "$DRY_RUN"
else
  echo "Provide --from-list or pipe paths on stdin" >&2
  exit 1
fi
