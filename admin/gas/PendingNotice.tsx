/**
 * Apps Script 전환 빌드: 저장을 보낸 뒤 적용될 때까지(소유자 작업 주기 때문에 몇 분 걸릴 수 있음) 화면 아래에 상태를 보입니다.
 * 각 화면의 저장 단추는 그대로 두고, 무엇을 기다리는지만 알립니다.
 */
import { useEffect, useState } from 'react';
import { dismissRecoveredRequest, onPending, onSitePublishing, recoverPendingRequests, refreshSitePublishing,
  type PendingStage, type RecoveredRequest } from '@admin/lib/appsScript';
import styles from './PendingNotice.module.css';

/** 저장(관리 기록에 적용)과 공개 사이트 반영을 따로 보입니다. */
const LABEL: Record<PendingStage, string> = {
  sending: '보내는 중',
  received: '접수됨 · 저장을 기다리는 중',
  applying: '저장하는 중',
};
const RECOVERED: Record<RecoveredRequest['phase'], string> = {
  unconfirmed: '접수 확인 중', received: '접수됨 · 저장 대기 중', applying: '저장하는 중', saved: '저장됨 · 공개 사이트 반영 중',
  done: '공개 사이트 반영 완료', failed: '처리 실패',
};

export function PendingNotice() {
  const [stages, setStages] = useState<PendingStage[]>([]);
  const [recovered, setRecovered] = useState<RecoveredRequest[]>([]);
  const [site, setSite] = useState(0);
  useEffect(() => onPending(setStages), []);
  useEffect(() => onSitePublishing(setSite), []);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const jobs = await recoverPendingRequests();
        if (alive) setRecovered(jobs);
        await refreshSitePublishing();
      } catch { /* Keep the last visible state until the snapshot is available again. */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);
  if (stages.length === 0 && recovered.length === 0 && site === 0) return <div className={styles.live} role="status" aria-live="polite" />;
  const stage = (['sending', 'received', 'applying'] as const).find((s) => stages.includes(s));
  return (
    <div className={styles.live} role="status" aria-live="polite">
      <div className={styles.notice}>
        {stage && <p>{LABEL[stage]}{stages.length > 1 && <span className="num"> ({stages.length}건)</span>}
          {stage !== 'sending' && <span className={styles.hint}> 창을 닫아도 접수한 내용은 적용됩니다.</span>}</p>}
        {site > 0 && <p>저장됨 · 공개 사이트 반영 중{site > 1 && <span className="num"> ({site}건)</span>}</p>}
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

