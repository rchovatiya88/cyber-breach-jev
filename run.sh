#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "================================================================="
echo "⚡ CYBER-BREACH: THE JEV PROTOCOL"
echo "🎮 Powered by TypeSafe AI Jev (System One Decision Model)"
echo "================================================================="

# Check dependencies
python3 -c "import fastapi, uvicorn, typesafe_sdk" 2>/dev/null || {
    echo "📦 Installing required dependencies..."
    pip3 install -r requirements.txt
}

echo "🚀 Launching game server at http://localhost:8000 ..."
python3 -m backend.app
