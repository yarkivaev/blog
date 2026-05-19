#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/post-media.sh
source "$SCRIPT_DIR/lib/post-media.sh"

usage() {
  echo "Usage: $0 --bucket NAME --slug SLUG [options]" >&2
  echo "       $0 --bucket NAME --slug SLUG --from-list paths.txt" >&2
  echo "       list-post-media.sh post.md | $0 --bucket NAME --slug SLUG" >&2
  echo "Options:" >&2
  echo "  --from-list FILE   Read absolute paths from file (default: stdin)" >&2
  echo "  --dry-run          Print aws commands without running them" >&2
  echo "  --exclude-mp4      Skip source .mp4 in HLS sync (keeps init.mp4)" >&2
  exit 1
}

BUCKET=""
SLUG=""
FROM_LIST=""
DRY_RUN=0
EXCLUDE_MP4=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bucket)
      [[ $# -lt 2 ]] && usage
      BUCKET="$2"
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
    --dry-run) DRY_RUN=1; shift ;;
    --exclude-mp4) EXCLUDE_MP4=1; shift ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1" >&2; usage ;;
  esac
done

[[ -z "$BUCKET" || -z "$SLUG" ]] && usage

ENDPOINT="${YC_S3_ENDPOINT:-https://storage.yandexcloud.net}"
BASE_PUBLIC="${YC_PUBLIC_BASE_URL:-https://storage.yandexcloud.net/${BUCKET}}"
REPO="$(pm_repo_root)"
MEDIA_ROOT="$(pm_media_root "$REPO" "$SLUG")"

SYNC_FLAGS=(--endpoint-url="$ENDPOINT" --exclude ".DS_Store")
CP_FLAGS=(--endpoint-url="$ENDPOINT")
if [[ "${YC_S3_ACL_PUBLIC:-}" == "1" ]]; then
  SYNC_FLAGS+=(--acl public-read)
  CP_FLAGS+=(--acl public-read)
fi

if [[ -n "$FROM_LIST" ]]; then
  [[ -f "$FROM_LIST" ]] || { echo "List file not found: $FROM_LIST" >&2; exit 1; }
  INPUT_FILE="$FROM_LIST"
elif [[ ! -t 0 ]]; then
  INPUT_FILE="$(mktemp "${TMPDIR:-/tmp}/post-media-upload.XXXXXX")"
  trap 'rm -f "$INPUT_FILE"' EXIT
  cat > "$INPUT_FILE"
else
  echo "Provide --from-list or pipe paths on stdin" >&2
  exit 1
fi

declare -A HLS_SYNCED=()
declare -A FILE_HANDLED=()
HLS_SYNC_COUNT=0
CP_COUNT=0
SKIP_COUNT=0

run_aws() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run] %s\n' "$*"
  else
    "$@"
  fi
}

sync_hls_dir() {
  local dir="$1"
  local rel s3_dest filters=()
  [[ -n "${HLS_SYNCED[$dir]:-}" ]] && return 0
  rel="${dir#${MEDIA_ROOT}/}"
  s3_dest="s3://${BUCKET}/${SLUG}/${rel}/"
  if [[ "$EXCLUDE_MP4" -eq 1 ]]; then
    filters=(--exclude "*.mp4" --include "init.mp4")
  fi
  run_aws aws s3 sync "$dir/" "$s3_dest" "${SYNC_FLAGS[@]}" "${filters[@]}"
  HLS_SYNCED[$dir]=1
  HLS_SYNC_COUNT=$((HLS_SYNC_COUNT + 1))
}

upload_file() {
  local path="$1"
  local key ctype s3_uri
  key="$(pm_s3_key_for "$path" "$REPO" "$SLUG")" || {
    echo "skip (no s3 key): $path" >&2
    SKIP_COUNT=$((SKIP_COUNT + 1))
    return 0
  }
  ctype="$(pm_content_type_for "$path")"
  s3_uri="s3://${BUCKET}/${key}"
  run_aws aws s3 cp "$path" "$s3_uri" "${CP_FLAGS[@]}" --content-type "$ctype"
  CP_COUNT=$((CP_COUNT + 1))
}

while IFS= read -r path || [[ -n "${path:-}" ]]; do
  [[ -z "${path:-}" ]] && continue
  path="${path//$'\r'/}"
  [[ -e "$path" ]] || {
    echo "skip (missing): $path" >&2
    SKIP_COUNT=$((SKIP_COUNT + 1))
    continue
  }
  hls_root=""
  if hls_root="$(pm_hls_root_for_path "$path")"; then
    if [[ -z "${HLS_SYNCED[$hls_root]:-}" ]]; then
      sync_hls_dir "$hls_root"
    fi
    FILE_HANDLED[$path]=1
    continue
  fi
  if [[ -n "${FILE_HANDLED[$path]:-}" ]]; then
    continue
  fi
  upload_file "$path"
  FILE_HANDLED[$path]=1
done < "$INPUT_FILE"

echo "Uploaded: ${CP_COUNT} file(s) via cp, ${HLS_SYNC_COUNT} HLS director(ies) via sync"
if [[ "$SKIP_COUNT" -gt 0 ]]; then
  echo "Skipped: ${SKIP_COUNT}"
fi
echo "Public base: ${BASE_PUBLIC}/${SLUG}/"
if [[ -f "${MEDIA_ROOT}/why_am_i_here/master.m3u8" ]]; then
  echo "Example HLS: ${BASE_PUBLIC}/${SLUG}/why_am_i_here/master.m3u8"
fi
echo "Note: set storage_prefix: yandex in post frontmatter for images; video URLs need full cloud paths or a separate hook"
