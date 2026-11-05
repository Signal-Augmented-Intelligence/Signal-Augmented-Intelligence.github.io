/** 관리 화면 묶기 설정. 배포 파일(build.mjs)과 시험(scripts/check-admin.mjs)이 같은 설정으로 묶습니다. */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const bundleOptions = {
  bundle: true,
  target: 'es2022',
  jsx: 'automatic',
  tsconfig: join(here, '..', 'tsconfig.json'),
  alias: { 'next/image': join(here, 'image.tsx'), 'next/navigation': join(here, 'navigation.ts') },
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.NEXT_PUBLIC_ADMIN_TRANSPORT': '"apps-script"',
  },
  loader: { '.module.css': 'local-css', '.woff2': 'dataurl', '.woff': 'dataurl', '.png': 'dataurl', '.svg': 'dataurl' },
};
