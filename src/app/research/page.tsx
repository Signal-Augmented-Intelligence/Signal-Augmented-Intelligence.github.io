import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Section } from '@/components/Section';
import { getResearchAreas } from '@/lib/content';
import { Redirect, redirectMetadata } from '@/components/Redirect';
import { RESEARCH_TABS, SHOW_RESEARCH_AREAS } from '@/lib/site';
import styles from './research.module.css';

export const metadata: Metadata = SHOW_RESEARCH_AREAS
  ? { title: 'Research Areas', description: 'Research areas at SAI Lab, Hanshin University.' }
  : { title: 'Research', ...redirectMetadata };

export default function ResearchPage() {
  if (!SHOW_RESEARCH_AREAS) return <Redirect to="/research/publications/" />;
  const areas = getResearchAreas();
  return (
    <>
      <PageHeader title="Research" tabs={RESEARCH_TABS} />
      <Section id="areas" title="Research Areas" hideTitle>
        <ul className={styles.cards}>
          {areas.map((a) => (
            <li key={a.slug} id={a.slug} className={styles.card}>
              <Link className={styles.cardLink} href={`/research/${a.slug}/`}>
                {a.figure && (
                  <span className={styles.figure}>
                    <img src={a.figure} alt="" />
                  </span>
                )}
                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{a.title}</h3>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
