#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$root/dist"
rm -f "$root/dist/daylight.xpi" "$root/dist/daylight.zip"
(
  cd "$root/extension"
  zip -q -r "$root/dist/daylight.xpi" . -x "*.DS_Store" -x "**/.DS_Store"
)
cp "$root/dist/daylight.xpi" "$root/dist/daylight.zip"
echo "packed $root/dist/daylight.xpi"
