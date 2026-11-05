'use client';

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Section } from '@/components/Section';
import { useDialog } from '@admin/components/Dialog';
import { Field, focusField } from '@admin/components/Field';
import { FileUpload, type FileValue } from '@admin/components/FileUpload';
import list from '@admin/components/List.module.css';
import { PublishFailure } from '@admin/components/PublishFailure';
import { api, ApiError, type Publish, signedOut } from '@admin/lib/api';
import { changedFields, PARTIAL_DATE, readDraft, writeDraft } from '@admin/lib/edit';
import { errorBody, fieldList } from '@admin/lib/errors';
import { formatDay } from '@admin/lib/format';
import type { NoticeItem, System } from '@admin/lib/types';
import { usePublish } from '@admin/lib/usePublish';
import { canDelete, useDeletePost } from '@admin/lib/deletePost';
import styles from './notices.module.css';

type Draft = Pick<NoticeItem, 'date' | 'event_date' | 'kind' | 'title' | 'body' | 'link' | 'popup'> & { photo: FileValue | null };
const MB = 1024 * 1024;
const kinds: Record<NoticeItem['kind'], string> = {
  seminar: '세미나', conference: '학술대회', recruitment: '학부연구생 모집', other: '기타',
};
const key = (id?: string) => `sai-admin:notices:${id ?? 'new'}`;
const sorted = (items: NoticeItem[]) => [...items].sort((a, b) => b.date.localeCompare(a.date));
const todayInSeoul = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

export function NoticesScreen() {
  const dialog = useDialog();
  const { publishing, track, settled } = usePublish();
  const [items, setItems] = useState<NoticeItem[] | null>(null);
  const [system, setSystem] = useState<System | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [notices, sys] = await Promise.all([api.get<NoticeItem[]>('/notices'), api.get<System>('/system')]);
      setItems(sorted(notices.data));
      setSystem(sys.data);
    }
    catch (err) { if (!signedOut(err) && await dialog.error('불러오지 못했습니다', errorBody(err), { retry: true })) void load(); }
  }, [dialog]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (settled) void load(); }, [settled, load]);
  const { remove, deleting } = useDeletePost(() => void load());
  if (!items || !system) return <p className="admin-muted">불러오는 중입니다.</p>;
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
      <NoticeForm system={system} onSaved={saved} onCancel={() => setOpen(null)} onConflict={load} /></div>}
    {items.length === 0 && open !== 'new' ? <p className="admin-muted">아직 등록된 공지가 없습니다.</p> :
      <ul className={list.list}>{items.map((item) => open === item.id
        ? <li key={item.id} className={list.open}><NoticeForm item={item} system={system} onSaved={saved}
            onCancel={() => setOpen(null)} onConflict={load} /></li>
        : <li key={item.id} className={list.row}>
          <div className={list.main}>
            <p className={list.title}>{item.title}</p>
            <p className={list.meta}><span className="num">{formatDay(item.date)}</span><span>{kinds[item.kind]}</span>
              {item.event_date && <span>일정 {formatDay(item.event_date)}</span>}{item.photo_file_id && <span>사진</span>}{item.popup && <span>첫 화면 띠</span>}</p>
            <PublishFailure publication={item.publication} pending={publishing(item.id)} />
          </div>
          <span className={list.status}>
            {publishing(item.id) || item.publication.state === 'publishing' ? '반영 중'
              : item.publication.state === 'failed' ? '반영 실패' : item.hidden ? '숨김' : '공개 중'}
          </span>
          <span className={list.actions}>
            <button type="button" className="admin-text-button" disabled={open !== null || busy === item.id} onClick={() => setOpen(item.id)}>수정</button>
            <button type="button" className="admin-text-button" disabled={open !== null || busy === item.id} onClick={() => void setHidden(item)}>{item.hidden ? '다시 보이기' : '숨기기'}</button>
            {canDelete(item, publishing(item.id)) && <button type="button" className="admin-text-button" disabled={deleting !== null || open !== null || busy === item.id}
              onClick={() => void remove('notices', item, '공지를 삭제할까요?')}>{deleting === item.id ? '삭제 중' : '삭제'}</button>}
          </span>
        </li>)}</ul>}
  </Section>;
}

function NoticeForm({ item, system, onSaved, onCancel, onConflict }: {
  item?: NoticeItem; system: System; onSaved: (item: NoticeItem, publish?: Publish) => void;
  onCancel: () => void; onConflict: () => void;
}) {
  const dialog = useDialog();
  const [draft, setDraft] = useState<Draft>(() => ({ date: item?.date ?? '', event_date: item?.event_date ?? '',
    kind: item?.kind ?? 'seminar', title: item?.title ?? '', body: item?.body ?? '',
    link: item?.link ?? '', popup: item?.popup ?? false,
    photo: item?.photo_file_id ? { id: item.photo_file_id, name: '사진', size: null,
      preview_url: item.photo_preview_url, warnings: [] } : null,
    ...readDraft<Draft>(key(item?.id)) }));
  const [saving, setSaving] = useState(false);
  const pending = useRef<Promise<FileValue | null> | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const set = (change: Partial<Draft>) => setDraft((prior) => {
    const next = { ...prior, ...change }; writeDraft(key(item?.id), next); return next;
  });
  const cancel = () => { writeDraft(key(item?.id), null); onCancel(); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    // 서버도 앞뒤 공백을 지우므로, 붙여 넣은 주소의 공백 때문에 저장이 막히지 않게 먼저 지우고 확인합니다.
    const date = draft.date.trim(); const event_date = draft.event_date.trim(); const title = draft.title.trim();
    const content = draft.body.trim(); const link = draft.link.trim();
    const problems: [string, string][] = [];
    if (item && date && !PARTIAL_DATE.test(date)) problems.push(['date', '게시 날짜를 YYYY, YYYY-MM 또는 YYYY-MM-DD로 적어 주세요.']);
    if (event_date && !PARTIAL_DATE.test(event_date)) problems.push(['event_date', '행사 날짜를 YYYY, YYYY-MM 또는 YYYY-MM-DD로 적어 주세요.']);
    if (!title) problems.push(['title', '제목을 적어 주세요.']);
    else if (title.length > 200) problems.push(['title', '제목은 200자 이내로 적어 주세요.']);
    if (content.length > 20000) problems.push(['body', '내용은 20,000자 이내로 적어 주세요.']);
    if (link && !/^(?:https?:\/\/\S+|\/\S+)$/.test(link)) problems.push(['link', '자세히 보기 주소는 https:// 주소 또는 사이트 내부 주소로 적어 주세요.']);
    if (draft.popup && draft.kind !== 'recruitment') problems.push(['popup', '첫 화면 띠는 학부연구생 모집 공지에만 표시할 수 있습니다.']);
    if (problems.length > 0) {
      await dialog.error('저장하지 못했습니다', fieldList(problems.map(([, message]) => message)));
      focusField(form.current, problems.map(([name]) => name));
      return;
    }
    setSaving(true);
    try {
      const wait = pending.current;
      const uploaded = wait ? await wait : null;
      if (wait && !uploaded) return;
      const photo = wait ? uploaded : draft.photo;
      const { kind, popup } = draft;
      const payload = { date: item ? date : todayInSeoul(), event_date, kind, title, body: content, link, popup,
        photo_file_id: photo?.id ?? null };
      const body = item ? changedFields(item, payload) : payload;
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
  const photoLimit = Math.min(system.limits.photo_mb, 20);
  return <form ref={form} className={`admin-form ${styles.form}`} onSubmit={submit} noValidate>
    <Field label="종류"><select value={draft.kind} onChange={(e) => set({ kind: e.target.value as Draft['kind'], popup: false })}>
      {Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></Field>
    {item && <Field label="게시 날짜"><input name="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} /></Field>}
    <Field label="행사 날짜" optional><input name="event_date" placeholder="YYYY, YYYY-MM, YYYY-MM-DD" value={draft.event_date} onChange={(e) => set({ event_date: e.target.value })} /></Field>
    <Field label="제목"><input name="title" value={draft.title} onChange={(e) => set({ title: e.target.value })} /></Field>
    <Field label="내용" optional><textarea name="body" className={styles.body} value={draft.body} onChange={(e) => set({ body: e.target.value })} /></Field>
    {system.storage.connected && <Field label="사진" optional limit={`${photoLimit} MB 이하`} group>
      <FileUpload name="photo" label="사진" purpose="notice" accept={system.limits.photo_types.join(',')}
        maxBytes={photoLimit * MB} tooLarge={`사진이 ${photoLimit} MB를 넘습니다.`}
        value={draft.photo} onChange={(photo) => set({ photo })}
        onPending={(promise) => { pending.current = promise; }} />
    </Field>}
    <Field label="자세히 보기 주소" optional><input name="link" value={draft.link} onChange={(e) => set({ link: e.target.value })} /></Field>
    {draft.kind === 'recruitment' && <Field label="첫 화면 띠" optional>
      <label><input name="popup" type="checkbox" checked={draft.popup} onChange={(e) => set({ popup: e.target.checked })} /> 표시</label>
    </Field>}
    <div className="admin-actions"><button type="submit" className="admin-button" disabled={saving}>{saving ? '저장 중' : '저장'}</button>
      <button type="button" className="admin-text-button" disabled={saving} onClick={cancel}>취소</button></div>
  </form>;
}
