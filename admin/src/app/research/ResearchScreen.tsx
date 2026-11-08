'use client';

import { useCallback, useEffect, useState } from 'react';
import { Section } from '@/components/Section';
import { useDialog } from '@admin/components/Dialog';
import list from '@admin/components/List.module.css';
import { PublishFailure } from '@admin/components/PublishFailure';
import { api, ApiError, type Publish, signedOut } from '@admin/lib/api';
import { errorBody } from '@admin/lib/errors';
import { formatDay } from '@admin/lib/format';
import type { PickerPerson, Publication, ResearchArea, System } from '@admin/lib/types';
import { usePublish } from '@admin/lib/usePublish';
import { AreaForm } from './AreaForm';
import { PublicationForm, TYPES } from './PublicationForm';
import { canDelete, useDeletePost } from '@admin/lib/deletePost';

/**
 * Research 한 화면 (설계 문서 2장): 논문(발표일 최신순)과 연구 분야(공개 순서).
 * 둘 다 목록 위 "추가"로 새 폼, 줄의 "고치기"로 그 자리 폼, "숨기기"는 확인 팝업. 연구 분야만 위로·아래로.
 * 한 번에 폼 하나만 엽니다(열려 있으면 다른 줄의 고치기·추가를 막음).
 */
type Loaded = { system: System; publications: Publication[]; areas: ResearchArea[]; people: PickerPerson[] };
type Open = { kind: 'publication' | 'area'; id: string | 'new' } | null;

const HIDE_PUBLICATION = '숨기면 공개 사이트의 논문 목록과 연구 분야, 소식에서 빠집니다. 원본은 남아 있어 다시 보이게 할 수 있습니다.';
const HIDE_AREA = '숨기면 공개 사이트의 연구 분야에서 빠집니다. 이 분야의 논문은 그대로 보이고, 다시 보이게 할 수 있습니다.';
const byDate = (a: Publication, b: Publication) => b.pub_date.localeCompare(a.pub_date);
const typeLabel = (t: string) => TYPES.find((x) => x.id === t)?.label ?? t;

export function ResearchScreen() {
  const dialog = useDialog();
  const { publishing, track, settled } = usePublish();
  // Called after render only, so load is defined by then.
  const { remove, deleting } = useDeletePost(() => void load());
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [system, publications, areas, people] = await Promise.all([
        api.get<System>('/system'), api.get<Publication[]>('/publications'),
        api.get<ResearchArea[]>('/research-areas'), api.get<PickerPerson[]>('/people?view=picker'),
      ]);
      setLoaded({ system: system.data, publications: [...publications.data].sort(byDate), areas: areas.data, people: people.data });
    } catch (err) {
      if (signedOut(err)) return;
      if (await dialog.error('불러오지 못했습니다', errorBody(err), { retry: true })) void load();
    }
  }, [dialog]);

  useEffect(() => { void load(); }, [load]);
  // 반영이 끝나면 분야의 논문 수처럼 관리 서버가 맞춘 값을 새로 받습니다.
  useEffect(() => { if (settled) void load(); }, [settled]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loaded) return <p className="admin-muted">불러오는 중입니다.</p>;
  const { system, publications, areas, people } = loaded;

  const run = async (id: string, work: () => Promise<void>) => {
    setBusy(id);
    try { await work(); } catch (err) {
      if (signedOut(err)) return;
      await dialog.error('저장하지 못했습니다', errorBody(err));
      if (err instanceof ApiError && err.code === 'CONFLICT') void load();
    } finally { setBusy(null); }
  };

  const savedPublication = (p: Publication, publish?: Publish) => {
    setLoaded((l) => l && { ...l, publications: [p, ...l.publications.filter((x) => x.id !== p.id)].sort(byDate) });
    track(p.id, publish);
    setOpen(null);
    void load(); // 분야의 논문 수가 바뀔 수 있습니다.
  };
  const savedArea = (a: ResearchArea, publish?: Publish) => {
    setLoaded((l) => l && { ...l, areas: l.areas.some((x) => x.id === a.id) ? l.areas.map((x) => (x.id === a.id ? a : x)) : [...l.areas, a] });
    track(a.id, publish);
    setOpen(null);
  };

  const hidePublication = async (p: Publication, hidden: boolean) => {
    if (hidden && !(await dialog.confirm('논문을 숨길까요?', HIDE_PUBLICATION, '숨기기'))) return;
    void run(p.id, async () => {
      const res = await api.patch<Publication>(`/publications/${p.id}`, { hidden, version: p.version });
      savedPublication(res.data, res.publish);
    });
  };
  const hideArea = async (a: ResearchArea, hidden: boolean) => {
    if (hidden && !(await dialog.confirm('연구 분야를 숨길까요?', HIDE_AREA, '숨기기'))) return;
    void run(a.id, async () => {
      const res = await api.patch<ResearchArea>(`/research-areas/${a.id}`, { hidden, version: a.version });
      savedArea(res.data, res.publish);
    });
  };
  const moveArea = (index: number, by: -1 | 1) => void run(areas[index].id, async () => {
    const next = [...areas];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    const res = await api.put<ResearchArea[]>('/research-areas/order', { ids: next.map((a) => a.id) });
    setLoaded((l) => l && { ...l, areas: res.data ?? next });
    track(next[index + by].id, res.publish);
  });

  const status = (item: Publication | ResearchArea) => {
    if (publishing(item.id) || item.publication.state === 'publishing') return '반영 중';
    if (item.publication.state === 'failed') return '반영 실패';
    return item.hidden ? '숨김' : '공개 중';
  };
  const locked = open !== null;
  const areaNames = (ids: string[]) => ids.map((id) => areas.find((a) => a.id === id)?.title).filter(Boolean).join(', ');

  return (
    <>
      <Section title="논문" aside={!locked && (
        <button type="button" className="admin-text-button" onClick={() => setOpen({ kind: 'publication', id: 'new' })}>논문 추가</button>
      )}>
        {open?.kind === 'publication' && open.id === 'new' && (
          <div className={list.open}>
            <h3 className="admin-form-title">새 논문</h3>
            <PublicationForm people={people} areas={areas} system={system} onSaved={savedPublication} onCancel={() => setOpen(null)} onConflict={load} />
          </div>
        )}
        {publications.length === 0 && !(open?.kind === 'publication' && open.id === 'new') ? (
          <p className="admin-muted">아직 등록된 논문이 없습니다.</p>
        ) : (
          <ul className={list.list}>
            {publications.map((p) => open?.kind === 'publication' && open.id === p.id ? (
              <li key={p.id} className={list.open}>
                <PublicationForm publication={p} people={people} areas={areas} system={system} onSaved={savedPublication} onCancel={() => setOpen(null)} onConflict={load} />
              </li>
            ) : (
              <li key={p.id} className={list.row}>
                <div className={list.main}>
                  <p className={list.title}>{p.title}</p>
                  <p className={list.meta}>
                    <span className="num">{formatDay(p.pub_date)}</span>
                    <span>{typeLabel(p.type)}</span>
                    <span>{p.venue}</span>
                    {p.area_ids.length > 0 && <span>{areaNames(p.area_ids)}</span>}
                  </p>
                  <PublishFailure publication={p.publication} pending={publishing(p.id)} />
                </div>
                <span className={list.status}>{status(p)}</span>
                <span className={list.actions}>
                  <button type="button" className="admin-text-button" disabled={locked || busy === p.id} onClick={() => setOpen({ kind: 'publication', id: p.id })}>수정</button>
                  <button type="button" className="admin-text-button" disabled={locked || busy === p.id} onClick={() => void hidePublication(p, !p.hidden)}>{p.hidden ? '다시 보이기' : '숨기기'}</button>
                  {canDelete(p, publishing(p.id)) && <button type="button" className="admin-text-button" disabled={deleting !== null || locked || busy === p.id}
                    onClick={() => void remove('publications', p, '논문을 삭제할까요?')}>{deleting === p.id ? '삭제 중' : '삭제'}</button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="연구 분야" aside={!locked && (
        <button type="button" className="admin-text-button" onClick={() => setOpen({ kind: 'area', id: 'new' })}>분야 추가</button>
      )}>
        {open?.kind === 'area' && open.id === 'new' && (
          <div className={list.open}>
            <h3 className="admin-form-title">새 연구 분야</h3>
            <AreaForm system={system} onSaved={savedArea} onCancel={() => setOpen(null)} onConflict={load} />
          </div>
        )}
        {areas.length === 0 && !(open?.kind === 'area' && open.id === 'new') ? (
          <p className="admin-muted">아직 등록된 연구 분야가 없습니다.</p>
        ) : (
          <ul className={list.list}>
            {areas.map((a, i) => open?.kind === 'area' && open.id === a.id ? (
              <li key={a.id} className={list.open}>
                <AreaForm area={a} system={system} onSaved={savedArea} onCancel={() => setOpen(null)} onConflict={load} />
              </li>
            ) : (
              <li key={a.id} className={list.row}>
                <div className={list.main}>
                  <p className={list.title}>{a.title}</p>
                  <p className={list.meta}><span>논문 <span className="num">{a.publication_count}</span>편</span></p>
                  <PublishFailure publication={a.publication} pending={publishing(a.id)} />
                </div>
                <span className={list.status}>{status(a)}</span>
                <span className={list.actions}>
                  <button type="button" className="admin-text-button" disabled={locked || busy !== null || i === 0} onClick={() => moveArea(i, -1)}>위로</button>
                  <button type="button" className="admin-text-button" disabled={locked || busy !== null || i === areas.length - 1} onClick={() => moveArea(i, 1)}>아래로</button>
                  <button type="button" className="admin-text-button" disabled={locked || busy === a.id} onClick={() => setOpen({ kind: 'area', id: a.id })}>수정</button>
                  <button type="button" className="admin-text-button" disabled={locked || busy === a.id} onClick={() => void hideArea(a, !a.hidden)}>{a.hidden ? '다시 보이기' : '숨기기'}</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
