import { AdminBanner } from '@admin/components/AdminBanner';
import { AdminShell } from '@admin/components/AdminShell';
import { SeminarsScreen } from './SeminarsScreen';

export const metadata = { title: 'Seminars' };

export default function SeminarsPage() {
  return (
    <>
      <AdminBanner title="Seminars" />
      <AdminShell><SeminarsScreen /></AdminShell>
    </>
  );
}
