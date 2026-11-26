#!/usr/bin/env bash
# Build-i i app-it për provat live në 390 px, me Supabase të rremë (tools/live-check/mock.js), dhe serveri lokal.
# Përdorimi: bash tools/live-check/build.sh   (LIVE_ROOT dhe LIVE_PORT ndryshojnë dosjen dhe portën)
set -euo pipefail
ROOT="${LIVE_ROOT:-/tmp/live/root}"
PORT="${LIVE_PORT:-4173}"
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE/../.."
VITE_SUPABASE_URL=https://smoke.invalid VITE_SUPABASE_PUBLISHABLE_KEY=prove npx vite build --outDir "$ROOT" --base / --emptyOutDir > /tmp/live-build.log 2>&1
cp "$HERE/mock.js" "$ROOT/mock.js"
sed -i 's#<head>#<head><script src="/mock.js"></script>#' "$ROOT/index.html"
# Ndalo një server tjetër në portë: ai mund të shërbejë një build të vjetër (MESIMET).
pkill -f "tools/live-check/serve.mjs" 2>/dev/null || true
(LIVE_ROOT="$ROOT" LIVE_PORT="$PORT" nohup node "$HERE/serve.mjs" > /tmp/live-serve.log 2>&1 &)
sleep 1
served=$(curl -s "127.0.0.1:$PORT/" | grep -o 'assets/index-[^"]*' | head -1)
built=$(ls "$ROOT/assets" | grep -o '^index-[^"]*\.js$' | head -1)
echo "shërbehet: $served · build: assets/$built"
