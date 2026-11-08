import Link from 'next/link';
import { getLab } from '@/lib/content';
import { visibleNav } from '@/lib/nav';
import { MAIN_NAV } from '@/lib/site';
import { NavLinks } from './NavLinks';
import styles from './SiteHeader.module.css';

export function SiteHeader() {
  const lab = getLab();
  const items = visibleNav(MAIN_NAV);
  const home = items.filter((item) => item.href === '/');
  const sections = items.filter((item) => item.href !== '/');
  return (
    <header className={styles.header}>
      <div className={`container container-header ${styles.inner}`}>
        <Link href="/" className={styles.brand} aria-label={`${lab.name} home`}>
          {lab.logo
            ? <img src={lab.logo} alt={lab.name} className={styles.customLogo} />
            : <span className={styles.brandLogo}>
                <img src="/images/sai-lab-black.png" alt={lab.name} className={styles.logoImage} />
              </span>}
        </Link>
        <nav aria-label="Main" className={styles.navFrame}>
          <NavLinks items={sections} className={styles.nav} linkClassName={styles.link} />
          <NavLinks items={home} className={styles.homeNav} linkClassName={styles.link} />
        </nav>
      </div>
    </header>
  );
}
