/**
 * Apps Script 전환 빌드: 관리 화면을 HTML 파일 하나로 묶습니다 (npm run build:admin:apps-script).
 * - admin/gas-dist/Admin.html: Apps Script 접수용 프로젝트에 Admin으로 넣을 파일 (intake doGet이 이 파일을 보여 줌).
 * - admin/gas-dist/mock.html: 가짜 google.script.run(mock.ts)을 넣은 로컬 확인용. Apps Script에 넣지 않습니다.
 * 기존 빌드(npm run build:admin → admin/out/)와 관리 서버 연결은 바꾸지 않습니다.
 */
import { build } from 'esbuild';
import { bundleOptions } from './bundle-options.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const admin = join(here, '..');
const out = join(admin, 'gas-dist');
/** 관리 화면 그림은 화면에 보이는 폭(최대 174px, 196px)의 두 배로 줄여 넣습니다. */
const IMAGE_WIDTH = { 'sai-lab-black.png': 360, 'hanshin-university.png': 400 };

/** sharp(Next와 함께 설치됨)가 있으면 그림을 줄입니다. 없으면 원본을 그대로 넣습니다. */
const shrinkImages = {
  name: 'shrink-admin-images',
  setup(b) {
    b.onLoad({ filter: /public[\\/]images[\\/]admin[\\/][^\\/]+\.png$/ }, async (args) => {
      const bytes = await readFile(args.path);
      const width = IMAGE_WIDTH[args.path.split(/[\\/]/).pop()];
      try {
        const { default: sharp } = await import('sharp');
        return { contents: await sharp(bytes).resize({ width, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer(), loader: 'dataurl' };
      } catch {
        return { contents: bytes, loader: 'dataurl', warnings: [{ text: `sharp unavailable; ${args.path} not resized` }] };
      }
    });
  },
};

const PRETENDARD = 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';

async function bundle(entry, extra = {}) {
  const result = await build({
    ...bundleOptions,
    entryPoints: [entry],
    write: false,
    outdir: out,
    format: 'iife',
    minify: true,
    plugins: [shrinkImages],
    logLevel: 'warning',
    ...extra,
  });
  const text = (ext) => result.outputFiles.filter((f) => f.path.endsWith(ext)).map((f) => f.text).join('\n');
  return { js: text('.js'), css: text('.css') };
}

/** 인라인 <script>·<style> 안에서 태그가 끝나지 않도록 막습니다. */
const safe = (code, tag) => code.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1');

function page({ js, css }, before = '') {
  // HtmlService embeds the entire page through document.write. A large inline bundle can
  // break that wrapper before our JavaScript runs. Keep the payload ASCII-only and small,
  // then execute the decompressed bundle as a script element inside the HTML Service frame.
  const packed = gzipSync(js).toString('base64');
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
${before}<script id="sai-app-bundle" type="application/octet-stream">${packed}</script>
<script>
(async function () {
  const encoded = document.getElementById('sai-app-bundle').textContent.trim();
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const script = document.createElement('script');
  script.textContent = await new Response(stream).text();
  document.body.appendChild(script);
})().catch(function (error) {
  console.error('SAI Lab management bundle failed to load', error);
  document.getElementById('root').textContent = '관리 화면을 열지 못했습니다. 페이지를 새로고침해 주세요.';
});
</script>
</body>
</html>
`;
}

const app = await bundle(join(here, 'main.tsx'));
const mock = await bundle(join(here, 'mock.ts'));
await mkdir(out, { recursive: true });
await writeFile(join(out, 'Admin.html'), page(app));
await writeFile(join(out, 'mock.html'), page(app, `<script>${safe(mock.js, 'script')}</script>\n`));
const kb = (s) => `${Math.round(Buffer.byteLength(s) / 1024)} KB`;
console.log(`admin/gas-dist/Admin.html ${kb(page(app))}, mock.html ${kb(page(app, mock.js))}`);
