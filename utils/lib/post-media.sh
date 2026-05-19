#!/usr/bin/env bash

pm_repo_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$script_dir/../.." && pwd
}

pm_slug_from_post() {
  local post_path="$1"
  local base
  base="$(basename "$post_path")"
  if [[ "$base" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}-(.+)\.md$ ]]; then
    echo "${BASH_REMATCH[1]}"
    return 0
  fi
  echo "post slug must match YYYY-MM-DD-name.md: $post_path" >&2
  return 1
}

pm_media_root() {
  local repo="$1"
  local slug="$2"
  echo "${repo}/travel/${slug}"
}

pm_is_remote_path() {
  local path="$1"
  [[ "$path" =~ ^https?:// ]] || [[ "$path" =~ ^// ]] || [[ "$path" =~ ^data: ]]
}

pm_strip_html_comments() {
  perl -0777 -pe 's/<!--.*?-->//gs'
}

pm_media_extension() {
  local path="$1"
  local lower
  lower="$(printf '%s' "$path" | tr '[:upper:]' '[:lower:]')"
  [[ "$lower" =~ \.(jpe?g|png|gif|webp|m3u8|mp4|m4s)$ ]]
}

pm_collect_frontmatter_paths() {
  local post_path="$1"
  local in_fm=0
  local line key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == "---" ]]; then
      if [[ "$in_fm" -eq 0 ]]; then
        in_fm=1
        continue
      fi
      break
    fi
    if [[ "$in_fm" -eq 1 && "$line" =~ ^([A-Za-z0-9_]+):[[:space:]]*(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      value="${BASH_REMATCH[2]}"
      value="${value%\"}"
      value="${value#\"}"
      value="${value%\'}"
      value="${value#\'}"
      if pm_media_extension "$value"; then
        printf '%s\n' "$value"
      fi
    fi
  done < "$post_path"
}

pm_collect_reference_map() {
  local post_path="$1"
  local line ref target
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^\[([^]]+)\]:[[:space:]]*(.+)$ ]]; then
      ref="${BASH_REMATCH[1]}"
      target="${BASH_REMATCH[2]}"
      target="${target%%#*}"
      target="${target%% *}"
      printf '%s\t%s\n' "$ref" "$target"
    fi
  done < "$post_path"
}

pm_collect_body_paths() {
  local post_path="$1"
  local body ref target path assign_name assign_value rest
  declare -A PM_REF_MAP=()
  declare -A PM_ASSIGN_MAP=()
  while IFS=$'\t' read -r ref target; do
    [[ -z "$ref" ]] && continue
    PM_REF_MAP["$ref"]="$target"
  done < <(pm_collect_reference_map "$post_path")
  body="$(awk 'BEGIN{fm=0} /^---$/{fm++; if(fm>=2) print; next} fm>=2{print}' "$post_path" | pm_strip_html_comments)"
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ assign[[:space:]]+([A-Za-z0-9_]+)[[:space:]]*=[[:space:]]*[\"\']([^\"\']+)[\"\'] ]]; then
      PM_ASSIGN_MAP["${BASH_REMATCH[1]}"]="${BASH_REMATCH[2]}"
    fi
    rest="$line"
    while [[ "$rest" =~ src=\"([^\"]+)\" ]]; do
      path="${BASH_REMATCH[1]}"
      rest="${rest#*src=\"$path\"}"
      printf '%s\n' "$path"
    done
    rest="$line"
    while [[ "$rest" =~ poster=\"([^\"]+)\" ]]; do
      path="${BASH_REMATCH[1]}"
      rest="${rest#*poster=\"$path\"}"
      printf '%s\n' "$path"
    done
    if [[ "$line" =~ include[[:space:]]+video\.html ]]; then
      if [[ "$line" =~ src=([A-Za-z0-9_]+) ]]; then
        assign_name="${BASH_REMATCH[1]}"
        if [[ -n "${PM_ASSIGN_MAP[$assign_name]:-}" ]]; then
          printf '%s\n' "${PM_ASSIGN_MAP[$assign_name]}"
        fi
      fi
      if [[ "$line" =~ poster=([A-Za-z0-9_]+) ]]; then
        assign_name="${BASH_REMATCH[1]}"
        if [[ -n "${PM_ASSIGN_MAP[$assign_name]:-}" ]]; then
          printf '%s\n' "${PM_ASSIGN_MAP[$assign_name]}"
        fi
      fi
    fi
    while IFS= read -r path; do
      [[ -z "$path" ]] && continue
      printf '%s\n' "$path"
    done < <(printf '%s\n' "$line" | grep -oE '!\[[^]]*\]\([^)]+\)' | sed -E 's/^!\[[^]]*\]\(([^)]+)\)$/\1/' || true)
    while IFS= read -r ref; do
      [[ -z "$ref" ]] && continue
      if [[ -n "${PM_REF_MAP[$ref]:-}" ]]; then
        printf '%s\n' "${PM_REF_MAP[$ref]}"
      fi
    done < <(printf '%s\n' "$line" | grep -oE '!\[[^]]*\]\[[^]]+\]' | sed -E 's/^!\[[^]]*\]\[([^]]+)\]$/\1/' || true)
  done <<< "$body"
}

pm_collect_raw_paths() {
  local post_path="$1"
  pm_collect_frontmatter_paths "$post_path"
  pm_collect_body_paths "$post_path"
}

pm_normalize_raw_path() {
  local path="$1"
  path="${path%%#*}"
  path="${path%%\?*}"
  path="${path//\\//}"
  path="${path#./}"
  printf '%s' "$path"
}

pm_resolve_path() {
  local raw="$1"
  local repo="$2"
  local media_root="$3"
  local path resolved
  path="$(pm_normalize_raw_path "$raw")"
  if pm_is_remote_path "$path"; then
    return 1
  fi
  if [[ "$path" == /assets/* ]]; then
    resolved="${repo}${path}"
  elif [[ "$path" == /* ]]; then
    resolved="${repo}${path}"
  else
    resolved="${media_root}/${path}"
  fi
  resolved="$(cd "$(dirname "$resolved")" 2>/dev/null && pwd)/$(basename "$resolved")" 2>/dev/null || echo "$resolved"
  printf '%s' "$resolved"
}

pm_hls_uri_from_line() {
  local line="$1"
  local uri=""
  if [[ "$line" =~ URI=\"([^\"]+)\" ]]; then
    uri="${BASH_REMATCH[1]}"
  elif [[ "$line" =~ URI=\'([^\']+)\' ]]; then
    uri="${BASH_REMATCH[1]}"
  elif [[ "$line" != \#* && "$line" =~ [^[:space:]] ]]; then
    uri="${line%%#*}"
    uri="${uri%% *}"
  fi
  printf '%s' "$uri"
}

pm_expand_hls_playlist() {
  local playlist="$1"
  local exclude_mp4="${2:-0}"
  local playlist_dir uri target visited_key
  if [[ ! -f "$playlist" ]]; then
    return 0
  fi
  playlist_dir="$(cd "$(dirname "$playlist")" && pwd)"
  visited_key="$playlist"
  if [[ -n "${PM_HLS_VISITED[$visited_key]:-}" ]]; then
    return 0
  fi
  PM_HLS_VISITED[$visited_key]=1
  printf '%s\n' "$playlist"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line//$'\r'/}"
    uri="$(pm_hls_uri_from_line "$line")"
    [[ -z "$uri" ]] && continue
    if pm_is_remote_path "$uri"; then
      continue
    fi
    if [[ "$uri" == /* ]]; then
      target="$uri"
    else
      target="${playlist_dir}/${uri}"
    fi
    target="$(cd "$(dirname "$target")" 2>/dev/null && pwd)/$(basename "$target")" 2>/dev/null || echo "$target"
    if [[ -f "$target" ]]; then
      if [[ "$target" == *.m3u8 ]]; then
        pm_expand_hls_playlist "$target" "$exclude_mp4"
      else
        if [[ "$exclude_mp4" -eq 1 && "$target" == *.mp4 && "$(basename "$target")" != "init.mp4" ]]; then
          continue
        fi
        printf '%s\n' "$target"
      fi
    fi
  done < "$playlist"
  if [[ "$exclude_mp4" -eq 0 ]]; then
    local mp4
    for mp4 in "$playlist_dir"/*.mp4; do
      [[ -e "$mp4" ]] || continue
      printf '%s\n' "$mp4"
    done
  fi
}

pm_expand_hls_for_path() {
  local path="$1"
  local exclude_mp4="${2:-0}"
  if [[ "$path" != *.m3u8 ]]; then
    return 0
  fi
  declare -gA PM_HLS_VISITED=()
  pm_expand_hls_playlist "$path" "$exclude_mp4"
}

pm_add_unique_path() {
  local path="$1"
  [[ -z "$path" ]] && return 0
  if [[ -z "${PM_SEEN[$path]:-}" ]]; then
    PM_SEEN[$path]=1
    PM_RESULT_PATHS+=("$path")
  fi
}

pm_list_media() {
  local post_path="$1"
  local check="${2:-0}"
  local relative="${3:-0}"
  local exclude_mp4="${4:-0}"
  local repo slug media_root raw resolved expanded missing=0
  PM_RESULT_PATHS=()
  declare -gA PM_SEEN=()
  repo="$(pm_repo_root)"
  slug="$(pm_slug_from_post "$post_path")" || return 1
  post_path="$(cd "$(dirname "$post_path")" && pwd)/$(basename "$post_path")"
  media_root="$(pm_media_root "$repo" "$slug")"
  if [[ ! -d "$media_root" ]]; then
    echo "warning: media directory not found: $media_root" >&2
  fi
  while IFS= read -r raw; do
    [[ -z "$raw" ]] && continue
    if ! resolved="$(pm_resolve_path "$raw" "$repo" "$media_root")"; then
      continue
    fi
    pm_add_unique_path "$resolved"
    if [[ "$resolved" == *.m3u8 ]]; then
      while IFS= read -r expanded; do
        [[ -z "$expanded" ]] && continue
        pm_add_unique_path "$expanded"
      done < <(pm_expand_hls_for_path "$resolved" "$exclude_mp4")
    fi
  done < <(pm_collect_raw_paths "$post_path" | sort -u)
  local path out
  for path in "${PM_RESULT_PATHS[@]}"; do
    if [[ ! -e "$path" ]]; then
      missing=1
      if [[ "$check" -eq 1 ]]; then
        echo "missing: $path" >&2
      fi
      continue
    fi
    if [[ "$relative" -eq 1 ]]; then
      if [[ "$path" == "${media_root}/"* ]]; then
        out="${path#${media_root}/}"
      elif [[ "$path" == "${repo}/assets/"* ]]; then
        out="${path#${repo}/}"
      else
        out="$path"
      fi
      printf '%s\n' "$out"
    else
      printf '%s\n' "$path"
    fi
  done
  if [[ "$check" -eq 1 && "$missing" -eq 1 ]]; then
    return 1
  fi
  return 0
}

pm_content_type_for() {
  local path="$1"
  local lower
  lower="$(printf '%s' "$path" | tr '[:upper:]' '[:lower:]')"
  case "$lower" in
    *.m3u8) echo "application/vnd.apple.mpegurl" ;;
    *.m4s) echo "video/iso.segment" ;;
    *.mp4) echo "video/mp4" ;;
    *.jpg|*.jpeg) echo "image/jpeg" ;;
    *.png) echo "image/png" ;;
    *.gif) echo "image/gif" ;;
    *.webp) echo "image/webp" ;;
    *) echo "application/octet-stream" ;;
  esac
}

pm_s3_key_for() {
  local path="$1"
  local repo="$2"
  local slug="$3"
  local media_root rel
  media_root="$(pm_media_root "$repo" "$slug")"
  if [[ "$path" == "${media_root}/"* ]]; then
    rel="${path#${media_root}/}"
    printf '%s/%s' "$slug" "$rel"
    return 0
  fi
  if [[ "$path" == "${repo}/assets/"* ]]; then
    rel="${path#${repo}/}"
    printf '%s' "$rel"
    return 0
  fi
  return 1
}

pm_hls_root_for_path() {
  local path="$1"
  local dir master
  dir="$(dirname "$path")"
  while [[ "$dir" != "/" && -n "$dir" ]]; do
    master="${dir}/master.m3u8"
    if [[ -f "$master" ]]; then
      printf '%s' "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}
