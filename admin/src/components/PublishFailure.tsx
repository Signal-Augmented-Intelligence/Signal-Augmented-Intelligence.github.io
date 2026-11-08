import list from './List.module.css';

type Publication = { state: string; message?: string | null } | null | undefined;

/**
 * 공개 반영이 실패한 까닭. 상태 글자의 툴팁에만 두면 휴대폰에서 볼 수 없어 글자로 보입니다.
 * pending: 다시 반영하는 중에는 지난 실패를 보이지 않습니다.
 */
export function PublishFailure({ publication, pending = false, className = list.meta }: {
  publication: Publication; pending?: boolean; className?: string;
}) {
  if (pending || publication?.state !== 'failed' || !publication.message) return null;
  return <p className={className}>반영 실패: {publication.message}</p>;
}
