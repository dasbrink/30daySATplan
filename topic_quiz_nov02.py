#!/usr/bin/env python3
# Adds the 5-question quiz to all 50 /sat-math/ topic pages.
# Run from the site root. Undo: python3 topic_quiz_nov02.py --undo
import base64, glob, hashlib, os, shutil, sys, zlib

SHA = 'b4f0c728ede93f82c8a41af753c2fd2bacc1f2029c520a5e83efa20d0eb4a77c'
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
