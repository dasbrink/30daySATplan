#!/bin/bash
# Adds the "best free SAT math practice sites" post to freepracticesat.com.
# Safe to run twice: it skips anything already done.
set -e
BASE="https://raw.githubusercontent.com/dasbrink/30daySATplan/fps-transfer-oct12"
if [ ! -f blog/index.html ] || [ ! -f sitemap.xml ]; then
  echo "STOPPED: run this from the main project folder (blog/index.html and sitemap.xml not found)."
  exit 1
fi
mkdir -p .backup-oct12
cp blog/index.html .backup-oct12/blog-index.html
cp sitemap.xml .backup-oct12/sitemap.xml

# 1. The new post
curl -fsSL "$BASE/best-free-sat-math-practice-sites.html" -o blog/best-free-sat-math-practice-sites.html
echo "Post saved: blog/best-free-sat-math-practice-sites.html ($(wc -c < blog/best-free-sat-math-practice-sites.html) bytes)"

# 2. Blog index card, right under the gold rule (newest first)
if grep -q 'best-free-sat-math-practice-sites' blog/index.html; then
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

# 3. Sitemap entries
if grep -q 'best-free-sat-math-practice-sites' sitemap.xml; then
  echo "Sitemap already updated. Skipped."
else
  curl -fsSL "$BASE/sitemap-add.xml" -o /tmp/sm-add.xml
  if grep -q 'freepracticesat-vs-khan-academy' sitemap.xml; then
    tail -n 4 /tmp/sm-add.xml > /tmp/sm-add2.xml && mv /tmp/sm-add2.xml /tmp/sm-add.xml
  fi
  grep -v '^</urlset>$' sitemap.xml > /tmp/sm.xml
  cat /tmp/sm-add.xml >> /tmp/sm.xml
  printf '</urlset>\n' >> /tmp/sm.xml
  mv /tmp/sm.xml sitemap.xml
  echo "Sitemap now lists $(grep -c '<loc>' sitemap.xml) pages."
fi

echo "CHECKS: DOCTYPE in new post: $(grep -c '<!DOCTYPE' blog/best-free-sat-math-practice-sites.html) (must be 1). Cards in blog index: $(grep -c 'class="post-card"' blog/index.html)."
echo "DONE. Now click Republish."
