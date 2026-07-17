#!/usr/bin/env bash
set -euo pipefail

required=(
  CSC_LINK
  CSC_KEY_PASSWORD
  APPLE_ID
  APPLE_APP_SPECIFIC_PASSWORD
  APPLE_TEAM_ID
)

missing=()
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("$name")
  fi
done

if (( ${#missing[@]} > 0 )); then
  printf 'Missing required macOS signing/notarization secrets: %s\n' "${missing[*]}" >&2
  exit 1
fi

echo "MACOS_SIGNING_ENV_OK"
