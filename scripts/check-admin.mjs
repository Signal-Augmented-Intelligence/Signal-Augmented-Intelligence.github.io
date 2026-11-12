/**
 * Regression checks for the management screen. Needs no account, Drive or network: it bundles the real
 * screens the way the Apps Script build does and renders them to HTML in Node.
 * Usage: npm run check:admin
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { load } from 'js-yaml';
import { bundleOptions } from '../admin/gas/bundle-options.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const entry = `
export { createElement } from 'react';
export { renderToStaticMarkup } from 'react-dom/server';
export { PAGES } from './pages';
export { MENU } from '@admin/lib/menu';
export { clearLocalWork, readDraft, writeDraft } from '@admin/lib/edit';
export { DialogProvider } from '@admin/components/Dialog';
export { Field } from '@admin/components/Field';
export { FileUpload } from '@admin/components/FileUpload';
export { PublishFailure } from '@admin/components/PublishFailure';
export { MemberForm } from '@admin/app/members/MemberForm';
export { markSchema, plainPaste, toDoc, toValue } from '@admin/lib/markDoc';
export { textRuns } from '@/lib/text-marks';
`;

const dir = mkdtempSync(join(tmpdir(), 'sai-check-admin-'));
try {
  const result = await build({
    ...bundleOptions,
    stdin: { contents: entry, resolveDir: join(root, 'admin/gas'), loader: 'ts' },
    write: false, outdir: dir, format: 'cjs', platform: 'node', logLevel: 'error',
  });
  const file = join(dir, 'bundle.cjs');
  writeFileSync(file, result.outputFiles.find((output) => output.path.endsWith('.js')).text);
  const store = new Map();
  globalThis.localStorage = {
    get length() { return store.size; },
    key: (i) => [...store.keys()][i] ?? null,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  const ui = createRequire(import.meta.url)(file);
  const render = (element) => ui.renderToStaticMarkup(ui.createElement(ui.DialogProvider, null, element));

  // Every menu item must open its own screen: the hash router sends unknown paths back to the first screen.
  for (const item of ui.MENU.filter((menu) => menu.ready)) {
    assert.ok(ui.PAGES[item.href], `menu "${item.title}" (${item.href}) has no screen in admin/gas/pages.ts`);
  }
  for (const path of Object.keys(ui.PAGES)) {
    assert.ok(ui.MENU.some((menu) => menu.href === path), `screen ${path} has no menu item`);
  }

  // A file field must not be a <label>: a label opens the file picker wherever it is clicked.
  const noop = () => {};
  const upload = render(ui.createElement(ui.Field, { label: '사진', optional: true, group: true },
    ui.createElement(ui.FileUpload, { name: 'photo', label: '사진', purpose: 'notice', accept: 'image/png', maxBytes: 1, tooLarge: '',
      value: { id: 'f', name: 'a.png', size: 1, preview_url: 'x.png', warnings: [] }, onChange: noop, onPending: noop })));
  assert.doesNotMatch(upload, /<label/, 'file field must not render a label');
  assert.match(upload, /role="group"/);
  assert.match(upload, /aria-label="사진"/);
  const sources = (folder) => readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? sources(path) : /\.tsx$/.test(name) ? [path] : [];
  });
  const screens = sources(join(root, 'admin/src'));
  for (const path of screens) {
    const text = readFileSync(path, 'utf8');
    const uses = (text.match(/<FileUpload\b/g) ?? []).length;
    const grouped = (text.match(/<Field\b[^>]*\bgroup\b[^>]*>\s*<FileUpload\b/g) ?? []).length;
    assert.equal(grouped, uses, `${path}: every FileUpload must sit in <Field group>`);
    // Touch screens have no tooltip, so a publish failure reason must be shown as text.
    assert.doesNotMatch(text, /title=\{[^}]*publication\??\.message/, `${path}: publish failure reason is tooltip-only`);
  }

  // The failure reason is visible text, and an old failure hides while publishing again.
  const failed = { state: 'failed', message: '이유' };
  assert.match(render(ui.createElement(ui.PublishFailure, { publication: failed })), /반영 실패: 이유/);
  assert.doesNotMatch(render(ui.createElement(ui.PublishFailure, { publication: failed, pending: true })), /이유/);
  assert.doesNotMatch(render(ui.createElement(ui.PublishFailure, { publication: { state: 'published', message: null } })), /반영 실패/);

  // The member form reopens with what was typed, and leaving the screen clears it like every other form.
  const system = { limits: { photo_mb: 20, photo_types: ['image/png'] } };
  const member = (props = {}) => render(ui.createElement(ui.MemberForm, { system, onSaved: noop, onCancel: noop, onConflict: noop, ...props }));
  assert.doesNotMatch(member(), /Draft Name/);
  ui.writeDraft('sai-admin:members:new', { name: 'Draft Name' });
  assert.match(member(), /value="Draft Name"/);
  assert.doesNotMatch(member({ member: { id: 'm1', name: 'Saved', name_ko: '', group: 'ms' } }), /Draft Name/, 'a draft belongs to one form');
  // 학교 메일 칸은 모든 멤버 폼에 있고 저장된 값을 보여 줍니다.
  assert.match(member({ member: { id: 'm3', name: 'Saved', name_ko: '', group: 'phd', email: 'a@hs.ac.kr' } }),
    /<input type="email"[^>]*name="email" value="a@hs.ac.kr"/);
  // 학년은 학부생에게만 있고, 저장된 학년이 골라져 있습니다.
  assert.doesNotMatch(member({ member: { id: 'm1', name: 'Saved', name_ko: '', group: 'ms' } }), /name="grade"/);
  assert.match(member({ member: { id: 'm2', name: 'Saved', name_ko: '', group: 'undergrad', grade: 3 } }),
    /<select name="grade">(?:(?!<\/select>).)*<option value="3" selected="">3학년<\/option>/);
  ui.writeDraft('sai-admin:professor-draft', { version: 1 });
  store.set('unrelated', '1');
  ui.clearLocalWork();
  assert.equal(ui.readDraft('sai-admin:members:new'), null);
  assert.equal(ui.readDraft('sai-admin:professor-draft'), null);
  assert.equal(store.get('unrelated'), '1');

  // 공지 편집기: 저장 글 → 편집기 문서 → 저장 글. 처음 열어 저장하면 보이는 글자와 굵게·색이 그대로이고, 그 뒤로는 글이 바뀌지 않습니다.
  const look = (text) => ui.textRuns(text).flatMap((r) => [...r.text].map((ch) => ch + (/\s/.test(ch) ? '' : `${r.bold ? 'B' : ''}${r.color ?? ''}`)));
  const again = (text) => ui.toValue(ui.toDoc(text));
  const notices = load(readFileSync(join(root, 'content/notices.yml'), 'utf8')) ?? [];
  const stored = [...notices.map((n) => n.body ?? ''), '', 'a **b** c', 'a ** b **c**', '**a\nb**', '{red|**중요**}합니다', '**a {red|b} c**',
    '{green|x}', '{red|a\\}b}', '\\*\\*a\\*\\*', 'C:\\path', 'end\\', '줄 하나\n\n빈 줄 다음', '  앞뒤 빈칸  ', '**https://a.com** 링크', '😀**x**'];
  for (const text of stored) {
    const saved = again(text);
    assert.deepEqual(look(saved), look(text), `editor keeps what ${JSON.stringify(text)} shows`);
    assert.equal(again(saved), saved, `saving ${JSON.stringify(saved)} again changes nothing`);
    assert.equal(saved.split('\n').length, text.split('\n').length, 'one line per paragraph');
  }
  // 편집기에서 만든 문서(모든 굵게·색 조합, 표기 문자를 글자로 쓴 경우 포함)는 저장 후 다시 열면 같은 문서입니다.
  const { markSchema: ms } = ui;
  const marks = [[], [ms.marks.bold.create()], [ms.marks.color.create({ color: 'red' })], [ms.marks.color.create({ color: 'blue' })],
    [ms.marks.bold.create(), ms.marks.color.create({ color: 'red' })]];
  const words = ['a', '**', '{red|x}', '\\', '}{', '*b*', '한글', 'https://x.io', '|'];
  let seed = 11; const rnd = (k) => (seed = (seed * 1103515245 + 12345) % 2147483648) % k;
  for (let round = 0; round < 300; round++) {
    const lines = Array.from({ length: 1 + rnd(3) }, () => ms.nodes.paragraph.create(null,
      Array.from({ length: rnd(5) }, () => ms.text(words[rnd(words.length)], marks[rnd(marks.length)]))));
    const doc = ms.nodes.doc.create(null, lines);
    assert.ok(ui.toDoc(ui.toValue(doc)).eq(doc), `editor document survives saving: ${JSON.stringify(ui.toValue(doc))}`);
  }
  // 다른 곳에서 붙여 넣은 글은 글자만, 이 편집기에서 복사한 조각은 표시까지 들어옵니다.
  const pasted = ui.toDoc('{red|**굵은 빨강**}\n둘째 줄');
  const styled = pasted.slice(1, pasted.content.size - 1);
  assert.equal(ui.toValue(ms.nodes.doc.create(null, ui.plainPaste(styled, false).content)), '굵은 빨강\n둘째 줄');
  assert.equal(ui.plainPaste(styled, true), styled);

  console.log('Management screen routes, file fields, failure reasons, drafts and the notice editor passed.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
