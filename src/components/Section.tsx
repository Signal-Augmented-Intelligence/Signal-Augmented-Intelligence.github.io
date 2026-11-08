import type { ReactNode } from 'react';
import styles from './Section.module.css';
import { langOf } from '@/lib/format';

/** A content block: heading with an optional link on the right, a dark rule, then the content. */
export function Section({ id, title, aside, children, hideTitle = false }: { id?: string; title: string; aside?: ReactNode; children: ReactNode; hideTitle?: boolean }) {
  return (
    <section id={id} className={`container ${styles.section} ${hideTitle ? styles.sectionWithoutVisibleTitle : ''}`}>
      <div className={styles.head}>
        <h2 className={hideTitle ? styles.visuallyHidden : styles.title} lang={langOf(title)}>{title}</h2>
        {aside && <div className={styles.aside}>{aside}</div>}
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
