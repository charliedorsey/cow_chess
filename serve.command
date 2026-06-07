#!/usr/bin/env bash
# Double-click to serve the cow locally, then open http://localhost:8000/
cd "$(dirname "$0")"
if [ ! -f cow.wasm ]; then
  echo "⚠  cow.wasm not found in this folder."
  echo "   Copy your --public build in first:"
  echo "     cp /path/to/engine/dist/cow.js  ./cow.js"
  echo "     cp /path/to/engine/dist/cow.wasm ./cow.wasm"
  echo ""
fi
echo "serving cow_chess at http://localhost:8000/  (Ctrl-C to stop)"
python3 -m http.server 8000
