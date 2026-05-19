#!/usr/bin/env bash
set -euo pipefail

# if [[ "${1:-}" == "" || "${2:-}" == "" ]]; then
#   echo "Usage: $0 <input_mp4> <assets_subdir>" >&2
#   echo "Example: $0 ~/Downloads/clip.mp4 test-doc-2026-05-09" >&2
#   echo "Writes HLS under assets/hls/<subdir>/ (master.m3u8, segments, poster.jpg)" >&2
#   exit 1
# fi

SUBDIR="${1#/}"
NAME="${2:-$SUBDIR}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INPUT="${ROOT}/travel/italy/${SUBDIR}/${NAME}.mp4"
OUT="${ROOT}/travel/italy/${SUBDIR}"

mkdir -p "$OUT"
(
  cd "$OUT"
  ffmpeg -y -i "$INPUT" \
    -c:v libx264 -profile:v high -pix_fmt yuv420p \
    -c:a aac -ar 48000 -b:a 128k \
    -hls_time 6 -hls_playlist_type vod \
    -hls_segment_type fmp4 \
    -hls_fmp4_init_filename init.mp4 \
    -hls_segment_filename 'segment_%03d.m4s' \
    -master_pl_name master.m3u8 \
    -f hls "stream.m3u8"
  ffmpeg -y -ss ${3:-0} -i "$INPUT" -frames:v 1 -update 1 -q:v 2 "poster.jpg"
)

echo "Done: ${OUT}/master.m3u8"
