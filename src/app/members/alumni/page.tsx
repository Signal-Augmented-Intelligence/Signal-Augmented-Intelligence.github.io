import type { Metadata } from 'next';
import { Redirect, redirectMetadata } from '@/components/Redirect';
import { hasAlumni, visibleNav } from '@/lib/nav';
import { PageHeader } from '@/components/PageHeader';
import { Section } from '@/components/Section';
import { getPeople } from '@/lib/content';
import { MEMBERS_TABS } from '@/lib/site';
import styles from '../members.module.css';

/** With no alumni yet the tab is hidden and this address forwards to Our Team, so old links still land somewhere. */
export const metadata: Metadata = hasAlumni()
  ? { title: 'Alumni', description: 'Alumni of SAI Lab, Hanshin University.' }
  : { title: 'Alumni', ...redirectMetadata };

export default function AlumniPage() {
  const alumni = getPeople().filter((p) => p.group === 'alumni');
  if (alumni.length === 0) return <Redirect to="/members/our-team/" />;
  return (
    <>
      <PageHeader title="Members" tabs={visibleNav(MEMBERS_TABS)} />
      <Section id="alumni" title="Alumni">
        <ul className={styles.alumni}>
          {alumni.map((p) => (
            <li key={p.id} id={p.id}>
              <span className={styles.name}>{p.url ? <a href={p.url}>{p.name}</a> : p.name}</span>
              <span lang="ko" className={styles.nameKo}>{p.name_ko}</span>
              <span className="muted">{p.after}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
