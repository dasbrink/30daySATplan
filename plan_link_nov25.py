#!/usr/bin/env python3
# plan_link_nov25.py | freepracticesat.com | Nov 25, 2026
# Adds plan_link.js: email links (?plan=...) open the Log In tab, and the $29
# buy button reads "Build my 10-day plan, $29" when the plan is 30 days or less.
# Changes index.html by adding ONE script line after site_stats.js. Nothing else.
# Undo: python3 plan_link_nov25.py --undo
import base64, hashlib, os, shutil, sys, zlib

INDEX = 'index.html'
NEW_FILE = 'plan_link.js'
BACKUP = '.planlink_backup_20261125'
INDEX_SHA = 'bafa96ba09e7e7c8b16cf984f10a3659f5e05f70f870fe29c42bda77273ae303'
ANCHOR = '<script src="site_stats.js?v=20261118"></script>'
TAG = '<script src="plan_link.js?v=20261125"></script>'
FILE_SHA = '10b93892a6ce9f3e6b11dbe27a1adf35670347a907b0b386493b415ae2b67612'
FILE_B64 = """
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
"""

def sha(b): return hashlib.sha256(b).hexdigest()

def new_bytes():
    data = zlib.decompress(base64.b64decode(''.join(FILE_B64.split())))
    if sha(data) != FILE_SHA:
        print('STOP. Nothing was changed: the embedded plan_link.js is damaged.'); sys.exit(1)
    return data

def install():
    data = new_bytes()
    if not os.path.exists(INDEX):
        print('STOP. Nothing was changed: index.html not found. Run this in the Replit Shell, in the main folder.'); sys.exit(1)
    idx = open(INDEX, 'rb').read()
    text = idx.decode('utf-8')
    if TAG in text and os.path.exists(NEW_FILE) and sha(open(NEW_FILE, 'rb').read()) == FILE_SHA:
        print('Already done. Nothing to change.'); return
    problems = []
    if sha(idx) != INDEX_SHA: problems.append('index.html is not the version I tested against (it changed since Nov 25).')
    if text.count(ANCHOR) != 1: problems.append('the site_stats.js line was found %d times, expected 1.' % text.count(ANCHOR))
    if 'plan_link.js' in text: problems.append('index.html already mentions plan_link.js.')
    if os.path.exists(NEW_FILE): problems.append('plan_link.js already exists.')
    if os.path.exists(BACKUP): problems.append('backup folder %s already exists.' % BACKUP)
    if problems:
        print('STOP. Nothing was changed:')
        for p in problems: print(' - ' + p)
        sys.exit(1)
    os.makedirs(BACKUP)
    shutil.copy2(INDEX, os.path.join(BACKUP, INDEX))
    open(NEW_FILE, 'wb').write(data)
    new_text = text.replace(ANCHOR, ANCHOR + '\n' + TAG, 1)
    open(INDEX, 'wb').write(new_text.encode('utf-8'))
    check = open(INDEX, 'rb').read().decode('utf-8')
    ok = check.count(TAG) == 1 and check.rstrip().endswith('</html>') and sha(open(NEW_FILE, 'rb').read()) == FILE_SHA
    if not ok:
        shutil.copy2(os.path.join(BACKUP, INDEX), INDEX)
        os.remove(NEW_FILE)
        print('STOP. The check after writing failed, so I put index.html back. Nothing is changed.'); sys.exit(1)
    print('DONE: plan_link.js added and index.html loads it. Click Republish.')

def undo():
    b = os.path.join(BACKUP, INDEX)
    if not os.path.exists(b):
        print('Nothing to undo: backup not found.'); sys.exit(1)
    shutil.copy2(b, INDEX)
    if os.path.exists(NEW_FILE):
        shutil.move(NEW_FILE, os.path.join(BACKUP, NEW_FILE + '.removed'))
    os.rename(BACKUP, BACKUP + '_undone')
    print('UNDONE: index.html restored and plan_link.js removed. Click Republish.')

if __name__ == '__main__':
    undo() if '--undo' in sys.argv else install()
