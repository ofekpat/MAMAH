#!/usr/bin/env node
// בונה את index.html מתוך data/course.json + data/questions.json + data/solutions.md
// + התמונות שב-exercises/ ו-solutions/, על גבי tools/template.html.
const fs = require('fs');
const path = require('path');
const ROOT   = path.join(__dirname, '..');
const COURSE = path.join(ROOT, 'data', 'course.json');
const DATA   = path.join(ROOT, 'data', 'questions.json');
const SOLS   = path.join(ROOT, 'data', 'solutions.md');
const THEMES = path.join(__dirname, 'themes.json');
const TPL    = path.join(__dirname, 'template.html');
const OUT    = path.join(ROOT, 'index.html');

const die = msg => { console.error('שגיאה: ' + msg); process.exit(1); };

const C = JSON.parse(fs.readFileSync(COURSE, 'utf8'));
const T = JSON.parse(fs.readFileSync(THEMES, 'utf8'));
const D = JSON.parse(fs.readFileSync(DATA, 'utf8'));

/* ---------- ערכת הנושא ----------
   כל האפורים נגזרים מגוון אחד. המספרים כאן משחזרים את הפלטה שנבדקה
   לניגודיות AA — שינוי של אחד מהם משנה את כל הערכות בבת אחת. */
const theme = T.themes[C.theme];
if (!theme) die(`ערכת נושא "${C.theme}" לא קיימת. אפשרויות: ${Object.keys(T.themes).join(', ')}`);
const meter = C.meter || theme.meter;
if (!T.meters[meter] || meter === '_')
  die(`גרף "${meter}" לא קיים. אפשרויות: ${Object.keys(T.meters).filter(k => k !== '_').join(', ')}`);

const hsl = (h, s, l) => `hsl(${h} ${s}% ${l}%)`;
const hsla = (h, s, l, a) => `hsl(${h} ${s}% ${l}% / ${a})`;
function neutrals(h, dark) {
  return dark ? {
    bg: hsl(h, 20, 7), surface: hsl(h, 18, 10), surface2: hsl(h, 16, 13), text: hsl(h, 15, 91),
    dim: hsl(h, 10, 61), faint: hsl(h, 9, 56), line: hsl(h, 15, 18), lineSoft: hsl(h, 16, 14),
    track: hsl(h, 16, 13), thumb: hsl(h, 12, 30), thumbHover: hsl(h, 12, 42),
    doneBg: hsl(h, 32, 13),
    shadow: '0 1px 2px rgba(0,0,0,.4), 0 8px 20px -14px rgba(0,0,0,.7)'
  } : {
    bg: hsl(h, 12, 96), surface: '#FFFFFF', surface2: hsl(h, 14, 93), text: hsl(h, 26, 12),
    dim: hsl(h, 10, 40), faint: hsl(h, 10, 43), line: hsl(h, 14, 87), lineSoft: hsl(h, 14, 92),
    track: hsl(h, 12, 90), thumb: hsl(h, 8, 67), thumbHover: hsl(h, 8, 48),
    doneBg: hsl(h, 45, 94),
    shadow: `0 1px 2px ${hsla(h, 26, 12, .06)}, 0 6px 18px -12px ${hsla(h, 26, 12, .24)}`
  };
}

const BANDS = C.bands || [];
if (!BANDS.length) die('course.json חייב להגדיר לפחות אשכול אחד ב-bands');
if (BANDS.length > T.bands.light.length)
  die(`יש ${BANDS.length} אשכולות אבל רק ${T.bands.light.length} צבעים. אפשר לאחד אשכולות או להוסיף צבע ל-themes.json`);

function vars(dark) {
  const n = neutrals(theme.hue, dark);
  const k = dark ? 'dark' : 'light';
  const lines = [
    `--bg: ${n.bg}`, `--surface: ${n.surface}`, `--surface-2: ${n.surface2}`, `--text: ${n.text}`,
    `--dim: ${n.dim}`, `--faint: ${n.faint}`, `--line: ${n.line}`, `--line-soft: ${n.lineSoft}`,
    `--accent: ${theme.accent[k]}`, `--done-bg: ${n.doneBg}`,
    `--scroll-track: ${n.track}`, `--scroll-thumb: ${n.thumb}`, `--scroll-thumb-hover: ${n.thumbHover}`,
    `--warn: ${T.semantic.warn[k]}`, `--star: ${T.semantic.star[k]}`,
    `--shadow: ${n.shadow}`
  ];
  BANDS.forEach((b, i) => lines.push(`--band-${b.id}: ${T.bands[k][i]}`));
  return lines.map(l => '    ' + l + ';').join('\n');
}

const FONTS =
  '    --heb: "Assistant","Heebo","Rubik","Arial Hebrew","Noto Sans Hebrew",system-ui,-apple-system,sans-serif;\n' +
  '    --mono: ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;';

/* התצוגה הבהירה היא ברירת המחדל; הכהה נבחרת בכפתור ונשמרת בדפדפן.
   data-theme="light" חוזר במפורש כדי שהכפתור יגבר גם בכיוון ההפוך. */
const PALETTE = [
  '  :root {', vars(false), FONTS, '  }',
  '  :root[data-theme="dark"] {', vars(true), '  }',
  '  :root[data-theme="light"] {', vars(false), '  }'
].join('\n');

const BANDDOTS  = BANDS.map(b => `  .chip.band-${b.id} .dot { background: var(--band-${b.id}); }`).join('\n');
const BANDHUES  = BANDS.map(b => `  tr[data-band="${b.id}"] { --band-hue: var(--band-${b.id}); }`).join('\n');
const BANDCHIPS = BANDS.map(b =>
  `        <button class="chip band-${b.id}" data-band="${b.id}" aria-pressed="false" type="button"><i class="dot"></i>${b.chip || b.heb}</button>`
).join('\n');

/* ---------- יחידות ושאלות ---------- */
D.weeks.sort((a, b) => (a.order < b.order ? -1 : 1));
const byid = Object.fromEntries(D.weeks.map(w => [w.id, w]));
const unknown = D.questions.filter(q => !byid[q.week]);
if (unknown.length) console.warn(`אזהרה: ${unknown.length} שאלות מפנות ליחידה שלא קיימת:`,
  [...new Set(unknown.map(q => q.week))].join(', '));

/* מיון: לפי היחידה, ובתוכה לפי מספר הסט ואז מספר השאלה. מספר הסט אינו בהכרח
   מספר היחידה — שאלה מסט 09 יכולה להופיע תחת שבוע 08 — ולכן היחידה קודמת. */
const qs = D.questions.filter(q => byid[q.week]).sort((a, b) =>
  byid[a.week].order !== byid[b.week].order
    ? (byid[a.week].order < byid[b.week].order ? -1 : 1)
    : a.set !== b.set ? (a.set < b.set ? -1 : 1) : a.n - b.n);

const known = new Set(qs.map(q => q.id));
const TOPICS = C.topics || [];
const badBand = TOPICS.filter(t => !BANDS.some(b => b.id === t.band));
if (badBand.length) die(`נושאים שמפנים לאשכול לא קיים: ${badBand.map(t => t.id).join(', ')}`);
const badTopic = qs.filter(q => !TOPICS.some(t => t.id === q.topic));
if (badTopic.length) die(`שאלות שמפנות לנושא לא קיים: ${badTopic.map(q => q.id + '→' + q.topic).join(', ')}`);
const emptyTopics = TOPICS.filter(t => !qs.some(q => q.topic === t.id));
if (emptyTopics.length) console.warn(`אזהרה: נושאים בלי שאלות: ${emptyTopics.map(t => t.id).join(', ')}`);

/* ---------- פתרונות כטקסט ---------- */
let SOLTEXT = {};
if (fs.existsSync(SOLS)) {
  for (const block of fs.readFileSync(SOLS, 'utf8').split(/^##[ \t]+/m).slice(1)) {
    const nl = block.indexOf('\n');
    const id = (nl === -1 ? block : block.slice(0, nl)).trim();
    /* הערות HTML הן פיגומים של הקובץ ולא תוכן, ונחתכות כאן */
    const body = (nl === -1 ? '' : block.slice(nl + 1)).replace(/<!--[\s\S]*?-->/g, '').trim();
    if (!id) continue;
    if (SOLTEXT[id] !== undefined) console.warn(`אזהרה: הפתרון של ${id} מופיע פעמיים ב-solutions.md`);
    SOLTEXT[id] = body;
  }
}
const isStub = t => !t || /^TODO\.?$/im.test(t.trim());
const strayText = Object.keys(SOLTEXT).filter(id => !known.has(id));
if (strayText.length) console.warn(`אזהרה: פתרונות למזהים שלא קיימים: ${strayText.join(', ')}`);
for (const id of Object.keys(SOLTEXT)) if (isStub(SOLTEXT[id]) || !known.has(id)) delete SOLTEXT[id];

/* ---------- פתרונות כצילומי מסך ----------
   <מזהה>.png לעמוד יחיד, או <מזהה>-1.png, -2.png לכמה עמודים. המזהה עצמו
   מכיל מקף, ולכן אי אפשר לפצל על המקף האחרון בעיוורון: 06-2.png הוא השאלה
   06-2 בעמוד יחיד. ההכרעה היא מול רשימת המזהים המוכרים. */
const IMG = /\.(png|jpg|jpeg|webp)$/i;
const SOLIMG = {};
const IMGDIR = path.join(ROOT, 'solutions');
if (fs.existsSync(IMGDIR)) {
  for (const f of fs.readdirSync(IMGDIR)) {
    if (!IMG.test(f)) continue;
    let id = f.replace(IMG, ''), page = 0;
    if (!known.has(id)) {
      const p = id.match(/^(.+)-(\d+)$/);
      if (p) { id = p[1]; page = +p[2]; }
    }
    (SOLIMG[id] = SOLIMG[id] || []).push({ f, i: page });
  }
  for (const id of Object.keys(SOLIMG)) {
    SOLIMG[id].sort((a, b) => a.i - b.i);
    SOLIMG[id] = SOLIMG[id].map(x => 'solutions/' + x.f);
  }
}
const strayImgs = Object.keys(SOLIMG).filter(id => !known.has(id));
if (strayImgs.length) console.warn(`אזהרה: תמונות פתרון למזהים שלא קיימים: ${strayImgs.join(', ')}`);
strayImgs.forEach(id => delete SOLIMG[id]);

/* אילו תרגילים קיימים בפועל. ההצגה נגזרת מהקובץ ולא מדגל בנתונים, כדי
   ששאלה שיתווסף לה קובץ תתחיל להופיע מעצמה. */
const EXDIR = path.join(ROOT, 'exercises');
const HASEX = !fs.existsSync(EXDIR) ? [] :
  fs.readdirSync(EXDIR).filter(f => IMG.test(f)).map(f => f.replace(IMG, '')).filter(id => known.has(id));

/* ---------- הרכבה ---------- */
const parts = [...new Set(D.weeks.map(w => w.part).filter(Boolean))];
const PARTCHIPS = parts.map(p =>
  `<button class="chip part" data-part="${p}" aria-pressed="false" type="button">${p}</button>`
).join('\n        ');

const live = qs.filter(q => !q.void);
const unit = C.unit || { one: 'שבוע', many: 'שבועות', en: 'Week' };
const J = v => JSON.stringify(v);

/* ההזרקה נעשית עם פונקציית החלפה ולא עם מחרוזת. ב-String.replace הרצף $$
   בתוך מחרוזת ההחלפה הוא תו $ בודד מוגן, ולכן כל נוסחת $$...$$ שבפתרונות
   הייתה נמעכת ל-$...$ ומרונדרת כנוסחה בתוך שורה. */
const inject = (src, token, value) => src.split(token).join(value);

const filled = [
  ['__TITLE__',      C.title],
  ['__EYEBROW__',    C.eyebrow || ''],
  ['__H1__',         C.h1 || 'מעקב תרגילים לפי נושאים'],
  ['__PALETTE__',    PALETTE],
  ['__BANDDOTS__',   BANDDOTS],
  ['__BANDHUES__',   BANDHUES],
  ['__BANDCHIPS__',  BANDCHIPS],
  ['__BANDS__',      J(BANDS.map(b => ({ id: b.id, tag: b.tag, heb: b.heb })))],
  ['__TOPICS__',     J(TOPICS)],
  ['__NS__',         J(C.ns || 'exercises')],
  ['__METERCLASS__', meter],
  ['__METER__',      J(meter)],
  ['__UNIT1J__',     J(unit.one)],
  ['__UNITNJ__',     J(unit.many)],
  ['__UNITENJ__',    J(unit.en)],
  ['__UNIT1__',      unit.one],
  ['__UNITN__',      unit.many],
  ['__WEEKS__',      J(D.weeks)],
  ['__Q__',          J(qs)],
  ['__SOL__',        J(SOLTEXT)],
  ['__SOLIMG__',     J(SOLIMG)],
  ['__HASEX__',      J(HASEX)],
  ['__PARTCHIPS__',  PARTCHIPS],
  ['__WEEKSPAN__',   `${D.weeks[0].n}–${D.weeks[D.weeks.length - 1].n}`],
  ['__NWEEKS__',     String(D.weeks.length)],
  ['__NQ__',         String(live.length)],
].reduce((acc, [token, value]) => inject(acc, token, value), fs.readFileSync(TPL, 'utf8'));

const leftover = [...new Set(filled.match(/__[A-Z0-9]+__/g) || [])];
if (leftover.length) die(`נשארו מצייני מקום שלא מולאו: ${leftover.join(', ')}`);

/* התבנית היא קטע (fragment). כאן היא נעטפת במסמך שלם עם doctype — בלעדיו
   הדפדפן נכנס למצב quirks, ושם <table> לא יורש color מההורה ונופל לצבע
   השורש. במצב כהה זה יוצא טקסט לבן על רקע לבן. */
const cut = filled.indexOf('</style>') + '</style>'.length;
fs.writeFileSync(OUT, `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
${filled.slice(0, cut).trim()}
</head>
<body>
${filled.slice(cut).trim()}
</body>
</html>
`);

const withSol = new Set([...Object.keys(SOLTEXT), ...Object.keys(SOLIMG)]);
const liveSol = live.filter(q => withSol.has(q.id)).length;
const npages  = Object.values(SOLIMG).reduce((s, a) => s + a.length, 0);
console.log(
  `נבנה index.html — ${C.title}\n` +
  `  ערכה: ${C.theme} (${theme.he}) · גרף: ${meter} · ${BANDS.length} אשכולות, ${TOPICS.length} נושאים\n` +
  `  ${D.weeks.length} ${unit.many}, ${live.length} שאלות פעילות` +
  (qs.length - live.length ? ` (${qs.length - live.length} בוטלו)` : '') + '\n' +
  `  תרגילים: ${HASEX.length}/${live.length} · פתרונות: ${liveSol}/${live.length} ` +
  `(${Object.keys(SOLTEXT).length} כתובים, ${Object.keys(SOLIMG).length} כצילומים ב-${npages} עמודים)`
);
