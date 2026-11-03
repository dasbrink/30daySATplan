#!/usr/bin/env python3
# Adds the 5-question quiz to all 50 /sat-math/ topic pages.
# Run from the site root. Undo: python3 topic_quiz_nov02.py --undo
import base64, glob, hashlib, os, shutil, sys, zlib

SHA = '9957e8c03f594bab585d165022252bba2afffb4d3eae32209ca81fe638bb8bcb'
DATA = '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'
NEW = 'topic_quiz.js'
TAG = '<script src="/topic_quiz.js?v=20261102"></script>'
BK = '.topicquiz_backup_20261102'
EXPECT = 50

pages = sorted(glob.glob('sat-math/*/index.html'))

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
    for p in pages:
        b = os.path.join(BK, p)
        if os.path.exists(b):
            shutil.copy2(b, p)
    if os.path.exists(NEW):
        shutil.move(NEW, os.path.join(BK, NEW + '.removed'))
    print('UNDONE: quiz removed from the topic pages. Click Republish.')
    sys.exit(0)

src = zlib.decompress(base64.b64decode(DATA))
problems = []
if hashlib.sha256(src).hexdigest() != SHA:
    problems.append('embedded file failed its check')
if len(pages) != EXPECT:
    problems.append('found %d topic pages, expected %d' % (len(pages), EXPECT))

tagged = [p for p in pages if TAG in read(p)]
if len(tagged) == len(pages) and os.path.exists(NEW) and sha_file(NEW) == SHA:
    print('Already done. Nothing to change.')
    sys.exit(0)
if tagged:
    problems.append('%d pages already have the tag' % len(tagged))
if os.path.exists(NEW):
    problems.append(NEW + ' already exists')
if os.path.exists(BK):
    problems.append('backup folder already exists')
for p in pages:
    t = read(p)
    if t.count('</body>') != 1:
        problems.append(p + ': </body> not found exactly once')
    if t.count('class="cta-block"') != 1:
        problems.append(p + ': cta-block not found exactly once')
if problems:
    print('STOP. Nothing was changed:')
    for x in problems:
        print(' -', x)
    sys.exit(1)

for p in pages:
    b = os.path.join(BK, p)
    os.makedirs(os.path.dirname(b), exist_ok=True)
    shutil.copy2(p, b)
with open(NEW, 'wb') as f:
    f.write(src)
for p in pages:
    t = read(p)
    write(p, t.replace('</body>', TAG + '\n</body>'))

bad = [p for p in pages if read(p).count(TAG) != 1 or read(p).count('</body>') != 1]
if bad or sha_file(NEW) != SHA:
    print('STOP. Check failed after writing. Run: python3 topic_quiz_nov02.py --undo')
    sys.exit(1)
print('DONE: 5-question quiz added to %d topic pages. Click Republish.' % len(pages))
