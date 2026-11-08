'use client';

import { useEffect } from 'react';
import { AdminBanner } from '@admin/components/AdminBanner';
import { AdminShell } from '@admin/components/AdminShell';
import { useDialog } from '@admin/components/Dialog';

/**
 * 화면을 그리다 오류가 나면(예: 받은 자료 모양이 예상과 다름) 브라우저 기본 영어 오류 화면 대신
 * 관리 화면 틀과 공통 오류 팝업을 보여 줍니다. "다시 시도"는 그 화면을 다시 그립니다.
 */
export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  const dialog = useDialog();
  useEffect(() => {
    console.error(error);
    let cancelled = false;
    dialog.error('화면을 표시하지 못했습니다', '잠시 뒤 다시 시도해 주세요. 저장한 내용은 남아 있습니다.', { retry: true })
      .then((again) => { if (!cancelled && again) reset(); });
    return () => { cancelled = true; };
  }, [error, reset, dialog]);
  return (
    <>
      <AdminBanner title="관리 화면" />
      <AdminShell>{null}</AdminShell>
    </>
  );
}
