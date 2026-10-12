#!/bin/bash
# Adds the junior-year SAT plan post and its timeline image to freepracticesat.com.
# Safe to run twice: it skips anything already done.
set -e
BASE="https://raw.githubusercontent.com/dasbrink/30daySATplan/fps-transfer-junior"
if [ ! -f blog/index.html ] || [ ! -f sitemap.xml ]; then
  echo "STOPPED: run this from the main project folder (blog/index.html and sitemap.xml not found)."
  exit 1
fi
mkdir -p .backup-junior
cp blog/index.html .backup-junior/blog-index.html
cp sitemap.xml .backup-junior/sitemap.xml

curl -fsSL "$BASE/junior-year-sat-plan.html" -o blog/junior-year-sat-plan.html
curl -fsSL "$BASE/junior-year-sat-timeline.png" -o blog/junior-year-sat-timeline.png
echo "Post saved ($(wc -c < blog/junior-year-sat-plan.html) bytes). Image saved ($(wc -c < blog/junior-year-sat-timeline.png) bytes)."

if grep -q 'junior-year-sat-plan' blog/index.html; then
  echo "Blog index already has the card. Skipped."
else
  if [ "$(grep -c '<hr class="gold-rule">' blog/index.html)" != "1" ]; then
    echo "STOPPED: could not find one gold rule line in blog/index.html. Nothing changed there."
    exit 1
  fi
  curl -fsSL "$BASE/card.html" -o /tmp/card.html
  sed -i '/<hr class="gold-rule">/r /tmp/card.html' blog/index.html
  echo "Blog index card added."
fi

if grep -q 'junior-year-sat-plan' sitemap.xml; then
  echo "Sitemap already updated. Skipped."
else
  curl -fsSL "$BASE/sitemap-add.xml" -o /tmp/sm-add.xml
  grep -v '^</urlset>$' sitemap.xml > /tmp/sm.xml
  cat /tmp/sm-add.xml >> /tmp/sm.xml
  printf '</urlset>\n' >> /tmp/sm.xml
  mv /tmp/sm.xml sitemap.xml
  echo "Sitemap now lists $(grep -c '<loc>' sitemap.xml) pages."
fi

echo "CHECKS: DOCTYPE in new post: $(grep -c '<!DOCTYPE' blog/junior-year-sat-plan.html) (must be 1). Cards in blog index: $(grep -c 'class="post-card"' blog/index.html)."
echo "DONE. Now click Republish."
