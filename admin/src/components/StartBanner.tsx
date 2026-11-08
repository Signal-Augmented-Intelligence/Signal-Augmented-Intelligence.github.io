'use client';

import { AdminBanner } from './AdminBanner';
import { useSession } from './Session';

/**
 * 주소 / 의 띠 제목. 로그인 뒤에는 메뉴 이름과 같은 "반영·백업", 로그인 전(로그인 칸)에는 "관리 화면".
 * 로그인 상태를 확인하는 동안은 "관리 화면"으로 둡니다.
 */
export function StartBanner() {
  const { state } = useSession();
  return <AdminBanner title={state === 'in' ? '반영·백업' : '관리 화면'} />;
}
