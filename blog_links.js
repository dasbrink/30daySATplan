/* blog_links.js — appends a "More free reading" links block to the bottom of the
   30daySATplan landing page. Self-contained, touches no checkout code. */
(function () {
  function addLinks() {
    try {
      if (document.getElementById('more-reading-block')) return;

      var NAVY = '#1a3a5c', GOLD = '#c9902a', LINE = '#e3e7ec';

      var section = document.createElement('section');
      section.id = 'more-reading-block';
      section.style.cssText =
        'max-width:760px;margin:0 auto;padding:36px 20px 48px;' +
        'font-family:Georgia,"Times New Roman",serif;color:#20303f;';

      var h = document.createElement('h2');
      h.textContent = 'More free reading from Dr. Brink';
      h.style.cssText =
        'color:' + NAVY + ';font-size:24px;margin:0 0 6px;' +
        'border-bottom:3px solid ' + GOLD + ';padding-bottom:6px;';
      section.appendChild(h);

      var sub = document.createElement('p');
      sub.textContent =
        'Short, practical reads on raising an SAT math score, free and no sign-up.';
      sub.style.cssText = 'font-size:16px;color:#6b7683;font-style:italic;margin:0 0 18px;';
      section.appendChild(sub);

      var posts = [
        {
          href: '/blog/twenty-mile-march/',
          title: 'The 20-Mile March: Why a Little SAT Math Every Day Beats Cramming on Saturdays',
          blurb: 'The polar-explorer lesson on why consistency beats the big Saturday session that never happens.'
        },
        {
          href: '/sat-math-skills/',
          title: 'The 280 Skills the SAT Math Section Really Tests',
          blurb: 'Every foundational skill behind the test, grouped from Grade 5 up, and how the plan fixes your gaps.'
        },
        {
          href: '/blog/7-things-boost-sat-score/',
          title: '7 Things That Boost Your SAT Score',
          blurb: 'Simple, high-leverage habits that move the needle more than another practice book.'
        }
      ];

      posts.forEach(function (p) {
        var a = document.createElement('a');
        a.href = p.href;
        a.style.cssText =
          'display:block;text-decoration:none;color:inherit;' +
          'border:1px solid ' + LINE + ';border-radius:10px;' +
          'padding:16px 18px;margin:0 0 14px;';
        a.onmouseover = function () { a.style.borderColor = GOLD; };
        a.onmouseout = function () { a.style.borderColor = LINE; };

        var t = document.createElement('div');
        t.textContent = p.title;
        t.style.cssText = 'color:' + NAVY + ';font-size:18px;font-weight:bold;margin:0 0 4px;';
        a.appendChild(t);

        var b = document.createElement('div');
        b.textContent = p.blurb;
        b.style.cssText = 'font-size:15px;color:#444;';
        a.appendChild(b);

        section.appendChild(a);
      });

      document.body.appendChild(section);
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addLinks);
  } else {
    addLinks();
  }
})();
