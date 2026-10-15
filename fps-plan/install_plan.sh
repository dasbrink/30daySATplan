#!/bin/bash
# Installs the custom plan files into the freepracticesat Replit project.
# Safe to run more than once. Backs up index.html first.
set -e
RAW="https://raw.githubusercontent.com/dasbrink/30daySATplan/fps-transfer-plan/fps-plan"
STAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p plan score
for f in plan_core.js plan_stage1.js plan/index.html plan/plan_app.js score/index.html; do
  curl -fsSL "$RAW/$f?cb=$STAMP" -o "$f.new" && mv "$f.new" "$f" && echo "updated $f ($(wc -c < "$f") bytes)"
done
if ! grep -q 'plan_stage1.js' index.html; then
  cp index.html "index.backup-$STAMP.html"
  sed -i 's#</body>#<script src="plan_core.js"></script>\n<script src="plan_stage1.js"></script>\n</body>#' index.html
  echo "index.html: added the two plan script tags (backup index.backup-$STAMP.html)"
else
  echo "index.html: plan script tags already there"
fi
# Version stamps so browsers fetch the newest files
sed -i "s#src=\"plan_core.js[^\"]*\"#src=\"plan_core.js?v=$STAMP\"#; s#src=\"plan_stage1.js[^\"]*\"#src=\"plan_stage1.js?v=$STAMP\"#" index.html
sed -i "s#__V__#$STAMP#g" plan/index.html
grep -o 'plan_[a-z0-9]*\.js?v=[0-9_]*' index.html plan/index.html | sed 's/^/version: /'
grep -c 'plan_stage1.js' index.html | sed 's/^/plan_stage1 tag count: /'
grep -c '</body>' index.html | sed 's/^/body close count: /'
