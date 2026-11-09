import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { PhotoSlot } from '@/components/PhotoSlot';
import { Section } from '@/components/Section';
import { getPeople, type Person } from '@/lib/content';
import { visibleNav } from '@/lib/nav';
import { MEMBERS_TABS, TEAM_GROUPS } from '@/lib/site';
import styles from '../members.module.css';
import { langOf } from '@/lib/format';

export const metadata: Metadata = { title: 'Our Team', description: 'Members of SAI Lab, Hanshin University.' };

const YEARS = [
  { grade: 4, title: '4th Year' },
  { grade: 3, title: '3rd Year' },
  { grade: 2, title: '2nd Year' },
  { grade: 1, title: '1st Year' },
];

type Row = { key: string; title: string | null; members: Person[] };

/** Undergrads get one row per school year (4 → 1, then those without a year); everyone else, or undergrads with no year set, one untitled row. */
function rowsOf(groupId: string, members: Person[]): Row[] {
  if (groupId !== 'undergrad' || !members.some((m) => m.grade !== null)) return [{ key: 'all', title: null, members }];
  const rows: Row[] = YEARS.map((y) => ({ key: `year-${y.grade}`, title: y.title, members: members.filter((m) => m.grade === y.grade) }));
  rows.push({ key: 'year-none', title: 'Others', members: members.filter((m) => m.grade === null) });
  return rows.filter((r) => r.members.length > 0);
}

/** Starts a new line after each comma-ended phrase ("…생긴다면, 무엇에…" → two lines). The data stays one line. */
function phraseLines(text: string) {
  return text.split(/(?<=,)\s+/).map((part, i) => (
    <span key={i} className={styles.phrase}>{part}</span>
  ));
}

export default function TeamPage() {
  const people = getPeople();
  const groups = TEAM_GROUPS.map((g) => ({ ...g, rows: rowsOf(g.id, people.filter((p) => p.group === g.id)) })).filter((g) => g.rows.length > 0 && g.rows[0].members.length > 0);

  return (
    <>
      <PageHeader title="Members" tabs={visibleNav(MEMBERS_TABS)} />
      <Section id="our-team" title="Our Team" hideTitle>
        {groups.length === 0 && <p className="muted">Members will be listed here.</p>}
        {groups.map((g) => (
          <div key={g.id} id={g.id} className={styles.group}>
            <h3 className={styles.groupTitle}>{g.title}</h3>
            {g.rows.map((row, rowIndex) => (
              <div key={row.key} className={styles.row}>
                {row.title && <h4 className={styles.rowTitle}>{row.title}</h4>}
                <ul className={styles.team}>
                  {row.members.map((m, index) => (
                    <li key={m.id} id={m.id} className={styles.member}>
                      <PhotoSlot photo={m.photo} alt={m.name} eager={rowIndex === 0 && index < 6} />
                      <div className={styles.info}>
                        <p className={styles.name}>{m.name}</p>
                        {m.name_ko && <p className={styles.nameKo} lang="ko">{m.name_ko}</p>}
                        {m.bio_en && <p className={styles.bio} lang={langOf(m.bio_en)}>{phraseLines(m.bio_en)}</p>}
                        {m.bio && <p className={`${styles.bio} ${m.bio_en ? styles.bioSecond : ''}`} lang={langOf(m.bio)}>{phraseLines(m.bio)}</p>}
                        {(m.url || m.email) && (
                          <p className={styles.link}>
                            {m.url && <a href={m.url}>Website</a>}
                            {m.email && <a href={`mailto:${m.email}`}>Email</a>}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </Section>
    </>
  );
}
