'use client';

import { useCallback, useEffect, useState } from 'react';
import { Section } from '@/components/Section';
import { useDialog } from '@admin/components/Dialog';
import list from '@admin/components/List.module.css';
import { api, APPS_SCRIPT, type Publish, signedOut } from '@admin/lib/api';
import { errorBody } from '@admin/lib/errors';
import { formatTime } from '@admin/lib/format';
import type { LastRun, System } from '@admin/lib/types';
import { usePublish } from '@admin/lib/usePublish';
import { useSession } from '@admin/components/Session';

/**
 * 반영·백업 화면 (규칙 문서 1부 6장의 "첫 화면"): 마지막 반영, 마지막 백업, 원본 파일 저장소를 목록 한 줄 형식으로.
 * "다시 반영"은 지금 저장된 내용 전체로 공개 사이트를 다시 만듭니다 (api.md 4장 POST /publish).
 */
const SITE = 'site'; // 반영 중 표시용 항목 id

const STATE: Record<LastRun['state'], string> = { queued: '반영 중', running: '반영 중', done: '완료', failed: '실패' };
const BACKUP: Record<LastRun['state'], string> = { queued: '백업 중', running: '백업 중', done: '완료', failed: '실패' };

export function StartScreen() {
  const dialog = useDialog();
  const { publishing, track, settled } = usePublish();
  const { changePassword } = useSession();
  const [system, setSystem] = useState<System | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (quiet = false) => {
    try {
      setSystem((await api.get<System>('/system')).data);
    } catch (err) {
      if (signedOut(err)) return;
      if (quiet) return;
      if (await dialog.error('불러오지 못했습니다', errorBody(err), { retry: true })) void load();
    }
  }, [dialog]);

  useEffect(() => {
    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(true); };
    const timer = window.setInterval(refresh, 10_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [load]);

  // 반영이 끝나면 마지막 반영 시각을 새로 받습니다.
  const running = publishing(SITE);
  useEffect(() => { if (settled) void load(true); }, [settled, load]);

  if (!system) return <p className="admin-muted">불러오는 중입니다.</p>;

  const republish = async () => {
    setBusy(true);
    try {
      const res = await api.post<Publish>('/publish');
      track(SITE, res.data);
      setSystem((s) => s && { ...s, last_publish: { ...res.data, finished_at: null } });
    } catch (err) {
      if (!signedOut(err)) await dialog.error('다시 반영하지 못했습니다', errorBody(err));
    } finally {
      setBusy(false);
    }
  };

  const { last_publish: pub, last_backup: backup } = system;
  const pubState = running ? '반영 중' : pub ? STATE[pub.state] : '';
  const publishBusy = running || pub?.state === 'queued' || pub?.state === 'running';

  return (
    <>
    <Section title="공개 사이트">
      <ul className={list.list}>
        <li className={list.row}>
          <div className={list.main}>
            <p className={list.title}>마지막 반영</p>
            <p className={list.meta}>
              {pub?.finished_at ? <span className="num">{formatTime(pub.finished_at)}</span> : !pub && <span>아직 없음</span>}
              {pub?.state === 'failed' && pub.message && !running && <span>{pub.message}</span>}
            </p>
          </div>
          <span className={list.status}>{pubState}</span>
          <span className={list.actions}>
            <button type="button" className="admin-text-button" disabled={busy || publishBusy} onClick={republish}>다시 반영</button>
          </span>
        </li>
        <li className={list.row}>
          <div className={list.main}>
            <p className={list.title}>마지막 백업</p>
            <p className={list.meta}>
              {backup?.finished_at ? <span className="num">{formatTime(backup.finished_at)}</span> : <span>{backup ? '진행 중' : '백업 설정 전'}</span>}
              {backup?.state === 'failed' && backup.message && <span>{backup.message}</span>}
            </p>
          </div>
          <span className={list.status}>{backup ? BACKUP[backup.state] : ''}</span>
          <span className={list.actions} />
        </li>
        <li className={list.row}>
          <div className={list.main}>
            <p className={list.title}>원본 파일 저장소</p>
          </div>
          <span className={list.status}>{system.storage.connected ? '연결됨' : '연결 안 됨'}</span>
          <span className={list.actions} />
        </li>
      </ul>
    </Section>

    {/* 휴대폰에서는 헤더에 "비밀번호 바꾸기"가 없어서 여기서 바꿉니다. PC에서도 같이 둡니다. Apps Script 전환 빌드에는 비밀번호가 없습니다. */}
    {!APPS_SCRIPT && <Section title="계정">
      <ul className={list.list}>
        <li className={list.row}>
          <div className={list.main}><p className={list.title}>공용 비밀번호</p></div>
          <span className={list.status} />
          <span className={list.actions}>
            <button type="button" className="admin-text-button" onClick={changePassword}>바꾸기</button>
          </span>
        </li>
      </ul>
    </Section>}
    </>
  );
}
