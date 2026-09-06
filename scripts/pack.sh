#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$root/dist"
rm -f "$root/dist/daylight.xpi" "$root/dist/daylight.zip"

if command -v zip >/dev/null 2>&1; then
  ( cd "$root/extension" && zip -q -r "$root/dist/daylight.xpi" . -x "*.DS_Store" -x "**/.DS_Store" )
elif command -v powershell.exe >/dev/null 2>&1 || command -v pwsh >/dev/null 2>&1; then
  ps="$(command -v pwsh || command -v powershell.exe)"
  win_root="$(cd "$root" && pwd -W 2>/dev/null || echo "$root")"
  "$ps" -NoProfile -Command "Compress-Archive -Path '${win_root}/extension/*' -DestinationPath '${win_root}/dist/daylight.xpi' -Force"
else
  echo "need either 'zip' or PowerShell to pack" >&2
  exit 1
fi

cp "$root/dist/daylight.xpi" "$root/dist/daylight.zip"
echo "packed $root/dist/daylight.xpi"
