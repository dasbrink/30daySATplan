#!/usr/bin/env python3
"""quizauto_nov28.py

Topic-page quiz: no Start button. Question 1 loads as the reader scrolls
near the quiz box. Adds two counts in page_views: /_quiz/loaded and
/_quiz/first_answer. Bumps the topic_quiz.js version tag on every
/sat-math/ topic page so browsers load the new file at once.

Run from the Replit project root:
    python3 quizauto_nov28.py          install
    python3 quizauto_nov28.py --undo   put everything back
"""
import glob
import hashlib
import os
import shutil
import sys

JS = "topic_quiz.js"
OLD_SHA = "d1633cd6ca8980159a745d6780f0b16678f5987de8d1ed17a0fab6056e3ef314"
NEW_SHA = "661ffaa77e4cf9244c979f442dc8824d2d51d2134faa0dd532d699dcbec36faf"
OLD_TAG = "/topic_quiz.js?v=20261104"
NEW_TAG = "/topic_quiz.js?v=20261128"
BACKUP = ".quizauto_backup_20261128"
TEST = os.environ.get("QUIZAUTO_TEST") == "1"  # local testing only

PAIRS = [
[" * Undo the move: python3 quiz_move_nov04.py --undo\n */",
 " * Undo the move: python3 quiz_move_nov04.py --undo\n *\n * Nov 28, 2026: no Start button. Question 1 loads as the reader scrolls\n * near the box. New counts: /_quiz/loaded and /_quiz/first_answer.\n * Undo: python3 quizauto_nov28.py --undo\n */"],
["      '<button type=\"button\" class=\"tq-btn\" id=\"tq-start\">Start the 5 questions</button>';\n    document.getElementById('tq-start').addEventListener('click', start);\n  }\n",
 "      '<p>Loading the questions.</p>';\n    startWhenNear();\n  }\n\n  // Load the questions as the reader scrolls near the box, so question 1\n  // is already showing when they reach it.\n  function startWhenNear() {\n    if (!('IntersectionObserver' in window)) { start(); return; }\n    var near = new IntersectionObserver(function (entries) {\n      if (!entries[0].isIntersecting) return;\n      near.disconnect();\n      start();\n    }, { rootMargin: '600px 0px' });\n    near.observe(box);\n  }\n"],
["    var btn = document.getElementById('tq-start');\n    btn.disabled = true;\n    btn.textContent = 'Loading the questions';\n    track('start');\n",
 "    track('loaded');\n"],
["      '<div class=\"tq-top\"><span id=\"tq-count\"></span>' +\n",
 "      '<h2>Try 5 SAT Math questions</h2>' +\n      '<p>Mixed questions from across the math section. No account needed.</p>' +\n      '<div class=\"tq-top\"><span id=\"tq-count\"></span>' +\n"],
["        answers[index] = choice;\n",
 "        if (index === 0 && !answers.length) track('first_answer');\n        answers[index] = choice;\n"],
]


def sha(b):
    return hashlib.sha256(b).hexdigest()


def read(p):
    with open(p, "rb") as f:
        return f.read()


def write(p, b):
    with open(p, "wb") as f:
        f.write(b)


def pages():
    return sorted(glob.glob(os.path.join("sat-math", "*", "index.html")))


def stop(reasons):
    print("STOP. Nothing was changed:")
    for r in reasons:
        print("  - " + r)
    sys.exit(1)


def undo():
    if not os.path.isdir(BACKUP):
        stop(["no backup folder " + BACKUP + " found"])
    n = 0
    for root, _, files in os.walk(BACKUP):
        for name in files:
            src = os.path.join(root, name)
            rel = os.path.relpath(src, BACKUP)
            shutil.copy2(src, rel)
            n += 1
    print("UNDONE: restored %d files from %s. Click Republish." % (n, BACKUP))


def install():
    reasons = []
    if not os.path.isfile(JS):
        stop([JS + " not found. Run this from the Replit project root."])
    js = read(JS)

    old_pages, new_pages, odd_pages = [], [], []
    for p in pages():
        t = read(p).decode("utf-8")
        if OLD_TAG in t:
            if t.count(OLD_TAG) != 1:
                odd_pages.append(p + " has the quiz tag more than once")
            else:
                old_pages.append(p)
        elif NEW_TAG in t:
            new_pages.append(p)
        elif "topic_quiz.js" in t:
            odd_pages.append(p + " loads topic_quiz.js with a different version")

    if sha(js) == NEW_SHA and not old_pages and new_pages and not odd_pages:
        print("Already done. Nothing to change.")
        return

    if sha(js) != OLD_SHA and not TEST:
        reasons.append(JS + " is not the version this script was built for")
    text = js.decode("utf-8")
    for old, _ in PAIRS:
        c = text.count(old)
        if c != 1:
            reasons.append("a spot in %s was found %d times, expected once: %r" % (JS, c, old[:60]))
    if not old_pages:
        reasons.append("no /sat-math/ page has the tag " + OLD_TAG)
    reasons.extend(odd_pages)
    if os.path.exists(BACKUP):
        reasons.append("backup folder " + BACKUP + " already exists")
    if reasons:
        stop(reasons)

    new_text = text
    for old, new in PAIRS:
        new_text = new_text.replace(old, new, 1)
    new_js = new_text.encode("utf-8")
    if sha(new_js) != NEW_SHA and not TEST:
        stop(["the changed " + JS + " did not match the tested version"])

    os.makedirs(BACKUP)
    shutil.copy2(JS, os.path.join(BACKUP, JS))
    for p in old_pages:
        dest = os.path.join(BACKUP, p)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy2(p, dest)

    write(JS, new_js)
    for p in old_pages:
        t = read(p).decode("utf-8")
        write(p, t.replace(OLD_TAG, NEW_TAG, 1).encode("utf-8"))

    bad = [p for p in old_pages if read(p).decode("utf-8").count(NEW_TAG) != 1]
    if bad or (sha(read(JS)) != NEW_SHA and not TEST):
        print("Something did not check out after writing. Run: python3 quizauto_nov28.py --undo")
        sys.exit(1)
    print("DONE: quiz shows question 1 without a Start button on %d topic pages. Click Republish." % len(old_pages))


if __name__ == "__main__":
    if "--undo" in sys.argv:
        undo()
    else:
        install()
