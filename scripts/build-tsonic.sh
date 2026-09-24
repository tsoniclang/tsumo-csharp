#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT/.temp/build-runs"
LOG_ROOT="${TSUMO_BUILD_LOG_DIR:-$(mktemp -d "$ROOT/.temp/build-runs/tsonic-XXXXXXXX")}"
mkdir -p "$LOG_ROOT"

packages=(engine cli tests)
worker_count="${TSUMO_TSONIC_WORKERS:-${TSONIC_TEST_WORKERS:-$(node --input-type=module -e 'import { availableParallelism } from "node:os"; console.log(availableParallelism());')}}"
node_options="${TSUMO_TSONIC_NODE_OPTIONS:---max-old-space-size=3072}"
build_timeout="${TSUMO_TSONIC_TIMEOUT:-15m}"

if ! [[ "$worker_count" =~ ^[1-9][0-9]*$ ]]; then
  echo "TSUMO_TSONIC_WORKERS must be a positive integer" >&2
  exit 2
fi

failed=0
for ((offset = 0; offset < ${#packages[@]}; offset += worker_count)); do
  pids=()
  batch=()
  for ((index = offset; index < offset + worker_count && index < ${#packages[@]}; index++)); do
    package="${packages[$index]}"
    batch+=("$package")
    (
      cd "$ROOT/packages/$package"
      /usr/bin/time -v env NODE_OPTIONS="$node_options" timeout "$build_timeout" \
        node "$ROOT/node_modules/@tsonic/cli/dist/src/index.js" build --project tsonic.json
    ) >"$LOG_ROOT/$package.log" 2>&1 &
    pids+=("$!")
  done

  for index in "${!pids[@]}"; do
    package="${batch[$index]}"
    if wait "${pids[$index]}"; then
      status="PASS"
    else
      status="FAIL"
      failed=1
    fi
    echo "=== tsonic $package: $status ==="
    cat "$LOG_ROOT/$package.log"
  done
done

echo "Tsonic build logs: $LOG_ROOT"
test "$failed" -eq 0
