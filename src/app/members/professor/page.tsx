import type { Metadata } from 'next';
import { DateList } from '@/components/DateList';
import { PageHeader } from '@/components/PageHeader';
import { PhotoSlot } from '@/components/PhotoSlot';
import { Section } from '@/components/Section';
import { getProfessor } from '@/lib/content';
import { formatDate } from '@/lib/format';
import { visibleNav } from '@/lib/nav';
import { MEMBERS_TABS } from '@/lib/site';
import styles from './professor.module.css';

export const metadata: Metadata = { title: 'Professor', description: 'Prof. Seon Man Kim, advisor of SAI Lab, Hanshin University.' };

export default function ProfessorPage() {
  const p = getProfessor();
  // Keep every source record; collapse title/year duplicates only in this public list.
  const software = p.software.filter((entry, index, entries) => !entries.some((earlier, earlierIndex) =>
    earlierIndex < index && earlier.title === entry.title && earlier.date.slice(0, 4) === entry.date.slice(0, 4)));

  return (
    <>
      <PageHeader title="Members" tabs={visibleNav(MEMBERS_TABS)} />

      <div className={`container ${styles.profile}`}>
        <PhotoSlot photo={p.photo} alt={p.name} className={styles.photo} eager />
        <div>
          <h2 className={styles.name}>{p.name} <span lang="ko" className={styles.nameKo}>{p.name_ko}</span></h2>
          <p className={styles.position}>{p.position}</p>
          <p>{p.affiliation}</p>
          {p.field && <p className="muted">{p.field}</p>}
          <dl className={styles.contact}>
            {p.office && <><dt>Office</dt><dd>{p.office}</dd></>}
            {p.email && <><dt>Email</dt><dd><a href={`mailto:${p.email}`}>{p.email}</a></dd></>}
            {p.phone && <><dt>Tel</dt><dd className="num">{p.phone}</dd></>}
          </dl>
          {p.links.length > 0 && <p className={styles.links}>{p.links.map((l) => <a key={l.url} href={l.url}>{l.label}</a>)}</p>}
        </div>
      </div>

      {p.bio && <Section id="biography" title="Biography"><p className="prose">{p.bio}</p></Section>}

      <Section id="education" title={p.career.length ? 'Education & Career' : 'Education'}>
        <DateList items={[
          ...p.education.map((e) => ({ date: formatDate(e.date, 'month'), content: <>{e.degree}, <span lang="ko">{e.school}</span></> })),
          ...p.career.map((c) => ({ date: c.period, content: c.role })),
        ]} />
      </Section>

      <Section id="research-areas" title="Research Areas">
        <ul className={styles.areas}>
          {p.research_areas.map((r) => (
            <li key={r.en}>{r.en}<span lang="ko" className={styles.ko}>{r.ko}</span></li>
          ))}
        </ul>
        {p.keywords && <p className={styles.keywords} lang="ko">{p.keywords}</p>}
      </Section>

      {p.teaching.length > 0 && (
        <Section id="teaching" title="Courses Taught">
          <DateList items={p.teaching.map((c) => ({ date: c.terms, content: c.course }))} />
        </Section>
      )}

      <Section id="publications" title="Publications">
        <ul className={styles.pubs}>
          {p.publications.map((pub) => (
            <li key={pub.title}>
              <span className={`${styles.pubDate} num`}>{pub.date}</span>
              <div>
                <p className={styles.pubTitle}>{pub.doi ? <a href={`https://doi.org/${pub.doi}`}>{pub.title}</a> : pub.title}</p>
                <p className={styles.pubMeta}>{pub.authors}. <em>{pub.venue}</em></p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="intellectual-property" title="Intellectual Property">
        <h3 className={styles.sub}>Software registrations</h3>
        <DateList items={software.map((s) => ({ date: s.date, content: <span lang="ko">{s.title}</span>, note: s.note }))} />
        <h3 className={styles.sub}>Patents</h3>
        <DateList items={p.patents.map((s) => {
          const applicationYear = /^(\d{4}) 출원$/.exec(s.date);
          return {
            date: applicationYear?.[1] ?? formatDate(s.date),
            content: <span lang="ko">{s.title}</span>,
            note: [applicationYear && '출원', s.status, s.number].filter(Boolean).join(', '),
          };
        })} />
      </Section>
    </>
  );
}
