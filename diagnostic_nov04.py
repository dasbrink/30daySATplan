#!/usr/bin/env python3
# Adds the page /free-sat-math-diagnostic/, a card on the blog page, a sitemap
# entry and a link from the About page.
# Run from the site root. Undo: python3 diagnostic_nov04.py --undo
import base64, hashlib, os, shutil, sys, zlib

SHA = '42b1734d173cab3b0de5c302384c5235980ce710c3aadade07245b08c8cbea06'
DATA = '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'
PAGE = 'free-sat-math-diagnostic/index.html'
BK = '.diagnostic_backup_20261104'
EDIT = ['blog/index.html', 'sitemap.xml', 'about/index.html']
HR = '<hr class="gold-rule">\n'
CARD = '<a class="post-card" href="/free-sat-math-diagnostic/">\n<p class="meta">For Students &amp; Parents &middot; November 4, 2026</p>\n<h2>Free SAT Math Diagnostic Test</h2>\n<p>What the free 44-question diagnostic shows, why the wrong answer you pick matters, and what the first tests of 228 students revealed.</p>\n</a>\n'
SMAP = '  <url>\n    <loc>https://freepracticesat.com/free-sat-math-diagnostic/</loc>\n    <lastmod>2026-11-04</lastmod>\n  </url>\n'
ABOUT_OLD = 'Free Practice SAT is the free SAT math diagnostic that pinpoints'
ABOUT_NEW = 'Free Practice SAT is the <a href="/free-sat-math-diagnostic/">free SAT math diagnostic</a> that pinpoints'

def read(p):
    with open(p, encoding='utf-8', newline='') as f:
        return f.read()

def write(p, s):
    with open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def sha_file(p):
    with open(p, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()

if '--undo' in sys.argv:
    if not os.path.isdir(BK):
        print('STOP. Nothing was changed: no backup folder found.')
        sys.exit(1)
    for p in EDIT:
        shutil.copy2(os.path.join(BK, p), p)
    if os.path.exists(PAGE):
        shutil.move(PAGE, os.path.join(BK, 'removed_page.html'))
        if not os.listdir(os.path.dirname(PAGE)):
            os.rmdir(os.path.dirname(PAGE))
    print('UNDONE: diagnostic page, blog card, sitemap entry and About link removed. Click Republish.')
    sys.exit(0)

src = zlib.decompress(base64.b64decode(DATA))
problems = []
if hashlib.sha256(src).hexdigest() != SHA:
    problems.append('embedded file failed its check')
missing = [p for p in EDIT if not os.path.exists(p)]
if missing:
    problems.append('not found: ' + ', '.join(missing))
else:
    blog, site, about = [read(p) for p in EDIT]
    if os.path.exists(PAGE) and sha_file(PAGE) == SHA and CARD in blog and SMAP in site and ABOUT_NEW in about:
        print('Already done. Nothing to change.')
        sys.exit(0)
    if blog.count(HR) != 1:
        problems.append('blog/index.html: gold rule line not found exactly once')
    if site.count('</urlset>') != 1:
        problems.append('sitemap.xml: end tag not found exactly once')
    if about.count(ABOUT_OLD) != 1:
        problems.append('about/index.html: sentence not found exactly once')
    if 'free-sat-math-diagnostic' in blog + site + about:
        problems.append('a link to the page already exists')
if os.path.exists(PAGE):
    problems.append(PAGE + ' already exists')
if os.path.exists(BK):
    problems.append('backup folder already exists')
if problems:
    print('STOP. Nothing was changed:')
    for x in problems:
        print(' -', x)
    sys.exit(1)

for p in EDIT:
    b = os.path.join(BK, p)
    os.makedirs(os.path.dirname(b) or BK, exist_ok=True)
    shutil.copy2(p, b)
os.makedirs(os.path.dirname(PAGE))
with open(PAGE, 'wb') as f:
    f.write(src)
write('blog/index.html', blog.replace(HR, HR + CARD, 1))
write('sitemap.xml', site.replace('</urlset>', SMAP + '</urlset>', 1))
write('about/index.html', about.replace(ABOUT_OLD, ABOUT_NEW, 1))

ok = (sha_file(PAGE) == SHA and read('blog/index.html').count(CARD) == 1
      and read('sitemap.xml').count('<loc>') == site.count('<loc>') + 1
      and read('about/index.html').count(ABOUT_NEW) == 1)
if not ok:
    print('STOP. Check failed after writing. Run: python3 diagnostic_nov04.py --undo')
    sys.exit(1)
print('DONE: diagnostic page added, with blog card, sitemap entry and About link. Click Republish.')
