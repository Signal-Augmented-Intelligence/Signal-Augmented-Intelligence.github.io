/** Prepare a fresh public-site checkout for manual GitHub Pages media failover. Never pushes. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { verifyPrivateBackupCheckout } from './private-media-repo.mjs';

const backup = process.argv[2];
if (!backup) throw new Error('Usage: node scripts/prepare-media-fallback.mjs PRIVATE_REPO_CHECKOUT');
verifyPrivateBackupCheckout(backup);
const root = process.cwd();
const candidates = execFileSync('git', ['rev-list', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim().split('\n');
const siteSha = candidates.find((sha) => fs.existsSync(path.join(backup, 'manifests', `${sha}.json`)));
if (!siteSha) throw new Error('No private media manifest matches this public site history.');
const manifest = JSON.parse(fs.readFileSync(path.join(backup, 'manifests', `${siteSha}.json`), 'utf8'));
assert.equal(manifest.format, 1);
assert.equal(manifest.site_sha, siteSha);
assert.ok(manifest.files && typeof manifest.files === 'object' && !Array.isArray(manifest.files));
const managed = /^(?:files\/(?:seminars|publications)|images\/(?:seminars|people|home|album|figures|notices))\//;
const files = Object.entries(manifest.files);
const mediaRoot = fs.realpathSync(path.join(backup, 'public'));
for (const [file, expected] of files) {
  if (!managed.test(file) || file.split('/').some((part) => !part || part === '.' || part === '..') ||
      typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) {
    throw new Error(`Unsafe backup manifest entry: ${file}`);
  }
  const source = path.join(backup, 'public', file);
  const resolved = fs.realpathSync(source);
  if (!resolved.startsWith(`${mediaRoot}${path.sep}`) || !fs.statSync(source).isFile() ||
      fs.lstatSync(source).isSymbolicLink()) throw new Error(`Unsafe backup media: ${file}`);
  const actual = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
  if (actual !== expected) throw new Error(`Backup media hash differs: ${file}`);
}
// Validate every file before mutating the checkout; a failed copy cannot activate a partial fallback.
for (const [file] of files) {
  const target = path.join(root, 'public', file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(backup, 'public', file), target);
}
fs.writeFileSync(path.join(root, 'content', 'media-delivery.json'), '{\n  "mode": "github",\n  "base_url": ""\n}\n');
console.log(`Fallback prepared from site commit ${siteSha} with ${files.length} verified media files. Run npm ci, npm run build, npm run check, then review and push the site commit.`);
