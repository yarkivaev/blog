#!/opt/homebrew/bin/bash

export PATH="/opt/homebrew/bin:${PATH:-/usr/bin:/bin:/usr/sbin:/sbin}"

VD_RENDITIONS="720,1080"
VD_HLS_SUBDIR="hls"

vd_require_ffmpeg() {
  if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "ffmpeg not found; install ffmpeg: brew install ffmpeg" >&2
    return 1
  fi
}

vd_is_master_playlist() {
  local path="$1"
  [[ "$(basename "$path")" == "master.m3u8" ]]
}

vd_filter_hls_masters() {
  local path
  while IFS= read -r path || [[ -n "${path:-}" ]]; do
    path="${path//$'\r'/}"
    [[ -z "$path" ]] && continue
    if vd_is_master_playlist "$path"; then
      printf '%s\n' "$path"
    fi
  done
}

vd_hls_rel_from_media() {
  local master_path="$1"
  local media_root="$2"
  local hls_root rel
  hls_root="$(pm_hls_root_for_path "$master_path")" || return 1
  if [[ "$hls_root" != "${media_root}/"* ]]; then
    return 1
  fi
  rel="${hls_root#${media_root}/}"
  printf '%s' "$rel"
}

vd_derived_hls_root() {
  local derived_root="$1"
  local rel="$2"
  printf '%s/%s/%s' "$derived_root" "$VD_HLS_SUBDIR" "$rel"
}

vd_find_source_mp4() {
  local hls_root="$1"
  local f base
  shopt -s nullglob
  for f in "${hls_root}"/*.mp4; do
    base="$(basename "$f")"
    [[ "$base" == "init.mp4" ]] && continue
    printf '%s' "$f"
    shopt -u nullglob
    return 0
  done
  shopt -u nullglob
  return 1
}

vd_probe_dimensions() {
  local input="$1"
  local w h
  w="$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$input")" || return 1
  h="$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$input")" || return 1
  w="${w//$'\r'/}"
  h="${h//$'\r'/}"
  w="${w//,/}"
  h="${h//,/}"
  printf '%s %s' "$w" "$h"
}

vd_probe_max_dimension() {
  local input="$1"
  local dims w h max
  dims="$(vd_probe_dimensions "$input")" || return 1
  w="${dims%% *}"
  h="${dims##* }"
  if [[ "$w" -gt "$h" ]]; then
    max="$w"
  else
    max="$h"
  fi
  printf '%s' "$max"
}

vd_renditions_for_source() {
  local max_dim="$1"
  local sizes_csv="$2"
  local -a sizes size result=()
  IFS=',' read -r -a sizes <<< "$sizes_csv"
  for size in "${sizes[@]}"; do
    [[ -z "$size" ]] && continue
    if [[ "$max_dim" -ge "$size" ]]; then
      result+=("$size")
    fi
  done
  if [[ "${#result[@]}" -eq 0 ]]; then
    printf 'native:%s' "$max_dim"
    return 0
  fi
  local joined="" s
  for s in "${result[@]}"; do
    if [[ -z "$joined" ]]; then
      joined="$s"
    else
      joined="${joined},${s}"
    fi
  done
  printf '%s' "$joined"
}

vd_needs_rebuild() {
  local source="$1"
  local master="$2"
  local force="$3"
  if [[ "$force" -eq 1 ]]; then
    return 0
  fi
  [[ -f "$master" ]] || return 0
  local src_mtime out_mtime
  src_mtime="$(stat -f '%m' "$source" 2>/dev/null || stat -c '%Y' "$source")"
  out_mtime="$(stat -f '%m' "$master" 2>/dev/null || stat -c '%Y' "$master")"
  if [[ "$src_mtime" -gt "$out_mtime" ]]; then
    return 0
  fi
  return 1
}

vd_encode_rendition() {
  local input="$1"
  local out_dir="$2"
  local max_edge="$3"
  mkdir -p "$out_dir"
  (
    cd "$out_dir"
    ffmpeg -y -hide_banner -loglevel error -nostats -i "$input" < /dev/null \
      -vf "scale='min(iw,${max_edge})':'min(ih,${max_edge})':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2" \
      -c:v libx264 -profile:v high -pix_fmt yuv420p -preset medium -crf 23 \
      -c:a aac -ar 48000 -b:a 128k \
      -hls_time 6 -hls_playlist_type vod \
      -hls_segment_type fmp4 \
      -hls_fmp4_init_filename init.mp4 \
      -hls_segment_filename 'segment_%03d.m4s' \
      -f hls "stream.m3u8"
  )
}

vd_bandwidth_for_height() {
  local height="$1"
  if [[ "$height" -le 480 ]]; then
    echo "900000"
  elif [[ "$height" -le 720 ]]; then
    echo "2800000"
  elif [[ "$height" -le 1080 ]]; then
    echo "5500000"
  else
    echo "7500000"
  fi
}

vd_stream_dimensions() {
  local init_mp4="$1"
  local dims w h
  dims="$(vd_probe_dimensions "$init_mp4")" || return 1
  w="${dims%% *}"
  h="${dims##* }"
  printf '%sx%s' "$w" "$h"
}

vd_write_master_playlist() {
  local out_root="$1"
  shift
  local -a variant_dirs=("$@")
  local dir stream dims w h bandwidth resolution height
  {
    echo "#EXTM3U"
    echo "#EXT-X-VERSION:7"
    for dir in "${variant_dirs[@]}"; do
      stream="${dir}/stream.m3u8"
      [[ -f "${out_root}/${stream}" ]] || continue
      dims="$(vd_stream_dimensions "${out_root}/${dir}/init.mp4")" || continue
      w="${dims%%x*}"
      h="${dims#*x}"
      if [[ "$dir" == "src" ]]; then
        height="$h"
        if [[ "$w" -gt "$h" ]]; then
          height="$w"
        fi
      else
        height="${dir%p}"
      fi
      bandwidth="$(vd_bandwidth_for_height "$height")"
      resolution="${w}x${h}"
      echo "#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution},CODECS=\"avc1.640028,mp4a.40.2\""
      echo "${stream}"
    done
  } > "${out_root}/master.m3u8"
}

vd_manifest_entry_json() {
  local rel_key="$1"
  local derived_rel="$2"
  local renditions_csv="$3"
  python3 - "$rel_key" "$derived_rel" "$renditions_csv" <<'PY'
import json
import sys

rel_key, derived_rel, renditions_csv = sys.argv[1:4]
renditions = [r.strip() for r in renditions_csv.split(",") if r.strip()]
entry = {
    "master": f"derived/hls/{derived_rel}/master.m3u8",
    "renditions": renditions,
}
print(json.dumps({rel_key: entry}, ensure_ascii=False))
PY
}

vd_merge_video_manifest() {
  local manifest_path="$1"
  shift
  local -a entries=("$@")
  local merged
  merged="$(mktemp "${TMPDIR:-/tmp}/vd-manifest.XXXXXX")"
  if [[ -f "$manifest_path" ]]; then
    cp "$manifest_path" "$merged"
  else
    echo '{}' > "$merged"
  fi
  local entry
  for entry in "${entries[@]}"; do
    [[ -z "$entry" ]] && continue
    python3 - "$merged" "$entry" <<'PY'
import json
import sys

path, entry_json = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
videos = data.get("videos", {})
videos.update(json.loads(entry_json))
data["videos"] = videos
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write("\n")
PY
  done
  mkdir -p "$(dirname "$manifest_path")"
  mv "$merged" "$manifest_path"
}

vd_process_one_master() {
  local master_path="$1"
  local media_root="$2"
  local derived_root="$3"
  local renditions_csv="$4"
  local force="$5"
  local dry_run="$6"
  local rel hls_root source_mp4 out_root max_dim sizes_built
  local -a sizes_to_build size variant_dirs=()
  local size out_dir entry_json
  rel="$(vd_hls_rel_from_media "$master_path" "$media_root")" || return 1
  hls_root="$(pm_hls_root_for_path "$master_path")" || return 1
  source_mp4="$(vd_find_source_mp4 "$hls_root")" || {
    echo "skip (no source mp4): $rel" >&2
    return 1
  }
  out_root="$(vd_derived_hls_root "$derived_root" "$rel")"
  if ! vd_needs_rebuild "$source_mp4" "${out_root}/master.m3u8" "$force"; then
    echo "skip (up to date): video $rel" >&2
    if [[ "$dry_run" -eq 0 && -f "${out_root}/master.m3u8" ]]; then
      sizes_built=""
      shopt -s nullglob
      if [[ -f "${out_root}/src/stream.m3u8" ]]; then
        sizes_built="$(vd_probe_max_dimension "$source_mp4")"
      else
        for out_dir in "${out_root}"/*p; do
          [[ -d "$out_dir" ]] || continue
          sizes_built="${sizes_built},${out_dir##*/}"
        done
        sizes_built="${sizes_built#,}"
        sizes_built="${sizes_built//p/}"
      fi
      shopt -u nullglob
      entry_json="$(vd_manifest_entry_json "$rel" "$rel" "$sizes_built")"
      printf '%s' "$entry_json"
    fi
    return 0
  fi
  if [[ "$dry_run" -eq 1 ]]; then
    echo "would process video: $rel" >&2
    return 0
  fi
  max_dim="$(vd_probe_max_dimension "$source_mp4")" || {
    echo "skip (probe failed): $rel" >&2
    return 1
  }
  sizes_to_build=()
  local renditions_plan
  renditions_plan="$(vd_renditions_for_source "$max_dim" "$renditions_csv")"
  if [[ "$renditions_plan" == native:* ]]; then
    sizes_to_build+=("${renditions_plan#native:}")
  else
    while IFS= read -r size || [[ -n "$size" ]]; do
      [[ -n "$size" ]] && sizes_to_build+=("$size")
    done < <(printf '%s' "$renditions_plan" | tr ',' '\n')
  fi
  echo "process video: $rel (${sizes_to_build[*]:-native})" >&2
  local tmp_root
  tmp_root="$(mktemp -d "${TMPDIR:-/tmp}/vd-hls.XXXXXX")"
  variant_dirs=()
  for size in "${sizes_to_build[@]}"; do
    if [[ "$renditions_plan" == native:* ]]; then
      out_dir="src"
      vd_encode_rendition "$source_mp4" "${tmp_root}/${out_dir}" "$size"
    else
      out_dir="${size}p"
      vd_encode_rendition "$source_mp4" "${tmp_root}/${out_dir}" "$size"
    fi
    [[ -f "${tmp_root}/${out_dir}/stream.m3u8" ]] || {
      echo "encode failed: $rel/${out_dir}" >&2
      rm -rf "$tmp_root"
      return 1
    }
    variant_dirs+=("$out_dir")
  done
  vd_write_master_playlist "$tmp_root" "${variant_dirs[@]}"
  rm -rf "$out_root"
  mv "$tmp_root" "$out_root"
  sizes_built="$(IFS=,; echo "${sizes_to_build[*]}")"
  entry_json="$(vd_manifest_entry_json "$rel" "$rel" "$sizes_built")"
  printf '%s' "$entry_json"
}

vd_process_masters() {
  local media_root="$1"
  local derived_root="$2"
  local renditions_csv="$3"
  local force="$4"
  local dry_run="$5"
  local manifest_path="${derived_root}/manifest.json"
  local -a entries=()
  local path entry_json
  vd_require_ffmpeg || return 1
  mkdir -p "$derived_root"
  local -a masters=()
  while IFS= read -r path || [[ -n "${path:-}" ]]; do
    path="${path//$'\r'/}"
    [[ -z "$path" ]] && continue
    masters+=("$path")
  done
  for path in "${masters[@]}"; do
    [[ -e "$path" ]] || {
      echo "skip (missing): $path" >&2
      continue
    }
    entry_json="$(vd_process_one_master "$path" "$media_root" "$derived_root" "$renditions_csv" "$force" "$dry_run" || true)"
    [[ -n "$entry_json" ]] && entries+=("$entry_json")
  done
  if [[ "$dry_run" -eq 1 ]]; then
    echo "dry-run: would update video manifest with ${#entries[@]} entries" >&2
    return 0
  fi
  if [[ "${#entries[@]}" -eq 0 ]]; then
    echo "no videos processed" >&2
    return 0
  fi
  vd_merge_video_manifest "$manifest_path" "${entries[@]}"
  echo "video manifest: $manifest_path (${#entries[@]} entries)" >&2
}
