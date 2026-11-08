/**
 * Apps Script 전환 빌드에서 next/navigation 대신 씁니다.
 * HTML 서비스는 /exec 주소 하나라서 관리 화면 주소를 해시(#/members/)로 둡니다.
 */
import { useSyncExternalStore } from 'react';

export function hashPath(): string {
  const raw = decodeURI(location.hash.replace(/^#/, '')) || '/';
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return path.endsWith('/') ? path : `${path}/`;
}

const subscribe = (change: () => void) => {
  window.addEventListener('hashchange', change);
  return () => window.removeEventListener('hashchange', change);
};

export function usePathname(): string {
  return useSyncExternalStore(subscribe, hashPath, () => '/');
}
