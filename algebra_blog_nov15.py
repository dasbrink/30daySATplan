#!/usr/bin/env python3
"""algebra_blog_nov15.py: adds the blog post for Algebra 1 teachers,
a card at the top of /blog/ and a line in sitemap.xml.
Run:  python3 algebra_blog_nov15.py        Undo:  python3 algebra_blog_nov15.py --undo
"""
import os, sys, zlib, base64, hashlib, shutil, glob

PAGE_PATH = 'blog/five-algebra-1-questions-sat-students-miss.html'
PAGE_B64 = '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'
PAGE_SHA = '275724375d5bbdb8233f87cfb69c356b06145f785944997f53c683d01b82d779'
BACKUP = '.algblog_backup_20261115'
URL = 'https://freepracticesat.com/blog/five-algebra-1-questions-sat-students-miss.html'

BLOG = 'blog/index.html'
BLOG_ANCHOR = '<hr class="gold-rule">'
CARD = ('\n<a class="post-card" href="/blog/five-algebra-1-questions-sat-students-miss.html">\n'
        '<p class="meta">For Teachers &middot; November 15, 2026</p>\n'
        '<h2>Five Algebra 1 Questions SAT Students Keep Missing</h2>\n'
        '<p>From 25,000 student answers: the Algebra questions students miss most, the wrong answers they pick, and what I would do about each one in class.</p>\n'
        '</a>')

SITEMAP = 'sitemap.xml'
SM_ANCHOR = '</urlset>'
SM_ENTRY = ('  <url>\n    <loc>' + URL + '</loc>\n    <lastmod>2026-11-15</lastmod>\n  </url>\n')

def page_bytes():
    data = zlib.decompress(base64.b64decode(PAGE_B64))
    if hashlib.sha256(data).hexdigest() != PAGE_SHA:
        print('STOP. Nothing was changed: the embedded page is damaged.'); sys.exit(1)
    return data

def read(p):
    return open(p, encoding='utf-8').read()

def undo():
    if not os.path.isdir(BACKUP):
        print('Nothing to undo: no backup folder ' + BACKUP); sys.exit(1)
    for name in (BLOG, SITEMAP):
        b = os.path.join(BACKUP, name.replace('/', '__'))
        if os.path.exists(b):
            shutil.copy2(b, name)
    if os.path.exists(PAGE_PATH):
        shutil.move(PAGE_PATH, os.path.join(BACKUP, 'removed__' + os.path.basename(PAGE_PATH)))
    print('UNDONE: blog post removed, /blog/ and sitemap.xml restored. Click Republish.')

def main():
    if '--undo' in sys.argv:
        undo(); return
    data = page_bytes()
    problems = []
    for p in (BLOG, SITEMAP):
        if not os.path.exists(p): problems.append(p + ' not found (run this from the main folder)')
    if problems:
        print('STOP. Nothing was changed:'); [print(' - ' + x) for x in problems]; sys.exit(1)
    blog, sm = read(BLOG), read(SITEMAP)
    page_ok = os.path.exists(PAGE_PATH) and hashlib.sha256(open(PAGE_PATH,'rb').read()).hexdigest() == PAGE_SHA
    card_in = 'five-algebra-1-questions-sat-students-miss.html' in blog
    sm_in = URL in sm
    if page_ok and card_in and sm_in:
        print('Already done. Nothing to change.'); return
    if os.path.exists(PAGE_PATH) and not page_ok: problems.append(PAGE_PATH + ' already exists with different content')
    if card_in: problems.append('/blog/ already links the post')
    if sm_in: problems.append('sitemap.xml already lists the post')
    if blog.count(BLOG_ANCHOR) != 1: problems.append('blog/index.html: expected the gold rule line once, found %d' % blog.count(BLOG_ANCHOR))
    if sm.count(SM_ANCHOR) != 1: problems.append('sitemap.xml: expected </urlset> once, found %d' % sm.count(SM_ANCHOR))
    if problems:
        print('STOP. Nothing was changed:'); [print(' - ' + x) for x in problems]; sys.exit(1)
    os.makedirs(BACKUP, exist_ok=True)
    for p in (BLOG, SITEMAP):
        shutil.copy2(p, os.path.join(BACKUP, p.replace('/', '__')))
    with open(PAGE_PATH, 'wb') as f: f.write(data)
    new_blog = blog.replace(BLOG_ANCHOR, BLOG_ANCHOR + CARD, 1)
    new_sm = sm.replace(SM_ANCHOR, SM_ENTRY + SM_ANCHOR, 1)
    open(BLOG, 'w', encoding='utf-8').write(new_blog)
    open(SITEMAP, 'w', encoding='utf-8').write(new_sm)
    ok = (hashlib.sha256(open(PAGE_PATH,'rb').read()).hexdigest() == PAGE_SHA
          and read(BLOG).count('five-algebra-1-questions-sat-students-miss.html') == 1
          and read(SITEMAP).count(URL) == 1 and read(SITEMAP).rstrip().endswith('</urlset>'))
    if not ok:
        undo(); print('STOP. The check after writing failed, so everything was put back.'); sys.exit(1)
    print('DONE: blog post for Algebra 1 teachers added, with a card on /blog/ and a sitemap line. Click Republish.')

main()
