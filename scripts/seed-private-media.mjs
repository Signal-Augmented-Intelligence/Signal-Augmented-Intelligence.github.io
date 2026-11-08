/** Copy existing public GitHub media into an empty private-repository checkout. Never pushes. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { verifyPrivateBackupCheckout } from './private-media-repo.mjs';

const backup = process.argv[2];
if (!backup) throw new Error('Usage: node scripts/seed-private-media.mjs PRIVATE_REPO_CHECKOUT');
verifyPrivateBackupCheckout(backup);
const sitePublic = fs.realpathSync(path.join(process.cwd(), 'public'));
const targetPublic = path.join(backup, 'public');
const directories = ['files/seminars', 'files/publications', 'images/seminars', 'images/people',
  'images/home', 'images/album', 'images/figures', 'images/notices'];
const hashes = {};
function walk(folder) {
  if (!fs.existsSync(folder)) return;
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const source = path.join(folder, entry.name);
    if (entry.isDirectory()) walk(source);
    else if (entry.isFile() && entry.name !== '.gitkeep') {
      const real = fs.realpathSync(source);
      if (!real.startsWith(`${sitePublic}${path.sep}`)) throw new Error(`Unsafe source media: ${source}`);
      const relative = path.relative(sitePublic, source).split(path.sep).join('/');
      const target = path.join(targetPublic, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const hash = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
      if (fs.existsSync(target)) {
        const existing = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
        if (existing !== hash) throw new Error(`Existing private file differs: ${relative}`);
      } else fs.copyFileSync(source, target);
      hashes[relative] = hash;
    } else if (!entry.isFile()) throw new Error(`Unsupported source media: ${source}`);
  }
}
for (const directory of directories) walk(path.join(sitePublic, directory));
fs.writeFileSync(path.join(backup, 'legacy-media.json'), `${JSON.stringify({ format: 1, files: hashes }, null, 2)}\n`);
console.log(`Copied and checked ${Object.keys(hashes).length} existing public files. Review and commit them in the private repository.`);
