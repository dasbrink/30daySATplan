// ══════════════════════════════════════════════════════════════
// plan_core.js | freepracticesat.com
//
// The custom plan engine, shared by the results page (plan_stage1.js) and
// the plan pages (/plan/). Self-contained: it needs only a signed-in
// Supabase client and the Airtable relay (airtable_shim.js).
//
// Oct 15, 2026. Design: project doc claude/custom-plan-design-oct15.md
//
//   schedule(days)      which kind of day falls on each day of the plan
//   rank(sb, userId)    the student's mistakes and basics, worst first
//   assign(...)         puts a mistake or basic on each skill day
// ══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var AT = 'https://api.airtable.com/v0/app4WLsifRZPgtosg/';

  // College Board weekend SAT dates still ahead. Add next year's here once.
  var SAT_DATES = ['2026-11-07', '2026-12-05', '2027-03-06', '2027-05-01', '2027-06-05'];
  // Weekend score release dates, where College Board has published them.
  var RELEASE = { '2026-11-07': '2026-11-20', '2026-12-05': '2026-12-18' };

  var MIN_DAYS = 4;       // fewer than this: no plan, a test-day page instead
  var CAP_DAYS = 84;      // 12 weeks
  var NO_DATE_DAYS = 30;  // "haven't booked yet"

  // ── dates ────────────────────────────────────────────────────
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parseISO(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(iso, n) {
    var d = parseISO(iso); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function longDate(iso) { var d = parseISO(iso); return MONTHS[d.getMonth()] + ' ' + d.getDate(); }
  function longDateYear(iso) { var d = parseISO(iso); return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }
  function fullDate(iso) { var d = parseISO(iso); return WEEKDAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }
  function shortDay(iso) { var d = parseISO(iso); return WEEKDAYS[d.getDay()].slice(0, 3) + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate(); }
  function upcomingSatDates() { var t = todayISO(); return SAT_DATES.filter(function (d) { return d > t; }); }

  // How long the plan runs, from a test date (or none) and a start date.
  // Returns { days, testDate, capped, noDate, tooSoon, endISO }
  function window_(testDate, startISO) {
    var start = startISO || todayISO();
    if (!testDate) {
      return { days: NO_DATE_DAYS, testDate: null, capped: false, noDate: true, tooSoon: false, start: start, endISO: addDays(start, NO_DATE_DAYS - 1) };
    }
    var n = daysBetween(start, testDate);
    if (n < MIN_DAYS) return { days: Math.max(n, 0), testDate: testDate, tooSoon: true, start: start };
    var capped = n > CAP_DAYS;
    var days = capped ? CAP_DAYS : n;
    return { days: days, testDate: testDate, capped: capped, noDate: false, tooSoon: false, start: start, endISO: addDays(start, days - 1) };
  }

  // ── the schedule ─────────────────────────────────────────────
  // Kinds: mistake, basic, desmos, test, halftest, review, bluebook,
  // bbreview, pacing, light, catchup
  var SHORT = {
    4: ['mistake', 'mistake', 'pacing', 'light'],
    5: ['mistake', 'mistake', 'desmos', 'pacing', 'light'],
    6: ['mistake', 'mistake', 'mistake', 'desmos', 'pacing', 'light'],
    7: ['mistake', 'mistake', 'halftest', 'review', 'desmos', 'pacing', 'light'],
    8: ['mistake', 'mistake', 'mistake', 'test', 'review', 'desmos', 'pacing', 'light'],
    9: ['mistake', 'mistake', 'mistake', 'test', 'review', 'mistake', 'desmos', 'pacing', 'light'],
    10: ['mistake', 'mistake', 'mistake', 'desmos', 'test', 'review', 'mistake', 'mistake', 'pacing', 'light']
  };

  function schedule(n, opts) {
    opts = opts || {};
    if (SHORT[n] && !opts.capped) return SHORT[n].slice();
    var k = new Array(n + 1);  // 1-based
    function put(day, kind) {
      day = Math.max(1, Math.min(n, Math.round(day)));
      // walk forward to the next free slot, then backward
      var d = day;
      while (d <= n && k[d]) d++;
      if (d > n) { d = day; while (d >= 1 && k[d]) d--; }
      if (d >= 1) k[d] = kind;
      return d;
    }
    // Ending
    if (opts.capped) {
      // Foundation plan: ends with a full test and its review, not test-day prep.
      k[n] = 'review'; k[n - 1] = 'test';
    } else {
      k[n] = 'light'; k[n - 1] = 'pacing';
    }
    // Our own full tests, each followed by its review
    function testPair(at) { var d = put(at, 'test'); if (d < n && !k[d + 1]) k[d + 1] = 'review'; else put(d + 1, 'review'); }
    if (n < 30) {
      if (n >= 14) { testPair(n * 0.35); testPair(n * 0.72); }
      else testPair(n / 2);
    } else {
      testPair(n * 0.45);
      if (!opts.capped) testPair(n - 4);
    }
    // Bluebook checkpoints, only from 30 days up
    function bbPair(at) { var d = put(at, 'bluebook'); if (d < n && !k[d + 1]) k[d + 1] = 'bbreview'; else put(d + 1, 'bbreview'); }
    if (n >= 60) { bbPair(n * 0.25); bbPair(n * 0.55); bbPair(n * 0.82); }
    else if (n >= 30) { bbPair(n * 0.28); bbPair(n * 0.7); }
    // Desmos
    if (n >= 30) { put(n * 0.32, 'desmos'); put(n * 0.62, 'desmos'); }
    else put(Math.max(4, n * 0.25), 'desmos');
    // Weekly catch-up from two weeks up, on the nearest free day
    if (n >= 14) for (var c = 7; c < n - 1; c += 7) {
      var cd = c; while (cd < n - 1 && k[cd]) cd++;
      if (cd < n - 1) k[cd] = 'catchup';
    }
    // Basics: only when there is time for them to pay off. Front of the plan.
    var basics = n >= 30 ? Math.min(14, Math.round(n / 6)) : (n >= 21 ? 2 : 0);
    for (var d = 1; d <= n && basics > 0; d++) if (!k[d]) { k[d] = 'basic'; basics--; }
    // Everything else is a mistake day
    for (var e = 1; e <= n; e++) if (!k[e]) k[e] = 'mistake';
    return k.slice(1);
  }

  var KIND_LABEL = {
    mistake: 'Mistake', basic: 'Basic', desmos: 'Desmos', test: 'Full test', halftest: 'Half test',
    review: 'Test review', bluebook: 'Bluebook test', bbreview: 'Bluebook review', pacing: 'Pacing',
    light: 'Light day', catchup: 'Catch-up', mixed: 'Mixed practice'
  };

  // ── Airtable reads (through the relay) ───────────────────────
  function atGet(path) {
    return fetch(AT + path).then(function (r) {
      if (!r.ok) throw new Error('Airtable read failed (' + r.status + ')');
      return r.json();
    });
  }
  function byIds(table, ids, fields) {
    ids = Array.from(new Set((ids || []).filter(Boolean)));
    if (!ids.length) return Promise.resolve([]);
    var chunks = [];
    for (var i = 0; i < ids.length; i += 40) chunks.push(ids.slice(i, i + 40));
    var fq = (fields || []).map(function (f) { return '&fields%5B%5D=' + encodeURIComponent(f); }).join('');
    return Promise.all(chunks.map(function (ch) {
      var formula = 'OR(' + ch.map(function (id) { return "RECORD_ID()='" + id + "'"; }).join(',') + ')';
      return atGet(encodeURIComponent(table) + '?pageSize=100&filterByFormula=' + encodeURIComponent(formula) + fq)
        .then(function (j) { return j.records || []; });
    })).then(function (parts) { return [].concat.apply([], parts); });
  }
  function table(name, fields, formula) {
    var out = [];
    var fq = (fields || []).map(function (f) { return '&fields%5B%5D=' + encodeURIComponent(f); }).join('');
    var fm = formula ? '&filterByFormula=' + encodeURIComponent(formula) : '';
    function page(offset) {
      return atGet(encodeURIComponent(name) + '?pageSize=100' + fq + fm + (offset ? '&offset=' + encodeURIComponent(offset) : ''))
        .then(function (j) { out = out.concat(j.records || []); return j.offset ? page(j.offset) : out; });
    }
    return page(null);
  }

  // ── the student's missed answers ─────────────────────────────
  function missedHistory(sb, userId) {
    var rows = [];
    function page(from) {
      return sb.from('questions_seen').select('question_id, answer_given, is_correct')
        .eq('user_id', userId).eq('is_correct', false).range(from, from + 999)
        .then(function (r) {
          if (r.error) throw r.error;
          rows = rows.concat(r.data || []);
          return (r.data || []).length === 1000 ? page(from + 1000) : rows;
        });
    }
    return page(0);
  }

  function looksLikeCode(s) { return /^[A-Z0-9][A-Z0-9_]{4,}$/.test(String(s || '').trim()); }
  function readable(s) {
    var t = String(s || '').trim();
    if (!looksLikeCode(t)) return t;
    return t.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  // Ranks mistakes (misconceptions actually committed) and basics
  // (prerequisites under missed questions). Worst first.
  function rank(sb, userId) {
    return missedHistory(sb, userId).then(function (miss) {
      var qids = Array.from(new Set(miss.map(function (m) { return m.question_id; }).filter(Boolean)));
      return byIds('Questions', qids, ['Distractors', 'Prerequisites', 'Critical Prerequisite', 'Skill']).then(function (qs) {
        var qById = new Map(qs.map(function (q) { return [q.id, q.fields || {}]; }));
        var dIds = [];
        qs.forEach(function (q) { (q.fields.Distractors || []).forEach(function (d) { dIds.push(d); }); });
        return byIds('Distractors', dIds, ['Distractor Text', 'Misconception']).then(function (ds) {
          var dById = new Map(ds.map(function (d) { return [d.id, d.fields || {}]; }));
          var mCount = new Map(), pCount = new Map(), pCrit = new Map(), mEx = new Map();
          miss.forEach(function (m) {
            var q = qById.get(m.question_id); if (!q) return;
            var ans = String(m.answer_given || '').trim();
            (q.Distractors || []).forEach(function (did) {
              var d = dById.get(did);
              if (d && String(d['Distractor Text'] || '').trim() === ans) {
                var mid = (d.Misconception || [])[0];
                if (mid) { mCount.set(mid, (mCount.get(mid) || 0) + 1); if (!mEx.has(mid)) mEx.set(mid, { qid: m.question_id, answer: ans }); }
              }
            });
            (q.Prerequisites || []).forEach(function (pid) { pCount.set(pid, (pCount.get(pid) || 0) + 1); });
            (q['Critical Prerequisite'] || []).forEach(function (pid) {
              pCrit.set(pid, (pCrit.get(pid) || 0) + 1);
              if (!pCount.has(pid)) pCount.set(pid, 1);
            });
          });
          return Promise.all([
            byIds('Misconceptions', Array.from(mCount.keys()), ['Description', 'Tutorials', 'Practice Problems', 'Skill']),
            byIds('Prerequisites', Array.from(pCount.keys()), ['Name', 'Concept Explanation', 'Domain'])
          ]).then(function (res) {
            var mistakes = res[0].map(function (r) {
              var f = r.fields || {};
              return {
                type: 'mistake', id: r.id, name: readable(f.Description), count: mCount.get(r.id) || 0, example: mEx.get(r.id) || null,
                teachable: (f.Tutorials || []).length > 0 && (f['Practice Problems'] || []).length > 0
              };
            }).filter(function (m) { return m.name; });
            mistakes.sort(function (a, b) {
              if (a.teachable !== b.teachable) return a.teachable ? -1 : 1;
              return b.count - a.count;
            });
            var basics = res[1].map(function (r) {
              var f = r.fields || {};
              return { type: 'basic', id: r.id, name: readable(f.Name), count: pCount.get(r.id) || 0, crit: pCrit.get(r.id) || 0, teachable: !!f['Concept Explanation'] };
            }).filter(function (b) { return b.name && b.teachable; });
            basics.sort(function (a, b) {
              if ((a.crit > 0) !== (b.crit > 0)) return a.crit > 0 ? -1 : 1;
              return b.count - a.count || b.crit - a.crit;
            });
            return { mistakes: mistakes, basics: basics, missedCount: miss.length };
          });
        });
      });
    });
  }

  // Put a mistake or basic on every skill day.
  //   kinds     from schedule()
  //   ranked    from rank()
  //   progress  rows from plan_progress (may be empty)
  // Done days keep what they had. Items passed in an exit check are fixed and
  // never scheduled again. Items that were not passed come back later.
  function assign(kinds, ranked, progress) {
    var byDay = new Map((progress || []).map(function (p) { return [p.day_number, p]; }));
    var fixed = new Set((progress || []).filter(function (p) { return p.passed && p.target_id; }).map(function (p) { return p.target_id; }));
    var lists = { mistake: (ranked && ranked.mistakes) || [], basic: (ranked && ranked.basics) || [] };
    var nameOf = new Map();
    lists.mistake.concat(lists.basic).forEach(function (x) { nameOf.set(x.id, x.name); });
    var used = { mistake: new Set(), basic: new Set() };
    var lastFail = new Map(); // item id -> day it was last attempted and not passed
    var out = [];
    kinds.forEach(function (kind, i) {
      var n = i + 1, p = byDay.get(n);
      var day = { n: n, kind: kind, status: p ? p.status : null, passed: p ? p.passed : null, target: null };
      if (kind === 'mistake' || kind === 'basic') {
        if (p && p.target_id) {
          day.target = { type: kind, id: p.target_id, name: nameOf.get(p.target_id) || (p.detail && p.detail.name) || '' };
          used[kind].add(p.target_id);
          if (p.status === 'done' && !p.passed) lastFail.set(p.target_id, n);
        } else {
          // Next unfixed item, worst first. A failed item returns, but not the very next day.
          var list = lists[kind];
          var pick = null;
          for (var j = 0; j < list.length && !pick; j++) {
            var it = list[j];
            if (fixed.has(it.id)) continue;
            if (used[kind].has(it.id) && !lastFail.has(it.id)) continue;
            if (lastFail.has(it.id) && n - lastFail.get(it.id) < 2) continue;
            pick = it;
          }
          if (pick) {
            day.target = { type: kind, id: pick.id, name: pick.name };
            used[kind].add(pick.id); lastFail.delete(pick.id);
          } else if (kind === 'basic' && lists.mistake.length) {
            // Out of basics: use the day for a mistake instead.
            day.kind = 'mistake';
            var m = lists.mistake.find(function (x) { return !fixed.has(x.id) && !used.mistake.has(x.id); });
            if (m) { day.target = { type: 'mistake', id: m.id, name: m.name }; used.mistake.add(m.id); }
            else day.kind = 'mixed';
          } else {
            day.kind = 'mixed';
          }
        }
      }
      out.push(day);
    });
    return out;
  }

  // When the official score email goes out for a test date.
  function scoreEmailDate(testDate, kind) {
    if (!testDate) return null;
    if (kind !== 'school' && RELEASE[testDate]) return addDays(RELEASE[testDate], 1);
    return addDays(testDate, 14);
  }

  window.PlanCore = {
    SAT_DATES: SAT_DATES, MIN_DAYS: MIN_DAYS, CAP_DAYS: CAP_DAYS, KIND_LABEL: KIND_LABEL,
    todayISO: todayISO, addDays: addDays, daysBetween: daysBetween, parseISO: parseISO,
    longDate: longDate, longDateYear: longDateYear, fullDate: fullDate, shortDay: shortDay,
    upcomingSatDates: upcomingSatDates, window: window_, schedule: schedule,
    rank: rank, assign: assign, byIds: byIds, table: table, atGet: atGet, readable: readable,
    scoreEmailDate: scoreEmailDate
  };
})();
