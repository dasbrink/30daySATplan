// skill_fix.js  (Oct 19, 2026)  Run in the Replit Shell:  node skill_fix.js   (undo: node skill_fix.js --undo)
// Changes two blocks only:
//   script.js          the skill rule that builds random and adaptive tests
//   plan/plan_app.js   pickByDomain, used by half tests and mixed sets on plan days
// Refuses to change anything unless both files are exactly the live versions
// that were tested on Oct 19, and checks the finished files after writing.
const fs = require('fs'), crypto = require('crypto');
const H = {"script_file": "32166ea8996517c75ce3d86ff970f2c031df5ef3726f282bc32efb24ee198143", "old_block": "beed732445d108dc08361d09c52959d7996cabefbe0a847602d15e0115962b03", "new_script": "9f47c539b6af68c48a0db2170dffdd23b7fb69eb870ae8c9a7486a1de97eb995", "plan_file": "9f7bfc3df6e52762126bc2bc87345210670c04bec4a03eb37f64b32188d2de1f", "old_pick": "0922a50df75f413b72519f1dfdb8358e23303bed04e3345299e7cd49b616a4f4", "new_plan": "183126a62c9f519750723a9c3321604dee69847fb339cf5057628e3087dfbccf"};
const NEW_DEDUP = "// ── SKILL DEDUPLICATION ─────────────────────────────────────────\n// One question per skill in a module, across ALL difficulty levels.\n// (Until Oct 19, 2026 each level kept its own list, so one skill could\n// appear three times in a module: once easy, once medium, once hard.)\n// usedSkills is shared by the levels of one module. avoidSkills holds the\n// skills Module 1 used: Module 2 avoids them when the pool allows.\nfunction primarySkillId(question) {\n  return (question.skillIds && question.skillIds.length > 0) ? question.skillIds[0] : null;\n}\n\nfunction deduplicateBySkill(questions, count, usedSkills, avoidSkills) {\n  const used = usedSkills || new Set();\n  const avoid = avoidSkills || new Set();\n  const result = [];\n  const takenIds = new Set();\n  // Pass 1: skills not yet in this module and not used in Module 1.\n  for (const q of questions) {\n    if (result.length >= count) break;\n    const skillId = primarySkillId(q);\n    if (skillId && (used.has(skillId) || avoid.has(skillId))) continue;\n    result.push(q);\n    takenIds.add(q.id);\n    if (skillId) used.add(skillId);\n  }\n  // Pass 2: if still short, allow Module 1 skills (still one per skill here).\n  for (const q of questions) {\n    if (result.length >= count) break;\n    if (takenIds.has(q.id)) continue;\n    const skillId = primarySkillId(q);\n    if (skillId && used.has(skillId)) continue;\n    result.push(q);\n    takenIds.add(q.id);\n    if (skillId) used.add(skillId);\n  }\n  return result;\n}\n\nfunction selectRandomModule(pool, count, difficultyProfile, excludeIds) {\n  const shuffle = fisherYatesShuffle;\n  const exclude = excludeIds || new Set();\n  const available = pool.filter(q => !exclude.has(q.id));\n\n  // When building Module 2, collect the skills Module 1 used.\n  const avoidSkills = new Set();\n  if (exclude.size > 0 && typeof module1Questions !== 'undefined' && Array.isArray(module1Questions)) {\n    for (const q of module1Questions) {\n      if (!exclude.has(q.id)) continue;\n      const skillId = primarySkillId(q);\n      if (skillId) avoidSkills.add(skillId);\n    }\n  }\n\n  const byLevel = {\n    hard: shuffle(available.filter(q => q.difficulty === 'Hard')),\n    medium: shuffle(available.filter(q => q.difficulty === 'Medium')),\n    easy: shuffle(available.filter(q => q.difficulty === 'Easy'))\n  };\n\n  // One shared skill list for the whole module. Hard is filled first\n  // because it has the fewest questions.\n  const usedSkills = new Set();\n  let combined = [];\n  for (const level of ['hard', 'medium', 'easy']) {\n    const n = difficultyProfile[level] || 0;\n    if (n > 0) combined = combined.concat(deduplicateBySkill(byLevel[level], n, usedSkills, avoidSkills));\n  }\n\n  // Top up if a level ran short: new skills first, then skills Module 1\n  // used, and only as a last resort a repeated skill, so the module\n  // always reaches its full count.\n  if (combined.length < count) {\n    const usedIds = new Set(combined.map(q => q.id));\n    const leftover = shuffle(available.filter(q => !usedIds.has(q.id)));\n    const passes = [\n      q => { const s = primarySkillId(q); return !s || (!usedSkills.has(s) && !avoidSkills.has(s)); },\n      q => { const s = primarySkillId(q); return !s || !usedSkills.has(s); },\n      q => true\n    ];\n    for (const allowed of passes) {\n      for (const q of leftover) {\n        if (combined.length >= count) break;\n        if (usedIds.has(q.id) || !allowed(q)) continue;\n        combined.push(q);\n        usedIds.add(q.id);\n        const s = primarySkillId(q);\n        if (s) usedSkills.add(s);\n      }\n    }\n  }\n\n  return shuffle(combined.slice(0, count));\n}";
const NEW_PICK = "  function pickByDomain(qs, weights, sk) {\n    var dom = new Map(); sk.forEach(function (s) { dom.set(s.id, s.domain); });\n    var out = [];\n    var usedSkills = new Set();\n    Object.keys(weights).forEach(function (d) {\n      var inDom = unseenFirst(qs.filter(function (q) { return dom.get(q.skill) === d && out.indexOf(q) < 0; }));\n      var picked = [];\n      // One question per skill first (no near-copies), then fill if the area runs short.\n      inDom.forEach(function (q) {\n        if (picked.length < weights[d] && !(q.skill && usedSkills.has(q.skill))) { picked.push(q); if (q.skill) usedSkills.add(q.skill); }\n      });\n      inDom.forEach(function (q) {\n        if (picked.length < weights[d] && picked.indexOf(q) < 0) { picked.push(q); if (q.skill) usedSkills.add(q.skill); }\n      });\n      out = out.concat(picked);\n    });\n    return out;\n  }";
const sha = s => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const F1 = 'script.js', F2 = 'plan/plan_app.js';
const B1 = 'script.backup-before-skillfix.js', B2 = 'plan/plan_app.backup-before-skillfix.js';
function stop(msg) { console.log('STOPPED: ' + msg + '\nNothing was changed.'); process.exit(1); }

if (process.argv.includes('--undo')) {
  if (!fs.existsSync(B1) || !fs.existsSync(B2)) stop('backup files not found');
  fs.writeFileSync(F1, fs.readFileSync(B1, 'utf8'), 'utf8');
  fs.writeFileSync(F2, fs.readFileSync(B2, 'utf8'), 'utf8');
  const ok = sha(fs.readFileSync(F1, 'utf8')) === H.script_file && sha(fs.readFileSync(F2, 'utf8')) === H.plan_file;
  console.log(ok ? 'UNDONE: both files are back to the Oct 19 versions. Click Republish.' : 'Restored from backups (files differ from Oct 19 originals).');
  process.exit(0);
}

const s1 = fs.readFileSync(F1, 'utf8'), s2 = fs.readFileSync(F2, 'utf8');
if (sha(s1) === H.new_script && sha(s2) === H.new_plan) { console.log('ALREADY DONE: both files already have the fix. Click Republish if you have not.'); process.exit(0); }
if (sha(s1) !== H.script_file) stop('script.js here is not the version tested (it differs from the live site)');
if (sha(s2) !== H.plan_file) stop('plan/plan_app.js here is not the version tested (it differs from the live site)');

const a = s1.indexOf('// ── SKILL DEDUPLICATION'), b = s1.indexOf('// ── FIXED TES', a);
if (a < 0 || b < 0) stop('could not find the skill block in script.js');
const oldBlock = s1.slice(a, b).replace(/\s+$/, '');
if (sha(oldBlock) !== H.old_block) stop('the skill block in script.js is not the one tested');
const n1 = s1.slice(0, a) + NEW_DEDUP + s1.slice(a + oldBlock.length);

const lines = s2.split('\n');
const pa = lines.findIndex(l => /^\s*function pickByDomain\(/.test(l));
if (pa < 0) stop('could not find pickByDomain in plan/plan_app.js');
const ind = lines[pa].match(/^\s*/)[0].length;
let pb = pa;
while (pb < lines.length && !(/^\s*}\s*$/.test(lines[pb]) && lines[pb].match(/^\s*/)[0].length === ind)) pb++;
const oldPick = lines.slice(pa, pb + 1).join('\n');
if (sha(oldPick) !== H.old_pick) stop('pickByDomain in plan/plan_app.js is not the one tested');
const n2 = s2.replace(oldPick, NEW_PICK);

if (sha(n1) !== H.new_script) stop('the new script.js did not come out as expected');
if (sha(n2) !== H.new_plan) stop('the new plan/plan_app.js did not come out as expected');

fs.writeFileSync(B1, s1, 'utf8');
fs.writeFileSync(B2, s2, 'utf8');
fs.writeFileSync(F1, n1, 'utf8');
fs.writeFileSync(F2, n2, 'utf8');
const ok = sha(fs.readFileSync(F1, 'utf8')) === H.new_script && sha(fs.readFileSync(F2, 'utf8')) === H.new_plan;
if (!ok) { fs.writeFileSync(F1, s1, 'utf8'); fs.writeFileSync(F2, s2, 'utf8'); stop('files did not read back correctly, originals put back'); }
console.log('DONE: both files updated and checked. Backups: ' + B1 + ', ' + B2 + '. Now click Republish.');
