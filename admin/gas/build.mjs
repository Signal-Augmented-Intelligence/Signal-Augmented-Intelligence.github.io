/**
 * Apps Script 전환 빌드: 관리 화면을 HTML 파일 하나로 묶습니다 (npm run build:admin:apps-script).
 * - admin/gas-dist/Index.html: Apps Script 접수용 프로젝트에 넣을 파일 (HtmlService.createHtmlOutputFromFile('Index')).
 * - admin/gas-dist/mock.html: 가짜 google.script.run(mock.ts)을 넣은 로컬 확인용. Apps Script에 넣지 않습니다.
 * 기존 빌드(npm run build:admin → admin/out/)와 관리 서버 연결은 바꾸지 않습니다.
 */
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const admin = join(here, '..');
const out = join(admin, 'gas-dist');
const PRETENDARD = 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';

async function bundle(entry, extra = {}) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    outdir: out,
    format: 'iife',
    target: 'es2022',
    minify: true,
    jsx: 'automatic',
    tsconfig: join(admin, 'tsconfig.json'),
    alias: { 'next/image': join(here, 'image.tsx'), 'next/navigation': join(here, 'navigation.ts') },
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.NEXT_PUBLIC_ADMIN_TRANSPORT': '"apps-script"',
    },
    loader: { '.module.css': 'local-css', '.woff2': 'dataurl', '.woff': 'dataurl', '.png': 'dataurl', '.svg': 'dataurl' },
    logLevel: 'warning',
    ...extra,
  });
  const text = (ext) => result.outputFiles.filter((f) => f.path.endsWith(ext)).map((f) => f.text).join('\n');
  return { js: text('.js'), css: text('.css') };
}

/** 인라인 <script>·<style> 안에서 태그가 끝나지 않도록 막습니다. */
const safe = (code, tag) => code.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1');

function page({ js, css }, before = '') {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>SAI Lab 관리</title>
<base target="_top">
<link rel="stylesheet" href="${PRETENDARD}">
<style>${safe(css, 'style')}</style>
</head>
<body>
<div id="root"></div>
${before}<script>${safe(js, 'script')}</script>
</body>
</html>
`;
}

const app = await bundle(join(here, 'main.tsx'));
const mock = await bundle(join(here, 'mock.ts'));
await mkdir(out, { recursive: true });
await writeFile(join(out, 'Index.html'), page(app));
await writeFile(join(out, 'mock.html'), page(app, `<script>${safe(mock.js, 'script')}</script>\n`));
const kb = (s) => `${Math.round(Buffer.byteLength(s) / 1024)} KB`;
console.log(`admin/gas-dist/Index.html ${kb(page(app))}, mock.html ${kb(page(app, mock.js))}`);
