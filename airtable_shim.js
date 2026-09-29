/* airtable_shim.js
 *
 * Load this BEFORE any other script on the page.
 *
 * The pages on freepracticesat.com and 30daysatplan.com were written to
 * call Airtable directly from the browser, with the Airtable token in the
 * page. That token was cancelled on Sept 28, 2026 because it was public.
 *
 * This file quietly re-routes every Airtable READ the page makes to the
 * airtable-read function in Supabase, which holds the token privately.
 * The rest of the page does not need to change: it still "calls Airtable"
 * and gets exactly the same answers back.
 *
 * Writes to Airtable (POST, PATCH, DELETE) are NOT re-routed. None of the
 * student pages make them.
 */
(function () {
  var RELAY_URL = 'https://undhvypblihwzojqkgsd.supabase.co/functions/v1/airtable-read';
  var AIRTABLE_PREFIX = 'https://api.airtable.com/v0/';

  if (!window.fetch || window.__airtableShim) return;
  window.__airtableShim = true;

  var realFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    try {
      var url = typeof input === 'string' ? input
              : (input && input.url) ? input.url
              : String(input);
      var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();

      if (url.indexOf(AIRTABLE_PREFIX) === 0 && method === 'GET') {
        // Drop "https://api.airtable.com/v0/<base>/" and keep the rest:
        // "Questions?filterByFormula=..." or "Questions/recXXXX".
        var rest = url.slice(AIRTABLE_PREFIX.length);
        var slash = rest.indexOf('/');
        var path = slash === -1 ? '' : rest.slice(slash + 1);

        return realFetch(RELAY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: path })
        });
      }
    } catch (e) {
      console.error('airtable_shim:', e);
    }
    return realFetch(input, init);
  };
})();
