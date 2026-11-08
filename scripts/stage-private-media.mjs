/** Stage verified public renditions from the private media repository for a Pages build. Never pushes. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const backup = process.argv[2];
if (!backup) throw new Error('Usage: node scripts/stage-private-media.mjs PRIVATE_REPO_CHECKOUT');
const delivery = JSON.parse(fs.readFileSync('content/media-delivery.json', 'utf8'));
if (delivery.mode !== 'pages_artifact' || delivery.base_url !== '') {
  throw new Error('Private media staging requires pages_artifact mode with an empty base_url.');
}
const site = process.cwd();
const output = path.join(site, 'out');
if (!fs.statSync(output).isDirectory()) throw new Error('Build the static site before staging private media.');
const commits = execFileSync('git', ['rev-list', 'HEAD'], { cwd: site, encoding: 'utf8' }).trim().split('\n');
const siteSha = commits.find((sha) => fs.existsSync(path.join(backup, 'manifests', `${sha}.json`)));
if (!siteSha) throw new Error('No private media manifest matches the site commit history.');
const manifest = JSON.parse(fs.readFileSync(path.join(backup, 'manifests', `${siteSha}.json`), 'utf8'));
assert.equal(manifest.format, 1);
assert.equal(manifest.site_sha, siteSha);
assert.ok(manifest.files && typeof manifest.files === 'object' && !Array.isArray(manifest.files));
const managed = /^(?:files\/(?:seminars|publications)|images\/(?:seminars|people|home|album|figures|notices))\//;
const root = fs.realpathSync(path.join(backup, 'public'));
const files = Object.entries(manifest.files);
// Complete verification precedes every copy so a corrupt private checkout cannot yield a partial artifact.
for (const [file, expected] of files) {
  if (!managed.test(file) || file.split('/').some((part) => !part || part === '.' || part === '..') ||
      typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) {
    throw new Error(`Unsafe private media entry: ${file}`);
  }
  const source = path.join(backup, 'public', file);
  const real = fs.realpathSync(source);
  if (!real.startsWith(`${root}${path.sep}`) || fs.lstatSync(source).isSymbolicLink() || !fs.statSync(source).isFile()) {
    throw new Error(`Unsafe private media file: ${file}`);
  }
  const actual = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
  if (actual !== expected) throw new Error(`Private media hash differs: ${file}`);
}
for (const [file] of files) {
  const target = path.join(output, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(backup, 'public', file), target);
}
console.log(`Staged ${files.length} verified public media files from private manifest ${siteSha}.`);
