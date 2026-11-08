import { type Person, SEMINAR_TYPES, type Seminar, seminarFileUrl } from '@/lib/content';
import { formatDate, langOf } from '@/lib/format';
import { PersonName } from './PersonName';
import styles from './Items.module.css';

/** Compact seminar row used outside the Seminars index. */
export function SeminarItem({ seminar, people }: { seminar: Seminar; people: Person[] }) {
  const file = seminarFileUrl(seminar);
  const meta = SEMINAR_TYPES[seminar.type];
  return (
    <li className={styles.seminar}>
      <span className={`${styles.date} num`}>{formatDate(seminar.date, 'full')}</span>
      <div>
        <p className={styles.title} lang={langOf(seminar.title)}>{file ? <a href={file}>{seminar.title}</a> : seminar.title}</p>
        <p className={styles.meta}>
          <PersonName name={seminar.presenter} people={people} />
          {meta && <span className={styles.metaExtra}>{meta}</span>}
        </p>
        {seminar.summary && <p className={styles.summary}>{seminar.summary}</p>}
      </div>
      <span className={styles.file}>{file && <a href={file} aria-label={`PDF: ${seminar.title}`}>PDF</a>}</span>
    </li>
  );
}
