import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { PhotoSlot } from '@/components/PhotoSlot';
import { Section } from '@/components/Section';
import { getPeople } from '@/lib/content';
import { MEMBERS_TABS, TEAM_GROUPS } from '@/lib/site';
import styles from '../members.module.css';
import { langOf } from '@/lib/format';

export const metadata: Metadata = { title: 'Our Team', description: 'Members of SAI Lab, Hanshin University.' };

export default function TeamPage() {
  const people = getPeople();
  const groups = TEAM_GROUPS.map((g) => ({ ...g, members: people.filter((p) => p.group === g.id) })).filter((g) => g.members.length > 0);

  return (
    <>
      <PageHeader title="Members" tabs={MEMBERS_TABS} />
      <Section id="our-team" title="Our Team">
        {groups.length === 0 && <p className="muted">Members will be listed here.</p>}
        {groups.map((g) => (
          <div key={g.id} id={g.id} className={styles.group}>
            <h3 className={styles.groupTitle}>{g.title}</h3>
            <ul className={styles.team}>
              {g.members.map((m, index) => (
                <li key={m.id} id={m.id} className={styles.member}>
                  <PhotoSlot photo={m.photo} alt={m.name} eager={index < 4} />
                  <p className={styles.name}>{m.name}</p>
                  {m.name_ko && <p className={styles.nameKo} lang="ko">{m.name_ko}</p>}
                  {m.bio && <p className={styles.bio} lang={langOf(m.bio)}>{m.bio}</p>}
                  {m.url && <p className={styles.link}><a href={m.url}>Website</a></p>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>
    </>
  );
}
