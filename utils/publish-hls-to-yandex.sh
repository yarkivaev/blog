#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "" || "${2:-}" == "" || "${3:-}" == "" ]]; then
  echo "Usage: $0 <input_video> <s3_bucket> <object_prefix>" >&2
  echo "Example: $0 clip.mp4 my-bucket video/2026/trip/clip1/" >&2
  echo "Requires: ffmpeg, aws CLI (aws configure s3 with endpoint), AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY" >&2
  exit 1
fi

INPUT="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
BUCKET="$2"
PREFIX="${3#/}"
LAST="${PREFIX: -1}"
if [[ "$LAST" != "/" ]]; then
  PREFIX="${PREFIX}/"
fi

ENDPOINT="${YC_S3_ENDPOINT:-https://storage.yandexcloud.net}"

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/hls-publish.XXXXXX")"
cleanup() {
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

(
  cd "$WORKDIR"
  ffmpeg -y -i "$INPUT" \
    -c:v libx264 -profile:v high -pix_fmt yuv420p \
    -c:a aac -ar 48000 -b:a 128k \
    -hls_time 6 -hls_playlist_type vod \
    -hls_segment_type fmp4 \
    -hls_fmp4_init_filename init.mp4 \
    -hls_segment_filename 'segment_%03d.m4s' \
    -master_pl_name master.m3u8 \
    -f hls "stream.m3u8"
  ffmpeg -y -ss 1 -i "$INPUT" -frames:v 1 -update 1 -q:v 2 "poster.jpg"
)

SYNC_FLAGS=(--endpoint-url="$ENDPOINT" --exclude ".DS_Store")
if [[ "${YC_S3_ACL_PUBLIC:-}" == "1" ]]; then
  SYNC_FLAGS+=(--acl public-read)
fi
aws s3 sync "$WORKDIR" "s3://${BUCKET}/${PREFIX}" "${SYNC_FLAGS[@]}"

BASE_PUBLIC="${YC_PUBLIC_BASE_URL:-https://storage.yandexcloud.net/${BUCKET}}"
echo "Master playlist: ${BASE_PUBLIC}/${PREFIX}master.m3u8"
echo "Poster: ${BASE_PUBLIC}/${PREFIX}poster.jpg"
