#!/opt/homebrew/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/post-media.sh
source "$SCRIPT_DIR/lib/post-media.sh"

usage() {
  echo "Usage: $0 [options] <post.md>" >&2
  echo "Options:" >&2
  echo "  --check          Report missing files on stderr; exit 1 if any missing" >&2
  echo "  --relative       Print paths relative to travel/<slug>/" >&2
  echo "  --exclude-mp4    Omit source .mp4 files when expanding HLS directories" >&2
  echo "  --prefix P       Only paths under travel/<slug>/ matching P (subdir or file;" >&2
  echo "                   repeat for multiple prefixes)" >&2
  echo "  -o, --output F   Write list to file instead of stdout" >&2
  exit 1
}

CHECK=0
RELATIVE=0
EXCLUDE_MP4=0
OUTPUT=""
POST=""
PM_PREFIXES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check) CHECK=1; shift ;;
    --relative) RELATIVE=1; shift ;;
    --exclude-mp4) EXCLUDE_MP4=1; shift ;;
    --prefix)
      [[ $# -lt 2 ]] && usage
      PM_PREFIXES+=("$2")
      shift 2
      ;;
    -o|--output)
      [[ $# -lt 2 ]] && usage
      OUTPUT="$2"
      shift 2
      ;;
    -h|--help) usage ;;
    --) shift; break ;;
    -*) echo "Unknown option: $1" >&2; usage ;;
    *)
      if [[ -z "$POST" ]]; then
        POST="$1"
        shift
      else
        echo "Unexpected argument: $1" >&2
        usage
      fi
      ;;
  esac
done

[[ -z "$POST" ]] && usage
[[ -f "$POST" ]] || { echo "Post file not found: $POST" >&2; exit 1; }

run_list() {
  pm_list_media "$POST" "$CHECK" "$RELATIVE" "$EXCLUDE_MP4"
}

if [[ -n "$OUTPUT" ]]; then
  run_list > "$OUTPUT"
else
  run_list
fi
