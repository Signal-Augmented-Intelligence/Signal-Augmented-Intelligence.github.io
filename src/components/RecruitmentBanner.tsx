'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Notice } from '@/lib/content';
import styles from './RecruitmentBanner.module.css';

function localDay() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/* A strip under the header, laid over the top of the Home first screen so showing it does not push the page down. */
export function RecruitmentBanner({ notice }: { notice: Notice }) {
  const [open, setOpen] = useState(false);
  const key = `sai-recruitment-dismissed:${notice.id}`;
  useEffect(() => {
    try { if (localStorage.getItem(key) === localDay()) return; } catch { /* storage may be disabled */ }
    setOpen(true);
  }, [key]);
  const dismiss = (todayOnly: boolean) => {
    if (todayOnly) {
      try { localStorage.setItem(key, localDay()); } catch { /* storage may be disabled */ }
    }
    setOpen(false);
  };
  if (!open) return null;
  const href = notice.link || `/notices/${notice.id}/`;
  return <aside className={styles.banner} aria-label="모집 공지">
    <div className={`container container-header ${styles.inner}`}>
      <strong className={styles.tag} lang="ko">모집</strong>
      <p className={styles.title}>{notice.title}</p>
      {href.startsWith('/')
        ? <Link href={href} className={styles.link}>공고 보기 →</Link>
        : <a href={href} target="_blank" rel="noopener noreferrer" className={styles.link}>공고 보기 →</a>}
      <div className={styles.actions}>
        <button type="button" onClick={() => dismiss(true)}>오늘 하루 보지 않기</button>
        <button type="button" onClick={() => dismiss(false)} aria-label="닫기" className={styles.close}>×</button>
      </div>
    </div>
  </aside>;
}
