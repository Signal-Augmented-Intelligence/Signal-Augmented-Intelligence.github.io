import { AdminBanner } from '@admin/components/AdminBanner';
import { AdminShell } from '@admin/components/AdminShell';
import { HomePageContent } from './HomePageContent';

export const metadata = { title: 'Home' };

/** Home: 첫 화면 사진, 랩 정보와 시를 같은 화면에서 관리합니다. */
export default function HomePage() {
  return (
    <>
      <AdminBanner title="Home" />
      <AdminShell><HomePageContent /></AdminShell>
    </>
  );
}
