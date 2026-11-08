import { AdminBanner } from '@admin/components/AdminBanner';
import { AdminShell } from '@admin/components/AdminShell';
import { NotFoundPopup } from '@admin/components/NotFoundPopup';

/** 없는 주소: 반영·백업 화면과 같은 틀 위에 공통 오류 팝업. */
export default function NotFound() {
  return (
    <>
      <AdminBanner title="관리 화면" />
      <AdminShell>{null}</AdminShell>
      <NotFoundPopup />
    </>
  );
}
