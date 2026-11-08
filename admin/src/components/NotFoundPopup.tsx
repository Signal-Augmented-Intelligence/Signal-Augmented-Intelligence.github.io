'use client';

import { useEffect } from 'react';
import { useDialog } from './Dialog';

/**
 * 없는 주소: 공통 오류 팝업을 띄우고, 닫으면 직전 관리 화면으로 돌아갑니다.
 * 직전 화면이 없으면(주소를 직접 입력·북마크) 반영·백업 화면으로 갑니다.
 */
export function NotFoundPopup() {
  const dialog = useDialog();
  useEffect(() => {
    let cancelled = false;
    dialog.error('페이지를 찾을 수 없습니다').then(() => {
      if (cancelled) return;
      const fromAdmin = document.referrer && new URL(document.referrer).origin === location.origin;
      if (fromAdmin && history.length > 1) history.back();
      else location.replace('/');
    });
    return () => { cancelled = true; };
  }, [dialog]);
  return null;
}
