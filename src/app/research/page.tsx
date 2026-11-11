import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Section } from '@/components/Section';
import { getPublications, getResearchAreas } from '@/lib/content';
import { Redirect, redirectMetadata } from '@/components/Redirect';
import { RESEARCH_TABS, SHOW_RESEARCH_AREAS } from '@/lib/site';
import styles from './research.module.css';

export const metadata: Metadata = SHOW_RESEARCH_AREAS
  ? { title: 'Research Areas', description: 'Research areas at SAI Lab, Hanshin University.' }
  : { title: 'Research', ...redirectMetadata };

export default function ResearchPage() {
  if (!SHOW_RESEARCH_AREAS) return <Redirect to="/research/publications/" />;
  const areas = getResearchAreas();
  const published = new Set(getPublications().map((p) => p.url));
  /** Only publications that are actually on the site are counted. */
  const countOf = (urls: string[]) => urls.filter((u) => published.has(u)).length;
  return (
    <>
      <PageHeader title="Research" tabs={RESEARCH_TABS} />
      <Section id="areas" title="Research Areas" hideTitle>
        <ul className={styles.cards}>
          {areas.map((a) => {
            const count = countOf(a.publications);
            return (
              <li key={a.slug} id={a.slug} className={styles.card}>
                <Link className={styles.cardLink} href={`/research/${a.slug}/`}>
                  {a.figure && (
                    <span className={styles.figure}>
                      <img src={a.figure} alt="" />
                    </span>
                  )}
                  <div className={styles.cardBody}>
                    <h3 className={styles.cardTitle}>{a.title}</h3>
                    {/* Without a figure the card would be a bare title, so the one-line summary fills it. */}
                    {!a.figure && a.summary && <p className={styles.cardSummary}>{a.summary}</p>}
                    {count > 0 && <p className={styles.cardMeta}>{count} {count === 1 ? 'publication' : 'publications'}</p>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>
    </>
  );
}
