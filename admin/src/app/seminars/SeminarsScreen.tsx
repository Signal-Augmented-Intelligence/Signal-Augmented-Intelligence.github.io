'use client';

import { useCallback, useEffect, useState } from 'react';
import { Section } from '@/components/Section';
import { useDialog } from '@admin/components/Dialog';
import { api, ApiError, signedOut } from '@admin/lib/api';
import { errorBody } from '@admin/lib/errors';
import type { PickerPerson, Seminar, SeminarArea, System } from '@admin/lib/types';
import { usePublish } from '@admin/lib/usePublish';
import { AreaList } from './AreaList';
import { SeminarForm } from './SeminarForm';
import list from '@admin/components/List.module.css';
import { canDelete, useDeletePost } from '@admin/lib/deletePost';

/**
 * Seminars 한 화면 (세미나 업로드 설계 5장, 규칙 문서 3-2).
 * 세미나: 목록(날짜 최신순), 목록 위에서 올리기, 줄 자리에서 고치기, 숨기기, 첫 화면에 보이기.
 * 세미나 분야: 추가, 이름 바꾸기, 숨기기, 순서.
 * 폼이 열려 있는 동안(올리기·고치기)에는 목록의 다른 동작과 "세미나 올리기"를 막습니다. 폼 하나만 다루게 하려는 것입니다.
 */
export type Loaded = { system: System; seminars: Seminar[]; areas: SeminarArea[]; people: PickerPerson[] };

const HIDE_BODY = '숨기면 공개 사이트에서 보이지 않습니다. 원본은 남아 있어 다시 보이게 할 수 있습니다.';

export function formatDate(date: string) {
  return date.replaceAll('-', '.');
}

export function presenterName(s: Seminar, people: PickerPerson[]) {
  if ('name' in s.presenter) return s.presenter.name;
  const id = s.presenter.person_id;
  const p = people.find((x) => x.id === id);
  return p ? p.name_ko || p.name : id;
}

export function SeminarsScreen() {
  const dialog = useDialog();
  const { publishing, track, settled } = usePublish();
  // Called after render only, so load is defined by then.
  const { remove, deleting } = useDeletePost(() => void load());
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // 'new' 또는 세미나 id
  const [busyRow, setBusyRow] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [system, seminars, areas, people] = await Promise.all([
        api.get<System>('/system'),
        api.get<Seminar[]>('/seminars'),
        api.get<SeminarArea[]>('/seminar-areas'),
        api.get<PickerPerson[]>('/people?view=picker'),
      ]);
      setLoaded({ system: system.data, seminars: seminars.data, areas: areas.data, people: people.data });
    } catch (err) {
      if (signedOut(err)) return;
      if (await dialog.error('불러오지 못했습니다', errorBody(err), { retry: true })) void load();
    }
  }, [dialog]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (settled) void load(); }, [settled]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loaded) return <p className="admin-muted">불러오는 중입니다.</p>;
  const { seminars, areas, people } = loaded;

  const replace = (s: Seminar) => setLoaded((l) => l && {
    ...l,
    seminars: [s, ...l.seminars.filter((x) => x.id !== s.id)].sort((a, b) => b.date.localeCompare(a.date)),
  });

  const patch = async (s: Seminar, change: Partial<Seminar>) => {
    setBusyRow(s.id);
    try {
      const res = await api.patch<Seminar>(`/seminars/${s.id}`, { ...change, version: s.version });
      replace(res.data);
      track(res.data.id, res.publish);
    } catch (err) {
      if (signedOut(err)) return;
      await dialog.error('저장하지 못했습니다', errorBody(err));
      if (err instanceof ApiError && err.code === 'CONFLICT') void load();
    } finally {
      setBusyRow(null);
    }
  };

  const hide = async (s: Seminar) => {
    if (await dialog.confirm('세미나를 숨길까요?', HIDE_BODY, '숨기기')) void patch(s, { hidden: true });
  };

  const saved = (s: Seminar, publish?: Parameters<typeof track>[1]) => {
    replace(s);
    track(s.id, publish);
    setEditing(null);
  };

  /** 그 줄을 저장하는 중이거나 폼이 열려 있으면 줄의 동작을 막습니다. */
  const locked = (s: Seminar) => busyRow === s.id || editing !== null;

  const status = (s: Seminar) => publishing(s.id) || s.publication.state === 'publishing'
    ? '반영 중' : s.publication.state === 'failed' ? '반영 실패' : s.hidden ? '숨김' : '공개 중';

  return (
    <>
      <Section title="세미나" aside={editing === null && (
        <button type="button" className="admin-text-button" onClick={() => setEditing('new')}>세미나 올리기</button>
      )}>
        {editing === 'new' && (
          <div className={list.open}>
            <h3 className="admin-form-title">새 세미나</h3>
            <SeminarForm loaded={loaded} onSaved={saved} onCancel={() => setEditing(null)} onConflict={load} />
          </div>
        )}
        {seminars.length === 0 && editing !== 'new' ? (
          <p className="admin-muted">아직 등록된 세미나가 없습니다.</p>
        ) : (
          <ul className={list.list}>
            {seminars.map((s) => editing === s.id ? (
              <li key={s.id} className={list.open}>
                <SeminarForm loaded={loaded} seminar={s} onSaved={saved} onCancel={() => setEditing(null)} onConflict={load} />
              </li>
            ) : (
              <li key={s.id} className={list.row}>
                <div className={list.main}>
                  <p className={list.title}>{s.title}</p>
                  <p className={list.meta}>
                    <span className="num">{formatDate(s.date)}</span>
                    <span>{presenterName(s, people)}</span>
                    {s.area_id && <span>{areas.find((a) => a.id === s.area_id)?.name}</span>}
                    {!s.pdf_file_id && <span>PDF 없음</span>}
                    {s.publication.state === 'failed' && s.publication.message && <span>{s.publication.message}</span>}
                  </p>
                </div>
                <span className={list.status}>{status(s)}</span>
                <span className={list.actions}>
                  <button type="button" className="admin-text-button" disabled={locked(s)} onClick={() => setEditing(s.id)}>수정</button>
                  {s.hidden ? (
                    <button type="button" className="admin-text-button" disabled={locked(s)} onClick={() => patch(s, { hidden: false })}>다시 보이기</button>
                  ) : (
                    <button type="button" className="admin-text-button" disabled={locked(s)} onClick={() => hide(s)}>숨기기</button>
                  )}
                  {canDelete(s, publishing(s.id)) && <button type="button" className="admin-text-button" disabled={deleting !== null || locked(s)}
                    onClick={() => void remove('seminars', s, '세미나를 삭제할까요?')}>{deleting === s.id ? '삭제 중' : '삭제'}</button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <AreaList
        areas={areas}
        onChange={(next) => setLoaded((l) => l && { ...l, areas: next })}
        onConflict={load}
        publishing={publishing}
        track={track}
      />
    </>
  );
}
