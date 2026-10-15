// ══════════════════════════════════════════════════════════════
// plan_app.js | freepracticesat.com/plan/
//
// The paid custom plan. Oct 15, 2026.
// Design: project doc claude/custom-plan-design-oct15.md
//
// Reads: plans, plan_profiles, plan_progress, questions_seen, test_results,
// bluebook_scores (Supabase, the student's own rows only) and the question
// bank through the Airtable relay.
// Writes: plan_progress, bluebook_scores, questions_seen, plan_profiles.
// ══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var SUPABASE_URL = 'https://undhvypblihwzojqkgsd.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_R49zB0bIjxMtlzx0qUasxw_Wmz92coq';
  var DESMOS_SRC = 'https://www.desmos.com/api/v1.10/calculator.js?apiKey=2f23c0c34b08448e8e167dba1a6c32c4';
  var PC = window.PlanCore;
  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  var app = document.getElementById('app');

  var S = { user: null, plan: null, profile: null, progress: [], ranked: null, days: [], win: null, seen: new Set(), todayN: 1, openN: 1 };

  // ── small helpers ────────────────────────────────────────────
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function hasHTML(s) { return /<\s*(table|svg|div|span|p|br|img|sub|sup|b|i|strong|em|ul|ol|li)\b/i.test(String(s || '')); }
  function stripComments(s) { return String(s || '').replace(/<!--[\s\S]*?-->/g, '').replace(/\[BATCH[^\]]*\]/g, ''); }
  function rich(s) {
    var t = stripComments(s);
    if (!hasHTML(t)) t = esc(t);
    return t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|\n)\s*###\s+([^\n]+)/g, '$1<strong>$2</strong>')
      .replace(/\n/g, '<br>');
  }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function typeset(el) {
    function go() { if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([el]).catch(function () {}); }
    if (window.MathJax && MathJax.typesetPromise) go(); else setTimeout(function () { go(); }, 600);
  }
  function setHTML(html) { app.innerHTML = html; typeset(app); window.scrollTo(0, 0); }
  function dayDate(n) { return PC.addDays(S.plan.start_date, n - 1); }

  // ── calculator: fixed to the screen, so short pages cannot squash it ──
  var calc = null, desmosLoading = null;
  function loadDesmos() {
    if (window.Desmos) return Promise.resolve();
    if (desmosLoading) return desmosLoading;
    desmosLoading = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = DESMOS_SRC; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
    return desmosLoading;
  }
  function openCalc() {
    document.getElementById('calc').hidden = false;
    document.body.classList.add('calc-open');
    loadDesmos().then(function () {
      if (!calc) calc = Desmos.GraphingCalculator(document.getElementById('calc-mount'), { expressionsCollapsed: false, settingsMenu: false });
      setTimeout(function () { try { calc.resize(); } catch (e) {} }, 30);
    });
  }
  function closeCalc() { document.getElementById('calc').hidden = true; document.body.classList.remove('calc-open'); }
  document.getElementById('calc-btn').onclick = openCalc;
  document.getElementById('calc-close').onclick = closeCalc;
  function calcResize() { if (calc) try { calc.resize(); } catch (e) {} }
  // Drag to resize. Width on a computer, height on a phone. Remembered on this device.
  (function () {
    var root = document.documentElement, panel = document.getElementById('calc'), grip = document.getElementById('calc-grip');
    function phone() { return window.matchMedia('(max-width: 900px)').matches; }
    function clampW(w) { return Math.round(Math.max(340, Math.min(w, window.innerWidth * 0.75))); }
    function clampH(h) { return Math.round(Math.max(220, Math.min(h, window.innerHeight * 0.9))); }
    function apply(saved) {
      if (saved.w) root.style.setProperty('--calc-w', clampW(saved.w) + 'px');
      if (saved.h) root.style.setProperty('--calc-h', clampH(saved.h) + 'px');
    }
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem('fps_calc_size') || '{}') || {}; } catch (e) {}
    apply(saved);
    var dragging = false;
    grip.addEventListener('pointerdown', function (e) {
      dragging = true; e.preventDefault();
      try { grip.setPointerCapture(e.pointerId); } catch (x) {}
      panel.classList.add('dragging'); document.body.classList.add('calc-dragging');
    });
    grip.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      if (phone()) { saved.h = clampH(window.innerHeight - e.clientY); root.style.setProperty('--calc-h', saved.h + 'px'); }
      else { saved.w = clampW(window.innerWidth - e.clientX); root.style.setProperty('--calc-w', saved.w + 'px'); }
      calcResize();
    });
    function stop() {
      if (!dragging) return; dragging = false;
      panel.classList.remove('dragging'); document.body.classList.remove('calc-dragging');
      try { localStorage.setItem('fps_calc_size', JSON.stringify(saved)); } catch (e) {}
      calcResize();
    }
    grip.addEventListener('pointerup', stop);
    grip.addEventListener('pointercancel', stop);
    window.addEventListener('resize', function () { apply(saved); calcResize(); });
  })();
  function showCalcButton(on) { document.getElementById('calc-btn').hidden = !on; if (!on) closeCalc(); }

  // ── Bluebook score form (every page) ─────────────────────────
  (function setupBB() {
    var t = document.getElementById('bb-test');
    for (var i = 1; i <= 11; i++) t.insertAdjacentHTML('beforeend', '<option value="' + i + '">Practice test ' + i + '</option>');
    t.insertAdjacentHTML('beforeend', '<option value="not sure">Not sure</option>');
    var sc = document.getElementById('bb-score');
    sc.innerHTML = '<option value="">Choose</option>';
    for (var v = 800; v >= 200; v -= 10) sc.insertAdjacentHTML('beforeend', '<option value="' + v + '">' + v + '</option>');
    document.getElementById('open-bb').onclick = function () { openBB(null); };
    document.getElementById('bb-cancel').onclick = closeBB;
    document.getElementById('bb-save').onclick = saveBB;
  })();
  var bbAfter = null;
  function openBB(after) {
    bbAfter = after;
    document.getElementById('bb-date').value = PC.todayISO();
    document.getElementById('bb-status').textContent = '';
    document.getElementById('bb-modal').hidden = false;
    document.getElementById('bb-test').focus();
  }
  function closeBB() { document.getElementById('bb-modal').hidden = true; }
  function saveBB() {
    var st = document.getElementById('bb-status');
    var score = document.getElementById('bb-score').value;
    if (!score) { st.className = 'status err'; st.textContent = 'Choose your math score.'; return; }
    if (!S.user) { st.className = 'status err'; st.textContent = 'Please sign in first.'; return; }
    var weak = document.getElementById('bb-weak').value;
    var row = {
      user_id: S.user.id, practice_test: document.getElementById('bb-test').value || null,
      taken_on: document.getElementById('bb-date').value || null, math_score: parseInt(score, 10),
      areas: weak ? { weakest: weak } : null
    };
    sb.from('bluebook_scores').insert(row).then(function (r) {
      if (r.error) { st.className = 'status err'; st.textContent = 'That did not save. Please try again.'; return; }
      st.className = 'status ok'; st.textContent = 'Saved. Thank you.';
      setTimeout(function () { closeBB(); if (bbAfter) bbAfter(row); }, 700);
    });
  }

  // ── question bank ────────────────────────────────────────────
  var QF = ['Question Text', 'Correct Answer', 'Distractors', 'Solution', 'Difficulty', 'Review Status', 'Visual SVG', 'graph_type', 'Skill', 'Desmos Video URL'];
  // Usable questions with their choices. Skips unreviewed, graph-on-screen and short-answer questions.
  function loadQuestions(ids) {
    return PC.byIds('Questions', ids, QF).then(function (qs) {
      qs = qs.filter(function (q) {
        var f = q.fields || {};
        return f['Review Status'] === 'Reviewed - OK' && String(f.graph_type || '').toLowerCase() !== 'desmos' &&
          (f.Distractors || []).length >= 3 && f['Question Text'] && f['Correct Answer'];
      });
      var dids = []; qs.forEach(function (q) { dids = dids.concat(q.fields.Distractors || []); });
      return PC.byIds('Distractors', dids, ['Distractor Text', 'Misconception']).then(function (ds) {
        var dm = new Map(ds.map(function (d) { return [d.id, d.fields || {}]; }));
        return qs.map(function (q) {
          var f = q.fields;
          var wrong = (f.Distractors || []).map(function (id) { var d = dm.get(id); return d ? { text: String(d['Distractor Text'] || '').trim(), misc: (d.Misconception || [])[0] || null } : null; })
            .filter(function (d) { return d && d.text; }).slice(0, 3);
          return {
            id: q.id, text: f['Question Text'], solution: f.Solution || '', difficulty: f.Difficulty || '', svg: f['Visual SVG'] || '',
            video: f['Desmos Video URL'] || '', skill: (f.Skill || [])[0] || null,
            choices: [{ text: String(f['Correct Answer']).trim(), ok: true, misc: null }].concat(wrong.map(function (w) { return { text: w.text, ok: false, misc: w.misc }; }))
          };
        }).filter(function (q) { return q.choices.length >= 4; });
      });
    });
  }
  function unseenFirst(qs) {
    var a = qs.filter(function (q) { return !S.seen.has(q.id); }), b = qs.filter(function (q) { return S.seen.has(q.id); });
    return shuffle(a).concat(shuffle(b));
  }
  function recordSeen(q, choice) {
    if (q.practice) return;
    S.seen.add(q.id);
    sb.from('questions_seen').insert({ user_id: S.user.id, question_id: q.id, answer_given: choice.text, is_correct: !!choice.ok })
      .then(function (r) { if (r.error) console.warn('[plan] questions_seen', r.error.message); });
  }

  var skillDomain = null;
  function skillsByDomain() {
    if (skillDomain) return Promise.resolve(skillDomain);
    return PC.table('Skills', ['Domain', 'Questions', 'Skill Name']).then(function (rs) {
      skillDomain = rs.map(function (r) { return { id: r.id, domain: String(r.fields.Domain || '').trim(), qids: r.fields.Questions || [], name: r.fields['Skill Name'] || '' }; });
      return skillDomain;
    });
  }
  // A balanced sample of question ids. weights: {domain: count}
  function sampleIds(weights, perSkill) {
    return skillsByDomain().then(function (sk) {
      var out = [];
      Object.keys(weights).forEach(function (dom) {
        var pool = [];
        sk.filter(function (s) { return !dom || s.domain === dom; }).forEach(function (s) { pool = pool.concat(shuffle(s.qids).slice(0, perSkill || 4)); });
        out = out.concat(shuffle(pool.filter(function (id) { return !S.seen.has(id); })).slice(0, weights[dom] * 4));
      });
      return out;
    });
  }
  function pickByDomain(qs, weights, sk) {
    var dom = new Map(); sk.forEach(function (s) { dom.set(s.id, s.domain); });
    var out = [];
    Object.keys(weights).forEach(function (d) {
      out = out.concat(unseenFirst(qs.filter(function (q) { return dom.get(q.skill) === d && out.indexOf(q) < 0; })).slice(0, weights[d]));
    });
    return out;
  }

  // ── one question, rendered ───────────────────────────────────
  // mode 'learn': answer shown right away with the solution.
  // mode 'check': no feedback until the set ends.
  function questionHTML(q, idx, label) {
    var L = ['A', 'B', 'C', 'D'];
    if (!q._order) q._order = shuffle(q.choices);
    return '<div class="q" id="q-' + idx + '">' +
      '<div class="qh"><span>' + esc(label || ('Question ' + (idx + 1))) + '</span>' + (q.difficulty ? '<span class="pill ' + esc(q.difficulty) + '">' + esc(q.difficulty) + '</span>' : '') + '<span class="clock" id="clk-' + idx + '"></span></div>' +
      (q.svg ? '<div class="qfig">' + q.svg + '</div>' : '') +
      '<div class="qt">' + rich(q.text) + '</div>' +
      '<div class="ch">' + q._order.map(function (c, i) {
        return '<button type="button" class="c" data-q="' + idx + '" data-c="' + i + '"><span class="L">' + L[i] + '</span><span class="tx">' + rich(c.text) + '</span></button>';
      }).join('') + '</div>' +
      '<div id="fb-' + idx + '"></div></div>';
  }

  // Runs a set of questions inside a container.
  //   opts.mode       'learn' or 'check'
  //   opts.target     misconception id to name when the student falls for it
  //   opts.targetName its name
  //   opts.pace       seconds per question for the clock (check mode)
  //   opts.onDone(results)  results = [{q, choice}]
  function runSet(container, qs, opts) {
    var results = [], i = 0, timer = null, started = 0;
    function clockTick() {
      var el = document.getElementById('clk-' + i); if (!el || !opts.pace) return;
      var s = Math.floor((Date.now() - started) / 1000);
      el.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2) + ' / ' + Math.floor(opts.pace / 60) + ':' + ('0' + (opts.pace % 60)).slice(-2);
      el.className = 'clock' + (s > opts.pace ? ' over' : '');
    }
    function show() {
      if (i >= qs.length) { clearInterval(timer); opts.onDone(results); return; }
      var q = qs[i];
      container.innerHTML = questionHTML(q, i, opts.fullLabel || ((opts.label || 'Question') + ' ' + (i + 1) + ' of ' + qs.length));
      typeset(container);
      started = Date.now(); clearInterval(timer); if (opts.pace) { clockTick(); timer = setInterval(clockTick, 1000); }
      container.querySelectorAll('.c').forEach(function (b) {
        b.onclick = function () {
          var ch = q._order[+b.getAttribute('data-c')];
          var secs = Math.round((Date.now() - started) / 1000);
          results.push({ q: q, choice: ch, secs: secs });
          recordSeen(q, ch);
          container.querySelectorAll('.c').forEach(function (x) { x.disabled = true; });
          if (opts.mode === 'check') {
            b.classList.add('sel');
            i++; setTimeout(show, 250);
            return;
          }
          clearInterval(timer);
          var right = q._order.indexOf(q._order.find(function (c) { return c.ok; }));
          container.querySelectorAll('.c')[right].classList.add('ok');
          if (!ch.ok) b.classList.add('no');
          var trap = !ch.ok && opts.target && ch.misc === opts.target;
          var verdict = ch.ok ? 'Correct.' : (trap ? 'That\'s the same slip: ' + opts.targetName : 'Not quite.');
          var fb = document.getElementById('fb-' + i);
          fb.innerHTML = '<div class="fb ' + (ch.ok ? 'ok' : 'no') + '"><b class="v">' + rich(verdict) + '</b>' +
            (q.solution ? '<div class="sol-l">Worked solution</div><div>' + rich(q.solution) + '</div>' : '') + '</div>' +
            '<div class="qactions"><button type="button" class="btn" id="next-' + i + '">' + (i + 1 < qs.length ? 'Next question' : 'Continue') + '</button></div>';
          typeset(fb);
          document.getElementById('next-' + i).onclick = function () { i++; show(); };
        };
      });
    }
    show();
  }

  function reviewHTML(results) {
    return results.map(function (r, k) {
      var q = r.q;
      return '<div class="q"><div class="qh"><span>Question ' + (k + 1) + '</span><span>' + (r.choice.ok ? 'right' : 'missed') + '</span>' + (r.secs != null ? '<span>' + r.secs + ' s</span>' : '') + '</div>' +
        '<div class="qt">' + rich(q.text) + '</div>' +
        '<div class="fb ' + (r.choice.ok ? 'ok' : 'no') + '"><b class="v">Your answer: ' + rich(r.choice.text) + '</b>' +
        (r.choice.ok ? '' : '<div>Correct answer: ' + rich(q.choices[0].text) + '</div>') +
        (q.solution ? '<div class="sol-l">Worked solution</div><div>' + rich(q.solution) + '</div>' : '') + '</div></div>';
    }).join('');
  }

  // ── progress ─────────────────────────────────────────────────
  function saveProgress(n, fields) {
    var day = S.days[n - 1];
    var row = Object.assign({ user_id: S.user.id, plan_id: S.plan.id, day_number: n, kind: day.kind, target_id: day.target ? day.target.id : null, updated_at: new Date().toISOString() }, fields);
    if (day.target && !(row.detail && row.detail.name)) row.detail = Object.assign({}, row.detail || {}, { name: day.target.name });
    return sb.from('plan_progress').upsert(row, { onConflict: 'plan_id,day_number' }).then(function (r) {
      if (r.error) { console.warn('[plan] progress save', r.error); return; }
      var i = S.progress.findIndex(function (p) { return p.day_number === n; });
      if (i >= 0) S.progress[i] = Object.assign(S.progress[i], row); else S.progress.push(row);
      rebuildDays();
    });
  }
  function rebuildDays() {
    var kinds = PC.schedule(S.win.days, { capped: S.win.capped });
    S.days = PC.assign(kinds, S.ranked, S.progress);
    // Students may work ahead: finishing every day so far opens the next one.
    var first = S.days.findIndex(function (d) { return d.status !== 'done'; });
    var firstUndone = first < 0 ? S.days.length : first + 1;
    S.openN = Math.min(S.days.length, Math.max(S.todayN, firstUndone));
  }
  function nextDayLine(n) {
    var nx = S.days[n];
    if (!nx) return 'That was the last day of your plan. Good luck on test day.';
    return 'Next: ' + (PC.KIND_LABEL[nx.kind] || nx.kind) + (nx.target ? ', ' + nx.target.name : '') + '.';
  }
  function doneCard(n, extra) {
    var nx = S.days[n];
    var go = nx ? '<a class="btn gold" href="#day-' + nx.n + '">Start day ' + nx.n + ' now</a> <a class="btn ghost" href="#">Back to my plan</a>'
      : '<a class="btn gold" href="#">Back to my plan</a>';
    return '<div class="done-card"><h2>Day ' + n + ' done</h2><p>' + esc(extra || '') + ' ' + esc(nextDayLine(n)) + (nx ? ' You can start it now or come back later.' : '') + '</p><div class="qactions">' + go + '</div></div>';
  }

  // ── overview ─────────────────────────────────────────────────
  function overview() {
    showCalcButton(false);
    var doneCount = S.days.filter(function (d) { return d.status === 'done'; }).length;
    var pct = Math.round(100 * doneCount / S.days.length);
    var t = S.days[Math.min(S.todayN, S.days.length) - 1];
    var ahead = false;
    if (t && t.status === 'done' && S.openN > t.n && S.days[S.openN - 1] && S.days[S.openN - 1].status !== 'done') { t = S.days[S.openN - 1]; ahead = true; }
    var title = S.win.capped ? 'Your plan through ' + PC.longDate(S.win.endISO) : 'Your plan to ' + PC.longDate(S.plan.test_date);
    var expires = S.plan.expires_at.slice(0, 10);
    var html = '<div class="ph"><div><h1>' + esc(title) + '</h1><div class="meta">Open until ' + esc(PC.longDate(expires)) + '.' +
      (S.plan.date_changed ? '' : ' <button type="button" class="linkbtn" id="chg-date">My test date changed</button>') + '</div></div>' +
      '<div class="progress"><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + S.days.length + '" aria-valuenow="' + doneCount + '"><i style="width:' + pct + '%"></i></div>' +
      '<div class="bar-l">' + doneCount + ' of ' + S.days.length + ' days done</div></div></div>';
    if (S.todayN > S.days.length) {
      html += '<div class="today"><div class="what"><div class="lbl">Your plan has ended</div><h2>Booked another SAT? Build a new plan for $29.</h2></div><a class="btn gold" href="/">Take a test</a></div>';
    } else if (t) {
      var tDone = t.status === 'done';
      html += '<div class="today"><div class="what"><div class="lbl">' + (ahead ? 'Working ahead, day ' : 'Today, day ') + t.n + '</div><h2>' + esc(PC.KIND_LABEL[t.kind] || t.kind) + (t.target ? ': ' + esc(t.target.name) : '') + '</h2></div>' +
        '<a class="btn ' + (tDone ? 'ghost' : 'gold') + '" href="#day-' + t.n + '">' + (tDone ? 'Done. Open again' : (ahead ? 'Start day ' + t.n : 'Start today')) + '</a></div>';
    }
    if (S.win.capped) html += '<p class="bbline">Your test is in ' + esc(PC.longDateYear(S.plan.test_date).split(' ')[0]) + '. This plan builds your SAT math skills through ' + esc(PC.longDate(S.win.endISO)) + '. By then you\'ll have worked through the gaps your tests showed. If you\'d like to take it further before test day, you can build a final plan from ' + esc(PC.longDate(S.win.endISO).split(' ')[0]) + ' to your test.</p>';
    // calendar
    var WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var startDow = (PC.parseISO(S.plan.start_date).getDay() + 6) % 7;
    var cells = WD.map(function (w) { return '<div class="wd">' + w + '</div>'; }).join('');
    for (var b = 0; b < startDow; b++) cells += '<div class="d blank" aria-hidden="true"></div>';
    var list = '';
    S.days.forEach(function (d) {
      var iso = dayDate(d.n);
      var cls = d.status === 'done' ? 'done' : (d.n === S.todayN ? 'today-d' : (d.n > S.openN ? 'future' : (d.n > S.todayN ? 'ahead' : 'missed')));
      if (d.n === S.todayN && d.status === 'done') cls += ' today-d';
      var st = d.status === 'done' ? (d.passed === false ? 'done, comes back' : 'done') : (d.n < S.todayN ? 'to catch up' : '');
      var open = d.n <= S.openN;
      var inner = '<div class="dn"><span>' + PC.parseISO(iso).getDate() + '</span><span class="st">' + esc(st) + '</span></div>' +
        '<div class="k">' + esc(PC.KIND_LABEL[d.kind] || d.kind) + '</div>' + (d.target ? '<div class="t">' + esc(d.target.name) + '</div>' : '');
      cells += open ? '<a class="d ' + cls + '" href="#day-' + d.n + '" aria-label="Day ' + d.n + ', ' + esc(PC.shortDay(iso)) + '">' + inner + '</a>'
        : '<div class="d ' + cls + '" title="Opens ' + esc(PC.shortDay(iso)) + '">' + inner + '</div>';
      var lin = '<span class="n">Day ' + d.n + '<br>' + esc(PC.shortDay(iso)) + '</span><span><span class="k">' + esc(PC.KIND_LABEL[d.kind] || d.kind) + '</span>' +
        (d.target ? '<br><span class="t">' + esc(d.target.name) + '</span>' : '') + (st ? '<br><span class="t">' + esc(st) + '</span>' : '') + '</span>';
      list += open ? '<a class="li ' + cls + '" href="#day-' + d.n + '">' + lin + '</a>' : '<div class="li ' + cls + '">' + lin + '</div>';
    });
    html += '<div class="cal">' + cells + '</div><div class="listv">' + list + '</div>';
    html += '<div class="side">' +
      '<div class="box"><h3>How your plan works</h3><p>Each mistake day teaches one mistake from your own tests and ends with a short check. Pass it and the mistake is marked fixed. If not, it comes back on a later day. After every full test you take, the days ahead are rebuilt from your newest results.</p></div>' +
      '<div class="box"><h3>Bluebook scores</h3><p>Took an official Bluebook practice test? Add your math score and the plan uses it.</p><button type="button" class="btn ghost" id="bb-ov">Add a Bluebook score</button></div>' +
      '</div>' +
      '<p class="bbline">If you have the time and energy, add an official Bluebook practice test from College Board. More full-length practice never hurts.</p>';
    setHTML(html);
    var cd = document.getElementById('chg-date'); if (cd) cd.onclick = changeDate;
    document.getElementById('bb-ov').onclick = function () { openBB(null); };
  }

  function changeDate() {
    var opts = PC.upcomingSatDates().map(function (d) { return '<option value="' + d + '">' + esc(PC.fullDate(d)) + '</option>'; }).join('');
    var box = document.createElement('div');
    box.className = 'box'; box.style.marginBottom = '16px';
    box.innerHTML = '<h3>Change your test date</h3><p>You can move your plan to a new date once, up to about three months after your current date.</p>' +
      '<div class="form-row"><select id="nd-sel"><option value="">Choose</option>' + opts + '<option value="other">Another date</option></select>' +
      '<input type="date" id="nd-other" hidden><button type="button" class="btn" id="nd-save">Move my plan</button></div><div class="status" id="nd-st" role="status"></div>';
    app.insertBefore(box, app.children[1] || null);
    var sel = box.querySelector('#nd-sel'), other = box.querySelector('#nd-other');
    sel.onchange = function () { other.hidden = sel.value !== 'other'; };
    box.querySelector('#nd-save').onclick = function () {
      var v = sel.value === 'other' ? other.value : sel.value;
      var st = box.querySelector('#nd-st');
      if (!v) { st.className = 'status err'; st.textContent = 'Choose a date.'; return; }
      sb.rpc('change_plan_date', { p_plan: S.plan.id, p_new: v }).then(function (r) {
        var res = r.data;
        var msg = { ok: 'Moved. Rebuilding your plan.', already_changed: 'This plan has already been moved once.', in_past: 'That date has passed.', too_far: 'That is more than about three months after your current date. Build a new plan for that test instead.', not_found: 'Plan not found.' }[res] || 'That did not work. Please try again.';
        st.className = 'status ' + (res === 'ok' ? 'ok' : 'err'); st.textContent = msg;
        if (res === 'ok') setTimeout(function () { boot(); }, 700);
      });
    };
  }

  // ── day views ────────────────────────────────────────────────
  function dayShell(d, inner) {
    var iso = dayDate(d.n);
    return '<div class="crumb"><a href="#">Back to my plan</a><span>Day ' + d.n + ' of ' + S.days.length + ', ' + esc(PC.fullDate(iso)) + '</span>' +
      '<span style="margin-left:auto"><button type="button" class="linkbtn" id="bb-day">Took a Bluebook practice test? Add your math score.</button></span></div>' +
      '<div class="dayhead"><div class="eyebrow">' + esc(PC.KIND_LABEL[d.kind] || d.kind) + '</div><h1>' + esc(d.target ? d.target.name : dayTitle(d.kind)) + '</h1></div>' + inner;
  }
  function dayTitle(k) {
    return { desmos: 'Desmos day', test: 'Full practice test', halftest: 'One timed module', review: 'Review your test', bluebook: 'Official Bluebook practice test',
      bbreview: 'Learn from your Bluebook test', pacing: 'Pacing and careless errors', light: 'Light day before your test', catchup: 'Catch up', mixed: 'Mixed practice' }[k] || 'Today';
  }
  function wireBBLink() { var b = document.getElementById('bb-day'); if (b) b.onclick = function () { openBB(null); }; }
  var PAPER = '<div class="paper">Work each problem out properly on paper, showing as many steps as you can.</div>';

  function openDay(n) {
    var d = S.days[n - 1];
    if (!d) { location.hash = ''; return; }
    var ownerPeek = S.user && S.user.email === 'dasbrink@gmail.com' && /[?&]peek=1/.test(location.search);
    if (n > S.openN && !ownerPeek) { setHTML('<div class="notice"><h1>Day ' + n + ' opens on ' + esc(PC.fullDate(dayDate(n))) + '</h1><p>Or sooner: finish the days before it and it opens straight away.</p><a class="btn" href="#">Back to my plan</a></div>'); return; }
    var fn = { mistake: mistakeDay, basic: basicDay, desmos: desmosDay, test: testDay, halftest: halfTestDay, review: reviewDay,
      bluebook: bluebookDay, bbreview: bbReviewDay, pacing: pacingDay, light: lightDay, catchup: catchupDay, mixed: mixedDay }[d.kind] || mixedDay;
    fn(d);
  }

  // Mistake day: where it came from, lesson, practice that climbs, exit check.
  function mistakeDay(d) {
    showCalcButton(true);
    setHTML(dayShell(d, '<p class="loading">Getting today ready&hellip;</p>')); wireBBLink();
    var mid = d.target.id;
    var item = (S.ranked.mistakes || []).find(function (m) { return m.id === mid; }) || {};
    PC.byIds('Misconceptions', [mid], ['Description', 'Tutorials', 'Practice Problems', 'Distractors']).then(function (ms) {
      var m = (ms[0] || {}).fields || {};
      return Promise.all([
        PC.byIds('Tutorials', (m.Tutorials || []).slice(0, 1), ['Concept Explanation', 'Worked Example']),
        PC.byIds('Practice Problems', m['Practice Problems'] || [], ['Question Text', 'Correct Answer', 'Wrong Answer 1', 'Wrong Answer 2', 'Wrong Answer 3', 'Solution', 'Difficulty']),
        PC.byIds('Distractors', m.Distractors || [], ['Question']).then(function (ds) {
          var qids = []; ds.forEach(function (x) { (x.fields.Question || []).forEach(function (q) { qids.push(q); }); });
          return loadQuestions(shuffle(Array.from(new Set(qids))).slice(0, 40));
        }),
        item.example ? loadQuestions([item.example.qid]) : Promise.resolve([])
      ]);
    }).then(function (r) {
      var tut = ((r[0][0] || {}).fields) || {};
      var order = { Easy: 0, Medium: 1, Hard: 2 };
      var pps = r[1].map(function (p) {
        var f = p.fields;
        return { id: p.id, text: f['Question Text'], solution: f.Solution, difficulty: f.Difficulty,
          choices: [{ text: String(f['Correct Answer'] || ''), ok: true }].concat([f['Wrong Answer 1'], f['Wrong Answer 2'], f['Wrong Answer 3']].filter(Boolean).map(function (w) { return { text: String(w), ok: false, misc: mid }; })), practice: true };
      }).sort(function (a, b) { return (order[a.difficulty] || 9) - (order[b.difficulty] || 9); });
      var bank = unseenFirst(r[2].filter(function (q) { return !item.example || q.id !== item.example.qid; }));
      var practiceBank = bank.slice(0, 5), checkBank = bank.slice(5, 8);
      if (checkBank.length < 3) { checkBank = bank.slice(-3); practiceBank = bank.slice(0, Math.max(0, bank.length - 3)); }
      var ex = r[3][0];
      var times = item.count || 0;
      var html = PAPER;
      html += '<div class="step"><h2><span class="num">1</span>Where it came from</h2>';
      if (ex) {
        html += '<p class="lead">' + (times > 1 ? 'You made this mistake ' + times + ' times on your tests.' : 'You made this mistake on your test.') + ' Today we fix it.</p>' +
          '<div class="qt">' + rich(ex.text) + '</div><div class="fb no"><b class="v">You answered: ' + rich(item.example.answer) + '</b><div>Correct answer: ' + rich(ex.choices[0].text) + '</div></div>';
      } else html += '<p class="lead">' + (times > 1 ? 'You made this mistake ' + times + ' times on your tests.' : 'This mistake showed up in your test results.') + ' Today we fix it.</p>';
      html += '</div>';
      html += '<div class="step"><h2><span class="num">2</span>The lesson</h2><p class="mistake-name">' + rich(d.target.name) + '</p>' +
        (tut['Concept Explanation'] ? '<div class="tut-l">The idea</div><div class="tut">' + rich(tut['Concept Explanation']) + '</div>' : '') +
        (tut['Worked Example'] ? '<div class="tut-l">Worked example</div><div class="tut">' + rich(tut['Worked Example']) + '</div>' : '') +
        (!tut['Concept Explanation'] && !tut['Worked Example'] ? '<p>There is no written lesson for this one yet, so today goes straight to practice. Read each worked solution carefully.</p>' : '') + '</div>';
      html += '<div class="step"><h2><span class="num">3</span>Practice that climbs</h2><p class="lead">Easy to hard. You see the answer and the working right after each one.</p><div id="practice"></div></div>';
      html += '<div class="step" id="check-step" hidden><h2><span class="num">4</span>Exit check</h2><p class="lead">Three fresh questions, no hints, at test pace (about 1 minute 35 each). Get two right and this mistake is marked fixed.</p><div id="check"></div></div>';
      html += '<div id="day-end"></div>';
      setHTML(dayShell(d, html)); wireBBLink();
      var practiceSet = pps.concat(practiceBank);
      if (!practiceSet.length) { startCheck(); return; }
      runSet(document.getElementById('practice'), practiceSet, { mode: 'learn', target: mid, targetName: d.target.name, label: 'Practice', onDone: function () {
        document.getElementById('practice').innerHTML = '<div class="fb ok"><b class="v">Practice done.</b>Now the exit check.</div>';
        startCheck();
      } });
      function startCheck() {
        var cs = document.getElementById('check-step'); cs.hidden = false;
        var set = checkBank.length ? checkBank : pps.slice(-3);
        if (!set.length) { finish([], 0); return; }
        cs.scrollIntoView({ behavior: 'smooth', block: 'start' });
        runSet(document.getElementById('check'), set, { mode: 'check', pace: 95, label: 'Check', onDone: function (res) {
          var right = res.filter(function (x) { return x.choice.ok; }).length; finish(res, right);
        } });
      }
      function finish(res, right) {
        var need = res.length >= 3 ? 2 : Math.ceil(res.length * 0.66);
        var passed = res.length === 0 ? null : right >= need;
        var nextDay = null;
        saveProgress(d.n, { status: 'done', passed: passed, detail: { score: right, of: res.length } }).then(function () {
          if (passed === false) {
            var back = S.days.find(function (x) { return x.n > d.n && x.target && x.target.id === mid; });
            nextDay = back ? back.n : null;
          }
          var box = '<div class="result ' + (passed === false ? 'fail' : 'pass') + '"><h2>' + right + ' of ' + res.length + ' right</h2><p>' +
            (passed === false ? 'Not fixed yet, and that is normal. ' + (nextDay ? 'This one returns on Day ' + nextDay + '.' : 'It comes back later in your plan.') : 'Marked fixed. It will not come back unless it shows up on a test again.') + '</p></div>';
          document.getElementById('check').innerHTML = reviewHTML(res);
          var end = document.getElementById('day-end');
          end.innerHTML = box + doneCard(d.n, '');
          typeset(app); end.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }).catch(fail);
  }

  // Basic day: the earlier skill underneath, then a check from questions that use it.
  function basicDay(d) {
    showCalcButton(true);
    setHTML(dayShell(d, '<p class="loading">Getting today ready&hellip;</p>')); wireBBLink();
    PC.byIds('Prerequisites', [d.target.id], ['Name', 'Concept Explanation', 'Worked Example', 'Practice Easy', 'Practice Medium', 'Practice Hard', 'Used By Questions', 'Questions']).then(function (ps) {
      var f = ((ps[0] || {}).fields) || {};
      var qids = (f['Used By Questions'] || []).concat(f.Questions || []);
      return loadQuestions(shuffle(Array.from(new Set(qids))).slice(0, 30)).then(function (qs) { return { f: f, qs: unseenFirst(qs) }; });
    }).then(function (o) {
      var f = o.f;
      function prac(raw, label, k) {
        var t = stripComments(raw || ''); if (!t.trim()) return '';
        var m = t.match(/(^|[\s>])(Answer|Solution)\s*[A-D]?\s*:/);
        var cut = m ? m.index + m[1].length : -1;
        var q = cut > -1 ? t.slice(0, cut) : t, a = cut > -1 ? t.slice(cut) : '';
        if (/(^|\s)A\)\s/.test(q)) q = q.replace(/[ \t]+([B-D])\)\s/g, '\n$1) ').replace(/([^\n])\s*(^|\s)A\)\s/, '$1\n\nA) ');
        return '<div class="q"><div class="qh"><span>Practice</span><span class="pill ' + label + '">' + label + '</span></div><div class="qt">' + rich(q) + '</div>' +
          (a ? '<div class="reveal"><button type="button" class="btn ghost" data-r="' + k + '">Show answer and working</button><div class="ans" id="ans-' + k + '">' + rich(a) + '</div></div>' : '') + '</div>';
      }
      var html = PAPER + '<div class="step"><h2><span class="num">1</span>The lesson</h2>' +
        (f['Concept Explanation'] ? '<div class="tut-l">The idea</div><div class="tut">' + rich(f['Concept Explanation']) + '</div>' : '') +
        (f['Worked Example'] ? '<div class="tut-l">Worked example</div><div class="tut">' + rich(f['Worked Example']) + '</div>' : '') + '</div>' +
        '<div class="step"><h2><span class="num">2</span>Practice that climbs</h2><p class="lead">Try each one on paper before you open the answer.</p>' +
        prac(f['Practice Easy'], 'Easy', 1) + prac(f['Practice Medium'], 'Medium', 2) + prac(f['Practice Hard'], 'Hard', 3) +
        '<div class="qactions" style="margin-top:14px"><button type="button" class="btn" id="to-check">I\'m ready for the check</button></div></div>' +
        '<div class="step" id="check-step" hidden><h2><span class="num">3</span>Check</h2><p class="lead">Three SAT questions that lean on this skill. Get two right and it is marked fixed.</p><div id="check"></div></div><div id="day-end"></div>';
      setHTML(dayShell(d, html)); wireBBLink();
      app.querySelectorAll('[data-r]').forEach(function (b) { b.onclick = function () { var a = document.getElementById('ans-' + b.getAttribute('data-r')); a.classList.toggle('show'); b.textContent = a.classList.contains('show') ? 'Hide answer' : 'Show answer and working'; typeset(a); }; });
      document.getElementById('to-check').onclick = function () {
        this.disabled = true;
        var cs = document.getElementById('check-step'); cs.hidden = false; cs.scrollIntoView({ behavior: 'smooth', block: 'start' });
        var set = o.qs.slice(0, 3);
        if (!set.length) {
          saveProgress(d.n, { status: 'done', passed: null }).then(function () { document.getElementById('check').innerHTML = '<p>No check questions for this one yet.</p>'; document.getElementById('day-end').innerHTML = doneCard(d.n, ''); });
          return;
        }
        runSet(document.getElementById('check'), set, { mode: 'learn', label: 'Check', onDone: function (res) {
          var right = res.filter(function (x) { return x.choice.ok; }).length;
          var passed = right >= Math.min(2, res.length);
          saveProgress(d.n, { status: 'done', passed: passed, detail: { score: right, of: res.length } }).then(function () {
            document.getElementById('check').innerHTML = '<div class="result ' + (passed ? 'pass' : 'fail') + '"><h2>' + right + ' of ' + res.length + ' right</h2><p>' +
              (passed ? 'Marked fixed.' : 'Not fixed yet. It comes back later in your plan.') + '</p></div>';
            document.getElementById('day-end').innerHTML = doneCard(d.n, '');
          });
        } });
      };
    }).catch(fail);
  }

  // Desmos day: six questions that Desmos solves fast, each with a walkthrough video.
  function ytEmbed(url) {
    var m = String(url).match(/(?:shorts\/|youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{6,})/);
    return m ? 'https://www.youtube-nocookie.com/embed/' + m[1] : null;
  }
  function desmosDay(d) {
    showCalcButton(true);
    setHTML(dayShell(d, '<p class="loading">Getting today ready&hellip;</p>')); wireBBLink();
    var shownBefore = new Set();
    S.progress.forEach(function (p) { ((p.detail && p.detail.qids) || []).forEach(function (q) { shownBefore.add(q); }); });
    PC.table('Questions', ['Desmos Video URL'], "NOT({Desmos Video URL}='')").then(function (rs) {
      var ids = rs.map(function (r) { return r.id; });
      var fresh = ids.filter(function (id) { return !shownBefore.has(id); });
      return loadQuestions(shuffle(fresh.length >= 6 ? fresh : ids).slice(0, 8));
    }).then(function (qs) {
      qs = qs.slice(0, 6);
      var html = PAPER + '<div class="step"><h2><span class="num">1</span>How to use today</h2><p class="lead">Open the calculator (bottom right). Try each question in Desmos first. Then watch the walkthrough and compare it with what you did.</p></div>' +
        '<div class="step"><h2><span class="num">2</span>Six Desmos questions</h2><div id="dq"></div></div><div id="day-end"></div>';
      setHTML(dayShell(d, html)); wireBBLink();
      var i = 0;
      function one() {
        if (i >= qs.length) {
          saveProgress(d.n, { status: 'done', passed: null, detail: { qids: qs.map(function (q) { return q.id; }) } }).then(function () {
            document.getElementById('dq').innerHTML = '<div class="fb ok"><b class="v">All done.</b></div>';
            document.getElementById('day-end').innerHTML = doneCard(d.n, '');
          });
          return;
        }
        var q = qs[i];
        var box = document.getElementById('dq');
        runSet(box, [q], { mode: 'learn', fullLabel: 'Desmos question ' + (i + 1) + ' of ' + qs.length, onDone: function () {} });
        // add the video under the feedback once answered
        var obs = new MutationObserver(function () {
          var nb = box.querySelector('[id^="next-"]');
          if (!nb || nb.__v) return; nb.__v = true; obs.disconnect();
          var emb = ytEmbed(q.video);
          nb.insertAdjacentHTML('beforebegin', emb ? '<div class="video"><iframe src="' + esc(emb) + '" title="Desmos walkthrough" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>'
            : '<p><a href="' + esc(q.video) + '" target="_blank" rel="noopener">Watch the Desmos walkthrough</a></p>');
          nb.onclick = function () { i++; one(); };
        });
        obs.observe(box, { childList: true, subtree: true });
      }
      one();
    }).catch(fail);
  }

  // Full test day: taken on the main site. Marked done when a new result appears.
  function testDay(d) {
    showCalcButton(false);
    var since = dayDate(d.n); if (PC.todayISO() < since) since = PC.todayISO(); // working ahead
    sb.from('test_results').select('id, created_at, score').eq('user_id', S.user.id).gte('created_at', since + 'T00:00:00').order('created_at', { ascending: false }).limit(1).then(function (r) {
      var took = r.data && r.data[0];
      if (took && d.status !== 'done') saveProgress(d.n, { status: 'done', passed: null, detail: { score: took.score } });
      var html = '<div class="step"><h2><span class="num">1</span>Take a full practice test</h2>' +
        '<p class="lead">Two timed modules of 22 questions, 35 minutes each, with a break between. Sit it like the real thing: quiet room, phone away, pencil and paper.</p>' +
        '<ul class="tips"><li>Use the on-screen Desmos and the reference sheet, the way you will on test day.</li><li>If a question takes much longer than 1 minute 35, mark it and come back.</li><li>When you finish, your plan rebuilds the days ahead from your new results.</li></ul>' +
        (took ? '<div class="result pass"><h2>Done: you scored ' + took.score + '</h2><p>Your plan has been rebuilt from this test.</p></div>' + doneCard(d.n, '')
          : '<div class="qactions"><a class="btn gold" href="/">Start the test</a><span class="clock">Come back here when you finish.</span></div>') + '</div>';
      setHTML(dayShell(d, html)); wireBBLink();
    });
  }

  // Half test (7-day plans): one timed module of 22, built here.
  function halfTestDay(d) {
    showCalcButton(true);
    var W = { 'Algebra': 7, 'Advanced Math': 7, 'Problem-Solving and Data Analysis': 4, 'Geometry and Trigonometry': 4 };
    setHTML(dayShell(d, '<p class="loading">Building your module&hellip;</p>')); wireBBLink();
    Promise.all([sampleIds(W, 3), skillsByDomain()]).then(function (r) {
      return loadQuestions(r[0]).then(function (qs) { return pickByDomain(qs, W, r[1]); });
    }).then(function (qs) {
      var html = PAPER + '<div class="step"><h2><span class="num">1</span>One module, 35 minutes</h2><p class="lead">' + qs.length + ' questions across all four areas. The clock under each question shows your pace against 1 minute 35. No answers until the end.</p>' +
        '<div class="qactions"><button type="button" class="btn gold" id="go">Start the clock</button></div></div><div class="step" id="ht" hidden><div id="htq"></div></div><div id="day-end"></div>';
      setHTML(dayShell(d, html)); wireBBLink();
      document.getElementById('go').onclick = function () {
        this.disabled = true; document.getElementById('ht').hidden = false;
        var start = Date.now();
        runSet(document.getElementById('htq'), qs, { mode: 'check', pace: 95, label: 'Question', onDone: function (res) {
          var right = res.filter(function (x) { return x.choice.ok; }).length;
          var mins = Math.round((Date.now() - start) / 60000);
          saveProgress(d.n, { status: 'done', passed: null, detail: { score: right, of: res.length, minutes: mins } }).then(function () {
            document.getElementById('htq').innerHTML = '<div class="result pass"><h2>' + right + ' of ' + res.length + ' right, in ' + mins + ' minutes</h2><p>' +
              (mins > 35 ? 'That ran over 35 minutes, so pacing is worth watching on test day.' : 'Inside the 35 minutes.') + ' Next you go through the misses.</p></div>' + reviewHTML(res);
            document.getElementById('day-end').innerHTML = doneCard(d.n, '');
            typeset(app);
          });
        } });
      };
    }).catch(fail);
  }

  // Review: the misses from the newest test, with worked solutions.
  function reviewDay(d) {
    showCalcButton(true);
    sb.from('test_results').select('created_at, score, snapshot').eq('user_id', S.user.id).order('created_at', { ascending: false }).limit(1).then(function (r) {
      var row = r.data && r.data[0];
      // Only a test taken since the plan started counts.
      if (row && row.created_at.slice(0, 10) < S.plan.start_date) row = null;
      var prev = S.progress.filter(function (p) { return p.kind === 'halftest' && p.detail; }).sort(function (a, b) { return b.day_number - a.day_number; })[0];
      var testDay = S.days.slice(0, d.n - 1).filter(function (x) { return x.kind === 'test' || x.kind === 'halftest'; }).pop();
      var html = PAPER;
      if (prev && (!row || prev.updated_at > row.created_at)) {
        html += '<div class="step"><h2><span class="num">1</span>Your half test</h2><p class="lead">You scored ' + prev.detail.score + ' of ' + prev.detail.of + '. The questions and worked solutions are on that day\'s page. Go through every miss and redo it on paper before reading the working.</p>' +
          '<a class="btn ghost" href="#day-' + prev.day_number + '">Open the half test</a></div>';
      } else if (row && row.snapshot && row.snapshot.missed) {
        var missed = row.snapshot.missed.filter(function (m) { return m.chosenIndex != null; });
        html += '<div class="step"><h2><span class="num">1</span>Your test on ' + esc(PC.longDate(row.created_at.slice(0, 10))) + ': ' + row.score + '</h2><p class="lead">' + missed.length + ' questions to go through. Redo each one on paper first, then read the working. Your next days are built from these.</p>' +
          missed.map(function (m, k) {
            var ch = (m.choices || [])[m.chosenIndex] || {};
            return '<div class="q"><div class="qh"><span>Miss ' + (k + 1) + '</span></div><div class="qt">' + rich(m.q.text) + '</div>' +
              '<div class="fb no"><b class="v">You answered: ' + rich(ch.text || '') + '</b><div>Correct answer: ' + rich(m.q.correctAnswer || '') + '</div>' +
              (m.q.solution ? '<div class="sol-l">Worked solution</div><div>' + rich(m.q.solution) + '</div>' : '') + '</div></div>';
          }).join('') + '</div>';
      } else {
        html += '<div class="step"><p>There is no test to review yet. Take the test from Day ' + (testDay ? testDay.n : d.n - 1) + ' first, then come back.</p>' +
          '<a class="btn gold" href="' + (testDay ? '#day-' + testDay.n : '/') + '">Go to the test</a></div>';
        setHTML(dayShell(d, html)); wireBBLink();
        return;
      }
      html += '<div class="qactions"><button type="button" class="btn" id="rv-done">I\'ve gone through them</button></div><div id="day-end"></div>';
      setHTML(dayShell(d, html)); wireBBLink();
      document.getElementById('rv-done').onclick = function () { this.disabled = true; saveProgress(d.n, { status: 'done', passed: null }).then(function () { document.getElementById('day-end').innerHTML = doneCard(d.n, ''); }); };
    });
  }

  // Bluebook day: the official test, then the score.
  function bluebookDay(d) {
    showCalcButton(false);
    var html = '<div class="step"><h2><span class="num">1</span>Take an official practice test in Bluebook</h2>' +
      '<p class="lead">Bluebook is College Board\'s free testing app. Open it, choose Practice and Prepare, then Full-Length Practice, and pick a test you have not taken.</p>' +
      '<ul class="tips"><li>Sit it in one go, timed, the way you will on test day.</li><li>When you finish, sign in to My Practice on College Board\'s site to see your score.</li><li>Enter your math score below. The rest of your plan uses it.</li></ul></div>' +
      '<div class="step"><h2><span class="num">2</span>Your math score</h2><div class="qactions"><button type="button" class="btn gold" id="bb-enter">Add my Bluebook score</button>' +
      '<button type="button" class="linkbtn" id="bb-skip">I couldn\'t take it today</button></div><div id="day-end"></div></div>';
    setHTML(dayShell(d, html)); wireBBLink();
    document.getElementById('bb-enter').onclick = function () {
      openBB(function (row) {
        saveProgress(d.n, { status: 'done', passed: null, detail: { score: row.math_score } }).then(function () {
          document.getElementById('day-end').innerHTML = '<div class="result pass"><h2>Saved: ' + row.math_score + '</h2></div>' + doneCard(d.n, '');
        });
      });
    };
    document.getElementById('bb-skip').onclick = function () { saveProgress(d.n, { status: 'done', passed: null, detail: { skipped: true } }).then(function () { document.getElementById('day-end').innerHTML = doneCard(d.n, 'No problem. You can add a score any time from the top of the page.'); }); };
  }

  // Bluebook review: College Board's own review, then our check in the weakest area, then the lesson for what it finds.
  function bbReviewDay(d) {
    showCalcButton(true);
    sb.from('bluebook_scores').select('*').eq('user_id', S.user.id).order('created_at', { ascending: false }).limit(1).then(function (r) {
      var last = r.data && r.data[0];
      var weak = last && last.areas && last.areas.weakest;
      var areas = ['Algebra', 'Advanced Math', 'Problem-Solving and Data Analysis', 'Geometry and Trigonometry'];
      var html = '<div class="step"><h2><span class="num">1</span>College Board\'s review (about 15 minutes)</h2>' +
        '<p class="lead">In My Practice, open Score Details for your test. Go through each math question you missed and read the explanation. If you have time, do the tailored practice set My Practice builds for you.</p></div>' +
        '<div class="step"><h2><span class="num">2</span>Which math area was weakest?</h2><p class="lead">Your score report shows how you did in each area.</p>' +
        '<div class="form-row"><select id="wk">' + '<option value="">Choose</option>' + areas.map(function (a) { return '<option' + (a === weak ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('') + '</select>' +
        '<button type="button" class="btn" id="wk-go">Start the check</button></div></div>' +
        '<div class="step" id="ck" hidden><h2><span class="num">3</span>Six questions in that area</h2><p class="lead">These pin down the exact mistake. Answers at the end.</p><div id="ckq"></div></div><div id="teach"></div><div id="day-end"></div>';
      setHTML(dayShell(d, PAPER + html)); wireBBLink();
      document.getElementById('wk-go').onclick = function () {
        var dom = document.getElementById('wk').value; if (!dom) return;
        this.disabled = true;
        if (last && (!last.areas || last.areas.weakest !== dom)) {
          sb.from('bluebook_scores').update({ areas: Object.assign({}, last.areas || {}, { weakest: dom }) }).eq('id', last.id).then(function () {});
        }
        var W = {}; W[dom] = 6;
        Promise.all([sampleIds(W, 4), skillsByDomain()]).then(function (rr) {
          return loadQuestions(rr[0]).then(function (qs) { return pickByDomain(qs, W, rr[1]); });
        }).then(function (qs) {
          document.getElementById('ck').hidden = false;
          runSet(document.getElementById('ckq'), qs, { mode: 'check', pace: 95, label: 'Question', onDone: function (res) {
            document.getElementById('ckq').innerHTML = reviewHTML(res);
            var tally = {}; res.forEach(function (x) { if (!x.choice.ok && x.choice.misc) tally[x.choice.misc] = (tally[x.choice.misc] || 0) + 1; });
            var top = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; })[0];
            var right = res.filter(function (x) { return x.choice.ok; }).length;
            if (!top) {
              saveProgress(d.n, { status: 'done', passed: null, detail: { area: dom, score: right, of: res.length } }).then(function () {
                document.getElementById('day-end').innerHTML = doneCard(d.n, right + ' of ' + res.length + ' right. No single mistake stood out, so the days ahead stay as they are.');
                typeset(app);
              });
              return;
            }
            PC.byIds('Misconceptions', [top], ['Description', 'Tutorials']).then(function (ms) {
              var m = (ms[0] || {}).fields || {};
              return PC.byIds('Tutorials', (m.Tutorials || []).slice(0, 1), ['Concept Explanation', 'Worked Example']).then(function (ts) {
                var t = ((ts[0] || {}).fields) || {};
                document.getElementById('teach').innerHTML = '<div class="step"><h2><span class="num">4</span>What the check found</h2><p class="mistake-name">' + rich(PC.readable(m.Description)) + '</p>' +
                  (t['Concept Explanation'] ? '<div class="tut-l">The idea</div><div class="tut">' + rich(t['Concept Explanation']) + '</div>' : '') +
                  (t['Worked Example'] ? '<div class="tut-l">Worked example</div><div class="tut">' + rich(t['Worked Example']) + '</div>' : '') + '<p>It is now in your plan, so it gets its own day with practice and a check.</p></div>';
                return saveProgress(d.n, { status: 'done', passed: null, detail: { area: dom, score: right, of: res.length, found: top } });
              });
            }).then(function () {
              // The answers went into questions_seen, so re-rank to bring this mistake forward.
              return PC.rank(sb, S.user.id, true).then(function (rk) { S.ranked = rk; rebuildDays(); });
            }).then(function () { document.getElementById('day-end').innerHTML = doneCard(d.n, ''); typeset(app); });
          } });
        }).catch(fail);
      };
    });
  }

  // Pacing: ten timed questions, then how the time went.
  function pacingDay(d) {
    showCalcButton(true);
    var W = { 'Algebra': 3, 'Advanced Math': 3, 'Problem-Solving and Data Analysis': 2, 'Geometry and Trigonometry': 2 };
    setHTML(dayShell(d, '<p class="loading">Getting today ready&hellip;</p>')); wireBBLink();
    Promise.all([sampleIds(W, 3), skillsByDomain()]).then(function (r) {
      return loadQuestions(r[0]).then(function (qs) { return pickByDomain(qs, W, r[1]); });
    }).then(function (qs) {
      var html = '<div class="step"><h2><span class="num">1</span>Where test-day points go</h2><ul class="tips">' +
        '<li>About 1 minute 35 a question. Some take 30 seconds, so others can take longer.</li>' +
        '<li>If a question passes 2 minutes and you are not close, mark it, guess, and move on. Come back at the end.</li>' +
        '<li>Careless slips cost more points than missing math: a dropped negative, the wrong value asked for, $x$ instead of $y$.</li>' +
        '<li>Before you click, reread the last line of the question. Is it asking for $x$, $2x$, or something else?</li>' +
        '<li>Never leave a blank. There is no penalty for a wrong answer.</li></ul></div>' +
        PAPER + '<div class="step"><h2><span class="num">2</span>Ten questions against the clock</h2><div class="qactions"><button type="button" class="btn gold" id="go">Start</button></div><div id="pq"></div></div><div id="day-end"></div>';
      setHTML(dayShell(d, html)); wireBBLink();
      document.getElementById('go').onclick = function () {
        this.remove();
        runSet(document.getElementById('pq'), qs, { mode: 'check', pace: 95, label: 'Question', onDone: function (res) {
          var right = res.filter(function (x) { return x.choice.ok; }).length;
          var avg = Math.round(res.reduce(function (a, x) { return a + x.secs; }, 0) / Math.max(1, res.length));
          var slow = res.filter(function (x) { return x.secs > 95; }).length;
          var fast = res.filter(function (x) { return x.secs < 25 && !x.choice.ok; }).length;
          saveProgress(d.n, { status: 'done', passed: null, detail: { score: right, of: res.length, avg: avg } }).then(function () {
            document.getElementById('pq').innerHTML = '<div class="result pass"><h2>' + right + ' of ' + res.length + ' right, ' + avg + ' seconds a question on average</h2><p>' +
              (slow ? slow + ' took longer than 1 minute 35. ' : 'None ran over 1 minute 35. ') +
              (fast ? fast + ' quick answers were wrong, which usually means a slip, not missing math.' : '') + '</p></div>' + reviewHTML(res);
            document.getElementById('day-end').innerHTML = doneCard(d.n, '');
            typeset(app);
          });
        } });
      };
    }).catch(fail);
  }

  function lightDay(d) {
    showCalcButton(true);
    var html = '<div class="step"><h2><span class="num">1</span>Today is light on purpose</h2><p class="lead">Your score is built by now. Today is about walking in rested and ready.</p><ul class="tips">' +
      '<li>Check your admission ticket and the test center address, and plan to arrive early.</li>' +
      '<li>Bring a photo ID, your charged testing device and its charger, and two pencils for scratch work.</li>' +
      '<li>Make sure Bluebook is updated on your device and the exam setup is complete.</li>' +
      '<li>Remember the on-screen Desmos and the reference sheet are there on test day. Use them.</li>' +
      '<li>Eat a real breakfast. Go to bed at your normal time tonight, not earlier and not later.</li>' +
      '<li>If you want something to do, redo two questions from your plan that you once got wrong. That is enough.</li></ul>' +
      '<div class="qactions"><button type="button" class="btn" id="lt">Done</button></div><div id="day-end"></div></div>';
    setHTML(dayShell(d, html)); wireBBLink();
    document.getElementById('lt').onclick = function () { this.disabled = true; saveProgress(d.n, { status: 'done', passed: null }).then(function () { document.getElementById('day-end').innerHTML = doneCard(d.n, 'Good luck tomorrow.'); }); };
  }

  function catchupDay(d) {
    showCalcButton(false);
    var open = S.days.filter(function (x) { return x.n < d.n && x.status !== 'done' && x.kind !== 'catchup'; });
    var html = '<div class="step"><h2><span class="num">1</span>Catch up</h2>' +
      (open.length ? '<p class="lead">These days are still open. Do as many as you can today, starting at the top.</p>' +
        open.map(function (x) { return '<a class="li" href="#day-' + x.n + '"><span class="n">Day ' + x.n + '</span><span><span class="k">' + esc(PC.KIND_LABEL[x.kind]) + '</span>' + (x.target ? '<br><span class="t">' + esc(x.target.name) + '</span>' : '') + '</span></a>'; }).join('')
        : '<p class="lead">You are all caught up. Take the day off, or add a Bluebook practice test if you have the time and energy.</p>') +
      '<div class="qactions" style="margin-top:12px"><button type="button" class="btn" id="cu">Mark today done</button></div><div id="day-end"></div></div>';
    setHTML(dayShell(d, html)); wireBBLink();
    document.getElementById('cu').onclick = function () { this.disabled = true; saveProgress(d.n, { status: 'done', passed: null }).then(function () { document.getElementById('day-end').innerHTML = doneCard(d.n, ''); }); };
  }

  function mixedDay(d) {
    showCalcButton(true);
    var W = { 'Algebra': 2, 'Advanced Math': 2, 'Problem-Solving and Data Analysis': 2, 'Geometry and Trigonometry': 2 };
    setHTML(dayShell(d, '<p class="loading">Getting today ready&hellip;</p>')); wireBBLink();
    Promise.all([sampleIds(W, 3), skillsByDomain()]).then(function (r) { return loadQuestions(r[0]).then(function (qs) { return pickByDomain(qs, W, r[1]); }); }).then(function (qs) {
      setHTML(dayShell(d, PAPER + '<div class="step"><h2><span class="num">1</span>Mixed practice</h2><p class="lead">Your list of mistakes is fixed for now, so today is a mix from all four areas. Anything you miss goes back into your plan.</p><div id="mq"></div></div><div id="day-end"></div>')); wireBBLink();
      runSet(document.getElementById('mq'), qs, { mode: 'learn', label: 'Question', onDone: function (res) {
        var right = res.filter(function (x) { return x.choice.ok; }).length;
        saveProgress(d.n, { status: 'done', passed: null, detail: { score: right, of: res.length } }).then(function () {
          document.getElementById('mq').innerHTML = '<div class="result pass"><h2>' + right + ' of ' + res.length + ' right</h2></div>';
          document.getElementById('day-end').innerHTML = doneCard(d.n, '');
        });
      } });
    }).catch(fail);
  }

  function fail(e) {
    console.error('[plan]', e);
    setHTML('<div class="notice"><h1>Something did not load</h1><p>Please check your connection and try again. If it keeps happening, email dasbrink@gmail.com.</p><a class="btn" href="#">Back to my plan</a></div>');
  }

  // ── routing and start ────────────────────────────────────────
  function route() {
    var m = location.hash.match(/^#day-(\d+)$/);
    if (m) openDay(parseInt(m[1], 10)); else overview();
  }
  window.addEventListener('hashchange', function () { if (S.plan) route(); });

  function loadSeen() {
    var ids = new Set();
    function page(from) {
      return sb.from('questions_seen').select('question_id').eq('user_id', S.user.id).range(from, from + 999).then(function (r) {
        (r.data || []).forEach(function (x) { ids.add(x.question_id); });
        return (r.data || []).length === 1000 ? page(from + 1000) : ids;
      });
    }
    return page(0);
  }

  function boot() {
    app.innerHTML = '<p class="loading">Loading your plan&hellip;</p>';
    sb.auth.getSession().then(function (r) {
      var session = r.data && r.data.session;
      if (!session) {
        setHTML('<div class="notice"><h1>Please sign in</h1><p>Sign in on the main page with the email you used to buy your plan, then come back here.</p><a class="btn" href="/">Sign in</a></div>');
        return;
      }
      S.user = session.user;
      return sb.from('plans').select('*').eq('user_id', S.user.id).order('created_at', { ascending: false }).limit(1).then(function (pr) {
        var plan = pr.data && pr.data[0];
        if (!plan) {
          var welcome = /welcome=1/.test(location.search);
          setHTML('<div class="notice"><h1>' + (welcome ? 'Setting up your plan' : 'No plan yet') + '</h1><p>' +
            (welcome ? 'Your payment went through. Your plan takes a moment to set up. This page will refresh in a few seconds.' : 'Take a full practice test and your plan appears on your results page.') +
            '</p><a class="btn" href="/">Go to the main page</a></div>');
          if (welcome) setTimeout(boot, 4000);
          return;
        }
        if (new Date(plan.expires_at) < new Date()) {
          setHTML('<div class="notice"><h1>Your plan has ended</h1><p>Booked another SAT? Build a new plan for $29.</p><a class="btn gold" href="/">Take a test</a></div>');
          return;
        }
        S.plan = plan;
        S.win = PC.window(plan.test_date, plan.start_date);
        if (S.win.tooSoon) S.win = { days: Math.max(1, PC.daysBetween(plan.start_date, plan.test_date)), start: plan.start_date, testDate: plan.test_date };
        S.todayN = PC.daysBetween(plan.start_date, PC.todayISO()) + 1;
        return Promise.all([
          sb.from('plan_progress').select('*').eq('plan_id', plan.id),
          PC.rank(sb, S.user.id),
          loadSeen()
        ]).then(function (res) {
          S.progress = (res[0] && res[0].data) || [];
          S.ranked = res[1];
          S.seen = res[2];
          rebuildDays();
          route();
        });
      });
    }).catch(fail);
  }
  boot();
})();
