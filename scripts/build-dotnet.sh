#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT/.temp/build-runs"
LOG_ROOT="${TSUMO_DOTNET_LOG_DIR:-$(mktemp -d "$ROOT/.temp/build-runs/dotnet-XXXXXXXX")}"
mkdir -p "$LOG_ROOT"

status=0
/usr/bin/time -v dotnet build "$ROOT/Tsumo.slnx" --no-restore \
  >"$LOG_ROOT/solution.log" 2>&1 || status=$?
cat "$LOG_ROOT/solution.log"
echo ".NET build log: $LOG_ROOT/solution.log"
exit "$status"
