import type { ReactNode } from 'react';
import type { NavItem } from '@/lib/site';
import { NavLinks } from './NavLinks';
import styles from './PageHeader.module.css';
import { langOf } from '@/lib/format';

/**
 * Navy page banner (title, optional back link) and an optional tab bar under it.
 * `lede`: only for facts about the item itself (an album's date and photo count, a research area's summary), never a sentence describing the page.
 * `long`: a smaller title for long titles such as paper titles.
 */
export function PageHeader({ title, lede, tabs, back, long = false }: { title: string; lede?: ReactNode; tabs?: NavItem[]; back?: ReactNode; long?: boolean }) {
  return (
    <>
      <div className={styles.banner}>
        <div className="container">
          {back && <p className={styles.back}>{back}</p>}
          <h1 className={long ? `${styles.title} ${styles.titleLong}` : styles.title} lang={langOf(title)}>{title}</h1>
          {lede && <p className={styles.lede}>{lede}</p>}
        </div>
      </div>
      {tabs && (
        <nav className={styles.tabBar} aria-label={`${title} sections`}>
          <div className="container">
            <NavLinks items={tabs} className={styles.tabs} linkClassName={styles.tab} />
          </div>
        </nav>
      )}
      <div className={styles.gap} />
    </>
  );
}
