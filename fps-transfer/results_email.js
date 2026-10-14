/* results_email.js
 *
 * Append-only. Load AFTER script.js. No existing file is edited.
 *
 * 1. After a full practice test is saved, ask the email-results function
 *    to email the student a summary of the result. The function decides
 *    whether to send (signed in, enough answers, not sent before, not
 *    opted out). This file never blocks the results screen: any failure
 *    is logged and ignored.
 *
 * 2. The "Stop sending me test results" link in that email opens
 *    freepracticesat.com/?unsub=...&sig=... . This file shows a small
 *    box with one button, so an email scanner that opens the link does
 *    not opt the student out by accident.
 */
(function () {
  'use strict';

  var FN_URL = 'https://undhvypblihwzojqkgsd.supabase.co/functions/v1/email-results';
  var ANON = 'sb_publishable_R49zB0bIjxMtlzx0qUasxw_Wmz92coq';

  // ── 1. Send after a test is saved ──────────────────────────────
  function requestEmail() {
    try {
      if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
      supabaseClient.auth.getSession().then(function (res) {
        var session = res && res.data && res.data.session;
        if (!session || !session.access_token) return;
        fetch(FN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': ANON,
            'Authorization': 'Bearer ' + session.access_token
          },
          body: '{}'
        }).then(function (r) { return r.json(); })
          .then(function (j) { console.log('[freepracticesat] results email:', j); })
          .catch(function (e) { console.warn('[freepracticesat] results email failed:', e); });
      }).catch(function () {});
    } catch (e) {
      console.warn('[freepracticesat] results email skipped:', e);
    }
  }

  function install() {
    if (typeof window.saveResultSnapshot !== 'function') return false;
    if (window.saveResultSnapshot.__resultsEmail) return true;
    var original = window.saveResultSnapshot;
    var wrapped = async function () {
      var out = await original.apply(this, arguments);
      requestEmail();
      return out;
    };
    wrapped.__resultsEmail = true;
    window.saveResultSnapshot = wrapped;
    return true;
  }

  if (!install()) {
    var tries = 0;
    var timer = setInterval(function () {
      if (install() || ++tries > 40) clearInterval(timer);
    }, 250);
  }

  // ── 2. Opt-out link from the email ─────────────────────────────
  function showOptOut(u, s) {
    var wrap = document.createElement('div');
    wrap.setAttribute('style',
      'position:fixed;inset:0;background:rgba(15,30,45,0.55);z-index:99999;' +
      'display:flex;align-items:center;justify-content:center;padding:16px;');
    wrap.innerHTML =
      '<div style="background:#fff;max-width:420px;width:100%;border-radius:10px;padding:24px;' +
      'font-family:Arial,sans-serif;color:#22303c;box-shadow:0 10px 30px rgba(0,0,0,0.25);">' +
      '<div style="font:bold 19px Georgia,serif;color:#1a3a5c;margin-bottom:10px;">Stop the test result emails?</div>' +
      '<p style="font-size:15px;line-height:1.5;margin:0 0 18px 0;">You will stop getting an email after each practice test. ' +
      'Your results stay on the site, and your account is not affected.</p>' +
      '<div id="ro-msg" style="font-size:14px;margin-bottom:14px;display:none;"></div>' +
      '<button id="ro-yes" style="background:#1a3a5c;color:#fff;border:0;border-radius:8px;padding:11px 18px;' +
      'font:bold 15px Arial,sans-serif;cursor:pointer;margin-right:8px;">Stop the emails</button>' +
      '<button id="ro-no" style="background:#fff;color:#1a3a5c;border:1px solid #c9d2db;border-radius:8px;' +
      'padding:11px 18px;font:15px Arial,sans-serif;cursor:pointer;">Keep them</button>' +
      '</div>';
    document.body.appendChild(wrap);

    function close() {
      wrap.remove();
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
    }
    wrap.querySelector('#ro-no').onclick = close;
    wrap.querySelector('#ro-yes').onclick = function () {
      var btn = this, msg = wrap.querySelector('#ro-msg');
      btn.disabled = true;
      fetch(FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': ANON, 'Authorization': 'Bearer ' + ANON },
        body: JSON.stringify({ action: 'unsubscribe', u: u, s: s })
      }).then(function (r) { return r.json(); }).then(function (j) {
        msg.style.display = 'block';
        if (j && j.ok) {
          msg.style.color = '#1a9e63';
          msg.textContent = 'Done. You will not get test result emails anymore.';
          btn.style.display = 'none';
          wrap.querySelector('#ro-no').textContent = 'Close';
        } else {
          msg.style.color = '#c9564a';
          msg.textContent = (j && j.message) || 'That did not work. Please reply to any of my emails and I will stop them.';
          btn.disabled = false;
        }
      }).catch(function () {
        msg.style.display = 'block';
        msg.style.color = '#c9564a';
        msg.textContent = 'That did not work. Please reply to any of my emails and I will stop them.';
        btn.disabled = false;
      });
    };
  }

  try {
    var p = new URLSearchParams(location.search);
    var u = p.get('unsub'), s = p.get('sig');
    if (u && s) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { showOptOut(u, s); });
      } else {
        showOptOut(u, s);
      }
    }
  } catch (e) {}

  console.log('[freepracticesat] results_email.js loaded');
})();
