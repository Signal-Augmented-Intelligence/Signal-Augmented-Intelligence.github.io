/** Restore server media links after the server and its private backup are verified. Never pushes. */
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.SAI_PUBLIC_MEDIA_BASE_URL;
let origin = '';
try { origin = new URL(base ?? '').origin; } catch { /* checked below */ }
if (!base || !base.startsWith('https://') || base !== origin) {
  throw new Error('Set SAI_PUBLIC_MEDIA_BASE_URL to the verified HTTPS media origin.');
}
fs.writeFileSync(path.join(process.cwd(), 'content', 'media-delivery.json'),
  `${JSON.stringify({ mode: 'server', base_url: base }, null, 2)}\n`);
console.log('Server media links prepared. Build, check and review before committing the recovery change.');
