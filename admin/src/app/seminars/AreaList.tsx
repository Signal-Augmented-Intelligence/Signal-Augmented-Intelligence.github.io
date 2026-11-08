'use client';

import { type FormEvent, useState } from 'react';
import { Section } from '@/components/Section';
import { useDialog } from '@admin/components/Dialog';
import { api, ApiError, type Publish, signedOut } from '@admin/lib/api';
import { errorBody } from '@admin/lib/errors';
import type { SeminarArea } from '@admin/lib/types';
import list from '@admin/components/List.module.css';
import styles from './seminars.module.css';

/**
 * 세미나 분야 Section (api.md 9장). 추가(제목 오른쪽, 목록 맨 위에 펼침), 이름 바꾸기(그 줄 자리에서), 숨기기, 순서(위로·아래로).
 * 숨긴 분야는 올리기 폼의 선택지에서 빠지고, 이미 그 분야인 세미나는 그대로 둡니다.
 * 추가·이름 바꾸기 칸이 열려 있는 동안에는 다른 줄의 동작과 "분야 추가"를 막습니다(세미나 목록과 같은 규칙).
 */
const HIDE_BODY = '숨기면 공개 사이트의 분야 목록에서 빠집니다. 이 분야의 세미나는 그대로 보이고, 다시 보이게 할 수 있습니다.';

export function AreaList({ areas, onChange, onConflict, publishing, track }: {
  areas: SeminarArea[];
  onChange: (areas: SeminarArea[]) => void;
  onConflict: () => void;
  publishing: (id: string) => boolean;
  track: (id: string, publish?: Publish) => void;
}) {
  const dialog = useDialog();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await work(); } catch (err) {
      if (signedOut(err)) return;
      await dialog.error('저장하지 못했습니다', errorBody(err, { name: '분야 이름' }));
      if (err instanceof ApiError && err.code === 'CONFLICT') onConflict();
    } finally { setBusy(false); }
  };

  const formOpen = adding || renaming !== null;
  const locked = busy || formOpen;

  const put = (a: SeminarArea) => onChange(areas.map((x) => (x.id === a.id ? a : x)));

  const add = (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) { void dialog.error('저장하지 못했습니다', '분야 이름을 적어 주세요.'); return; }
    void run(async () => {
      const res = await api.post<SeminarArea>('/seminar-areas', { name });
      onChange([...areas, res.data]);
      track(res.data.id, res.publish);
      setNewName(''); setAdding(false);
    });
  };

  const rename = (e: FormEvent, a: SeminarArea) => {
    e.preventDefault();
    const name = renaming?.name.trim() ?? '';
    if (!name) { void dialog.error('저장하지 못했습니다', '분야 이름을 적어 주세요.'); return; }
    void run(async () => {
      const res = await api.patch<SeminarArea>(`/seminar-areas/${a.id}`, { name, version: a.version });
      put(res.data); track(a.id, res.publish); setRenaming(null);
    });
  };

  const setHidden = async (a: SeminarArea, hidden: boolean) => {
    if (hidden && !(await dialog.confirm('분야를 숨길까요?', HIDE_BODY, '숨기기'))) return;
    void run(async () => {
      const res = await api.patch<SeminarArea>(`/seminar-areas/${a.id}`, { hidden, version: a.version });
      put(res.data); track(a.id, res.publish);
    });
  };

  const move = (index: number, by: -1 | 1) => void run(async () => {
    const next = [...areas];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    const res = await api.put<SeminarArea[]>('/seminar-areas/order', { ids: next.map((a) => a.id) });
    onChange(res.data ?? next);
    track(next[index + by].id, res.publish);
  });

  return (
    <Section title="세미나 분야" aside={!formOpen && (
      <button type="button" className="admin-text-button" onClick={() => setAdding(true)}>분야 추가</button>
    )}>
      {adding && (
        <div className={list.open}>
          <form className={styles.inline} onSubmit={add}>
            <input aria-label="분야 이름" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            <button type="submit" className="admin-text-button" disabled={busy}>{busy ? '추가 중' : '추가'}</button>
            <button type="button" className="admin-text-button" disabled={busy} onClick={() => { setAdding(false); setNewName(''); }}>취소</button>
          </form>
        </div>
      )}
      {areas.length === 0 ? (
        !adding && <p className="admin-muted">아직 등록된 분야가 없습니다.</p>
      ) : (
        <ul className={list.list}>
          {areas.map((a, i) => (
            <li key={a.id} className={list.row}>
              <div className={list.main}>
                {renaming?.id === a.id ? (
                  <form className={styles.inline} onSubmit={(e) => rename(e, a)}>
                    <input aria-label="분야 이름" value={renaming.name} onChange={(e) => setRenaming({ id: a.id, name: e.target.value })} autoFocus />
                    <button type="submit" className="admin-text-button" disabled={busy}>{busy ? '저장 중' : '저장'}</button>
                    <button type="button" className="admin-text-button" disabled={busy} onClick={() => setRenaming(null)}>취소</button>
                  </form>
                ) : (
                  <>
                    <p className={list.title}>{a.name}</p>
                    <p className={list.meta}><span>세미나 {a.seminar_count}개</span></p>
                  </>
                )}
              </div>
              <span className={list.status}>{publishing(a.id) ? '반영 중' : a.hidden ? '숨김' : '공개 중'}</span>
              <span className={list.actions}>
                <button type="button" className="admin-text-button" disabled={locked || i === 0} onClick={() => move(i, -1)}>위로</button>
                <button type="button" className="admin-text-button" disabled={locked || i === areas.length - 1} onClick={() => move(i, 1)}>아래로</button>
                <button type="button" className="admin-text-button" disabled={locked} onClick={() => setRenaming({ id: a.id, name: a.name })}>이름 바꾸기</button>
                {a.hidden
                  ? <button type="button" className="admin-text-button" disabled={locked} onClick={() => setHidden(a, false)}>다시 보이기</button>
                  : <button type="button" className="admin-text-button" disabled={locked} onClick={() => setHidden(a, true)}>숨기기</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
