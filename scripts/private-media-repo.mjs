import { execFileSync } from 'node:child_process';

export function verifyPrivateBackupCheckout(folder) {
  const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: folder, encoding: 'utf8' }).trim();
  const approved = ['https://github.com/Signal-Augmented-Intelligence/SAI_Pages_Media.git',
    'https://github.com/Signal-Augmented-Intelligence/SAI_Pages_Media',
    'git@github.com:Signal-Augmented-Intelligence/SAI_Pages_Media.git',
    'git@github.com:Signal-Augmented-Intelligence/SAI_Pages_Media'];
  if (!approved.includes(remote) && process.env.SAI_TEST_LOCAL_BACKUP !== '1') {
    throw new Error('The backup checkout must come from the lab-owned private media repository.');
  }
}
