#!/opt/homebrew/bin/bash

export PATH="/opt/homebrew/bin:${PATH:-/usr/bin:/bin:/usr/sbin:/sbin}"

id_require_magick() {
  if ! command -v magick >/dev/null 2>&1; then
    echo "magick not found; install ImageMagick: brew install imagemagick" >&2
    return 1
  fi
}

id_is_derived_output() {
  local path="$1"
  local lower
  lower="$(printf '%s' "$path" | tr '[:upper:]' '[:lower:]')"
  [[ "$path" == */derived/* ]] && return 0
  [[ "$lower" =~ \.w[0-9]+\.webp$ ]] && return 0
  [[ "$lower" =~ \.lqip\.webp$ ]] && return 0
  return 1
}

id_is_processable() {
  local path="$1"
  local lower
  if id_is_derived_output "$path"; then
    return 1
  fi
  lower="$(printf '%s' "$path" | tr '[:upper:]' '[:lower:]')"
  [[ "$lower" =~ \.(jpe?g|png)$ ]]
}

id_filter_raster_paths() {
  local path
  while IFS= read -r path || [[ -n "${path:-}" ]]; do
    path="${path//$'\r'/}"
    [[ -z "$path" ]] && continue
    if id_is_processable "$path"; then
      printf '%s\n' "$path"
    fi
  done
}

id_rel_from_media() {
  local path="$1"
  local media_root="$2"
  if [[ "$path" != "${media_root}/"* ]]; then
    return 1
  fi
  printf '%s' "${path#${media_root}/}"
}

id_stem_path() {
  local rel="$1"
  local dir base
  dir="$(dirname "$rel")"
  base="$(basename "$rel")"
  base="${base%.*}"
  if [[ "$dir" == "." ]]; then
    printf '%s' "$base"
  else
    printf '%s/%s' "$dir" "$base"
  fi
}

id_variant_webp_path() {
  local derived_root="$1"
  local stem="$2"
  local width="$3"
  printf '%s/%s.w%s.webp' "$derived_root" "$stem" "$width"
}

id_lqip_webp_path() {
  local derived_root="$1"
  local stem="$2"
  printf '%s/%s.lqip.webp' "$derived_root" "$stem"
}

id_file_dimensions() {
  local path="$1"
  local dims
  dims="$(magick "$path" -auto-orient -format '%w %h' info: 2>/dev/null)" || return 1
  printf '%s' "$dims"
}

id_max_dimension() {
  local w="$1"
  local h="$2"
  if [[ "$w" -gt "$h" ]]; then
    echo "$w"
  else
    echo "$h"
  fi
}

id_resize_webp() {
  local input="$1"
  local output="$2"
  local max_dim="$3"
  local quality="$4"
  mkdir -p "$(dirname "$output")"
  magick "$input" -auto-orient -strip -resize "${max_dim}x${max_dim}>" \
    -quality "$quality" -define webp:method=6 "$output"
}

id_make_lqip() {
  local input="$1"
  local output="$2"
  local lqip_width="$3"
  mkdir -p "$(dirname "$output")"
  magick "$input" -auto-orient -strip -resize "${lqip_width}x" \
    -blur "0x0.6" -quality 55 -define webp:method=6 "$output"
}

id_sizes_for_original() {
  local max_orig="$1"
  local sizes_csv="$2"
  local -a sizes size result=()
  IFS=',' read -r -a sizes <<< "$sizes_csv"
  for size in "${sizes[@]}"; do
    [[ -z "$size" ]] && continue
    if [[ "$size" -eq 2400 && "$max_orig" -le 1400 ]]; then
      continue
    fi
    result+=("$size")
  done
  if [[ "${#result[@]}" -eq 0 ]]; then
    result+=("1400")
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

id_discover_built_sizes() {
  local derived_root="$1"
  local stem="$2"
  local f base
  local -a found=()
  shopt -s nullglob
  for f in "${derived_root}/${stem}".w*.webp; do
    base="$(basename "$f")"
    if [[ "$base" =~ \.w([0-9]+)\.webp$ ]]; then
      found+=("${BASH_REMATCH[1]}")
    fi
  done
  shopt -u nullglob
  local joined="" s
  for s in "${found[@]}"; do
    if [[ -z "$joined" ]]; then
      joined="$s"
    else
      joined="${joined},${s}"
    fi
  done
  printf '%s' "$joined"
}

id_needs_rebuild() {
  local source="$1"
  local force="$2"
  shift 2
  local -a outputs=("$@")
  local out src_mtime out_mtime
  if [[ "$force" -eq 1 ]]; then
    return 0
  fi
  for out in "${outputs[@]}"; do
    [[ -f "$out" ]] || return 0
  done
  src_mtime="$(stat -f '%m' "$source" 2>/dev/null || stat -c '%Y' "$source")"
  for out in "${outputs[@]}"; do
    out_mtime="$(stat -f '%m' "$out" 2>/dev/null || stat -c '%Y' "$out")"
    if [[ "$src_mtime" -gt "$out_mtime" ]]; then
      return 0
    fi
  done
  return 1
}

id_manifest_entry_json() {
  local rel_key="$1"
  local orig_w="$2"
  local orig_h="$3"
  local derived_root="$4"
  local stem="$5"
  local sizes_csv="$6"
  python3 - "$rel_key" "$orig_w" "$orig_h" "$derived_root" "$stem" "$sizes_csv" <<'PY'
import json
import os
import subprocess
import sys

rel_key, orig_w, orig_h, derived_root, stem, sizes_csv = sys.argv[1:7]
orig_w = int(orig_w)
orig_h = int(orig_h)
variants = {}
for size in sizes_csv.split(","):
    size = size.strip()
    if not size:
        continue
    path = os.path.join(derived_root, f"{stem}.w{size}.webp")
    if not os.path.isfile(path):
        continue
    out = subprocess.check_output(
        ["magick", "identify", "-format", "%w %h", path],
        text=True,
    ).strip()
    w, h = out.split()
    rel = f"derived/{stem}.w{size}.webp"
    variants[size] = {"webp": rel, "w": int(w), "h": int(h)}
lqip_path = os.path.join(derived_root, f"{stem}.lqip.webp")
lqip = None
if os.path.isfile(lqip_path):
    out = subprocess.check_output(
        ["magick", "identify", "-format", "%w %h", lqip_path],
        text=True,
    ).strip()
    w, h = out.split()
    lqip = {"webp": f"derived/{stem}.lqip.webp", "w": int(w), "h": int(h)}
entry = {"width": orig_w, "height": orig_h, "variants": variants}
if lqip:
    entry["lqip"] = lqip
print(json.dumps({rel_key: entry}, ensure_ascii=False))
PY
}

id_write_manifest() {
  local manifest_path="$1"
  shift
  local -a entries=("$@")
  local merged
  merged="$(mktemp "${TMPDIR:-/tmp}/id-manifest-merge.XXXXXX")"
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

merged_path, entry_json = sys.argv[1], sys.argv[2]
with open(merged_path, encoding="utf-8") as f:
    data = json.load(f)
data.update(json.loads(entry_json))
with open(merged_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write("\n")
PY
  done
  mkdir -p "$(dirname "$manifest_path")"
  mv "$merged" "$manifest_path"
}

id_process_one() {
  local source="$1"
  local media_root="$2"
  local derived_root="$3"
  local sizes_csv="$4"
  local lqip_width="$5"
  local force="$6"
  local dry_run="$7"
  local rel stem max_orig orig_w orig_h sizes_built dims
  local -a outputs sizes_to_build size
  local lqip_path entry_json out_path
  rel="$(id_rel_from_media "$source" "$media_root")" || return 1
  stem="$(id_stem_path "$rel")"
  dims="$(id_file_dimensions "$source")" || {
    echo "skip (identify failed): $source" >&2
    return 1
  }
  orig_w="${dims%% *}"
  orig_h="${dims#* }"
  max_orig="$(id_max_dimension "$orig_w" "$orig_h")"
  sizes_to_build=()
  while IFS= read -r size || [[ -n "$size" ]]; do
    [[ -n "$size" ]] && sizes_to_build+=("$size")
  done < <(id_sizes_for_original "$max_orig" "$sizes_csv" | tr ',' '\n')
  lqip_path="$(id_lqip_webp_path "$derived_root" "$stem")"
  outputs=("$lqip_path")
  for size in "${sizes_to_build[@]}"; do
    outputs+=("$(id_variant_webp_path "$derived_root" "$stem" "$size")")
  done
  if ! id_needs_rebuild "$source" "$force" "${outputs[@]}"; then
    echo "skip (up to date): $rel" >&2
    if [[ "$dry_run" -eq 0 ]]; then
      sizes_built="$(id_discover_built_sizes "$derived_root" "$stem")"
      [[ -n "$sizes_built" ]] || return 0
      entry_json="$(id_manifest_entry_json "$rel" "$orig_w" "$orig_h" "$derived_root" "$stem" "$sizes_built")"
      printf '%s' "$entry_json"
    fi
    return 0
  fi
  if [[ "$dry_run" -eq 1 ]]; then
    echo "would process: $rel -> ${#outputs[@]} file(s)" >&2
    return 0
  fi
  echo "process: $rel" >&2
  for size in "${sizes_to_build[@]}"; do
    out_path="$(id_variant_webp_path "$derived_root" "$stem" "$size")"
    id_resize_webp "$source" "$out_path" "$size" 82
  done
  id_make_lqip "$source" "$lqip_path" "$lqip_width"
  sizes_built="$(id_discover_built_sizes "$derived_root" "$stem")"
  entry_json="$(id_manifest_entry_json "$rel" "$orig_w" "$orig_h" "$derived_root" "$stem" "$sizes_built")"
  printf '%s' "$entry_json"
}

id_process_paths() {
  local media_root="$1"
  local derived_root="$2"
  local sizes_csv="$3"
  local lqip_width="$4"
  local force="$5"
  local dry_run="$6"
  local manifest_path="${derived_root}/manifest.json"
  local -a entries=()
  local path entry_json
  id_require_magick || return 1
  mkdir -p "$derived_root"
  while IFS= read -r path || [[ -n "${path:-}" ]]; do
    path="${path//$'\r'/}"
    [[ -z "$path" ]] && continue
    [[ -e "$path" ]] || {
      echo "skip (missing): $path" >&2
      continue
    }
    if [[ "$path" != "${media_root}/"* ]]; then
      echo "skip (outside media root): $path" >&2
      continue
    fi
    entry_json="$(id_process_one "$path" "$media_root" "$derived_root" "$sizes_csv" "$lqip_width" "$force" "$dry_run" || true)"
    [[ -n "$entry_json" ]] && entries+=("$entry_json")
  done
  if [[ "$dry_run" -eq 1 ]]; then
    echo "dry-run: would write ${#entries[@]} manifest entries" >&2
    return 0
  fi
  if [[ "${#entries[@]}" -eq 0 ]]; then
    echo "no raster images processed" >&2
    return 0
  fi
  id_write_manifest "$manifest_path" "${entries[@]}"
  echo "manifest: $manifest_path (${#entries[@]} entries)" >&2
}
