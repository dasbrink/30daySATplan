# skill_fix.py  (Oct 19, 2026)  Run in the Replit Shell:  python3 skill_fix.py   (undo: python3 skill_fix.py --undo)
# Changes two blocks only:
#   script.js          the skill rule that builds random and adaptive tests
#   plan/plan_app.js   pickByDomain, used by half tests and mixed sets on plan days
# Refuses to change anything unless both files are exactly the live versions
# tested on Oct 19, and checks the finished files after writing.
import sys, re, hashlib, json, os
H = json.loads('{"script_file": "32166ea8996517c75ce3d86ff970f2c031df5ef3726f282bc32efb24ee198143", "old_block": "beed732445d108dc08361d09c52959d7996cabefbe0a847602d15e0115962b03", "new_script": "9f47c539b6af68c48a0db2170dffdd23b7fb69eb870ae8c9a7486a1de97eb995", "plan_file": "9f7bfc3df6e52762126bc2bc87345210670c04bec4a03eb37f64b32188d2de1f", "old_pick": "0922a50df75f413b72519f1dfdb8358e23303bed04e3345299e7cd49b616a4f4", "new_plan": "183126a62c9f519750723a9c3321604dee69847fb339cf5057628e3087dfbccf"}')
NEW_DEDUP = json.loads('"// \\u2500\\u2500 SKILL DEDUPLICATION \\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\n// One question per skill in a module, across ALL difficulty levels.\\n// (Until Oct 19, 2026 each level kept its own list, so one skill could\\n// appear three times in a module: once easy, once medium, once hard.)\\n// usedSkills is shared by the levels of one module. avoidSkills holds the\\n// skills Module 1 used: Module 2 avoids them when the pool allows.\\nfunction primarySkillId(question) {\\n  return (question.skillIds && question.skillIds.length > 0) ? question.skillIds[0] : null;\\n}\\n\\nfunction deduplicateBySkill(questions, count, usedSkills, avoidSkills) {\\n  const used = usedSkills || new Set();\\n  const avoid = avoidSkills || new Set();\\n  const result = [];\\n  const takenIds = new Set();\\n  // Pass 1: skills not yet in this module and not used in Module 1.\\n  for (const q of questions) {\\n    if (result.length >= count) break;\\n    const skillId = primarySkillId(q);\\n    if (skillId && (used.has(skillId) || avoid.has(skillId))) continue;\\n    result.push(q);\\n    takenIds.add(q.id);\\n    if (skillId) used.add(skillId);\\n  }\\n  // Pass 2: if still short, allow Module 1 skills (still one per skill here).\\n  for (const q of questions) {\\n    if (result.length >= count) break;\\n    if (takenIds.has(q.id)) continue;\\n    const skillId = primarySkillId(q);\\n    if (skillId && used.has(skillId)) continue;\\n    result.push(q);\\n    takenIds.add(q.id);\\n    if (skillId) used.add(skillId);\\n  }\\n  return result;\\n}\\n\\nfunction selectRandomModule(pool, count, difficultyProfile, excludeIds) {\\n  const shuffle = fisherYatesShuffle;\\n  const exclude = excludeIds || new Set();\\n  const available = pool.filter(q => !exclude.has(q.id));\\n\\n  // When building Module 2, collect the skills Module 1 used.\\n  const avoidSkills = new Set();\\n  if (exclude.size > 0 && typeof module1Questions !== \'undefined\' && Array.isArray(module1Questions)) {\\n    for (const q of module1Questions) {\\n      if (!exclude.has(q.id)) continue;\\n      const skillId = primarySkillId(q);\\n      if (skillId) avoidSkills.add(skillId);\\n    }\\n  }\\n\\n  const byLevel = {\\n    hard: shuffle(available.filter(q => q.difficulty === \'Hard\')),\\n    medium: shuffle(available.filter(q => q.difficulty === \'Medium\')),\\n    easy: shuffle(available.filter(q => q.difficulty === \'Easy\'))\\n  };\\n\\n  // One shared skill list for the whole module. Hard is filled first\\n  // because it has the fewest questions.\\n  const usedSkills = new Set();\\n  let combined = [];\\n  for (const level of [\'hard\', \'medium\', \'easy\']) {\\n    const n = difficultyProfile[level] || 0;\\n    if (n > 0) combined = combined.concat(deduplicateBySkill(byLevel[level], n, usedSkills, avoidSkills));\\n  }\\n\\n  // Top up if a level ran short: new skills first, then skills Module 1\\n  // used, and only as a last resort a repeated skill, so the module\\n  // always reaches its full count.\\n  if (combined.length < count) {\\n    const usedIds = new Set(combined.map(q => q.id));\\n    const leftover = shuffle(available.filter(q => !usedIds.has(q.id)));\\n    const passes = [\\n      q => { const s = primarySkillId(q); return !s || (!usedSkills.has(s) && !avoidSkills.has(s)); },\\n      q => { const s = primarySkillId(q); return !s || !usedSkills.has(s); },\\n      q => true\\n    ];\\n    for (const allowed of passes) {\\n      for (const q of leftover) {\\n        if (combined.length >= count) break;\\n        if (usedIds.has(q.id) || !allowed(q)) continue;\\n        combined.push(q);\\n        usedIds.add(q.id);\\n        const s = primarySkillId(q);\\n        if (s) usedSkills.add(s);\\n      }\\n    }\\n  }\\n\\n  return shuffle(combined.slice(0, count));\\n}"')
NEW_PICK = json.loads('"  function pickByDomain(qs, weights, sk) {\\n    var dom = new Map(); sk.forEach(function (s) { dom.set(s.id, s.domain); });\\n    var out = [];\\n    var usedSkills = new Set();\\n    Object.keys(weights).forEach(function (d) {\\n      var inDom = unseenFirst(qs.filter(function (q) { return dom.get(q.skill) === d && out.indexOf(q) < 0; }));\\n      var picked = [];\\n      // One question per skill first (no near-copies), then fill if the area runs short.\\n      inDom.forEach(function (q) {\\n        if (picked.length < weights[d] && !(q.skill && usedSkills.has(q.skill))) { picked.push(q); if (q.skill) usedSkills.add(q.skill); }\\n      });\\n      inDom.forEach(function (q) {\\n        if (picked.length < weights[d] && picked.indexOf(q) < 0) { picked.push(q); if (q.skill) usedSkills.add(q.skill); }\\n      });\\n      out = out.concat(picked);\\n    });\\n    return out;\\n  }"')
def sha(s): return hashlib.sha256(s.encode("utf-8")).hexdigest()
def rd(p):
    with open(p, encoding="utf-8", newline="") as f: return f.read()
def wr(p, s):
    with open(p, "w", encoding="utf-8", newline="") as f: f.write(s)
F1, F2 = "script.js", "plan/plan_app.js"
B1, B2 = "script.backup-before-skillfix.js", "plan/plan_app.backup-before-skillfix.js"
def stop(msg):
    print("STOPPED: " + msg + "\nNothing was changed."); sys.exit(1)

if "--undo" in sys.argv:
    if not (os.path.exists(B1) and os.path.exists(B2)): stop("backup files not found")
    wr(F1, rd(B1)); wr(F2, rd(B2))
    ok = sha(rd(F1)) == H["script_file"] and sha(rd(F2)) == H["plan_file"]
    print("UNDONE: both files are back to the Oct 19 versions. Click Republish." if ok else "Restored from backups (they differ from the Oct 19 originals).")
    sys.exit(0)

s1, s2 = rd(F1), rd(F2)
if sha(s1) == H["new_script"] and sha(s2) == H["new_plan"]:
    print("ALREADY DONE: both files already have the fix. Click Republish if you have not."); sys.exit(0)
if sha(s1) != H["script_file"]: stop("script.js here is not the version tested (it differs from the live site)")
if sha(s2) != H["plan_file"]: stop("plan/plan_app.js here is not the version tested (it differs from the live site)")

a = s1.find("// ── SKILL DEDUPLICATION")
b = s1.find("// ── FIXED TES", a) if a >= 0 else -1
if a < 0 or b < 0: stop("could not find the skill block in script.js")
old_block = re.sub(r"\s+\Z", "", s1[a:b])
if sha(old_block) != H["old_block"]: stop("the skill block in script.js is not the one tested")
n1 = s1[:a] + NEW_DEDUP + s1[a + len(old_block):]

lines = s2.split("\n")
pa = next((i for i, l in enumerate(lines) if re.match(r"^\s*function pickByDomain\(", l)), -1)
if pa < 0: stop("could not find pickByDomain in plan/plan_app.js")
ind = len(re.match(r"^\s*", lines[pa]).group(0))
pb = pa
while pb < len(lines) and not (re.match(r"^\s*}\s*$", lines[pb]) and len(re.match(r"^\s*", lines[pb]).group(0)) == ind): pb += 1
old_pick = "\n".join(lines[pa:pb + 1])
if sha(old_pick) != H["old_pick"]: stop("pickByDomain in plan/plan_app.js is not the one tested")
n2 = s2.replace(old_pick, NEW_PICK, 1)

if sha(n1) != H["new_script"]: stop("the new script.js did not come out as expected")
if sha(n2) != H["new_plan"]: stop("the new plan/plan_app.js did not come out as expected")

wr(B1, s1); wr(B2, s2); wr(F1, n1); wr(F2, n2)
if not (sha(rd(F1)) == H["new_script"] and sha(rd(F2)) == H["new_plan"]):
    wr(F1, s1); wr(F2, s2); stop("files did not read back correctly, originals put back")
print("DONE: both files updated and checked. Backups: " + B1 + ", " + B2 + ". Now click Republish.")
