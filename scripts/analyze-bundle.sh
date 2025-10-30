#!/bin/bash
set -e

echo "📊 Starting bundle analysis..."

cd frontend

export ANALYZE=true
export NODE_ENV=production

echo "🔨 Building with analysis..."
npm run build 2>&1 | tee build-output.txt

if [ -f "dist/stats.html" ]; then
  echo "✅ Bundle analysis complete!"
  echo "📈 Report: frontend/dist/stats.html"
  
  if [ -f "dist/.vite/manifest.json" ]; then
    echo ""
    echo "📦 Bundle sizes:"
    du -h dist/assets/*.js 2>/dev/null | sort -hr | head -10 || echo "No JS bundles found"
  fi
else
  echo "⚠️  Stats file not generated"
fi

echo ""
echo "To view the report, open: frontend/dist/stats.html"
