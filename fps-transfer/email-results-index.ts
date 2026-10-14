// @ts-nocheck
// ══════════════════════════════════════════════════════════════
// email-results
// Project: freepracticesat (undhvypblihwzojqkgsd)
//
// After a student finishes a full practice test, the page calls this
// function. It emails the student a one-screen summary of the result:
// the score, a bar for each of the four math areas, and bars for the
// mistakes behind the wrong answers. Free students see one mistake
// named and the rest locked, plus the $29 offer. Paid students see
// every mistake named and no offer.
//
// SAFETY
// - The caller must be signed in. The function only ever reads the
//   caller's own test_results rows.
// - Each test result is emailed at most once (results_emails_sent).
// - Clicked-through tests are skipped: fewer than 22 answers, no email.
// - A student who opts out (email_optouts) is never emailed again.
// - The Airtable token stays in Supabase secrets.
//
// Two actions:
//   POST {}                         send for the caller's newest result
//   POST { action:"unsubscribe", u, s }   opt out, from the email link
// ══════════════════════════════════════════════════════════════

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const AIRTABLE_TOKEN = Deno.env.get("AIRTABLE_TOKEN");
const AIRTABLE_BASE = "app4WLsifRZPgtosg";

const SENDER_EMAIL = "noreply@freepracticesat.com";
const SENDER_NAME = "Dr. Brink SAT Math";
const SITE = "https://freepracticesat.com/";
const PRICE_LABEL = "$29";
const MIN_ANSWERED = 22;
const MAX_AGE_MINUTES = 30;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// ── Database through the REST API, with the service key ──
async function db(path, init = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  return { ok: r.ok, status: r.status, data };
}

// ── Signed opt-out link ──
async function sign(userId) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SERVICE_KEY),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("optout:" + userId));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

// ── Airtable, read only ──
async function airtableByIds(table, ids, fields) {
  let out = [];
  const uniq = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 40) {
    const formula = "OR(" + uniq.slice(i, i + 40).map((x) => `RECORD_ID()='${x}'`).join(",") + ")";
    let url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(table)}?filterByFormula=${encodeURIComponent(formula)}`;
    for (const f of fields) url += `&fields[]=${encodeURIComponent(f)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
    if (!r.ok) throw new Error(`airtable ${table} ${r.status}`);
    const j = await r.json();
    out = out.concat(j.records || []);
  }
  return out;
}

function looksLikeInternalCode(s) {
  return /^[A-Z0-9][A-Z0-9_]{4,}$/.test(String(s || "").trim());
}

function answeredCount(snap) {
  return Array.isArray(snap?.answeredIds) ? snap.answeredIds.length : 0;
}

// ── Build the numbers the email shows ──
async function summarize(snap) {
  const answered = snap.answeredIds || [];
  const wrong = new Set(snap.missedIds || []);

  const qs = await airtableByIds("Questions", answered, ["Skill"]);
  const skillIds = qs.map((r) => (r.fields.Skill || [])[0]).filter(Boolean);
  const skills = await airtableByIds("Skills", skillIds, ["Domain"]);
  const domainOf = {};
  for (const s of skills) domainOf[s.id] = s.fields.Domain;

  const domains = {};
  for (const r of qs) {
    const d = domainOf[(r.fields.Skill || [])[0]];
    if (!d) continue;
    domains[d] = domains[d] || [0, 0];
    domains[d][1]++;
    if (!wrong.has(r.id)) domains[d][0]++;
  }

  const counts = {};
  for (const m of snap.missed || []) {
    const ch = (m.choices || [])[m.chosenIndex];
    const id = ch && ch.misconceptionId;
    if (id) counts[id] = (counts[id] || 0) + 1;
  }
  const mc = await airtableByIds("Misconceptions", Object.keys(counts), ["Description"]);
  const mistakes = mc
    .map((r) => [counts[r.id] || 0, String(r.fields.Description || "").trim()])
    .filter(([, d]) => d && !looksLikeInternalCode(d) && d.split(/\s+/).length >= 4)
    .sort((a, b) => b[0] - a[0]);

  return { domains, mistakes };
}

function buildText(d) {
  const lines = [
    `Test ${d.testNumber}, estimated SAT Math score: ${d.score}`,
    `${d.correct} of ${d.total} questions right`,
    "",
    "Where your points came from:",
    ...DOMAINS.filter(([n]) => d.domains[n]).map(([n]) => `  ${n}: ${d.domains[n][0]} of ${d.domains[n][1]}`),
    "",
  ];
  if (d.mistakes.length) {
    lines.push(d.paid ? "The mistakes behind your wrong answers:" : "The first mistake behind your wrong answers:");
    const shown = d.paid ? d.mistakes.slice(0, 5) : d.mistakes.slice(0, 1);
    for (const [n, t] of shown) lines.push(`  ${plainMath(t)} (${n} time${n === 1 ? "" : "s"})`);
    if (!d.paid && d.mistakes.length > 1) lines.push(`  Plus ${d.mistakes.length - 1} more, unlocked with full access (${PRICE_LABEL} one time).`);
    lines.push("");
  }
  lines.push(`See your results: ${SITE}`, "", "Keep going,", "Dr. Brink");
  if (d.unsubscribeUrl) lines.push("", `Stop sending me test results: ${d.unsubscribeUrl}`);
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body = {};
  try { body = await req.json(); } catch (_) { body = {}; }

  // ── Opt out ──
  if (body.action === "unsubscribe") {
    const u = String(body.u || ""), s = String(body.s || "");
    if (!/^[0-9a-f-]{36}$/.test(u) || s !== (await sign(u))) return json({ ok: false, message: "That link is not valid." }, 400);
    await db("email_optouts", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({ user_id: u }),
    });
    return json({ ok: true });
  }

  // ── Who is calling ──
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ sent: false, reason: "not signed in" }, 401);
  const ur = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` } });
  if (!ur.ok) return json({ sent: false, reason: "not signed in" }, 401);
  const user = await ur.json();
  if (!user?.id || !user?.email) return json({ sent: false, reason: "no email" }, 400);

  try {
    // Opted out?
    const opt = await db(`email_optouts?user_id=eq.${user.id}&select=user_id`);
    if (opt.ok && opt.data?.length) return json({ sent: false, reason: "opted out" });

    // Newest results for this student only.
    const rows = await db(`test_results?user_id=eq.${user.id}&select=id,score,test_number,snapshot,created_at&order=created_at.desc&limit=8`);
    if (!rows.ok || !rows.data?.length) return json({ sent: false, reason: "no result" });
    const latest = rows.data[0];
    const ageMin = (Date.now() - new Date(latest.created_at).getTime()) / 60000;
    if (ageMin > MAX_AGE_MINUTES) return json({ sent: false, reason: "no recent result" });

    const snap = latest.snapshot || {};
    if (answeredCount(snap) < MIN_ANSWERED) return json({ sent: false, reason: "test not finished" });

    // Claim this result. A second call for the same result stops here.
    const claim = await db("results_emails_sent", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ test_result_id: latest.id, user_id: user.id }),
    });
    if (!claim.ok) return json({ sent: false, reason: "already sent" });

    const prev = rows.data.slice(1).find((r) => answeredCount(r.snapshot) >= MIN_ANSWERED);

    const ent = await db(`entitlements?user_id=eq.${user.id}&select=tier`);
    const tier = ent.ok && ent.data?.length ? Number(ent.data[0].tier) || 0 : 0;

    const { domains, mistakes } = await summarize(snap);
    const unsubscribeUrl = `${SITE}?unsub=${user.id}&sig=${await sign(user.id)}`;

    const d = {
      testNumber: latest.test_number ?? snap.testNumber ?? "",
      score: snap.estimatedScore ?? latest.score,
      correct: snap.totalCorrect ?? 0,
      total: snap.total ?? 44,
      previousScore: prev ? (prev.snapshot?.estimatedScore ?? prev.score) : null,
      domains, mistakes,
      paid: tier >= 3,
      siteUrl: SITE, unsubscribeUrl, priceLabel: PRICE_LABEL,
    };
    const { subject, html } = buildResultsEmail(d);

    const brevo = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: SENDER_EMAIL, name: SENDER_NAME },
        to: [{ email: user.email }],
        replyTo: { email: "dasbrink@gmail.com", name: "Dr. Brink" },
        subject,
        htmlContent: html,
        textContent: buildText(d),
        headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
        tags: ["results-email"],
      }),
    });

    const ok = brevo.ok;
    const detail = ok ? null : (await brevo.text().catch(() => "")).slice(0, 300);
    await db(`results_emails_sent?test_result_id=eq.${latest.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ ok, detail, paid: d.paid, score: d.score }),
    });
    if (!ok) console.error("brevo send failed:", brevo.status, detail);
    return json({ sent: ok });
  } catch (e) {
    console.error("email-results error:", e);
    return json({ sent: false, reason: "error" }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// EMAIL TEMPLATE
// ══════════════════════════════════════════════════════════════
// Results email template. Pure function, no I/O. Used by the sample
// builder here and pasted into the email-results edge function.
// Every chart is table cells with background colors, so it renders in
// Gmail, Outlook and Apple Mail with images turned off.

const NAVY = "#1a3a5c";
const GOLD = "#c9902a";
const INK = "#22303c";
const MUTED = "#6b7785";
const LINE = "#e3e7ec";
const TRACK = "#eef1f4";

const DOMAINS = [
  ["Algebra", "#2e6da4"],
  ["Advanced Math", "#c9902a"],
  ["Problem-Solving and Data Analysis", "#1a9e63"],
  ["Geometry and Trigonometry", "#c9564a"],
];

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// Mistake names come from Airtable and may hold LaTeX like $30°$ or $x$.
function plainMath(s) {
  return String(s ?? "")
    .replace(/\\\$/g, "\u0000")
    .replace(/\$([^$]*)\$/g, (_, m) =>
      m.replace(/\\dfrac\{([^}]*)\}\{([^}]*)\}|\\frac\{([^}]*)\}\{([^}]*)\}/g, (_, a, b, c, d) => `${a ?? c}/${b ?? d}`)
        .replace(/\\sqrt\{([^}]*)\}/g, "√($1)")
        .replace(/\\pi/g, "π").replace(/\\cdot|\\times/g, "×").replace(/\\le/g, "≤").replace(/\\ge/g, "≥")
        .replace(/\^\{?2\}?/g, "²").replace(/\^\{?3\}?/g, "³")
        .replace(/[{}\\]/g, ""))
    .replace(/\u0000/g, "$")
    .replace(/cancelling/g, "canceling").replace(/Cancelling/g, "Canceling");
}

// One horizontal bar: filled part in color, rest in a light track.
function bar(pct, color, height = 14) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const fill = p === 0 ? "" :
    `<td width="${p}%" bgcolor="${color}" style="background:${color};height:${height}px;line-height:${height}px;font-size:1px;border-radius:7px 0 0 7px;">&nbsp;</td>`;
  const rest = p === 100 ? "" :
    `<td width="${100 - p}%" bgcolor="${TRACK}" style="background:${TRACK};height:${height}px;line-height:${height}px;font-size:1px;">&nbsp;</td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-radius:7px;overflow:hidden;"><tr>${fill}${rest}</tr></table>`;
}

// Score on the 200 to 800 scale, with a gold marker cell.
function scoreScale(score) {
  const pos = Math.round(((Math.max(200, Math.min(800, score)) - 200) / 600) * 100);
  const left = Math.max(0, pos - 1), right = Math.max(0, 100 - pos - 1);
  const cell = (w, c) => w > 0 ? `<td width="${w}%" bgcolor="${c}" style="background:${c};height:12px;font-size:1px;line-height:12px;">&nbsp;</td>` : "";
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>
    ${cell(left, "#2e6da4")}${cell(2, GOLD)}${cell(right, TRACK)}
  </tr></table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px;"><tr>
    <td style="font:12px Arial,sans-serif;color:${MUTED};" align="left">200</td>
    <td style="font:12px Arial,sans-serif;color:${MUTED};" align="center">500</td>
    <td style="font:12px Arial,sans-serif;color:${MUTED};" align="right">800</td>
  </tr></table>`;
}

function section(title, inner) {
  return `
  <tr><td style="padding:26px 28px 0 28px;">
    <div style="font:bold 18px Georgia,serif;color:${NAVY};margin:0 0 14px 0;">${title}</div>
    ${inner}
  </td></tr>`;
}

/**
 * data = {
 *   firstName?: string,
 *   testNumber: number, score: number, correct: number, total: number,
 *   previousScore?: number|null,
 *   domains: { [name]: [correct, total] },
 *   mistakes: [count, description][]   (sorted, most repeated first)
 *   paid: boolean,
 *   siteUrl, unsubscribeUrl, priceLabel
 * }
 */
function buildResultsEmail(d) {
  const site = d.siteUrl || "https://freepracticesat.com/";
  const price = d.priceLabel || "$29";

  // ── Score block ──
  let delta = "";
  if (typeof d.previousScore === "number" && d.previousScore > 0) {
    const diff = d.score - d.previousScore;
    const col = diff > 0 ? "#1a9e63" : diff < 0 ? "#c9564a" : MUTED;
    const word = diff > 0 ? `Up ${diff} from your last test` : diff < 0 ? `Down ${-diff} from your last test` : "Same as your last test";
    delta = `<div style="font:bold 14px Arial,sans-serif;color:${col};margin-top:6px;">${word}</div>`;
  }
  const scoreBlock = `
  <tr><td style="padding:28px 28px 0 28px;">
    <div style="font:14px Arial,sans-serif;color:${MUTED};">Test ${esc(d.testNumber)}, estimated SAT Math score</div>
    <div style="font:bold 54px Georgia,serif;color:${NAVY};line-height:1.1;margin:4px 0 2px 0;">${esc(d.score)}</div>
    <div style="font:14px Arial,sans-serif;color:${INK};">${esc(d.correct)} of ${esc(d.total)} questions right</div>
    ${delta}
    <div style="margin-top:16px;">${scoreScale(d.score)}</div>
  </td></tr>`;

  // ── Four domains ──
  let weakest = null;
  const rows = DOMAINS.map(([name, color]) => {
    const [c, t] = d.domains[name] || [0, 0];
    if (!t) return "";
    const pct = (c / t) * 100;
    if (!weakest || pct < weakest.pct) weakest = { name, pct, missed: t - c };
    return `
    <tr><td style="padding:0 0 14px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="font:bold 14px Arial,sans-serif;color:${INK};padding-bottom:5px;">${esc(name)}</td>
        <td align="right" style="font:14px Arial,sans-serif;color:${MUTED};padding-bottom:5px;white-space:nowrap;">${c} of ${t}</td>
      </tr></table>
      ${bar(pct, color)}
    </td></tr>`;
  }).join("");
  const domainBlock = section("Where your points came from", `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
    ${weakest ? `<div style="font:14px Arial,sans-serif;color:${INK};background:#fbf5ea;border-left:4px solid ${GOLD};padding:10px 12px;">
      Most room to grow: <b>${esc(weakest.name)}</b>, with ${weakest.missed} question${weakest.missed === 1 ? "" : "s"} missed.</div>` : ""}`);

  // ── Mistakes: one named, the rest hidden for free students ──
  const top = (d.mistakes || []).slice(0, 5);
  const maxCount = Math.max(1, ...top.map((m) => m[0]));
  const mRows = top.map(([n, desc], i) => {
    const show = d.paid || i === 0;
    const label = show
      ? `<span style="font:14px Arial,sans-serif;color:${INK};">${esc(plainMath(desc))}</span>`
      : `<span style="font:14px Arial,sans-serif;color:#b7c0ca;letter-spacing:1px;">&#9632;&#9632;&#9632;&#9632;&#9632;&#9632;&#9632;&#9632;&#9632;&#9632;&#9632;&#9632;</span>
         <span style="font:12px Arial,sans-serif;color:${MUTED};">&nbsp;Locked</span>`;
    return `
    <tr><td style="padding:0 0 14px 0;">
      <div style="padding-bottom:5px;">${label}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td>${bar((n / maxCount) * 100, show ? "#c9564a" : "#d5dbe1", 10)}</td>
        <td width="70" align="right" style="font:12px Arial,sans-serif;color:${MUTED};white-space:nowrap;">${n} time${n === 1 ? "" : "s"}</td>
      </tr></table>
    </td></tr>`;
  }).join("");
  const mistakeIntro = d.paid
    ? `The wrong answers you chose point to these mistakes. Your full study plan is waiting on the site.`
    : `Your wrong answers were not random. Each one points to a specific mistake. Here is the first one, free.`;
  const mistakeBlock = top.length ? section("The mistakes behind your wrong answers", `
    <div style="font:14px Arial,sans-serif;color:${INK};margin:0 0 14px 0;line-height:1.5;">${mistakeIntro}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${mRows}</table>
    ${(d.mistakes.length > top.length) ? `<div style="font:bold 14px Arial,sans-serif;color:${INK};">Plus ${d.mistakes.length - top.length} more mistake${d.mistakes.length - top.length === 1 ? "" : "s"} found on this test.</div>` : ""}`) : "";

  // ── Offer (free students only) ──
  const items = [
    ["Every mistake, worked out", "A step-by-step solution for every question you miss, on every test."],
    ["The mistakes you keep making", "Every one named, with why it happens and practice until it stops."],
    ["The math underneath them", "The building blocks missing beneath those mistakes, rebuilt from easy to hard."],
    ["The Desmos video library", "Walkthroughs sorted by topic, so you find the right one in seconds."],
  ];
  const offerBlock = d.paid ? "" : `
  <tr><td style="padding:28px 28px 0 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${NAVY}" style="background:${NAVY};border-radius:10px;">
      <tr><td style="padding:22px 22px 6px 22px;">
        <div style="font:bold 19px Georgia,serif;color:#ffffff;">Fix these, and the score moves</div>
        <div style="font:14px Arial,sans-serif;color:#d6e0ea;margin-top:6px;line-height:1.5;">
          Full access unlocks the rest of what this test found, and does the same after every test you take.</div>
      </td></tr>
      ${items.map(([h, p]) => `
      <tr><td style="padding:10px 22px 0 22px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="top" style="font:bold 15px Arial,sans-serif;color:${GOLD};padding-right:10px;">&#10003;</td>
          <td style="font:14px Arial,sans-serif;color:#ffffff;line-height:1.45;"><b>${h}</b><br><span style="color:#c4d1de;">${p}</span></td>
        </tr></table>
      </td></tr>`).join("")}
      <tr><td align="center" style="padding:22px 22px 8px 22px;">
        <a href="${esc(site)}" style="display:inline-block;background:${GOLD};color:#ffffff;font:bold 16px Arial,sans-serif;text-decoration:none;padding:14px 26px;border-radius:8px;">Unlock everything, ${esc(price)} one time</a>
      </td></tr>
      <tr><td align="center" style="padding:0 22px 20px 22px;font:12px Arial,sans-serif;color:#c4d1de;">
        One payment. No subscription. Sign in and open your results to unlock.</td></tr>
    </table>
  </td></tr>`;

  const nextBlock = `
  <tr><td style="padding:24px 28px 0 28px;font:14px Arial,sans-serif;color:${INK};line-height:1.55;">
    ${d.paid
      ? `Your worked solutions and study plan for this test are on the site now. <a href="${esc(site)}" style="color:${NAVY};font-weight:bold;">Open my results</a>.`
      : `Your score and four-area breakdown stay free on the site, and every practice test stays free. <a href="${esc(site)}" style="color:${NAVY};font-weight:bold;">See my results</a>.`}
    <br><br>Keep going,<br><b>Dr. Brink</b><br>
    <span style="color:${MUTED};font-size:13px;">Ph.D., 32 years of mathematics education</span>
  </td></tr>`;

  const footer = `
  <tr><td style="padding:26px 28px 24px 28px;">
    <div style="border-top:1px solid ${LINE};padding-top:14px;font:12px Arial,sans-serif;color:${MUTED};line-height:1.5;">
      You received this because you finished a practice test on freepracticesat.com.
      ${d.unsubscribeUrl ? `<a href="${esc(d.unsubscribeUrl)}" style="color:${MUTED};">Stop sending me test results</a>.` : ""}
    </div>
  </td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your SAT Math results</title></head>
<body style="margin:0;padding:0;background:#f2f4f7;">
<div style="display:none;max-height:0;overflow:hidden;">Test ${esc(d.testNumber)}: ${esc(d.score)}. Here is where your points came from.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f2f4f7" style="background:#f2f4f7;">
<tr><td align="center" style="padding:20px 10px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background:#ffffff;border-radius:10px;">
    <tr><td bgcolor="${NAVY}" style="background:${NAVY};padding:18px 28px;border-radius:10px 10px 0 0;">
      <span style="font:bold 20px Georgia,serif;color:#ffffff;">Free Practice SAT</span>
      <span style="font:14px Arial,sans-serif;color:${GOLD};">&nbsp; Your results</span>
    </td></tr>
    ${scoreBlock}
    ${domainBlock}
    ${mistakeBlock}
    ${offerBlock}
    ${nextBlock}
    ${footer}
  </table>
</td></tr></table>
</body></html>`;

  const subject = `Your Test ${d.testNumber} result: ${d.score} in SAT Math`;
  return { subject, html };
}
