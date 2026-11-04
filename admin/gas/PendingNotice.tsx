/**
 * Apps Script 전환 빌드: 저장을 보낸 뒤 적용될 때까지(소유자 작업 주기 때문에 몇 분 걸릴 수 있음) 화면 아래에 상태를 보입니다.
 * 각 화면의 저장 단추는 그대로 두고, 무엇을 기다리는지만 알립니다.
 */
import { useEffect, useState } from 'react';
import { dismissRecoveredRequest, onPending, recoverPendingRequests,
  type PendingStage, type RecoveredRequest } from '@admin/lib/appsScript';
import styles from './PendingNotice.module.css';

const LABEL: Record<PendingStage, string> = {
  sending: '보내는 중',
  received: '접수됨 · 적용을 기다리는 중',
  applying: '적용하는 중',
};
const RECOVERED: Record<RecoveredRequest['phase'], string> = {
  unconfirmed: '접수 확인 중', received: '접수됨 · 적용 대기 중', applying: '적용 중', saved: 'DB 저장 완료 · 공개 반영 중',
  done: '공개 완료', failed: '처리 실패',
};

export function PendingNotice() {
  const [stages, setStages] = useState<PendingStage[]>([]);
  const [recovered, setRecovered] = useState<RecoveredRequest[]>([]);
  useEffect(() => onPending(setStages), []);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const jobs = await recoverPendingRequests();
        if (alive) setRecovered(jobs);
      } catch { /* Keep the last visible state until the snapshot is available again. */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);
  if (stages.length === 0 && recovered.length === 0) return <div className={styles.live} role="status" aria-live="polite" />;
  const stage = (['sending', 'received', 'applying'] as const).find((s) => stages.includes(s));
  return (
    <div className={styles.live} role="status" aria-live="polite">
      <div className={styles.notice}>
        {stage && <p>{LABEL[stage]}{stages.length > 1 && <span className="num"> ({stages.length}건)</span>}
          {stage !== 'sending' && <span className={styles.hint}> 창을 닫아도 접수한 내용은 적용됩니다.</span>}</p>}
        {recovered.map((job) => <p key={job.id}>
          {job.label}: {RECOVERED[job.phase]}
          {job.message && <span className={styles.hint}> · {job.message}</span>}
          {(job.phase === 'done' || job.phase === 'failed') && <button type="button" className="admin-text-button"
            onClick={() => { dismissRecoveredRequest(job.id); setRecovered((items) => items.filter((item) => item.id !== job.id)); }}>
            확인</button>}
        </p>)}
      </div>
    </div>
  );
}

