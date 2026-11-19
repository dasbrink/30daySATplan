#!/usr/bin/env python3
# stats_nov18.py : adds the "Join N students..." line above the sign-up form on freepracticesat.com
# Run:   python3 stats_nov18.py        Undo:  python3 stats_nov18.py --undo
import base64, hashlib, os, shutil, sys, zlib

NEW_FILE = "site_stats.js"
NEW_SHA = "901b2c81e00e701f752fbe42a9c07875d2d42b9a7758eecbd82bb338f578d39e"
NEW_BLOB = "eNqNVW1z0zgQ/t5fsW1nsA2Jk0AZBptyc/SYuzJpmSHcZ0ax17ZAkYwkN/VB/zsr+SVJy3TuS2Ktdh/ts6+zGRhu8YuxzJr4q4EETKW2Bk4+KC7hGoxtcpTWwLZSULEbBCY0srwFJs0WNeZwBas/P8OG2Qq+N2gsV9JARVfxydFsBmytyMpWCJ+w5MaihhksVQmXEixbG1DS3womcy5LqFmJMVw3mzVqA5na0BUnhEKrjVN0mDkjS2ZI2MjMPQh1sxY8+7IjE0YxXBbkZWsrB1swLswEpOqO3HiiMj4KR4wwgh9HsMMsNjaUnQxAo2207P0icWzVUmVM4MpqAgwDlNN/V0GUkvbd0T4My/OVbQWGAxQvIMxV1mwosHGJ9r1A9/muvczDoKjN1LGYehb0S5ZBFPXvpx7ghmlKDJzDiJJRTiz2QGHQW3XaxsY8J+XfQ486Fm/thZKWAODcCwGC+NDmR0EK04JtuGiTk5VqdIawQk2Mzk4mf6PSJWcT4wRppoTSyemCvWAvszSAZwOmxzD8P0wWr+rbVHCJ0wp5WdlkEZ+9TDeMUGQyhzkszupbmKc1hZBinCzmdHSyfbi10jnqqcDCJk7dKEF0T7PXr+fPWbpm2bdSq0bmyWlRFGmvrVnOG+P007s9rHt0KSxaybJjve1cfDWfk0kXtTH8FXVEzOoaZX5RcZGHxu4KgZlWZrty0I0cK8El0jm+n0rqId2uUGBmlQ6DuO8LT3BIqbPzvXPemT954v8f2LLGVlOnOBi60jv2lj9/wv+swfvV5zBsW6MqwDS178MLwX3ZnFOVUaixoJzmgXvj+FAl1nW2Q/NwVrd9NDpeGh0ttmXcwkPjMHjQ6QO3zjMyj1Frpf3r7uSGxSGD7iHXEz2PQa1jYHxHB/AHfFh9vI5rpg2GO6RkVN9HM7yUTe1c70dEHveiaNLPyoPLXnTg+3E4oLyFeeQJhIOpk9yLHOyNln1X6kcmQ72LVv3bsRDsrjPBjLlmNIAf0+JSov7n89XSafmt8aZrm7fUWH6GDnGgYzAulDezXuuRzbIH1D8HHnCInQd8uHx20H4Ljb76FuGSxpN9h4XSGNYT30Z9SO4gYzarIMRorMjZU/KYtZReQV4nflO5DQVbpb8ZwFuWWUEuG1h7SHg667CG7j8Y9p7figKIXaUJxVxvB8N7oyIl9v0NfSzdwqT4hsFfH6/66bwkI+quiZsk3ZQBFLQL+z3lxks3e+4i9/ULO0CF8A=="
INDEX = "index.html"
ANCHOR = '<script src="offer_followup.js?v=20261028"></script>'
TAG = '<script src="site_stats.js?v=20261118"></script>'
BACKUP = ".stats_backup_20261118"

def new_bytes():
    data = zlib.decompress(base64.b64decode(NEW_BLOB))
    if hashlib.sha256(data).hexdigest() != NEW_SHA:
        print("STOP. Nothing was changed: the embedded file is damaged.")
        sys.exit(1)
    return data

def undo():
    bk = os.path.join(BACKUP, INDEX)
    if not os.path.exists(bk):
        print("Nothing to undo: no backup found in " + BACKUP + ".")
        sys.exit(1)
    shutil.copy2(bk, INDEX)
    if os.path.exists(NEW_FILE):
        shutil.move(NEW_FILE, os.path.join(BACKUP, NEW_FILE + ".removed"))
    print("UNDONE: index.html restored and site_stats.js removed. Click Republish.")

def install():
    data = new_bytes()
    problems = []
    if not os.path.exists(INDEX):
        print("STOP. Nothing was changed: index.html not found. Run this from the main folder.")
        sys.exit(1)
    html = open(INDEX, encoding="utf-8").read()

    if TAG in html and os.path.exists(NEW_FILE):
        if hashlib.sha256(open(NEW_FILE, "rb").read()).hexdigest() == NEW_SHA and html.count(TAG) == 1:
            print("Already done. Nothing to change.")
            return
    if html.count(ANCHOR) != 1:
        problems.append("the line loading offer_followup.js was found %d times (expected 1)" % html.count(ANCHOR))
    if "site_stats.js" in html:
        problems.append("index.html already mentions site_stats.js")
    if os.path.exists(NEW_FILE):
        problems.append("site_stats.js already exists")
    if problems:
        print("STOP. Nothing was changed:")
        for p in problems:
            print(" - " + p)
        sys.exit(1)

    os.makedirs(BACKUP, exist_ok=True)
    shutil.copy2(INDEX, os.path.join(BACKUP, INDEX))

    with open(NEW_FILE, "wb") as f:
        f.write(data)
    new_html = html.replace(ANCHOR, ANCHOR + "\n" + TAG, 1)
    with open(INDEX, "w", encoding="utf-8") as f:
        f.write(new_html)

    check = open(INDEX, encoding="utf-8").read()
    ok = (check.count(TAG) == 1 and check.rstrip().endswith("</html>")
          and hashlib.sha256(open(NEW_FILE, "rb").read()).hexdigest() == NEW_SHA)
    if not ok:
        shutil.copy2(os.path.join(BACKUP, INDEX), INDEX)
        os.remove(NEW_FILE)
        print("STOP. The check after writing failed, so everything was put back.")
        sys.exit(1)
    print("DONE: the student count line is added above the sign-up form. Click Republish.")

if __name__ == "__main__":
    if "--undo" in sys.argv:
        undo()
    else:
        install()
