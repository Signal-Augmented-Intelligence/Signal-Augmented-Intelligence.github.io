'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Section } from '@/components/Section';
import { useDialog } from '@admin/components/Dialog';
import { Field } from '@admin/components/Field';
import list from '@admin/components/List.module.css';
import { api, ApiError, type Publish, signedOut } from '@admin/lib/api';
import { changedFields, PARTIAL_DATE, readDraft, writeDraft } from '@admin/lib/edit';
import { errorBody } from '@admin/lib/errors';
import { formatDay } from '@admin/lib/format';
import type { NoticeItem } from '@admin/lib/types';
import { usePublish } from '@admin/lib/usePublish';
import styles from './notices.module.css';

type Draft = Pick<NoticeItem, 'date' | 'event_date' | 'kind' | 'title' | 'body' | 'link' | 'popup'>;
const kinds: Record<NoticeItem['kind'], string> = {
  seminar: '세미나', conference: '학술대회', recruitment: '학부연구생 모집', other: '기타',
};
const key = (id?: string) => `sai-admin:notices:${id ?? 'new'}`;
const sorted = (items: NoticeItem[]) => [...items].sort((a, b) => b.date.localeCompare(a.date));

export function NoticesScreen() {
  const dialog = useDialog();
  const { publishing, track, settled } = usePublish();
  const [items, setItems] = useState<NoticeItem[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setItems(sorted((await api.get<NoticeItem[]>('/notices')).data)); }
    catch (err) { if (!signedOut(err) && await dialog.error('불러오지 못했습니다', errorBody(err), { retry: true })) void load(); }
  }, [dialog]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (settled) void load(); }, [settled, load]);
  if (!items) return <p className="admin-muted">불러오는 중입니다.</p>;
  const saved = (notice: NoticeItem, publish?: Publish) => {
    setItems((old) => old && sorted([notice, ...old.filter((item) => item.id !== notice.id)]));
    track(notice.id, publish);
    setOpen(null);
  };
  const setHidden = async (item: NoticeItem) => {
    if (!item.hidden && !(await dialog.confirm('공지를 숨길까요?', '공개 목록과 첫 화면 띠에서 빠집니다. 원본은 남습니다.', '숨기기'))) return;
    setBusy(item.id);
    try {
      const res = await api.patch<NoticeItem>(`/notices/${item.id}`, { version: item.version, hidden: !item.hidden });
      saved(res.data, res.publish);
    } catch (err) {
      if (!signedOut(err)) await dialog.error('저장하지 못했습니다', errorBody(err));
      if (err instanceof ApiError && err.code === 'CONFLICT') void load();
    } finally { setBusy(null); }
  };
  return <Section title="공지" aside={open === null &&
    <button type="button" className="admin-text-button" onClick={() => setOpen('new')}>공지 추가</button>}>
    {open === 'new' && <div className={list.open}><h3 className="admin-form-title">새 공지</h3>
      <NoticeForm onSaved={saved} onCancel={() => setOpen(null)} onConflict={load} /></div>}
    {items.length === 0 && open !== 'new' ? <p className="admin-muted">아직 등록된 공지가 없습니다.</p> :
      <ul className={list.list}>{items.map((item) => open === item.id
        ? <li key={item.id} className={list.open}><NoticeForm item={item} onSaved={saved}
            onCancel={() => setOpen(null)} onConflict={load} /></li>
        : <li key={item.id} className={list.row}>
          <div className={list.main}>
            <p className={list.title}>{item.title}</p>
            <p className={list.meta}><span className="num">{formatDay(item.date)}</span><span>{kinds[item.kind]}</span>
              {item.event_date && <span>일정 {formatDay(item.event_date)}</span>}{item.popup && <span>첫 화면 띠</span>}</p>
          </div>
          <span className={list.status} title={item.publication.message ?? undefined}>
            {publishing(item.id) || item.publication.state === 'publishing' ? '반영 중'
              : item.publication.state === 'failed' ? '반영 실패' : item.hidden ? '숨김' : '공개 중'}
          </span>
          <span className={list.actions}>
            <button type="button" className="admin-text-button" disabled={open !== null || busy === item.id} onClick={() => setOpen(item.id)}>고치기</button>
            <button type="button" className="admin-text-button" disabled={open !== null || busy === item.id} onClick={() => void setHidden(item)}>{item.hidden ? '다시 보이기' : '숨기기'}</button>
          </span>
        </li>)}</ul>}
  </Section>;
}

function NoticeForm({ item, onSaved, onCancel, onConflict }: {
  item?: NoticeItem; onSaved: (item: NoticeItem, publish?: Publish) => void;
  onCancel: () => void; onConflict: () => void;
}) {
  const dialog = useDialog();
  const [draft, setDraft] = useState<Draft>(() => ({ date: item?.date ?? '', event_date: item?.event_date ?? '',
    kind: item?.kind ?? 'seminar', title: item?.title ?? '', body: item?.body ?? '',
    link: item?.link ?? '', popup: item?.popup ?? false, ...readDraft<Draft>(key(item?.id)) }));
  const [saving, setSaving] = useState(false);
  const set = (change: Partial<Draft>) => setDraft((prior) => {
    const next = { ...prior, ...change }; writeDraft(key(item?.id), next); return next;
  });
  const cancel = () => { writeDraft(key(item?.id), null); onCancel(); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if ((draft.date && !PARTIAL_DATE.test(draft.date)) || (draft.event_date && !PARTIAL_DATE.test(draft.event_date))
      || !draft.title.trim() || draft.title.length > 200 || draft.body.length > 20000
      || (draft.link && !/^(?:https?:\/\/\S+|\/\S+)$/.test(draft.link))
      || (draft.popup && draft.kind !== 'recruitment')) {
      await dialog.error('저장하지 못했습니다', '날짜·제목·링크·첫 화면 띠 설정을 확인해 주세요.'); return;
    }
    setSaving(true);
    try {
      const body = item ? changedFields(item, draft) : draft;
      if (item && Object.keys(body).length === 0) { cancel(); return; }
      const res = item
        ? await api.patch<NoticeItem>(`/notices/${item.id}`, { ...body, version: item.version })
        : await api.post<NoticeItem>('/notices', body);
      writeDraft(key(item?.id), null);
      onSaved(res.data, res.publish);
    } catch (err) {
      if (!signedOut(err)) await dialog.error('저장하지 못했습니다', errorBody(err));
      if (err instanceof ApiError && err.code === 'CONFLICT') onConflict();
    } finally { setSaving(false); }
  };
  return <form className={`admin-form ${styles.form}`} onSubmit={submit} noValidate>
    <Field label="종류"><select value={draft.kind} onChange={(e) => set({ kind: e.target.value as Draft['kind'], popup: false })}>
      {Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></Field>
    <Field label="게시 날짜" optional limit="YYYY, YYYY-MM, YYYY-MM-DD"><input value={draft.date} onChange={(e) => set({ date: e.target.value })} /></Field>
    <Field label="행사 날짜" optional limit="YYYY, YYYY-MM, YYYY-MM-DD"><input value={draft.event_date} onChange={(e) => set({ event_date: e.target.value })} /></Field>
    <Field label="제목"><input value={draft.title} onChange={(e) => set({ title: e.target.value })} /></Field>
    <Field label="내용" optional><textarea className={styles.body} value={draft.body} onChange={(e) => set({ body: e.target.value })} /></Field>
    <Field label="자세히 보기 주소" optional><input value={draft.link} onChange={(e) => set({ link: e.target.value })} /></Field>
    {draft.kind === 'recruitment' && <Field label="첫 화면 띠" optional>
      <label><input type="checkbox" checked={draft.popup} onChange={(e) => set({ popup: e.target.checked })} /> 표시</label>
    </Field>}
    <div className="admin-actions"><button type="submit" className="admin-button" disabled={saving}>{saving ? '저장 중' : '저장'}</button>
      <button type="button" className="admin-text-button" disabled={saving} onClick={cancel}>취소</button></div>
  </form>;
}
