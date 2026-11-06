import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { getNotices } from '@/lib/content';
import { localDay } from '@/lib/notices';
import { NoticesList } from './NoticesList';

export const metadata: Metadata = { title: 'Notices', description: 'SAI Lab seminars, conferences, and announcements.' };

export default function NoticesPage() {
  const notices = getNotices();
  return <>
    <PageHeader title="Notices" />
    <div className="container">
      {notices.length === 0 ? <p className="muted">No notices yet.</p> : <NoticesList notices={notices} builtOn={localDay()} />}
    </div>
  </>;
}
