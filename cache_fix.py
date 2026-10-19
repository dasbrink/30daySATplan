# cache_fix.py  (Oct 19, 2026)  Run in the Replit Shell:  python3 cache_fix.py   (undo: python3 cache_fix.py --undo)
# Adds a version tag to two script links so every browser loads the new test builder:
#   index.html        script.js            ->  script.js?v=20261019
#   plan/index.html   plan_app.js?v=20261015_234949  ->  plan_app.js?v=20261019_skillfix
# Refuses to change anything unless both files are exactly the live versions checked on Oct 19.
import sys, hashlib, os
H = {"index": "b7a55631177e12d46c6692510afd6dbf9940f0eeb9d8a5ca86b04a6c03fb30f2",
     "new_index": "a7354799164cce2cff728b35f5408ed24915264662299ca026e0b64b4f4ba3e3",
     "plan": "d11cec2b33996f80534fddd2ed50fb0e259072d76e488f5d178e812d5a4c2797",
     "new_plan": "024df546f208b786f757b7a713d357eba5aeeb9f46191a99e901872450f4566b"}
F1, F2 = "index.html", "plan/index.html"
B1, B2 = "index.backup-before-cachefix.html", "plan/index.backup-before-cachefix.html"
OLD1, NEW1 = '<script src="script.js"></script>', '<script src="script.js?v=20261019"></script>'
OLD2, NEW2 = '/plan/plan_app.js?v=20261015_234949', '/plan/plan_app.js?v=20261019_skillfix'
def sha(s): return hashlib.sha256(s.encode("utf-8")).hexdigest()
def rd(p):
    with open(p, encoding="utf-8", newline="") as f: return f.read()
def wr(p, s):
    with open(p, "w", encoding="utf-8", newline="") as f: f.write(s)
def stop(m):
    print("STOPPED: " + m + "\nNothing was changed."); sys.exit(1)
if "--undo" in sys.argv:
    if not (os.path.exists(B1) and os.path.exists(B2)): stop("backup files not found")
    wr(F1, rd(B1)); wr(F2, rd(B2)); print("UNDONE. Click Republish."); sys.exit(0)
s1, s2 = rd(F1), rd(F2)
if sha(s1) == H["new_index"] and sha(s2) == H["new_plan"]:
    print("ALREADY DONE. Click Republish if you have not."); sys.exit(0)
if sha(s1) != H["index"]: stop("index.html here is not the version checked (it differs from the live site)")
if sha(s2) != H["plan"]: stop("plan/index.html here is not the version checked (it differs from the live site)")
if s1.count(OLD1) != 1 or s2.count(OLD2) != 1: stop("the script links were not found exactly once")
n1, n2 = s1.replace(OLD1, NEW1), s2.replace(OLD2, NEW2)
if sha(n1) != H["new_index"] or sha(n2) != H["new_plan"]: stop("the new files did not come out as expected")
wr(B1, s1); wr(B2, s2); wr(F1, n1); wr(F2, n2)
if not (sha(rd(F1)) == H["new_index"] and sha(rd(F2)) == H["new_plan"]):
    wr(F1, s1); wr(F2, s2); stop("files did not read back correctly, originals put back")
print("DONE: both script links updated and checked. Now click Republish.")
