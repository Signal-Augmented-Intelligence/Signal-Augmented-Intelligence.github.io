/**
 * Plain-text marks shared by the public site and the 관리 화면 (guideline: "내용 표기").
 * The only mark is **bold**. Line breaks stay as they are and web addresses become links when the text is drawn
 * (components/MarkedText). Stored text keeps the asterisks, so content/ files do not change shape.
 *
 * Rules, so a stray asterisk never breaks a notice:
 * - `**…**` is bold only when both pairs sit on the same line and something other than spaces is inside.
 * - An unmatched `**`, an empty `****` or a pair split across lines is shown as typed.
 */
export type TextRun = { text: string; bold?: true };

export const BOLD_MARK = '**';

export function textRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const push = (t: string, bold = false) => {
    if (!t) return;
    const last = runs[runs.length - 1];
    if (last && Boolean(last.bold) === bold) last.text += t;
    else runs.push(bold ? { text: t, bold: true } : { text: t });
  };
  for (const line of text.split(/(\n)/)) {
    let i = 0;
    while (i < line.length) {
      const open = line.indexOf(BOLD_MARK, i);
      if (open < 0) break;
      const close = line.indexOf(BOLD_MARK, open + BOLD_MARK.length);
      if (close < 0) break;
      const inner = line.slice(open + BOLD_MARK.length, close);
      if (!inner.trim()) {
        push(line.slice(i, open + BOLD_MARK.length));
        i = open + BOLD_MARK.length;
        continue;
      }
      push(line.slice(i, open));
      push(inner, true);
      i = close + BOLD_MARK.length;
    }
    push(line.slice(i));
  }
  return runs;
}

/** Web addresses inside a run, split out so they can be drawn as links. */
const URL = /(https?:\/\/[^\s<>"')*]+)/g;
export function splitLinks(text: string): { text: string; href?: string }[] {
  return text.split(URL).filter(Boolean).map((p) => (/^https?:\/\//.test(p) ? { text: p, href: p } : { text: p }));
}
