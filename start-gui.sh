#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo ""
echo "========================================================"
echo "  Webstudio AI Agent // Control Center Dashboard"
echo "========================================================"
echo ""

if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js is not installed or not found in system PATH."
    echo "Please install Node.js (v22.12.0+ recommended) from https://nodejs.org/"
    echo ""
    exit 1
fi

export SHARP_IGNORE_GLOBAL_LIBVIPS=1

echo "Starting Webstudio Control Center GUI..."
node scripts/gui-server.mjs "$@"
