#!/usr/bin/env python3
"""December SAT page: send "Take the free test" straight to the Register form.

Changes ONE line in december-sat-plan/index.html:
    <a href="/">Take the free test</a>
becomes
    <a href="/#tab-register">Take the free test</a>

Run:   python3 december_register_nov08.py
Undo:  python3 december_register_nov08.py --undo
Then click Republish.
"""
import hashlib
import os
import shutil
import sys

PAGE = os.path.join("december-sat-plan", "index.html")
BACKUP_DIR = ".decreg_backup_20261108"
EXPECTED_SHA = "b375eb351327ffc79afa8555bd73213a578c0e2d087c7843916950bf16a42d1a"

OLD = '<a href="/">Take the free test</a>'
NEW = '<a href="/#tab-register">Take the free test</a>'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def stop(reasons):
    print("STOP. Nothing was changed:")
    for r in reasons:
        print("  - " + r)
    sys.exit(1)


def install():
    if not os.path.isfile(PAGE):
        stop([PAGE + " not found. Run this from the main project folder."])
    with open(PAGE, "rb") as f:
        raw = f.read()
    text = raw.decode("utf-8")

    if text.count(NEW) == 1 and text.count(OLD) == 0:
        print("Already done. Nothing to change.")
        return

    reasons = []
    if sha(raw) != EXPECTED_SHA:
        reasons.append(PAGE + " is not the version this script was tested on.")
    if text.count(OLD) != 1:
        reasons.append("The 'Take the free test' link was found %d times (expected 1)." % text.count(OLD))
    if text.count(NEW) != 0:
        reasons.append("The new link is already partly there.")
    if os.path.exists(BACKUP_DIR):
        reasons.append("Backup folder " + BACKUP_DIR + " already exists.")
    if reasons:
        stop(reasons)

    os.makedirs(BACKUP_DIR)
    shutil.copy2(PAGE, os.path.join(BACKUP_DIR, "index.html"))

    new_text = text.replace(OLD, NEW, 1)
    with open(PAGE, "wb") as f:
        f.write(new_text.encode("utf-8"))

    with open(PAGE, "rb") as f:
        check = f.read().decode("utf-8")
    if check.count(NEW) != 1 or check.count(OLD) != 0 or not check.rstrip().endswith("</html>"):
        shutil.copy2(os.path.join(BACKUP_DIR, "index.html"), PAGE)
        stop(["Check after writing failed, so the original page was put back."])

    print("DONE: 'Take the free test' now goes straight to the Register form. Click Republish.")


def undo():
    saved = os.path.join(BACKUP_DIR, "index.html")
    if not os.path.isfile(saved):
        stop(["No backup found in " + BACKUP_DIR + "."])
    shutil.copy2(saved, PAGE)
    shutil.rmtree(BACKUP_DIR)
    print("UNDONE: the December page is back to how it was. Click Republish.")


if __name__ == "__main__":
    if "--undo" in sys.argv:
        undo()
    else:
        install()
