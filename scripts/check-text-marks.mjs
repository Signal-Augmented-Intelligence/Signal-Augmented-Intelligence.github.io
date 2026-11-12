/**
 * Checks the shared text marks (src/lib/text-marks.ts, guideline "내용 표기"): how stored text is read, and that what the
 * 관리 화면 writes with serializeRuns reads back the same (npm run check:marks).
 */
import { fileURLToPath } from 'node:url';
const { textRuns, serializeRuns, escapeMarks } = await import(fileURLToPath(new URL('../src/lib/text-marks.ts', import.meta.url)));
const f = (r) => r.text + (r.bold ? '·B' : '') + (r.color ? '·' + r.color : '');
const cases = [
  ['a **b** c', ['a ','b·B',' c']], ['**b**', ['b·B']], ['a ** b', ['a ** b']], ['****', ['****']], ['** **', ['** **']],
  ['**a\nb**', ['**a\nb**']], ['**a**b**', ['a·B','b**']], ['x **1** y **2**\n**3**', ['x ','1·B',' y ','2·B','\n','3·B']],
  ['**https://a.com**', ['https://a.com·B']], ['', []], ['plain\nline', ['plain\nline']],
  ['{red|경고}', ['경고·red']], ['a {blue|b} c', ['a ','b·blue',' c']], ['{green|x}', ['{green|x}']], ['{red|}', ['{red|}']],
  ['{red| }', ['{red| }']], ['{red|a\nb}', ['{red|a\nb}']], ['{red|**x**}', ['x·B·red']], ['**{red|x}**', ['x·B·red']],
  ['**{red|중요}**합니다', ['중요·B·red','합니다']], ['**a**{red|x}**b**', ['a·B','x·red','b·B']],
  ['**a {red|b} c**', ['a ·B','b·B·red',' c·B']], ['**a **{red|**b**}** c**', ['a ·B','b·B·red',' c·B']],
  ['**a {red|b** c}', ['**a ','b** c·red']], ['{red|a} {blue|b}', ['a·red',' ','b·blue']], ['{red|x', ['{red|x']],
  // escapes
  ['\\*\\*a\\*\\*', ['**a**']], ['a \\\\ b', ['a \\ b']], ['C:\\path', ['C:\\path']], ['\\{red|x\\}', ['{red|x}']],
  ['{red|a\\}b}', ['a}b·red']], ['**a\\*b**', ['a*b·B']], ['\\**a**', ['**a**']], ['\\***a**', ['*','a·B']], ['end\\', ['end\\']],
  ['a ** b **c**', ['a ',' b ·B','c**']], ['a \\*\\* b **c**', ['a ** b ','c·B']], ['😀**x**', ['😀','x·B']],
];
let bad = 0;
for (const [input, want] of cases) {
  const got = textRuns(input).map(f);
  if (JSON.stringify(got) !== JSON.stringify(want)) { bad++; console.log('FAIL', JSON.stringify(input), JSON.stringify(got), 'want', JSON.stringify(want)); }
}
// Round trip: runs -> serializeRuns -> textRuns gives the same text, and the same style on every non-space character.
const styleAt = (runs) => runs.flatMap((r) => r.text.split('').map((ch) => [ch, /\s/.test(ch) ? '' : (r.bold ? 'B' : '') + (r.color || '')]));
const pieces = ['a', 'b c', '**', '*', '{', '}', '\\', '{red|x}', '**y**', ' ', '\n', '한글', '\\*', 'https://x.io', '}{', '|'];
let seed = 7; const rnd = (k) => (seed = (seed * 1103515245 + 12345) % 2147483648) % k;
let rtBad = 0;
const fixed = [
  [{ text: 'a ** b ' }, { text: 'c', bold: true }],
  [{ text: '{red|x}' }, { text: 'y', color: 'red' }],
  [{ text: 'a}b{c', color: 'blue', bold: true }],
  [{ text: '\\', bold: true }, { text: '\\*' }],
  [{ text: 'x\ny', bold: true, color: 'red' }],
  [{ text: '  ', bold: true }, { text: 'z' }],
];
const cases2 = [...fixed];
for (let t = 0; t < 3000; t++) {
  const runs = []; const k = 1 + rnd(6);
  for (let j = 0; j < k; j++) {
    let text = ''; const m = 1 + rnd(4); for (let q = 0; q < m; q++) text += pieces[rnd(pieces.length)];
    const r = { text }; if (rnd(2)) r.bold = true; const c = rnd(3); if (c === 1) r.color = 'red'; if (c === 2) r.color = 'blue';
    runs.push(r);
  }
  cases2.push(runs);
}
for (const runs of cases2) {
  const stored = serializeRuns(runs); const back = textRuns(stored);
  const a = JSON.stringify(styleAt(runs)), b = JSON.stringify(styleAt(back));
  if (a !== b) { rtBad++; if (rtBad <= 5) console.log('RT FAIL', JSON.stringify(runs), '→', JSON.stringify(stored), '→', JSON.stringify(back)); }
}
if (escapeMarks('a*b{c}\\d') !== 'a\\*b\\{c\\}\\\\d') { bad++; console.log('FAIL escapeMarks', escapeMarks('a*b{c}\\d')); }
if (bad || rtBad) { console.error(`Text marks: ${bad} reading cases and ${rtBad} round trips failed.`); process.exit(1); }
console.log(`Text marks: ${cases.length} reading cases and ${cases2.length} round trips passed.`);
