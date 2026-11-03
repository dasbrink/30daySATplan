/* topic_quiz.js
 *
 * A 5-question quiz at the end of every /sat-math/ topic page.
 * No sign-up. Questions come through the airtable-read relay, so no
 * token is in the page. Starts, finishes and clicks to the full test
 * are counted as rows in page_views (page = /_quiz/...).
 *
 * Installed by topic_quiz_nov02.py. Undo: python3 topic_quiz_nov02.py --undo
 */
(function () {
  'use strict';

  if (window.__topicQuiz) return;
  window.__topicQuiz = true;

  var SUPABASE = 'https://undhvypblihwzojqkgsd.supabase.co';
  var RELAY = SUPABASE + '/functions/v1/airtable-read';
  var PUBLIC_KEY = 'sb_publishable_R49zB0bIjxMtlzx0qUasxw_Wmz92coq';
  var DESMOS_API = 'https://www.desmos.com/api/v1.10/calculator.js?apiKey=2f23c0c34b08448e8e167dba1a6c32c4';
  var HOW_MANY = 5;
  var LETTERS = ['A', 'B', 'C', 'D'];

  var box, body;
  var questions = [];
  var answers = [];
  var index = 0;
  var calc = null;

  function track(what) {
    if (window.__TQ_DRY) return;
    try {
      fetch(SUPABASE + '/rest/v1/page_views', {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          'apikey': PUBLIC_KEY,
          'Authorization': 'Bearer ' + PUBLIC_KEY
        },
        body: JSON.stringify({
          page: '/_quiz/' + what,
          referrer: window.location.pathname,
          gclid: null,
          user_agent: navigator.userAgent
        })
      }).catch(function () {});
    } catch (e) {}
  }

  function airtable(path) {
    return fetch(RELAY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: path })
    }).then(function (r) {
      if (!r.ok) throw new Error('relay ' + r.status);
      return r.json();
    });
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function usable(r) {
    var f = r.fields || {};
    return Array.isArray(f['Distractors']) && f['Distractors'].length >= 3 &&
      !(f['Visual SVG'] && String(f['Visual SVG']).trim()) &&
      !(f['graph_type'] && String(f['graph_type']).trim()) &&
      f['Question Text'] && String(f['Question Text']).trim() &&
      f['Correct Answer'] && String(f['Correct Answer']).trim();
  }

  function difficultyRank(r) {
    var d = String((r.fields || {})['Difficulty'] || '').toLowerCase();
    if (d === 'easy') return 0;
    if (d === 'medium') return 1;
    if (d === 'hard') return 2;
    return 1;
  }

  // One question per skill, so no two of the five look alike.
  function pickFive(pool) {
    var seen = {};
    var chosen = [];
    shuffle(pool).forEach(function (r) {
      if (chosen.length >= HOW_MANY + 3) return;
      var skill = ((r.fields['Skill'] || [])[0]) || r.id;
      if (seen[skill]) return;
      seen[skill] = true;
      chosen.push(r);
    });
    return chosen;
  }

  async function loadQuestions() {
    var params = new URLSearchParams();
    params.set('filterByFormula', "{Review Status}='Reviewed - OK'");
    var data = await airtable('Questions?' + params.toString());
    var chosen = pickFive((data.records || []).filter(usable));
    if (chosen.length < HOW_MANY) throw new Error('too few questions');

    var ids = [];
    chosen.forEach(function (r) { ids = ids.concat(r.fields['Distractors']); });
    var formula = 'OR(' + ids.map(function (id) {
      return "RECORD_ID()='" + id + "'";
    }).join(',') + ')';
    var dist = await airtable('Distractors?filterByFormula=' + encodeURIComponent(formula));
    var text = {};
    (dist.records || []).forEach(function (d) {
      text[d.id] = (d.fields && d.fields['Distractor Text']) || '';
    });

    var built = [];
    chosen.forEach(function (r) {
      var correct = String(r.fields['Correct Answer']).trim();
      var wrong = [];
      r.fields['Distractors'].forEach(function (id) {
        var t = String(text[id] || '').trim();
        if (t && t !== correct && wrong.indexOf(t) === -1) wrong.push(t);
      });
      if (wrong.length < 3) return;
      built.push({
        rank: difficultyRank(r),
        text: r.fields['Question Text'],
        correct: correct,
        choices: shuffle([correct].concat(wrong.slice(0, 3)))
      });
    });
    if (built.length < HOW_MANY) throw new Error('too few complete questions');
    return built.slice(0, HOW_MANY).sort(function (a, b) { return a.rank - b.rank; });
  }

  function typeset(el) {
    var tries = 0;
    (function go() {
      if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise([el]).catch(function () {});
      } else if (tries++ < 40) {
        setTimeout(go, 150);
      }
    })();
  }

  function css() {
    var s = document.createElement('style');
    s.textContent = [
      '.tq-box{background:#fff;border:1px solid #e0e0e0;border-top:4px solid #c9902a;border-radius:8px;padding:24px;margin:36px 0 8px;scroll-margin-top:80px}',
      '.tq-box h2{font-family:Georgia,serif;color:#1a3a5c;margin:0 0 8px;font-size:1.3rem}',
      '.tq-box p{margin:0 0 14px;line-height:1.6;color:#333}',
      '.tq-btn{display:inline-block;background:#c9902a;color:#fff;border:0;border-radius:5px;font:700 1rem Georgia,serif;padding:13px 30px;cursor:pointer;text-decoration:none}',
      '.tq-btn[disabled]{opacity:.45;cursor:default}',
      '.tq-link{background:none;border:1px solid #1a3a5c;color:#1a3a5c;border-radius:5px;font:600 .9rem Georgia,serif;padding:7px 14px;cursor:pointer}',
      '.tq-top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;color:#1a3a5c;font-weight:700}',
      '.tq-paper{font-size:.92rem;color:#555;background:#faf6ec;border-radius:6px;padding:9px 12px;margin-bottom:14px}',
      '.tq-q{line-height:1.65;margin-bottom:14px;padding:2px 0;overflow-x:auto;overflow-y:hidden}',
      '.tq-choice{display:flex;gap:10px;align-items:baseline;width:100%;text-align:left;background:#fff;border:1px solid #cfd6dd;border-radius:6px;padding:11px 13px;margin-bottom:9px;font:inherit;color:#222;cursor:pointer;overflow-x:auto;overflow-y:hidden}',
      '.tq-choice.tq-on{border-color:#1a3a5c;background:#eef3f8;box-shadow:inset 0 0 0 1px #1a3a5c}',
      '.tq-lbl{font-weight:700;color:#1a3a5c;flex:0 0 auto}',
      '.tq-calc{height:400px;width:100%;margin:0 0 14px;border:1px solid #cfd6dd;border-radius:6px;overflow:hidden;display:none}',
      '.tq-score{font-family:Georgia,serif;font-size:1.5rem;color:#1a3a5c;font-weight:700;margin-bottom:12px}',
      '.tq-miss{border-top:1px solid #e6e6e6;padding:13px 0;line-height:1.6;overflow-x:auto;overflow-y:hidden}',
      '.tq-miss div{margin-top:5px}',
      '.tq-next{background:#1a3a5c;border-radius:8px;padding:20px;margin-top:14px;color:#fff;text-align:center}',
      '.tq-next p{color:#fff}',
      '@media (max-width:600px){.tq-box{padding:18px 15px}.tq-btn{width:100%;text-align:center;box-sizing:border-box}.tq-calc{height:340px}}'
    ].join('');
    document.head.appendChild(s);
  }

  function showIntro() {
    body.innerHTML =
      '<h2>Try 5 SAT Math questions</h2>' +
      '<p>These are mixed questions from across the math section, not only this topic. ' +
      'You do not need an account, and it takes about five minutes.</p>' +
      '<button type="button" class="tq-btn" id="tq-start">Start the 5 questions</button>';
    document.getElementById('tq-start').addEventListener('click', start);
  }

  function showError() {
    body.innerHTML =
      '<h2>Try 5 SAT Math questions</h2>' +
      '<p>The questions did not load this time. The full test is free too.</p>' +
      '<a class="tq-btn" href="/">Take the full test</a>';
  }

  async function start() {
    var btn = document.getElementById('tq-start');
    btn.disabled = true;
    btn.textContent = 'Loading the questions';
    track('start');
    try {
      questions = await loadQuestions();
    } catch (e) {
      console.error('topic_quiz:', e);
      showError();
      return;
    }
    answers = [];
    index = 0;
    body.innerHTML =
      '<div class="tq-top"><span id="tq-count"></span>' +
      '<button type="button" class="tq-link" id="tq-calc-btn">Calculator</button></div>' +
      '<div class="tq-paper">Work each problem out properly on paper, showing as many steps as you can.</div>' +
      '<div class="tq-calc" id="tq-calc"></div>' +
      '<div id="tq-stage"></div>';
    document.getElementById('tq-calc-btn').addEventListener('click', toggleCalculator);
    showQuestion();
  }

  function showQuestion() {
    var q = questions[index];
    var stage = document.getElementById('tq-stage');
    document.getElementById('tq-count').textContent = 'Question ' + (index + 1) + ' of ' + questions.length;
    stage.innerHTML = '';

    var text = document.createElement('div');
    text.className = 'tq-q';
    text.innerHTML = q.text;
    stage.appendChild(text);

    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'tq-btn';
    next.disabled = true;
    next.textContent = index === questions.length - 1 ? 'See my score' : 'Next question';

    q.choices.forEach(function (choice, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tq-choice';
      b.innerHTML = '<span class="tq-lbl">' + LETTERS[i] + '</span><span></span>';
      b.lastChild.innerHTML = choice;
      b.addEventListener('click', function () {
        answers[index] = choice;
        stage.querySelectorAll('.tq-choice').forEach(function (x) { x.classList.remove('tq-on'); });
        b.classList.add('tq-on');
        next.disabled = false;
      });
      stage.appendChild(b);
    });

    next.style.marginTop = '6px';
    next.addEventListener('click', function () {
      index++;
      if (index < questions.length) {
        showQuestion();
        box.scrollIntoView({ block: 'start' });
      } else {
        showScore();
      }
    });
    stage.appendChild(next);
    typeset(stage);
  }

  function toggleCalculator() {
    var holder = document.getElementById('tq-calc');
    var open = holder.style.display === 'block';
    holder.style.display = open ? 'none' : 'block';
    if (open) return;
    if (calc) { calc.resize(); return; }
    var make = function () {
      calc = Desmos.GraphingCalculator(holder, { keypad: true, expressions: true, settingsMenu: false, zoomButtons: true });
      calc.resize();
    };
    if (window.Desmos) { make(); return; }
    var s = document.createElement('script');
    s.src = DESMOS_API;
    s.onload = make;
    document.head.appendChild(s);
  }

  function showScore() {
    track('finish');
    var right = 0;
    var missed = '';
    questions.forEach(function (q, i) {
      if (answers[i] === q.correct) { right++; return; }
      missed += '<div class="tq-miss">' + q.text +
        '<div><strong>You chose:</strong> ' + answers[i] + '</div>' +
        '<div><strong>Correct answer:</strong> ' + q.correct + '</div></div>';
    });

    body.innerHTML =
      '<div class="tq-score">You got ' + right + ' out of ' + questions.length + '.</div>' +
      missed +
      '<div class="tq-next"><p>That was 5 questions. The full test has 44, and it shows you which skills are behind your mistakes.</p>' +
      '<a class="tq-btn" id="tq-full" href="/">Take the full test for free</a></div>';
    document.getElementById('tq-full').addEventListener('click', function () { track('full_test_click'); });
    typeset(body);
    box.scrollIntoView({ block: 'start' });
  }

  function install() {
    if (!/^\/sat-math\/[^/]+\/?/.test(window.location.pathname)) return;
    var anchor = document.querySelector('main .cta-block');
    if (!anchor) return;
    css();
    box = document.createElement('section');
    box.className = 'tq-box';
    box.id = 'try-five';
    body = document.createElement('div');
    box.appendChild(body);
    anchor.parentNode.insertBefore(box, anchor);
    showIntro();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();
