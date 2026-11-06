'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Notice } from '@/lib/content';
import { formatDate } from '@/lib/format';
import { localDay, NOTICE_KINDS, noticeTitle, orderNotices } from '@/lib/notices';
import styles from './notices.module.css';

/**
 * Notice board: pinned notices first, then newest post first.
 * The pin check runs again in the browser so a pin ends on time without a new build.
 * A conference row shows its name, host and presentation date, with the poster on the right.
 */
export function NoticesList({ notices, builtOn }: { notices: Notice[]; builtOn: string }) {
  const [today, setToday] = useState(builtOn);
  useEffect(() => { setToday(localDay()); }, []);
  return (
    <ol className={styles.list}>
      {orderNotices(notices, today).map((n) => {
        const meta = n.kind === 'conference'
          ? [n.title && n.host, n.event_date && formatDate(n.event_date)]
          : [NOTICE_KINDS[n.kind], n.event_date && formatDate(n.event_date)];
        return (
          <li key={n.id} className={styles.row}>
            <div className={styles.main}>
              {n.pinnedNow && <strong className={styles.pin}>Pinned</strong>}
              <h2 className={styles.title}><Link href={`/notices/${n.id}/`}>{noticeTitle(n)}</Link></h2>
              {meta.some(Boolean) && (
                <p className={styles.meta}>{meta.filter(Boolean).map((m, i) => <span key={i} className={m === n.host ? undefined : 'num'}>{m}</span>)}</p>
              )}
            </div>
            {n.photo && (
              <Link href={`/notices/${n.id}/`} className={styles.thumb} tabIndex={-1} aria-hidden="true">
                <img src={n.photo} alt="" loading="lazy" />
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}
