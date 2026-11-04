import { AdminBanner } from '@admin/components/AdminBanner';
import { AdminShell } from '@admin/components/AdminShell';
import { ProfessorScreen } from './ProfessorScreen';

export const metadata = { title: 'Professor' };

export default function ProfessorPage() {
  return <><AdminBanner title="Professor" /><AdminShell><ProfessorScreen /></AdminShell></>;
}
