import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { getNotices } from '@/lib/content';
import { formatDate } from '@/lib/format';
import styles from './notices.module.css';

export const metadata: Metadata = { title: 'Notices', description: 'SAI Lab seminars, conferences, and announcements.' };
const kinds = { seminar: 'Seminar', conference: 'Conference', recruitment: 'Recruitment', other: 'Notice' };

export default function NoticesPage() {
  const notices = getNotices();
  return <>
    <PageHeader title="Notices" />
    <div className="container">
      {notices.length === 0 ? <p className="muted">No notices yet.</p> :
        <ol className={styles.list}>{notices.map((notice) => <li key={notice.id} id={`notice-${notice.id}`} className={styles.row}>
          <time className={`${styles.date} num`}>{formatDate(notice.date)}</time>
          <div>
            <strong className={styles.kind}>{kinds[notice.kind]}</strong>
            <h2 className={styles.title}>{notice.title}</h2>
            {notice.event_date && <p className={styles.meta}>Date: {formatDate(notice.event_date)}</p>}
            {notice.body && <p className={styles.body}>{notice.body}</p>}
            {notice.link && (notice.link.startsWith('/')
              ? <Link href={notice.link}>Details</Link>
              : <a href={notice.link} target="_blank" rel="noopener noreferrer">Details</a>)}
          </div>
        </li>)}</ol>}
    </div>
  </>;
}
