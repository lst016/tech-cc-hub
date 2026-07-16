#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[macos-packaged-smoke] $*" >&2
  exit 1
}

case "${1:-$(uname -m)}" in
  arm64) arch="arm64" ;;
  x64|x86_64) arch="x64" ;;
  *) fail "unsupported architecture: ${1:-$(uname -m)}" ;;
esac

for command in codesign spctl xcrun hdiutil; do
  command -v "$command" >/dev/null 2>&1 || fail "missing required command: $command"
done

shopt -s nullglob
dmg_candidates=(dist/*-"$arch".dmg)
(( ${#dmg_candidates[@]} == 1 )) || fail "expected exactly one $arch DMG, found ${#dmg_candidates[@]}"
dmg_path="${dmg_candidates[0]}"
[[ -s "$dmg_path" ]] || fail "DMG is empty: $dmg_path"

mount_dir="$(mktemp -d "${TMPDIR:-/tmp}/tech-cc-hub-dmg.XXXXXX")"
mounted=false
cleanup() {
  if [[ "$mounted" == true ]]; then
    hdiutil detach "$mount_dir" -quiet || true
  fi
  rmdir "$mount_dir" 2>/dev/null || true
}
trap cleanup EXIT

hdiutil attach "$dmg_path" -nobrowse -readonly -mountpoint "$mount_dir" >/dev/null
mounted=true
app_path="$(find "$mount_dir" -maxdepth 2 -type d -name '*.app' -print -quit)"
[[ -n "$app_path" ]] || fail "DMG does not contain an application bundle: $dmg_path"

signature_info="$(codesign -dv --verbose=4 "$app_path" 2>&1)"
grep -q '^Authority=Developer ID Application:' <<<"$signature_info" \
  || fail "application is not signed with a Developer ID Application certificate"
codesign --verify --deep --strict --verbose=2 "$app_path"
spctl --assess --type execute --verbose=4 "$app_path"
xcrun stapler validate "$app_path"

echo "MACOS_PACKAGED_SMOKE_OK $dmg_path"
