import { AdminBanner } from '@admin/components/AdminBanner';
import { AdminShell } from '@admin/components/AdminShell';
import { AlbumScreen } from './AlbumScreen';

export const metadata = { title: 'Album' };

export default function AlbumPage() {
  return (
    <>
      <AdminBanner title="Album" />
      <AdminShell><AlbumScreen /></AdminShell>
    </>
  );
}
