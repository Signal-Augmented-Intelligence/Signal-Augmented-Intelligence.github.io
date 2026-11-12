/**
 * Plain-text marks shared by the public site and the 관리 화면 (guideline: "내용 표기").
 * Marks: **bold**, and two text colors written {blue|text} (site accent) and {red|text}.
 * Line breaks stay as they are and web addresses become links when the text is drawn (components/MarkedText).
 * Stored text keeps the marks as typed, so content/ files do not change shape; HTML is never stored or read.
 *
 * Rules, so a stray character never breaks a notice:
 * - A mark counts only when it opens and closes on the same line and something other than spaces is inside.
 * - An unmatched `**`, an empty `****`, an unknown color name or a mark split across lines is shown as typed.
 * - Colored text cannot contain `{` or `}`. Bold may sit inside a color ({red|**text**}) or around whole colors
 *   (**a {red|b} c**), but a bold pair with one end inside a color and the other outside is shown as typed.
 */
export type MarkColor = 'blue' | 'red';
export type TextRun = { text: string; bold?: true; color?: MarkColor };

export const BOLD_MARK = '**';
/** Color names in stored text → CSS color (tokens in app/globals.css). */
export const MARK_COLORS: Record<MarkColor, string> = { blue: 'var(--accent)', red: 'var(--mark-red)' };
/** How the 관리 화면 writes a colored piece of text. */
export const colorMark = (color: MarkColor, text: string) => `{${color}|${text}}`;

const COLOR_SPAN = /\{(blue|red)\|([^{}\n]*)\}/g;

export function textRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  for (const line of text.split(/(\n)/)) {
    for (const r of lineRuns(line)) {
      const last = runs[runs.length - 1];
      if (last && last.bold === r.bold && last.color === r.color) last.text += r.text;
      else runs.push(r);
    }
  }
  return runs;
}

/** One line: mark which characters are markup, which are bold, and which color each one has. */
function lineRuns(line: string): TextRun[] {
  const n = line.length;
  const hidden = new Array<boolean>(n).fill(false);
  const bold = new Array<boolean>(n).fill(false);
  const color = new Array<MarkColor | undefined>(n).fill(undefined);
  const owner = new Array<number>(n).fill(-1); // which color piece a character's text belongs to

  const spans: { from: number; to: number }[] = [];
  for (const m of line.matchAll(COLOR_SPAN)) {
    if (!m[2].trim()) continue;
    const open = m.index, from = open + m[1].length + 2, to = open + m[0].length - 1;
    for (let i = open; i < from; i++) hidden[i] = true;
    hidden[to] = true;
    for (let i = from; i < to; i++) { color[i] = m[1] as MarkColor; owner[i] = spans.length; }
    spans.push({ from, to });
  }

  const inside = (i: number) => owner[i];
  const markOutside = (i: number) => !hidden[i] && !hidden[i + 1];
  let i = 0;
  while (i < n) {
    const open = line.indexOf(BOLD_MARK, i);
    if (open < 0) break;
    if (!markOutside(open)) { i = open + 1; continue; }
    let close = line.indexOf(BOLD_MARK, open + BOLD_MARK.length);
    while (close >= 0 && !markOutside(close)) close = line.indexOf(BOLD_MARK, close + 1);
    if (close < 0) break;
    const sameSide = inside(open) === inside(close);
    const visible = [...line.slice(open + BOLD_MARK.length, close)].filter((_, k) => !hidden[open + BOLD_MARK.length + k]).join('');
    if (!sameSide || !visible.trim()) { i = open + BOLD_MARK.length; continue; }
    hidden[open] = hidden[open + 1] = hidden[close] = hidden[close + 1] = true;
    for (let k = open + BOLD_MARK.length; k < close; k++) bold[k] = true;
    i = close + BOLD_MARK.length;
  }

  const runs: TextRun[] = [];
  for (let k = 0; k < n; k++) {
    if (hidden[k]) continue;
    const b = bold[k] ? true : undefined, c = color[k];
    const last = runs[runs.length - 1];
    if (last && last.bold === b && last.color === c) last.text += line[k];
    else runs.push({ text: line[k], ...(b ? { bold: b } : {}), ...(c ? { color: c } : {}) });
  }
  return runs;
}

/** Web addresses inside a run, split out so they can be drawn as links. */
const URL = /(https?:\/\/[^\s<>"')*{}]+)/g;
export function splitLinks(text: string): { text: string; href?: string }[] {
  return text.split(URL).filter(Boolean).map((p) => (/^https?:\/\//.test(p) ? { text: p, href: p } : { text: p }));
}
