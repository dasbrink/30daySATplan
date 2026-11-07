#!/usr/bin/env python3
"""Title change on /december-sat-plan/ (Nov 7). Undo: python3 dectitle_nov07.py --undo"""
import hashlib, os, shutil, sys
P=os.path.join("december-sat-plan","index.html")
OLD_SHA="4f7417c275f846bd021d81a9c7ba1e2dea163ee67066517879479114daa5f4ed"
NEW_SHA="b375eb351327ffc79afa8555bd73213a578c0e2d087c7843916950bf16a42d1a"
OLD='A custom built math plan for the December 5 SAT'; NEW='A custom built math plan for your December 5 SAT'
B=".dectitle_backup_20261107"
def sha(b): return hashlib.sha256(b).hexdigest()
if "--undo" in sys.argv:
    src=os.path.join(B,"index.html")
    if not os.path.exists(src): print("Nothing to undo."); sys.exit(1)
    shutil.copy2(src,P); print("UNDONE: old title restored. Click Republish."); sys.exit(0)
if not os.path.exists(P): print("STOP. Nothing was changed: page not found."); sys.exit(1)
b=open(P,"rb").read()
if sha(b)==NEW_SHA: print("Already done. Nothing to change."); sys.exit(0)
if sha(b)!=OLD_SHA: print("STOP. Nothing was changed: the page differs from the tested version."); sys.exit(1)
os.makedirs(B,exist_ok=True); shutil.copy2(P,os.path.join(B,"index.html"))
t=b.decode("utf-8").replace(OLD,NEW)
open(P,"wb").write(t.encode("utf-8"))
if sha(open(P,"rb").read())!=NEW_SHA: print("Something went wrong. Run: python3 dectitle_nov07.py --undo"); sys.exit(1)
print("DONE: title now reads 'for your December 5 SAT'. Click Republish.")
