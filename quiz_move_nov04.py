#!/usr/bin/env python3
# Moves the 5-question quiz up on all 50 /sat-math/ topic pages, to just before
# the worked examples, and counts readers who reach it (/_quiz/seen).
# Run from the site root. Undo: python3 quiz_move_nov04.py --undo
import base64, glob, hashlib, os, shutil, sys, zlib

OLD_SHA = 'b4f0c728ede93f82c8a41af753c2fd2bacc1f2029c520a5e83efa20d0eb4a77c'
SHA = 'd1633cd6ca8980159a745d6780f0b16678f5987de8d1ed17a0fab6056e3ef314'
DATA = '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'
JS = 'topic_quiz.js'
OLD_TAG = '<script src="/topic_quiz.js?v=20261102"></script>'
TAG = '<script src="/topic_quiz.js?v=20261104"></script>'
BK = '.quizmove_backup_20261104'
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
    for p in pages + [JS]:
        b = os.path.join(BK, p)
        if os.path.exists(b):
            shutil.copy2(b, p)
    print('UNDONE: the quiz is back at the end of the topic pages. Click Republish.')
    sys.exit(0)

src = zlib.decompress(base64.b64decode(DATA))
problems = []
if hashlib.sha256(src).hexdigest() != SHA:
    problems.append('embedded file failed its check')
if len(pages) != EXPECT:
    problems.append('found %d topic pages, expected %d' % (len(pages), EXPECT))
if not os.path.exists(JS):
    problems.append(JS + ' not found')
elif sha_file(JS) == SHA and all(read(p).count(TAG) == 1 for p in pages):
    print('Already done. Nothing to change.')
    sys.exit(0)
elif sha_file(JS) != OLD_SHA:
    problems.append(JS + ' is not the expected version')
if os.path.exists(BK):
    problems.append('backup folder already exists')
for p in pages:
    if read(p).count(OLD_TAG) != 1:
        problems.append(p + ': quiz script line not found exactly once')
if problems:
    print('STOP. Nothing was changed:')
    for x in problems:
        print(' -', x)
    sys.exit(1)

for p in pages + [JS]:
    b = os.path.join(BK, p)
    os.makedirs(os.path.dirname(b) or BK, exist_ok=True)
    shutil.copy2(p, b)
with open(JS, 'wb') as f:
    f.write(src)
for p in pages:
    write(p, read(p).replace(OLD_TAG, TAG))

bad = [p for p in pages if read(p).count(TAG) != 1 or OLD_TAG in read(p)]
if bad or sha_file(JS) != SHA:
    print('STOP. Check failed after writing. Run: python3 quiz_move_nov04.py --undo')
    sys.exit(1)
print('DONE: quiz moved up on %d topic pages. Click Republish.' % len(pages))
