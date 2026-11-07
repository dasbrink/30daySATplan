#!/usr/bin/env python3
"""December 5 plan page for freepracticesat.com (Nov 7, 2026).
Adds december-sat-plan/index.html and one sitemap entry.
Undo: python3 december_nov07.py --undo"""
import base64, hashlib, os, shutil, sys, zlib

PAGE_B64 = "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"
PAGE_SHA = "4f7417c275f846bd021d81a9c7ba1e2dea163ee67066517879479114daa5f4ed"
PAGE_PATH = os.path.join("december-sat-plan", "index.html")
SITEMAP = "sitemap.xml"
ENTRY = "  <url>\n    <loc>https://freepracticesat.com/december-sat-plan/</loc>\n    <lastmod>2026-11-07</lastmod>\n  </url>\n"
ANCHOR = "</urlset>"
BACKUP = ".december_backup_20261107"

def sha(b): return hashlib.sha256(b).hexdigest()

def undo():
    if not os.path.isdir(BACKUP):
        print("Nothing to undo: no backup folder found."); sys.exit(1)
    shutil.copy2(os.path.join(BACKUP, "sitemap.xml"), SITEMAP)
    if os.path.exists(PAGE_PATH):
        shutil.move(PAGE_PATH, os.path.join(BACKUP, "index.html.removed"))
        try: os.rmdir("december-sat-plan")
        except OSError: pass
    print("UNDONE: December page removed and sitemap restored. Click Republish.")

def main():
    if "--undo" in sys.argv:
        undo(); return
    page = zlib.decompress(base64.b64decode(PAGE_B64))
    if sha(page) != PAGE_SHA:
        print("STOP. Nothing was changed: embedded page is damaged."); sys.exit(1)
    if not os.path.exists(SITEMAP):
        print("STOP. Nothing was changed: sitemap.xml not found. Run this from the main project folder."); sys.exit(1)
    sm = open(SITEMAP, encoding="utf-8").read()
    has_entry = "freepracticesat.com/december-sat-plan/" in sm
    page_exists = os.path.exists(PAGE_PATH)
    if has_entry and page_exists and sha(open(PAGE_PATH, "rb").read()) == PAGE_SHA:
        print("Already done. Nothing to change."); return
    problems = []
    if sm.count(ANCHOR) != 1: problems.append("sitemap.xml does not have exactly one </urlset>")
    if has_entry: problems.append("sitemap already lists the December page")
    if page_exists: problems.append("december-sat-plan/index.html already exists")
    if problems:
        print("STOP. Nothing was changed:"); [print(" - " + p) for p in problems]; sys.exit(1)
    os.makedirs(BACKUP, exist_ok=True)
    shutil.copy2(SITEMAP, os.path.join(BACKUP, "sitemap.xml"))
    os.makedirs("december-sat-plan", exist_ok=True)
    open(PAGE_PATH, "wb").write(page)
    new = sm.replace(ANCHOR, ENTRY + ANCHOR)
    open(SITEMAP, "w", encoding="utf-8").write(new)
    ok = sha(open(PAGE_PATH, "rb").read()) == PAGE_SHA and open(SITEMAP, encoding="utf-8").read().count("december-sat-plan") == 1
    if not ok:
        print("Something went wrong. Run: python3 december_nov07.py --undo"); sys.exit(1)
    print("DONE: December 5 plan page added at /december-sat-plan/ and listed in the sitemap. Click Republish.")

main()
