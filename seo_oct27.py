"""freepracticesat.com SEO fixes, Oct 27 2026.
Run from the Replit project root:  python3 seo_oct27.py      Undo:  python3 seo_oct27.py --undo
Changes nothing unless every file matches the version that was checked on the live site."""
import hashlib, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
E = json.load(open(os.path.join(HERE, 'edits.json'), encoding='utf-8'))
BK = os.path.join(HERE, '.seo_backup_20261027')
sha = lambda b: hashlib.sha256(b).hexdigest()

def undo():
    if not os.path.isdir(BK):
        print('STOPPED: no backup folder found, nothing to undo.'); return
    for f in E['files'].values():
        src = os.path.join(BK, f['disk'])
        if os.path.exists(src):
            shutil.copyfile(src, os.path.join(HERE, f['disk']))
    if os.path.exists(os.path.join(BK, 'ROBOTS_CREATED')):
        os.remove(os.path.join(HERE, 'robots.txt'))
    print('UNDONE: all files restored. Click Republish.')

def run():
    plan = []
    for path, f in E['files'].items():
        disk = os.path.join(HERE, f['disk'])
        if not os.path.isfile(disk):
            print('STOPPED: file not found:', f['disk'], '(nothing was changed)'); return
        raw = open(disk, 'rb').read()
        if sha(raw) == f['after']:
            plan.append((disk, None, f)); continue          # already done
        if sha(raw) != f['before']:
            print('STOPPED:', f['disk'], 'is not the version I checked (nothing was changed)'); return
        text = raw.decode('utf-8')
        for e in f['edits']:
            n = text.count(e['old'])
            if n != e['count']:
                print('STOPPED:', f['disk'], 'expected', e['count'], 'match(es), found', n, '(nothing was changed)'); return
            text = text.replace(e['old'], e['new'])
        new = text.encode('utf-8')
        if sha(new) != f['after']:
            print('STOPPED:', f['disk'], 'result did not match the checked version (nothing was changed)'); return
        plan.append((disk, new, f))
    os.makedirs(BK, exist_ok=True)
    for disk, new, f in plan:
        if new is None: continue
        b = os.path.join(BK, f['disk']); os.makedirs(os.path.dirname(b), exist_ok=True)
        if not os.path.exists(b): shutil.copyfile(disk, b)
        open(disk, 'wb').write(new)
    rob = os.path.join(HERE, 'robots.txt')
    if not os.path.exists(rob):
        open(rob, 'w', encoding='utf-8').write(E['robots'])
        open(os.path.join(BK, 'ROBOTS_CREATED'), 'w').write('1')
    print('DONE: 9 pages updated and robots.txt added. Click Republish.')

undo() if '--undo' in sys.argv else run()
