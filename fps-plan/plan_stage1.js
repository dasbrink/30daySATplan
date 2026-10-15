// ══════════════════════════════════════════════════════════════
// plan_stage1.js | freepracticesat.com
//
// Loads LAST, after every other script and after plan_core.js.
// Append-only: edits no other file.
//
// Oct 15, 2026. The custom plan, results-page side:
//   1. After Test 1 (or any full test, until answered), before the score:
//      test date, goal score, Bluebook tests taken.
//   2. Results page for free students: pacing line, the plan as a locked
//      calendar with a $29 "Build my plan" button, and a smaller free sample
//      (1 worked solution, no Desmos videos, counts instead of full lists).
//   3. Welcome screen: the offer panel becomes "Take your first test to get
//      your plan", or "Open my plan" for students who have one.
//   4. After a student's test date: one quiet question asking for the
//      official math score.
//
// SWITCH. Off for everyone until window.PLAN_LIVE is true. To see it before
// then, open freepracticesat.com/?preview=plan (remembered on that browser;
// ?preview=off forgets it). Going live is one line in index.html, above the
// script tags:  <script>window.PLAN_LIVE = true;</script>
// ══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var PC = window.PlanCore;
  if (!PC) { console.warn('[plan] plan_core.js missing'); return; }

  // ── switch ───────────────────────────────────────────────────
  var PREVIEW_KEY = 'fps_plan_preview';
  try {
    var qs = new URLSearchParams(location.search);
    if (qs.get('preview') === 'plan') localStorage.setItem(PREVIEW_KEY, '1');
    if (qs.get('preview') === 'off') localStorage.removeItem(PREVIEW_KEY);
  } catch (e) { /* storage blocked */ }
  function active() {
    if (window.PLAN_LIVE === true) return true;
    try { return localStorage.getItem(PREVIEW_KEY) === '1'; } catch (e) { return false; }
  }
  if (!active()) { console.log('[plan] stage 1 off'); return; }

  var PRICE_LABEL = '$29';
  var PLAN_URL = '/plan/';

  // ── helpers ──────────────────────────────────────────────────
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function sb() { return (typeof supabaseClient !== 'undefined') ? supabaseClient : null; }
  function user() { return (typeof currentUser !== 'undefined' && currentUser) ? currentUser : null; }
  function tier() { return (typeof currentTier !== 'undefined') ? currentTier : 0; }
  function typeset(el) { try { if (typeof renderMathInDiv === 'function') renderMathInDiv(el); else if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([el]); } catch (e) {} }

  var profileCache = undefined;   // undefined = not loaded, null = none
  function getProfile(force) {
    if (!user()) return Promise.resolve(null);
    if (profileCache !== undefined && !force) return Promise.resolve(profileCache);
    return sb().from('plan_profiles').select('*').eq('user_id', user().id).maybeSingle().then(function (r) {
      profileCache = r.error ? null : (r.data || null);
      return profileCache;
    });
  }
  function saveProfile(fields) {
    var row = Object.assign({ user_id: user().id, updated_at: new Date().toISOString() }, fields);
    return sb().from('plan_profiles').upsert(row, { onConflict: 'user_id' }).select().maybeSingle().then(function (r) {
      if (r.error) { console.warn('[plan] profile save failed', r.error); return null; }
      profileCache = r.data; return r.data;
    });
  }
  var planCache = undefined;
  function getActivePlan() {
    if (!user()) return Promise.resolve(null);
    if (planCache !== undefined) return Promise.resolve(planCache);
    return sb().from('plans').select('*').eq('user_id', user().id).gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }).limit(1).then(function (r) {
        planCache = (r.data && r.data[0]) || null; return planCache;
      });
  }

  // ── styles ───────────────────────────────────────────────────
  function ensureStyles() {
    if (document.getElementById('plan-s1-style')) return;
    var s = document.createElement('style');
    s.id = 'plan-s1-style';
    s.textContent = [
      '.pq-overlay{position:fixed;inset:0;background:rgba(18,32,48,0.72);z-index:11000;overflow-y:auto;padding:24px max(16px,env(safe-area-inset-right,0px)) 40px max(16px,env(safe-area-inset-left,0px));}',
      '.pq-card{background:#fff;max-width:600px;margin:20px auto;border-radius:12px;border-top:5px solid #c9902a;padding:26px 28px 24px;box-shadow:0 12px 40px rgba(0,0,0,0.3);font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;}',
      '.pq-card h2{font-family:Georgia,serif;color:#1a3a5c;font-size:1.55rem;margin:0 0 6px;line-height:1.25;}',
      '.pq-lede{color:#555;font-size:0.95rem;line-height:1.55;margin:0 0 20px;}',
      '.pq-q{margin:0 0 20px;}',
      '.pq-q > label, .pq-qt{display:block;font-weight:700;color:#1a3a5c;font-size:1rem;margin-bottom:8px;font-family:Georgia,serif;}',
      '.pq-opts{display:grid;gap:6px;}',
      '.pq-opt{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1.5px solid #e2e2dc;border-radius:8px;cursor:pointer;font-size:0.95rem;}',
      '.pq-opt:has(input:checked){border-color:#1a3a5c;background:#f1f5f9;}',
      '.pq-opt input{accent-color:#1a3a5c;width:17px;height:17px;margin:0;}',
      '.pq-sel{font-size:1rem;padding:9px 10px;border:1.5px solid #cfd6dd;border-radius:8px;background:#fff;color:#1a1a1a;min-width:150px;}',
      '.pq-note{font-size:0.82rem;color:#777;margin-top:6px;}',
      '.pq-date{margin-top:8px;}',
      '.pq-date input{font-size:1rem;padding:8px 10px;border:1.5px solid #cfd6dd;border-radius:8px;}',
      '.pq-bb{display:flex;flex-wrap:wrap;gap:8px;}',
      '.pq-bb button{padding:7px 14px;border:1.5px solid #cfd6dd;background:#fff;border-radius:20px;font-size:0.9rem;cursor:pointer;color:#1a1a1a;}',
      '.pq-bb button.on{border-color:#1a3a5c;background:#1a3a5c;color:#fff;}',
      '.pq-link{background:none;border:none;color:#1a3a5c;text-decoration:underline;cursor:pointer;font-size:0.9rem;padding:0;margin-top:10px;}',
      '.pq-scores{display:grid;gap:8px;margin-top:10px;}',
      '.pq-srow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:0.9rem;color:#444;}',
      '.pq-go{display:block;width:100%;margin-top:6px;padding:15px;background:#1a3a5c;color:#fff;border:none;border-radius:8px;font-family:Georgia,serif;font-size:1.12rem;font-weight:700;cursor:pointer;}',
      '.pq-go:hover{background:#122a44;}',
      '.pq-skip{display:block;margin:12px auto 0;background:none;border:none;color:#999;font-size:0.85rem;cursor:pointer;text-decoration:underline;}',
      '.pq-err{color:#c65d4e;font-size:0.88rem;margin-top:8px;min-height:1em;}',
      '.pq-card :focus-visible{outline:3px solid #c9902a;outline-offset:2px;}',
      // pacing line
      '.pl-pace{margin-top:10px;padding:10px 12px;background:#f5f5f0;border-radius:6px;font-size:0.86rem;line-height:1.5;color:#333;font-family:-apple-system,Segoe UI,Roboto,sans-serif;}',
      '.pl-pace b{color:#1a3a5c;}',
      // plan block
      '#v2-offer-block.pl-block{background:#fff;border:1.5px solid #dfe3e7;border-radius:12px;padding:0;margin:0 0 30px;color:#1a1a1a;overflow:hidden;}',
      '.pl-head{padding:22px 24px 6px;}',
      '.pl-eyebrow{font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:0.75rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#c9902a;margin:0 0 4px;}',
      '.pl-title{font-family:Georgia,serif;font-size:1.6rem;color:#1a3a5c;margin:0;line-height:1.25;}',
      '.pl-sub{font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:0.95rem;color:#555;margin:6px 0 0;line-height:1.55;}',
      '.pl-body{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:0;}',
      '@media (max-width:760px){.pl-body{grid-template-columns:1fr;}}',
      '.pl-cal{padding:16px 24px 22px;min-width:0;}',
      '.pl-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;}',
      '.pl-wd{font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:0.68rem;font-weight:700;color:#999;text-align:center;letter-spacing:0.05em;text-transform:uppercase;}',
      '.pl-day{min-height:62px;border:1px solid #e4e6e9;border-radius:6px;padding:5px 6px;background:#fafbfc;font-family:-apple-system,Segoe UI,Roboto,sans-serif;position:relative;min-width:0;}',
      '.pl-day.blank{border:none;background:none;}',
      '.pl-dn{font-size:0.68rem;color:#888;font-variant-numeric:tabular-nums;}',
      '.pl-k{font-size:0.72rem;font-weight:700;color:#1a3a5c;line-height:1.25;margin-top:2px;overflow-wrap:anywhere;}',
      '.pl-t{font-size:0.68rem;color:#444;line-height:1.3;margin-top:2px;overflow-wrap:anywhere;}',
      '.pl-lock{position:absolute;right:5px;top:4px;font-size:0.65rem;color:#aab;}',
      '.pl-day.open{background:#fff;border-color:#c9902a;}',
      '.pl-day.k-test,.pl-day.k-halftest,.pl-day.k-bluebook{background:#eef3f8;}',
      '.pl-day.k-light{background:#f3f7f2;}',
      '.pl-list{display:none;}',
      '@media (max-width:560px){.pl-grid{display:none;}.pl-list{display:grid;gap:6px;}}',
      '.pl-li{display:flex;gap:10px;align-items:baseline;padding:8px 10px;border:1px solid #e4e6e9;border-radius:6px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:0.88rem;}',
      '.pl-li .d{min-width:5.5em;color:#888;font-size:0.8rem;font-variant-numeric:tabular-nums;}',
      '.pl-li .k{font-weight:700;color:#1a3a5c;}',
      '.pl-li .t{color:#444;}',
      '.pl-legend{font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:0.8rem;color:#777;margin-top:10px;line-height:1.5;}',
      '#v2-offer-block .v2-offer-foot.pl-offer{background:#1a3a5c;color:#fff;padding:22px 22px 24px;text-align:left;display:flex;flex-direction:column;gap:10px;min-width:0;}',
      '.pl-btn{background:#d4a04a;color:#1a1a1a;border:none;padding:15px 18px;border-radius:8px;font-family:Georgia,serif;font-size:1.08rem;font-weight:700;cursor:pointer;line-height:1.3;width:100%;}',
      '.pl-btn:hover{background:#c9902a;}',
      '.pl-btn:disabled{opacity:0.6;cursor:default;}',
      '.pl-ben{list-style:none;margin:4px 0 0;padding:0;display:grid;gap:7px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:0.9rem;line-height:1.45;color:#e8eef4;}',
      '.pl-ben li{padding-left:20px;position:relative;}',
      '.pl-ben li::before{content:"\\2713";position:absolute;left:0;color:#d4a04a;font-weight:700;}',
      '.pl-terms{font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:0.82rem;line-height:1.55;color:#b9c7d4;margin:0;}',
      '.pl-msg{font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:0.88rem;color:#ffd9d2;min-height:0;}',
      '.pl-bluebook{font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:0.85rem;color:#555;padding:0 24px 18px;line-height:1.55;}',
      '.pl-datebox{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:0.9rem;}',
      '.pl-datebox select{font-size:0.95rem;padding:7px 9px;border:1.5px solid #cfd6dd;border-radius:6px;}',
      '.pl-datebox button{padding:8px 14px;border:none;border-radius:6px;background:#1a3a5c;color:#fff;font-size:0.9rem;cursor:pointer;}',
      '.pl-soon{padding:22px 24px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:0.95rem;line-height:1.6;color:#333;}',
      '.pl-soon h3{font-family:Georgia,serif;color:#1a3a5c;margin:0 0 8px;font-size:1.3rem;}',
      '.pl-soon ul{margin:8px 0 0;padding-left:1.2em;}',
      '.pl-owned{background:#fff;border:1.5px solid #1a7a4c;border-top:4px solid #1a7a4c;border-radius:12px;padding:20px 22px;margin:0 0 24px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;}',
      '.pl-owned h3{font-family:Georgia,serif;color:#1a3a5c;margin:0 0 6px;font-size:1.35rem;}',
      '.pl-owned p{margin:0 0 12px;color:#444;line-height:1.55;}',
      '.pl-owned a{display:inline-block;background:#1a3a5c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-family:Georgia,serif;font-weight:700;}',
      '.pl-cut{font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:0.92rem;color:#444;line-height:1.55;padding:14px 16px;background:#f5f5f0;border-radius:8px;}',
      '.pl-cut b{color:#1a3a5c;}',
      // welcome + official score card
      '.pl-wpanel{font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.55;}',
      '.pl-wpanel h3{font-family:Georgia,serif;margin:0 0 8px;font-size:1.3rem;}',
      '.pl-wpanel a.pl-open{display:inline-block;margin-top:10px;background:#d4a04a;color:#1a1a1a;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-family:Georgia,serif;}',
      '.pl-official{max-width:640px;margin:16px auto;background:#fff;border:1.5px solid #c9902a;border-radius:10px;padding:16px 18px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;}',
      '.pl-official h4{font-family:Georgia,serif;color:#1a3a5c;margin:0 0 6px;font-size:1.1rem;}',
      '.pl-official .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px;}',
      '.pl-official select{font-size:0.95rem;padding:7px 9px;border:1.5px solid #cfd6dd;border-radius:6px;}',
      '.pl-official button{padding:8px 14px;border:none;border-radius:6px;background:#1a3a5c;color:#fff;cursor:pointer;}',
      '.pl-official .no{background:none;color:#888;text-decoration:underline;}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── 1. the questions after the test ──────────────────────────
  function scoreOptions(lo, hi, selected, placeholder) {
    var h = '<option value="">' + esc(placeholder || 'Choose') + '</option>';
    for (var v = hi; v >= lo; v -= 10) h += '<option value="' + v + '"' + (v === selected ? ' selected' : '') + '>' + v + '</option>';
    return h;
  }

  function askQuestions() {
    ensureStyles();
    return new Promise(function (resolve) {
      var dates = PC.upcomingSatDates();
      var ov = document.createElement('div');
      ov.className = 'pq-overlay';
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-modal', 'true');
      ov.setAttribute('aria-labelledby', 'pq-title');
      var dateOpts = dates.map(function (d, i) {
        return '<label class="pq-opt"><input type="radio" name="pq-date" value="' + d + '"' + (i === 0 ? '' : '') + '> ' + esc(PC.fullDate(d)) + '</label>';
      }).join('');
      var bbChoices = ['None', '1', '2', '3', '4 or more', 'All of them'];
      var testNums = '<option value="">Practice test</option>' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (n) { return '<option value="' + n + '">Practice test ' + n + '</option>'; }).join('') + '<option value="not sure">Not sure</option>';
      ov.innerHTML =
        '<div class="pq-card">' +
          '<h2 id="pq-title">One last thing before your score</h2>' +
          '<p class="pq-lede">I\'m building you a study plan from this test. Three quick questions so it fits your calendar.</p>' +
          '<div class="pq-q"><span class="pq-qt" id="pq-l1">When is your next SAT?</span>' +
            '<div class="pq-opts" role="radiogroup" aria-labelledby="pq-l1">' + dateOpts +
              '<label class="pq-opt"><input type="radio" name="pq-date" value="school"> An SAT at my school on a weekday</label>' +
              '<div class="pq-date" id="pq-school" hidden><label for="pq-school-date" class="pq-note">Date of your school SAT</label><br><input type="date" id="pq-school-date"></div>' +
              '<label class="pq-opt"><input type="radio" name="pq-date" value="none"> I haven\'t booked one yet</label>' +
            '</div></div>' +
          '<div class="pq-q"><label for="pq-goal">What math score would you love to get?</label>' +
            '<select id="pq-goal" class="pq-sel">' + scoreOptions(400, 800, null, 'Choose a score') + '</select>' +
            '<div class="pq-note">Math only, out of 800.</div></div>' +
          '<div class="pq-q"><span class="pq-qt" id="pq-l3">Have you taken any official Bluebook practice tests?</span>' +
            '<div class="pq-bb" role="group" aria-labelledby="pq-l3">' + bbChoices.map(function (c) { return '<button type="button" data-v="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' +
            '<button type="button" class="pq-link" id="pq-addscores" hidden>Add my math scores</button>' +
            '<div class="pq-scores" id="pq-scores" hidden></div></div>' +
          '<div class="pq-err" id="pq-err" role="status"></div>' +
          '<button type="button" class="pq-go" id="pq-go">Show my score</button>' +
          '<button type="button" class="pq-skip" id="pq-skip">Skip for now</button>' +
        '</div>';
      document.body.appendChild(ov);

      var bbVal = null;
      ov.querySelectorAll('input[name="pq-date"]').forEach(function (r) {
        r.addEventListener('change', function () {
          ov.querySelector('#pq-school').hidden = r.value !== 'school' || !r.checked;
        });
      });
      ov.querySelectorAll('.pq-bb button').forEach(function (b) {
        b.addEventListener('click', function () {
          ov.querySelectorAll('.pq-bb button').forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
          b.classList.add('on'); b.setAttribute('aria-pressed', 'true');
          bbVal = b.getAttribute('data-v');
          ov.querySelector('#pq-addscores').hidden = bbVal === 'None';
          if (bbVal === 'None') { ov.querySelector('#pq-scores').hidden = true; ov.querySelector('#pq-scores').innerHTML = ''; }
        });
      });
      function addScoreRow() {
        var box = ov.querySelector('#pq-scores');
        if (box.children.length >= 6) return;
        var row = document.createElement('div');
        row.className = 'pq-srow';
        row.innerHTML = '<select class="pq-sel pq-bt" aria-label="Which practice test">' + testNums + '</select>' +
          '<select class="pq-sel pq-bs" aria-label="Math score">' + scoreOptions(200, 800, null, 'Math score') + '</select>';
        box.appendChild(row);
      }
      ov.querySelector('#pq-addscores').addEventListener('click', function () {
        var box = ov.querySelector('#pq-scores');
        box.hidden = false; addScoreRow();
        this.textContent = 'Add another score';
      });

      function finish(skipped) {
        var err = ov.querySelector('#pq-err');
        var fields = { skipped: !!skipped };
        var bbRows = [];
        if (!skipped) {
          var pick = ov.querySelector('input[name="pq-date"]:checked');
          if (!pick) { err.textContent = 'Choose your next SAT date, or "I haven\'t booked one yet".'; return; }
          if (pick.value === 'school') {
            var sd = ov.querySelector('#pq-school-date').value;
            if (!sd || sd <= PC.todayISO()) { err.textContent = 'Enter the date of your school SAT. It has to be after today.'; return; }
            fields.test_date = sd; fields.test_kind = 'school';
          } else if (pick.value === 'none') {
            fields.test_date = null; fields.test_kind = 'none';
          } else {
            fields.test_date = pick.value; fields.test_kind = 'weekend';
          }
          var g = ov.querySelector('#pq-goal').value;
          fields.goal_score = g ? parseInt(g, 10) : null;
          fields.bluebook_count = bbVal;
          ov.querySelectorAll('.pq-srow').forEach(function (r) {
            var sc = r.querySelector('.pq-bs').value;
            if (sc) bbRows.push({ user_id: user().id, practice_test: r.querySelector('.pq-bt').value || null, math_score: parseInt(sc, 10) });
          });
        }
        var go = ov.querySelector('#pq-go'); go.disabled = true; go.textContent = 'One moment';
        saveProfile(fields).then(function () {
          if (bbRows.length) return sb().from('bluebook_scores').insert(bbRows).then(function (r) { if (r.error) console.warn('[plan] bluebook save', r.error); });
        }).catch(function (e) { console.warn('[plan] save failed', e); }).then(function () {
          ov.remove(); resolve();
        });
      }
      ov.querySelector('#pq-go').addEventListener('click', function () { finish(false); });
      ov.querySelector('#pq-skip').addEventListener('click', function () { finish(true); });
      var first = ov.querySelector('input[name="pq-date"]'); if (first) first.focus();
    });
  }

  // ── 2. results page ──────────────────────────────────────────
  function pacingHTML() {
    var o = window.__ttLastObj;
    if (!o) return '';
    var times = Object.keys(o).map(function (k) { return o[k]; }).filter(function (ms) { return ms > 0; });
    if (times.length < 10) return '';
    var avg = times.reduce(function (a, b) { return a + b; }, 0) / times.length / 1000;
    var real = 95;
    function clock(s) { s = Math.round(s); var m = Math.floor(s / 60); var r = s % 60; return m ? (m + ' minute' + (m === 1 ? '' : 's') + (r ? ' ' + r + ' seconds' : '')) : (r + ' seconds'); }
    var line = 'You averaged <b>' + clock(avg) + '</b> per question. The real test gives you about <b>1 minute 35</b>.';
    if (avg > real) {
      var short = Math.round(44 - (70 * 60) / avg);
      if (short > 0) line += ' At your pace, you\'d run out of time with about <b>' + short + ' question' + (short === 1 ? '' : 's') + '</b> left.';
    } else {
      line += ' Your pace is fine, so the points are in the mistakes, not the clock.';
    }
    return '<div class="pl-pace" id="pl-pace">' + line + '</div>';
  }

  function insertPacing() {
    var cell = document.querySelector('#results-top-bar .rb-cell');
    if (!cell || cell.querySelector('#pl-pace')) return;
    var h = pacingHTML(); if (!h) return;
    cell.insertAdjacentHTML('beforeend', h);
  }

  function calendarHTML(win, days, showTopics) {
    var WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var startDow = (PC.parseISO(win.start).getDay() + 6) % 7; // Monday first
    var cells = '';
    for (var b = 0; b < startDow; b++) cells += '<div class="pl-day blank" aria-hidden="true"></div>';
    var list = '';
    days.forEach(function (d, i) {
      var iso = PC.addDays(win.start, i);
      var label = PC.KIND_LABEL[d.kind] || d.kind;
      var topic = (i < showTopics && d.target && d.target.name) ? d.target.name : '';
      var dn = PC.parseISO(iso).getDate();
      cells += '<div class="pl-day k-' + d.kind + (topic ? ' open' : '') + '" title="Day ' + (i + 1) + ', ' + esc(PC.shortDay(iso)) + '">' +
        '<div class="pl-dn">' + dn + '</div><span class="pl-lock" aria-label="locked">locked</span>' +
        '<div class="pl-k">' + esc(label) + '</div>' + (topic ? '<div class="pl-t">' + esc(topic) + '</div>' : '') + '</div>';
      list += '<div class="pl-li"><span class="d">Day ' + (i + 1) + '<br>' + esc(PC.shortDay(iso)) + '</span><span><span class="k">' + esc(label) + '</span>' +
        (topic ? ': <span class="t">' + esc(topic) + '</span>' : '') + '</span></div>';
    });
    return '<div class="pl-grid">' + WD.map(function (w) { return '<div class="pl-wd">' + w + '</div>'; }).join('') + cells + '</div>' +
      '<div class="pl-list">' + list + '</div>' +
      '<div class="pl-legend">The first days show what they cover. Every day opens with your plan. Each one is built from the mistakes on your own tests, and the order changes after every test you take.</div>';
  }

  function dateBoxHTML() {
    var opts = PC.upcomingSatDates().map(function (d) { return '<option value="' + d + '">' + esc(PC.fullDate(d)) + '</option>'; }).join('');
    return '<div class="pl-datebox"><label for="pl-date-pick">Tell me your test date and this plan will fit it:</label>' +
      '<select id="pl-date-pick"><option value="">Choose a date</option>' + opts + '</select>' +
      '<button type="button" id="pl-date-save">Use this date</button></div>';
  }

  function offerHTML(win) {
    var dateText = win.testDate ? PC.longDate(win.testDate) : null;
    var btn = win.capped
      ? 'Build my plan through ' + PC.longDate(win.endISO) + ', ' + PRICE_LABEL
      : (dateText ? 'Build my plan to ' + dateText + ', ' + PRICE_LABEL : 'Build my 30-day plan, ' + PRICE_LABEL);
    var openUntil = win.testDate && !win.capped
      ? 'Your plan stays open until 30 days after ' + dateText + ', in case you retake.'
      : (win.capped ? 'Your plan stays open for a week after it ends.' : 'Your plan stays open for 30 days after it ends.');
    return '<div class="v2-offer-foot pl-offer">' +
      '<button type="button" class="pl-btn" id="pl-buy">' + esc(btn) + '</button>' +
      '<ul class="pl-ben">' +
        '<li>Every day of your plan, built from your own mistakes</li>' +
        '<li>Your plan rebuilds after every test you take</li>' +
        '<li>Every mistake on every test, worked out step by step</li>' +
        '<li>The Desmos video walkthroughs</li>' +
      '</ul>' +
      '<p class="pl-terms">One payment, no subscription. ' + esc(openUntil) + ' Seven-day money-back guarantee.</p>' +
      '<div class="pl-msg" id="pl-msg" role="status"></div>' +
    '</div>';
  }

  function soonHTML(win) {
    var when = win.days <= 0 ? 'today' : (win.days === 1 ? 'tomorrow' : 'in ' + win.days + ' days');
    return '<div class="pl-soon"><h3>Your test is ' + esc(when) + '</h3>' +
      '<p>That is too close for a study plan to help, so here is what I would do instead.</p><ul>' +
      '<li>Go through the worked solution below and the mistakes it names. Fixing one habit now is worth more than new topics.</li>' +
      '<li>Work every question on paper. Most lost points on test day are careless slips, not missing math.</li>' +
      '<li>Watch your pace: about 1 minute 35 seconds a question. If one takes much longer, mark it, move on, and come back.</li>' +
      '<li>Use Desmos for anything you can graph. It is faster and it catches algebra slips.</li>' +
      '<li>Sleep. A rested brain is worth more points than a late-night cram.</li></ul>' +
      '<p>Good luck. After your test, come back and build a plan for the next one.</p></div>';
  }

  function planBlockHTML(profile, win) {
    if (win.tooSoon) return '<div class="v2-offer pl-block" id="v2-offer-block">' + soonHTML(win) + '</div>';
    var title;
    if (win.capped) title = 'Your plan through ' + PC.longDate(win.endISO) + ' (' + win.days + ' days)';
    else if (win.testDate) title = 'Your plan to ' + PC.longDate(win.testDate) + ' (' + win.days + ' days)';
    else title = 'Your 30-day plan';
    var sub = '';
    if (win.capped) sub = 'Your test is in ' + PC.longDateYear(win.testDate).split(' ')[0] + ', so this plan runs through ' + PC.longDate(win.endISO) + ' and focuses on building your skills. When it ends, you can build a second plan that takes you the rest of the way to test day.';
    else if (win.noDate) sub = '';
    var goal = (profile && profile.goal_score) ? '<span id="pl-goalgap"></span>' : '';
    return '<div class="v2-offer pl-block" id="v2-offer-block">' +
      '<div class="pl-head"><p class="pl-eyebrow">Built from this test</p><h3 class="pl-title">' + esc(title) + '</h3>' +
        '<p class="pl-sub">' + esc(sub) + (sub && goal ? ' ' : '') + goal + '</p>' +
        (win.noDate ? dateBoxHTML() : '') + '</div>' +
      '<div class="pl-body"><div class="pl-cal" id="pl-cal"><p class="pl-sub">Working out your plan&hellip;</p></div>' + offerHTML(win) + '</div>' +
      (win.days >= 30 && !win.capped ? '' : '') +
      '<p class="pl-bluebook">If you have the time and energy, add an official Bluebook practice test from College Board. More full-length practice never hurts.</p>' +
    '</div>';
  }

  function trimFreeSample() {
    var free = document.getElementById('v2-free');
    if (!free) return;
    // Free header
    var fs = free.querySelector('.v2-free-sub');
    if (fs) fs.textContent = 'A sample from the test you just took. Your plan works through the rest, one day at a time.';
    var ft = free.querySelector('.v2-free-title');
    if (ft) ft.textContent = 'Free from this test';
    // Section 1: one worked solution instead of three
    var secs = free.querySelectorAll('.v2-sec');
    if (secs[0]) {
      var items = secs[0].querySelectorAll('.v2-item');
      var total = ((typeof lastResultsMissed !== 'undefined' && lastResultsMissed) || []).length;
      for (var i = 1; i < items.length; i++) items[i].remove();
      var head = secs[0].querySelector('.v2-item-head'); if (head) head.textContent = 'Worked solution';
      var bt = secs[0].querySelector('.v2-block-title');
      if (bt && total) bt.textContent = '1 of your ' + total + ' mistakes, worked out';
      var bn = secs[0].querySelector('.v2-block-note');
      if (bn && total > 1) bn.textContent = 'The other ' + (total - 1) + ' are worked out in your plan, along with every question you miss on future tests.';
      var lede = secs[0].querySelector('.v2-sec-lede');
      if (lede) lede.textContent = 'One question you got wrong, worked out step by step, with the exact error named.';
    }
    // No Desmos videos in the free sample
    free.querySelectorAll('.v2-video').forEach(function (a) { a.remove(); });
    // Sections 2 and 3: the one fixed item stays, the full list becomes a count
    [1, 2].forEach(function (si) {
      var sec = secs[si]; if (!sec) return;
      sec.querySelectorAll('.v2-block-gold').forEach(function (blk) {
        var ul = blk.querySelector('.v2-list'); if (!ul) return;
        var n = ul.querySelectorAll('li').length;
        var rest = Math.max(0, n - 1);
        var what = si === 1 ? 'mistake' : 'basic';
        var msg = rest > 0
          ? '<b>' + rest + ' more ' + what + (rest === 1 ? '' : 's') + '</b> ' + (si === 1 ? (rest === 1 ? 'keeps' : 'keep') + ' repeating' : (rest === 1 ? 'is' : 'are') + ' holding your score down') + '. ' + (rest === 1 ? 'It is' : 'They are') + ' in your plan, each one taught and practiced on its own day.'
          : 'That is the only one so far. Your plan keeps watching for new ones after every test.';
        blk.outerHTML = '<div class="pl-cut">' + msg + '</div>';
      });
      // The locked "opens after your next test" text promised the full list free
      sec.querySelectorAll('.v2-locked-what li').forEach(function (li) {
        if (/full list/i.test(li.textContent)) li.textContent = si === 1 ? 'How many mistakes keep repeating' : 'How many basics are holding your score down';
      });
    });
    // Closing block
    var close = free.querySelector('.v2-close');
    if (close) {
      var lab = currentButtonLabel();
      close.querySelectorAll('.v2-close-badge,.v2-close-terms,.v2-close-note').forEach(function (n) { n.remove(); });
      var line = close.querySelector('.v2-close-line'); if (line) line.textContent = 'Ready to work through the rest, one day at a time?';
      var b = close.querySelector('.v2-close-btn');
      if (b) { b.textContent = lab + '. One payment.'; b.removeAttribute('onclick'); b.onclick = function () { buy(); }; }
    }
  }

  var currentWin = null;
  function currentButtonLabel() {
    if (!currentWin || currentWin.tooSoon) return 'Build my plan, ' + PRICE_LABEL;
    if (currentWin.capped) return 'Build my plan through ' + PC.longDate(currentWin.endISO) + ', ' + PRICE_LABEL;
    return currentWin.testDate ? 'Build my plan to ' + PC.longDate(currentWin.testDate) + ', ' + PRICE_LABEL : 'Build my 30-day plan, ' + PRICE_LABEL;
  }

  function rewriteFreeCell() {
    var list = document.querySelector('.fp-free-cell .fp-free-list');
    if (!list || list.__plan) return;
    list.__plan = true;
    list.innerHTML = '<li>Unlimited full-length practice tests</li>' +
      '<li>Your score, the four areas and your pacing</li>' +
      '<li>One worked solution<small>From every test you take</small></li>' +
      '<li>One mistake and one basic fully taught<small>From your second test</small></li>';
  }

  function goalGap(profile) {
    var el = document.getElementById('pl-goalgap');
    if (!el || !profile || !profile.goal_score) return;
    var est = (typeof lastResultSnapshot !== 'undefined' && lastResultSnapshot) ? lastResultSnapshot.estimatedScore : null;
    if (!est) return;
    var gap = profile.goal_score - est;
    el.textContent = gap > 0 ? 'You\'re about ' + gap + ' points from your goal of ' + profile.goal_score + '.' : 'You\'re already at your goal of ' + profile.goal_score + ' on this test. The plan is about keeping it there on test day.';
  }

  function fillCalendar(win, profile) {
    var cal = document.getElementById('pl-cal');
    if (!cal) return;
    var kinds = PC.schedule(win.days, { capped: win.capped });
    // Draw the shape at once, then add the first topics when the ranking arrives.
    cal.innerHTML = calendarHTML(win, kinds.map(function (k) { return { kind: k }; }), 0);
    PC.rank(sb(), user().id, true).then(function (ranked) {
      var days = PC.assign(kinds, ranked, []);
      cal.innerHTML = calendarHTML(win, days, 3);
    }).catch(function (e) { console.warn('[plan] ranking failed', e); });
  }

  function renderPlanBlock(profile) {
    var old = document.getElementById('v2-offer-block');
    var win = PC.window(profile && profile.test_date);
    currentWin = win;
    var html = planBlockHTML(profile, win);
    if (old) old.outerHTML = html;
    else {
      var free = document.getElementById('v2-free');
      if (!free) return;
      free.insertAdjacentHTML('afterbegin', html);
    }
    if (!win.tooSoon) {
      fillCalendar(win, profile);
      var b = document.getElementById('pl-buy'); if (b) b.onclick = function () { buy(); };
      var ds = document.getElementById('pl-date-save');
      if (ds) ds.onclick = function () {
        var v = document.getElementById('pl-date-pick').value; if (!v) return;
        saveProfile({ test_date: v, test_kind: 'weekend', skipped: false }).then(function (p) { renderPlanBlock(p); trimFreeSample(); });
      };
    }
    goalGap(profile);
  }

  function renderOwned(plan) {
    var bar = document.getElementById('results-top-bar');
    if (!bar || document.getElementById('pl-owned')) return;
    var html = '<div class="pl-owned" id="pl-owned"><h3>Your plan to ' + esc(PC.longDate(plan.test_date)) + '</h3>' +
      '<p>This test has been added to your plan, and the days ahead now reflect it.</p>' +
      '<a href="' + PLAN_URL + '">Open my plan</a></div>';
    bar.insertAdjacentHTML('afterend', html);
  }

  function afterResults() {
    if (!user()) return Promise.resolve();
    ensureStyles();
    insertPacing();
    if (tier() >= 3) {
      return getActivePlan().then(function (p) { if (p) renderOwned(p); });
    }
    return getProfile().then(function (profile) {
      renderPlanBlock(profile);
      trimFreeSample();
      rewriteFreeCell();
      // results_v2 and free_cell re-render asynchronously; keep the trims applied.
      watchResults(profile);
    });
  }

  var watcher = null;
  function watchResults(profile) {
    var target = document.getElementById('screen-results');
    if (!target || watcher) return;
    var t = null;
    watcher = new MutationObserver(function () {
      if (t) return;
      t = setTimeout(function () {
        t = null;
        if (tier() >= 3) return;
        var blk = document.getElementById('v2-offer-block');
        if (blk && !blk.classList.contains('pl-block')) renderPlanBlock(profileCache);
        var free = document.getElementById('v2-free');
        if (free && (free.querySelectorAll('.v2-sec')[0] || {}).querySelectorAll && free.querySelectorAll('.v2-sec')[0].querySelectorAll('.v2-item').length > 1) trimFreeSample();
        if (free && free.querySelector('.v2-video, .v2-list')) trimFreeSample();
        rewriteFreeCell();
        insertPacing();
      }, 80);
    });
    watcher.observe(target, { childList: true, subtree: true });
  }

  // ── checkout ─────────────────────────────────────────────────
  function buy() {
    var msg = document.getElementById('pl-msg');
    var btn = document.getElementById('pl-buy');
    if (!user()) { if (msg) msg.textContent = 'Please sign in again to continue.'; return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Opening checkout'; }
    getProfile().then(function (profile) {
      var win = PC.window(profile && profile.test_date);
      if (win.tooSoon) throw new Error('Your test is too close for a plan.');
      return sb().auth.getSession().then(function (r) {
        var token = r.data && r.data.session && r.data.session.access_token;
        if (!token) throw new Error('Please sign in again to continue.');
        return fetch(CHECKOUT_FN_URL, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token, 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: true, testDate: win.testDate || null })
        }).then(function (res) { return res.json(); });
      });
    }).then(function (out) {
      if (out && out.url) { window.location.href = out.url; return; }
      throw new Error((out && out.error) || 'Checkout did not start.');
    }).catch(function (e) {
      console.error('[plan] checkout', e);
      if (msg) msg.textContent = 'Sorry, checkout did not open. Please try again in a moment.';
      if (btn) { btn.disabled = false; btn.textContent = currentButtonLabel(); }
    });
  }
  // Every older "$29" button on the page now builds the plan instead.
  window.v2StartFullAccess = buy;
  window.startCheckout = buy;
  window.planBuy = buy;

  // ── hooks ────────────────────────────────────────────────────
  if (typeof showResults === 'function' && !showResults.__planHooked) {
    var origShow = showResults;
    showResults = function () {
      var self = this, args = arguments;
      var gate = user()
        ? getProfile().then(function (p) { if (!p) return askQuestions(); }).catch(function () {})
        : Promise.resolve();
      return gate.then(function () { return origShow.apply(self, args); })
        .then(function (r) { return afterResults().then(function () { return r; }, function () { return r; }); });
    };
    showResults.__planHooked = true;
  }
  if (typeof reopenResultsFromSnapshot === 'function' && !reopenResultsFromSnapshot.__planHooked) {
    var origReopen = reopenResultsFromSnapshot;
    reopenResultsFromSnapshot = function () {
      return Promise.resolve(origReopen.apply(this, arguments))
        .then(function (r) { return afterResults().then(function () { return r; }, function () { return r; }); });
    };
    reopenResultsFromSnapshot.__planHooked = true;
  }

  // ── 3. welcome screen ────────────────────────────────────────
  function welcomePanel() {
    var panel = document.querySelector('.wo-panel');
    if (!panel || panel.__plan || !user()) return;
    panel.__plan = true;
    ensureStyles();
    getActivePlan().then(function (plan) {
      if (plan) {
        panel.innerHTML = '<div class="pl-wpanel"><h3>Your plan to ' + esc(PC.longDate(plan.test_date)) + '</h3>' +
          '<p>Pick up where you left off. Today\'s work is waiting.</p><a class="pl-open" href="' + PLAN_URL + '">Open my plan</a></div>';
        return;
      }
      if (tier() >= 3) return; // owners and testers keep the existing panel
      panel.innerHTML = '<div class="pl-wpanel"><h3>Take your first test to get your plan</h3>' +
        '<p>When you finish a full test, I build a study plan from your own mistakes, day by day, up to your SAT date.</p></div>';
    });
  }

  // ── 4. official score, once, after test day ──────────────────
  function officialAsk() {
    if (!user() || document.getElementById('pl-official')) return;
    getProfile().then(function (p) {
      if (!p || !p.test_date || p.test_date >= PC.todayISO()) return;
      if (p.official_asked_for === p.test_date) return;
      return sb().from('official_scores').select('id').eq('user_id', user().id).eq('test_date', p.test_date).limit(1).then(function (r) {
        if (r.data && r.data.length) return;
        var host = document.querySelector('#screen-welcome .container') || document.getElementById('screen-welcome');
        if (!host) return;
        ensureStyles();
        host.insertAdjacentHTML('afterbegin',
          '<div class="pl-official" id="pl-official"><h4>How did your SAT go on ' + esc(PC.longDate(p.test_date)) + '?</h4>' +
          '<div>If your scores are out, I\'d love to know your math score.</div>' +
          '<div class="row"><label for="pl-off-score" class="pq-note">Math score</label><select id="pl-off-score">' + scoreOptions(200, 800, null, 'Choose') + '</select>' +
          '<button type="button" id="pl-off-save">Send</button><button type="button" class="no" id="pl-off-no">Not yet</button></div>' +
          '<div class="pq-err" id="pl-off-msg" role="status"></div></div>');
        function markAsked() { saveProfile({ official_asked_for: p.test_date }); }
        document.getElementById('pl-off-no').onclick = function () { markAsked(); document.getElementById('pl-official').remove(); };
        document.getElementById('pl-off-save').onclick = function () {
          var v = document.getElementById('pl-off-score').value; if (!v) return;
          sb().from('official_scores').insert({ user_id: user().id, test_date: p.test_date, math_score: parseInt(v, 10), source: 'site' }).then(function (r) {
            markAsked();
            var box = document.getElementById('pl-official');
            box.innerHTML = r.error ? '<div>Sorry, that did not save. Please try again later.</div>' : '<h4>Thank you</h4><div>Your score helps me make these tests more accurate for everyone.</div>';
          });
        };
      });
    });
  }

  // The welcome screen and sign-in happen after this file loads, so watch for them.
  var wt = null;
  new MutationObserver(function () {
    if (wt) return;
    wt = setTimeout(function () { wt = null; try { welcomePanel(); officialAsk(); } catch (e) {} }, 120);
  }).observe(document.body, { childList: true, subtree: true });

  console.log('[plan] stage 1 active' + (window.PLAN_LIVE === true ? '' : ' (preview)'));
})();
