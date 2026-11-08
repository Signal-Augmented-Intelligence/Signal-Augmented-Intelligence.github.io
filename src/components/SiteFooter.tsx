import Link from 'next/link';
import { getLab } from '@/lib/content';
import { visibleNav } from '@/lib/nav';
import { FOOTER_LINKS } from '@/lib/site';
import styles from './SiteFooter.module.css';

export function SiteFooter() {
  const lab = getLab();
  const links = visibleNav(FOOTER_LINKS);
  // 한신대학교면 이름 대신 학교 로고를 오른쪽 끝에 둡니다.
  const hanshin = lab.institution === 'Hanshin University';
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div>
          <p className={styles.lab}>{lab.name}</p>
          <p className="muted">{lab.full_name}</p>
          {!hanshin && <p className="muted">{lab.institution}</p>}
          {lab.location && <p className="muted">{lab.location}</p>}
          {lab.email && <p><a href={`mailto:${lab.email}`}>{lab.email}</a></p>}
        </div>
        <nav aria-label="Quick links">
          <ul className={styles.links}>
            {links.map((l) => (
              <li key={l.href}><Link href={l.href}>{l.title}</Link></li>
            ))}
          </ul>
        </nav>
        {hanshin && <img src="/images/hanshin-university.png" alt={lab.institution} className={styles.universityLogo} />}
      </div>
      <div className="container">
        <div className={styles.bottom}>
          <p>&copy; {new Date().getFullYear()} {lab.name}</p>
        </div>
      </div>
    </footer>
  );
}
