import type { Metadata } from 'next';
import itemStyles from '@/components/Items.module.css';
import { PageHeader } from '@/components/PageHeader';
import { PublicationItem } from '@/components/PublicationItem';
import { getPeople, getPublications } from '@/lib/content';
import { RESEARCH_TABS } from '@/lib/site';
import styles from './publications.module.css';

export const metadata: Metadata = { title: 'Publications', description: 'Publications of SAI Lab, Hanshin University.' };

export default function PublicationsPage() {
  const people = getPeople();
  const publications = getPublications();
  const years = [...new Set(publications.map((p) => p.pub_date.slice(0, 4)))];

  return (
    <>
      <PageHeader title="Research" tabs={RESEARCH_TABS.length > 1 ? RESEARCH_TABS : undefined} />
      <div className="container">
        {years.length > 1 && (
          <nav className={styles.years} aria-label="Years">
            {years.map((y) => <a key={y} href={`#y${y}`} className="num">{y}</a>)}
          </nav>
        )}
        {years.map((y) => (
          <section key={y} id={`y${y}`} className={styles.year}>
            <h2 className={`${styles.yearTitle} num`}>{y}</h2>
            <ol className={itemStyles.list}>
              {publications.filter((p) => p.pub_date.startsWith(y)).map((p) => <PublicationItem key={p.url} pub={p} people={people} />)}
            </ol>
          </section>
        ))}
      </div>
    </>
  );
}
