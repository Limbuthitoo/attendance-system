#!/bin/bash
# Archisys NFC Reader — double-click to launch
cd "$(dirname "$0")"

if ! command -v node &> /dev/null; then
  echo "❌ Node.js is not installed."
  echo "   Download it from https://nodejs.org"
  read -p "Press Enter to exit..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

echo ""
echo "🚀 Starting Archisys NFC Reader..."
echo ""
node index.js

echo ""
read -p "Press Enter to exit..."
