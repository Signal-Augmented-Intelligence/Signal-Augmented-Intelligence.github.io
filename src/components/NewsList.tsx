import Link from 'next/link';
import { formatDate, langOf } from '@/lib/format';
import type { NewsEntry } from '@/lib/news';
import { DateList } from './DateList';
import styles from './NewsList.module.css';

/** Site paths go through Link; files (PDFs) and other sites use a plain anchor. */
function Go({ href, label, children }: { href: string; label: string; children: string }) {
  return href.startsWith('/') && !href.startsWith('/files/')
    ? <Link href={href} aria-label={label} lang="ko" className={styles.go}>{children}</Link>
    : <a href={href} aria-label={label} lang="ko" className={styles.go}>{children}</a>;
}

/**
 * News entries as a date list: kind (수상·게재·발표, bold), title, then "논문 →"/"기사 →" for the news link
 * and "사진 →" when an album has the same date.
 */
export function NewsList({ news }: { news: NewsEntry[] }) {
  return (
    <DateList wide items={news.map((n) => ({
      date: formatDate(n.date),
      content: <>
        {n.kind && <strong className={styles.kind} lang="ko">{n.kind}</strong>}
        <span lang={langOf(n.text)}>{n.text}</span>
        {n.href && <> <Go href={n.href} label={`${n.hrefLabel}: ${n.text}`}>{`${n.hrefLabel} →`}</Go></>}
        {n.album && <> <Go href={n.album.href} label={`사진: ${n.text}`}>사진 →</Go></>}
      </>,
    }))} />
  );
}
