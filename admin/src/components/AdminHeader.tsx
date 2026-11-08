'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { APPS_SCRIPT } from '@admin/lib/api';
import { currentMenu } from '@admin/lib/menu';
import styles from './AdminHeader.module.css';
import { useSession } from './Session';

/**
 * 관리 화면 헤더. 왼쪽에는 연구실 로고, 오른쪽에는 공개 사이트 링크와 계정 동작을 둡니다.
 * "공개 사이트"(새 탭)는 지금 화면이 고치는 공개 사이트 페이지를 엽니다(Seminars → /seminars/, Album → /album/, 그 밖에는 첫 화면).
 * 로그인한 뒤에는 오른쪽에 "비밀번호 바꾸기"(팝업)와 "로그아웃"이 붙습니다(공용 계정이라 이름은 없음).
 * 휴대폰에서는 헤더가 한 줄에 들어가도록 "비밀번호 바꾸기"를 빼고, 반영·백업 화면의 "계정"에서 바꿉니다.
 * Apps Script 전환 빌드에는 비밀번호가 없어 "비밀번호 바꾸기"를 두지 않고, "로그아웃" 대신 "나가기"를 둡니다.
 */
export function AdminHeader({ siteUrl }: { siteUrl: string }) {
  const { state, changePassword, logout } = useSession();
  const path = usePathname();
  const siteHref = `${siteUrl}${currentMenu(path)?.site ?? '/'}`;
  const loggedIn = state === 'in';
  return (
    <header className={styles.header}>
      <div className={`container container-header ${styles.inner}`}>
        <a href="/" className={styles.brand} aria-label="SAI Lab 관리 화면 첫 화면">
          <span className={styles.brandLogo}>
            <Image src="/images/admin/sai-lab-black.png" width={1778} height={885} alt="SAI Lab" className={styles.logoImage} />
          </span>
          <span className={styles.divider} aria-hidden="true" />
          <span className={styles.area}>관리</span>
        </a>
        <ul className={styles.actions}>
          <li><a className={styles.link} href={siteHref} target="_blank" rel="noopener noreferrer">공개 사이트</a></li>
          {loggedIn && (
            <>
              {!APPS_SCRIPT && <li className={styles.password}><button type="button" className={`${styles.link} ${styles.button}`} onClick={changePassword}>비밀번호 바꾸기</button></li>}
              <li><button type="button" className={`${styles.link} ${styles.button}`} onClick={() => void logout()}>{APPS_SCRIPT ? '나가기' : '로그아웃'}</button></li>
            </>
          )}
        </ul>
      </div>
    </header>
  );
}
