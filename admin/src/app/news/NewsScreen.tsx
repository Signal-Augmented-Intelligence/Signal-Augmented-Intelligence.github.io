'use client';

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Section } from '@/components/Section';
import { useDialog } from '@admin/components/Dialog';
import { Field, focusField } from '@admin/components/Field';
import list from '@admin/components/List.module.css';
import { PublishFailure } from '@admin/components/PublishFailure';
import { api, ApiError, type Publish, signedOut } from '@admin/lib/api';
import { changedFields, PARTIAL_DATE, readDraft, writeDraft } from '@admin/lib/edit';
import { errorBody, fieldList } from '@admin/lib/errors';
import { formatDay } from '@admin/lib/format';
import type { NewsItem, Publication } from '@admin/lib/types';
import { usePublish } from '@admin/lib/usePublish';
import styles from './news.module.css';
import { canDelete, useDeletePost } from '@admin/lib/deletePost';

/**
 * News 한 화면 (설계 문서 3장): 소식 목록(날짜 최신순), 추가·고치기·숨기기. 순서는 날짜로만 정합니다.
 * 칸: 날짜(모르면 공란), 소식 제목(국문 가능), 관련 논문 또는 근거 링크.
 */
const HIDE_BODY = '숨기면 공개 사이트의 뉴스에서 빠집니다. 원본은 남아 있어 다시 보이게 할 수 있습니다.';
const byDate = (a: NewsItem, b: NewsItem) => b.date.localeCompare(a.date);

export function NewsScreen() {
  const dialog = useDialog();
  const { publishing, track, settled } = usePublish();
  // Called after render only, so load is defined by then.
  const { remove, deleting } = useDeletePost(() => void load());
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [open, setOpen] = useState<string | null>(null); // 'new' 또는 소식 id
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [news, pubs] = await Promise.all([api.get<NewsItem[]>('/news'), api.get<Publication[]>('/publications')]);
      setItems([...news.data].sort(byDate));
      setPublications([...pubs.data].sort((a, b) => b.pub_date.localeCompare(a.pub_date)));
    } catch (err) {
      if (signedOut(err)) return;
      if (await dialog.error('불러오지 못했습니다', errorBody(err), { retry: true })) void load();
    }
  }, [dialog]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (settled) void load(); }, [settled]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!items) return <p className="admin-muted">불러오는 중입니다.</p>;

  const saved = (n: NewsItem, publish?: Publish) => {
    setItems((l) => l && [n, ...l.filter((x) => x.id !== n.id)].sort(byDate));
    track(n.id, publish);
  };
  /** 폼의 저장이 끝나면 그 폼만 닫습니다. 다른 줄의 숨기기가 끝나도 열려 있는 폼은 그대로 둡니다. */
  const savedForm = (key: string) => (n: NewsItem, publish?: Publish) => {
    saved(n, publish);
    setOpen((current) => (current === key ? null : current));
  };

  const setHidden = async (n: NewsItem, hidden: boolean) => {
    if (hidden && !(await dialog.confirm('소식을 숨길까요?', HIDE_BODY, '숨기기'))) return;
    setBusy(n.id);
    try {
      const res = await api.patch<NewsItem>(`/news/${n.id}`, { hidden, version: n.version });
      saved(res.data, res.publish);
    } catch (err) {
      if (signedOut(err)) return;
      await dialog.error('저장하지 못했습니다', errorBody(err));
      if (err instanceof ApiError && err.code === 'CONFLICT') void load();
    } finally { setBusy(null); }
  };

  const pubTitle = (id: string | null) => (id ? publications.find((p) => p.id === id)?.title : undefined);
  const locked = open !== null;

  return (
    <Section title="소식" aside={!locked && (
      <button type="button" className="admin-text-button" onClick={() => setOpen('new')}>소식 추가</button>
    )}>
      {open === 'new' && (
        <div className={list.open}>
          <h3 className="admin-form-title">새 소식</h3>
          <NewsForm publications={publications} onSaved={savedForm('new')} onCancel={() => setOpen(null)} onConflict={load} />
        </div>
      )}
      {items.length === 0 && open !== 'new' ? (
        <p className="admin-muted">아직 등록된 소식이 없습니다.</p>
      ) : (
        <ul className={list.list}>
          {items.map((n) => open === n.id ? (
            <li key={n.id} className={list.open}>
              <NewsForm item={n} publications={publications} onSaved={savedForm(n.id)} onCancel={() => setOpen(null)} onConflict={load} />
            </li>
          ) : (
            <li key={n.id} className={list.row}>
              <div className={list.main}>
                <p className={`${list.title} ${styles.text}`}>{n.text}</p>
                <p className={list.meta}>
                  <span className="num">{formatDay(n.date)}</span>
                  {pubTitle(n.publication_id) && <span>{pubTitle(n.publication_id)}</span>}
                </p>
                <PublishFailure publication={n.publication} pending={publishing(n.id)} />
              </div>
              <span className={list.status}>
                {publishing(n.id) || n.publication.state === 'publishing' ? '반영 중'
                  : n.publication.state === 'failed' ? '반영 실패' : n.hidden ? '숨김' : '공개 중'}
              </span>
              <span className={list.actions}>
                <button type="button" className="admin-text-button" disabled={locked || busy === n.id} onClick={() => setOpen(n.id)}>수정</button>
                <button type="button" className="admin-text-button" disabled={locked || busy === n.id} onClick={() => void setHidden(n, !n.hidden)}>{n.hidden ? '다시 보이기' : '숨기기'}</button>
                {canDelete(n, publishing(n.id)) && <button type="button" className="admin-text-button" disabled={deleting !== null || locked || busy === n.id}
                  onClick={() => void remove('news', n, '소식을 삭제할까요?')}>{deleting === n.id ? '삭제 중' : '삭제'}</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

type Draft = { date: string; text: string; publication_id: string; link_url: string };
const draftKey = (id?: string) => `sai-admin:news:${id ?? 'new'}`;
const LABELS: Record<string, string> = { date: '날짜', text: '소식 제목', publication_id: '관련 논문', link_url: '근거 링크' };

function NewsForm({ item, publications, onSaved, onCancel, onConflict }: {
  item?: NewsItem;
  publications: Publication[];
  onSaved: (n: NewsItem, publish?: Publish) => void;
  onCancel: () => void;
  onConflict: () => void;
}) {
  const dialog = useDialog();
  const form = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<Draft>(() => ({
    date: item?.date ?? '', text: item?.text ?? '', publication_id: item?.publication_id ?? '',
    link_url: item?.link_url ?? '', ...readDraft<Draft>(draftKey(item?.id)),
  }));
  const [saving, setSaving] = useState(false);

  const set = (change: Partial<Draft>) => setDraft((d) => {
    const next = { ...d, ...change };
    writeDraft(draftKey(item?.id), next);
    return next;
  });
  const cancel = () => { writeDraft(draftKey(item?.id), null); onCancel(); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const problems: [string, string][] = [];
    if (draft.date.trim() && !PARTIAL_DATE.test(draft.date.trim())) problems.push(['date', '날짜를 YYYY, YYYY-MM 또는 YYYY-MM-DD로 적어 주세요.']);
    if (!draft.text.trim()) problems.push(['text', '소식 제목을 적어 주세요.']);
    else if (draft.text.trim().length > 500 || /[\r\n]/.test(draft.text))
      problems.push(['text', '소식 제목은 줄바꿈 없이 500자 이내로 적어 주세요.']);
    if (draft.link_url && !/^(?:https?:\/\/\S+|\/\S+)$/.test(draft.link_url.trim()))
      problems.push(['link_url', '근거 링크는 https:// 주소 또는 사이트 내부 주소로 적어 주세요.']);
    if (problems.length > 0) {
      await dialog.error('저장하지 못했습니다', fieldList(problems.map(([, m]) => m)));
      focusField(form.current, problems.map(([k]) => k));
      return;
    }
    const body: Partial<NewsItem> = { date: draft.date.trim(), text: draft.text.trim(),
      publication_id: draft.publication_id || null, link_url: draft.link_url.trim() || null };
    setSaving(true);
    try {
      if (item) {
        const changed = changedFields(item, body);
        if (Object.keys(changed).length === 0) { cancel(); return; }
        const res = await api.patch<NewsItem>(`/news/${item.id}`, { ...changed, version: item.version });
        writeDraft(draftKey(item.id), null);
        onSaved(res.data, res.publish);
      } else {
        const res = await api.post<NewsItem>('/news', body);
        writeDraft(draftKey(), null);
        onSaved(res.data, res.publish);
      }
    } catch (err) {
      if (signedOut(err)) return;
      await dialog.error('저장하지 못했습니다', errorBody(err, LABELS));
      if (err instanceof ApiError) {
        if (err.code === 'CONFLICT') onConflict();
        focusField(form.current, Object.keys(err.fields));
      }
    } finally {
      setSaving(false);
    }
  };

  const shown = publications.filter((p) => !p.hidden || p.id === draft.publication_id);

  return (
    <form ref={form} className={`admin-form ${styles.form}`} onSubmit={submit} noValidate>
      <Field label="날짜" optional>
        <input name="date" inputMode="numeric" placeholder="YYYY, YYYY-MM, YYYY-MM-DD" value={draft.date} onChange={(e) => set({ date: e.target.value })} />
      </Field>
      <Field label="소식 제목" limit="한 줄, 500자 이내">
        <input name="text" value={draft.text} placeholder="2026 한국음성학회 학술대회 우수논문 발표상 수상 (박소영, 김선만)" onChange={(e) => set({ text: e.target.value })} />
      </Field>
      <Field label="관련 논문" optional>
        <select name="publication_id" value={draft.publication_id} onChange={(e) => set({ publication_id: e.target.value, link_url: '' })}>
          <option value="">없음</option>
          {shown.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </Field>
      <Field label="근거 링크" optional>
        <input name="link_url" type="url" value={draft.link_url}
          onChange={(e) => set({ link_url: e.target.value, publication_id: '' })} />
      </Field>
      <div className="admin-actions">
        <button type="submit" className="admin-button" disabled={saving}>{saving ? '저장 중' : '저장'}</button>
        <button type="button" className="admin-text-button" onClick={cancel} disabled={saving}>취소</button>
      </div>
    </form>
  );
}
