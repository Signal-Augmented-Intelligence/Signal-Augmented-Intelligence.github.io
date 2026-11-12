import { execFileSync } from 'node:child_process';

export function verifyPrivateBackupCheckout(folder) {
  const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: folder, encoding: 'utf8' }).trim();
  // The organization was renamed Signal-Augmented-Intelligence → HS-SCI → hs-sai-lab; clones made before a rename keep the old remote.
  const approved = ['hs-sai-lab', 'HS-SAI-Lab', 'HS-SCI', 'Signal-Augmented-Intelligence'].flatMap((org) => [
    `https://github.com/${org}/SAI_Pages_Media.git`,
    `https://github.com/${org}/SAI_Pages_Media`,
    `git@github.com:${org}/SAI_Pages_Media.git`,
    `git@github.com:${org}/SAI_Pages_Media`,
  ]);
  if (!approved.includes(remote) && process.env.SAI_TEST_LOCAL_BACKUP !== '1') {
    throw new Error('The backup checkout must come from the lab-owned private media repository.');
  }
}
