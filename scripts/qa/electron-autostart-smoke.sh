#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB_PATH="${HOME}/Library/Application Support/agent-cowork/sessions.db"
LOCK_DIR="/tmp/agent-cowork-smoke.lock"
PROMPT_INPUT="${1:-请只回复：SMOKE_OK}"
CONTINUE_PROMPT="${2:-}"
TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-60}"
AUTOSTART_CWD="${SMOKE_AUTOSTART_CWD:-$ROOT_DIR}"

STAMP="$(date +%s)"
SAFE_TOKEN="$(printf '%s' "$PROMPT_INPUT" | tr ' /' '__' | tr -cd '[:alnum:]_-' | cut -c1-40)"
REACT_LOG="/tmp/agent-cowork-react-${STAMP}-${SAFE_TOKEN}.log"
ELECTRON_LOG="/tmp/agent-cowork-electron-${STAMP}-${SAFE_TOKEN}.log"

VITE_PID=""
ELECTRON_PID=""

cleanup() {
  rmdir "$LOCK_DIR" >/dev/null 2>&1 || true
  if [[ -n "${ELECTRON_PID}" ]] && kill -0 "${ELECTRON_PID}" >/dev/null 2>&1; then
    kill "${ELECTRON_PID}" >/dev/null 2>&1 || true
    wait "${ELECTRON_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${VITE_PID}" ]] && kill -0 "${VITE_PID}" >/dev/null 2>&1; then
    kill "${VITE_PID}" >/dev/null 2>&1 || true
    wait "${VITE_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

wait_for_vite() {
  local deadline=$((SECONDS + 20))
  until curl -sf "http://localhost:5173/" >/dev/null 2>&1; do
    if (( SECONDS >= deadline )); then
      echo "Vite dev server did not become ready in time." >&2
      return 1
    fi
    sleep 1
  done
}

poll_for_completion() {
  local expected_prompt="$PROMPT_INPUT"
  if [[ -n "$CONTINUE_PROMPT" ]]; then
    expected_prompt="$CONTINUE_PROMPT"
  fi

  local deadline=$((SECONDS + TIMEOUT_SECONDS))
  while (( SECONDS < deadline )); do
    local row
    row="$(sqlite3 "$DB_PATH" "select status || '|' || ifnull(claude_session_id,'') || '|' || replace(ifnull(title,''), char(10), ' ') || '|' || id from sessions where last_prompt = '$expected_prompt' order by updated_at desc limit 1;" 2>/dev/null || true)"
    if [[ -n "$row" ]]; then
      local status claude_session_id title session_id
      IFS='|' read -r status claude_session_id title session_id <<<"$row"
      if [[ "$status" == "completed" && -n "$claude_session_id" ]]; then
        if [[ -n "$CONTINUE_PROMPT" ]]; then
          local prompt_count
          prompt_count="$(sqlite3 "$DB_PATH" "select count(*) from messages where session_id = '$session_id' and json_extract(data, '$.type') = 'user_prompt';" 2>/dev/null || echo 0)"
          if [[ "${prompt_count}" -lt 2 ]]; then
            sleep 1
            continue
          fi
        fi
        echo "SMOKE_OK status=$status claude_session_id=$claude_session_id title=$title session_id=$session_id"
        return 0
      fi
      if [[ "$status" == "error" ]]; then
        echo "SMOKE_FAILED status=error title=$title" >&2
        return 1
      fi
    fi
    sleep 2
  done

  echo "Timed out waiting for session completion." >&2
  return 1
}

cd "$ROOT_DIR"

lock_deadline=$((SECONDS + 30))
until mkdir "$LOCK_DIR" >/dev/null 2>&1; do
  if (( SECONDS >= lock_deadline )); then
    echo "Another smoke run is still holding the lock: $LOCK_DIR" >&2
    exit 1
  fi
  sleep 1
done

pkill -f "vite" >/dev/null 2>&1 || true
pkill -f "/node_modules/electron/" >/dev/null 2>&1 || true

bun run dev:react >"$REACT_LOG" 2>&1 &
VITE_PID="$!"
wait_for_vite

AGENT_COWORK_DEV_AUTOSTART_PROMPT="$PROMPT_INPUT" \
AGENT_COWORK_DEV_AUTOSTART_CWD="$AUTOSTART_CWD" \
AGENT_COWORK_DEV_CONTINUE_PROMPT="$CONTINUE_PROMPT" \
  bun run dev:electron >"$ELECTRON_LOG" 2>&1 &
ELECTRON_PID="$!"

if ! poll_for_completion; then
  echo "--- React log ---" >&2
  tail -n 80 "$REACT_LOG" >&2 || true
  echo "--- Electron log ---" >&2
  tail -n 120 "$ELECTRON_LOG" >&2 || true
  exit 1
fi

echo "Logs:"
echo "  React:    $REACT_LOG"
echo "  Electron: $ELECTRON_LOG"
