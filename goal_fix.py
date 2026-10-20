# goal_fix.py  (Oct 19, 2026)  Run in the Replit Shell:  python3 goal_fix.py   (undo: python3 goal_fix.py --undo)
# Rewords the goal question shown after Test 1, and bumps the version tag on its script link:
#   plan_stage1.js  "What math score would you love to get?"  ->  "What math score are you aiming for on test day?"
#                   note "Math only, out of 800."  ->  "The score you'd be happy with, not your dream score. Math only, out of 800."
#   index.html      plan_stage1.js?v=20261015_234949  ->  plan_stage1.js?v=20261019_goal
# Refuses to change anything unless both files are exactly the live versions checked on Oct 19.
import sys, hashlib, os
H = {"stage": "19303be29af28bfa006fe871f0779c4e6c95ac8269dc4c912a6b17043a97ac73",
     "new_stage": "cc895228ac31eb34098dcd9b988f0b21eb5c598f41900075484bdeae7fa54685",
     "index": "a7354799164cce2cff728b35f5408ed24915264662299ca026e0b64b4f4ba3e3",
     "new_index": "13f0f92d8f6c1e103af593adeb88489b56f0380a78c10a9849ad0eed6337bf40"}
F1, F2 = "plan_stage1.js", "index.html"
B1, B2 = "plan_stage1.backup-before-goalfix.js", "index.backup-before-goalfix.html"
EDITS1 = [("What math score would you love to get?</label>", "What math score are you aiming for on test day?</label>"),
          ('<div class="pq-note">Math only, out of 800.</div>', '<div class="pq-note">The score you\\\'d be happy with, not your dream score. Math only, out of 800.</div>')]
EDITS2 = [("plan_stage1.js?v=20261015_234949", "plan_stage1.js?v=20261019_goal")]
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
if sha(s1) == H["new_stage"] and sha(s2) == H["new_index"]:
    print("ALREADY DONE. Click Republish if you have not."); sys.exit(0)
if sha(s1) != H["stage"]: stop("plan_stage1.js here is not the version checked (it differs from the live site)")
if sha(s2) != H["index"]: stop("index.html here is not the version checked (it differs from the live site)")
n1, n2 = s1, s2
for o, n in EDITS1:
    if n1.count(o) != 1: stop("text not found exactly once in plan_stage1.js")
    n1 = n1.replace(o, n)
for o, n in EDITS2:
    if n2.count(o) != 1: stop("text not found exactly once in index.html")
    n2 = n2.replace(o, n)
if sha(n1) != H["new_stage"] or sha(n2) != H["new_index"]: stop("the new files did not come out as expected")
wr(B1, s1); wr(B2, s2); wr(F1, n1); wr(F2, n2)
if not (sha(rd(F1)) == H["new_stage"] and sha(rd(F2)) == H["new_index"]):
    wr(F1, s1); wr(F2, s2); stop("files did not read back correctly, originals put back")
print("DONE: question reworded and checked. Now click Republish.")
