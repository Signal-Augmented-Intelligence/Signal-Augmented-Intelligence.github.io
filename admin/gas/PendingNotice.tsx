/**
 * Apps Script 전환 빌드: 저장을 보낸 뒤 적용될 때까지(소유자 작업 주기 때문에 몇 분 걸릴 수 있음) 화면 아래에 상태를 보입니다.
 * 각 화면의 저장 단추는 그대로 두고, 무엇을 기다리는지만 알립니다.
 */
import { useEffect, useState } from 'react';
import { onPending, type PendingStage } from '@admin/lib/appsScript';
import styles from './PendingNotice.module.css';

const LABEL: Record<PendingStage, string> = {
  sending: '보내는 중',
  received: '접수됨 · 적용을 기다리는 중',
  applying: '적용하는 중',
};

export function PendingNotice() {
  const [stages, setStages] = useState<PendingStage[]>([]);
  useEffect(() => onPending(setStages), []);
  if (stages.length === 0) return <div className={styles.live} role="status" aria-live="polite" />;
  const stage = (['sending', 'received', 'applying'] as const).find((s) => stages.includes(s))!;
  return (
    <div className={styles.live} role="status" aria-live="polite">
      <p className={styles.notice}>
        {LABEL[stage]}{stages.length > 1 && <span className="num"> ({stages.length}건)</span>}
        <span className={styles.hint}>창을 닫아도 접수한 내용은 적용됩니다.</span>
      </p>
    </div>
  );
}
