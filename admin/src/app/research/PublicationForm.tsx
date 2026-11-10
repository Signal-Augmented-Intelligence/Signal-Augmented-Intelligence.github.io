'use client';

import { type FormEvent, useRef, useState } from 'react';
import { useDialog } from '@admin/components/Dialog';
import { Field, focusField } from '@admin/components/Field';
import { FileUpload, type FileValue } from '@admin/components/FileUpload';
import { api, ApiError, type Publish, signedOut } from '@admin/lib/api';
import { overwriteOk, PARTIAL_DATE, readDraft, useEditBase, writeDraft } from '@admin/lib/edit';
import { errorBody, fieldList } from '@admin/lib/errors';
import type { Author, PickerPerson, Publication, PublicationType, ResearchArea, System } from '@admin/lib/types';
import styles from './research.module.css';

/**
 * 논문 올리기·고치기 폼 (설계 문서 2-2).
 * 저자: 멤버에서 고르고, 없으면 "외부 저자"로 이름을 적고, 위로·아래로로 순서를 정합니다.
 * 연구 분야: 이 논문이 들어갈 분야를 여기서 고릅니다(분야 쪽 "관련 논문"은 관리 서버가 맞춥니다).
 * 쓰던 내용은 브라우저에 임시 보관하고, 고치기는 바꾼 칸만 보냅니다.
 */
export const TYPES: { id: PublicationType; label: string }[] = [
  { id: 'journal', label: '저널' },
  { id: 'conference-paper', label: '학회 발표' },
  { id: 'conference-poster', label: '학회 포스터' },
  { id: 'other', label: '기타' },
];
const EXTERNAL = '__external';

type AuthorRow = { person: string; name: string }; // person: 멤버 id 또는 EXTERNAL
type Draft = {
  title: string; title_ko: string; type: PublicationType; authors: AuthorRow[]; venue: string; pub_date: string;
  status: string; award: string; links: { label: string; url: string }[]; area_ids: string[];
  pdf: FileValue | null; excerpt: string; body: string;
};

const toRow = (a: Author): AuthorRow => ('person_id' in a ? { person: a.person_id, name: '' } : { person: EXTERNAL, name: a.name });
const fromPublication = (p?: Publication): Draft => ({
  title: p?.title ?? '', title_ko: p?.title_ko ?? '', type: p?.type ?? 'journal',
  authors: p ? p.authors.map(toRow) : [{ person: '', name: '' }],
  venue: p?.venue ?? '', pub_date: p?.pub_date ?? '', status: p?.status ?? '', award: p?.award ?? '',
  links: p?.links ?? [], area_ids: p?.area_ids ?? [],
  pdf: p?.pdf_file_id ? { id: p.pdf_file_id, name: '논문 PDF', size: null, preview_url: null,
    content_url: p.pdf_content_url, warnings: [] } : null,
  excerpt: p?.excerpt ?? '', body: p?.body ?? '',
});
const draftKey = (id?: string) => `sai-admin:publication:${id ?? 'new'}`;

const LABELS: Record<string, string> = {
  title: '제목', title_ko: '국문 제목', type: '구분', authors: '저자', venue: '학회·저널', pub_date: '발표일',
  status: '진행 상태', award: '수상', links: '링크', area_ids: '연구 분야', pdf_file_id: 'PDF',
};
const MB = 1024 * 1024;

export function PublicationForm({ publication, people, areas, system, onSaved, onCancel, onConflict }: {
  publication?: Publication;
  people: PickerPerson[];
  areas: ResearchArea[];
  system: System;
  onSaved: (p: Publication, publish?: Publish) => void;
  onCancel: () => void;
  onConflict: () => void;
}) {
  const dialog = useDialog();
  const edit = useEditBase(publication);
  const form = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<Draft>(() => ({ ...fromPublication(publication),
    ...readDraft<Draft>(draftKey(publication?.id)) }));
  const [saving, setSaving] = useState(false);
  const pending = useRef<Promise<FileValue | null> | null>(null);

  const set = (change: Partial<Draft>) => setDraft((d) => {
    const next = { ...d, ...change };
    writeDraft(draftKey(publication?.id), next);
    return next;
  });
  const cancel = () => { writeDraft(draftKey(publication?.id), null); onCancel(); };

  const setAuthor = (i: number, change: Partial<AuthorRow>) => set({ authors: draft.authors.map((a, j) => (j === i ? { ...a, ...change } : a)) });
  const moveAuthor = (i: number, by: -1 | 1) => {
    const next = [...draft.authors];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    set({ authors: next });
  };
  const setLink = (i: number, change: Partial<{ label: string; url: string }>) => set({ links: draft.links.map((l, j) => (j === i ? { ...l, ...change } : l)) });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const authors = draft.authors.filter((a) => a.person && (a.person !== EXTERNAL || a.name.trim()));
    const links = draft.links.map((l) => ({ label: l.label.trim(), url: l.url.trim() })).filter((l) => l.label || l.url);
    const problems: [string, string][] = [];
    if (!draft.title.trim()) problems.push(['title', '제목을 적어 주세요.']);
    if (authors.length === 0) problems.push(['author-0', '저자를 한 명 이상 골라 주세요.']);
    if (!draft.venue.trim()) problems.push(['venue', '학회·저널을 적어 주세요.']);
    if (!PARTIAL_DATE.test(draft.pub_date.trim())) problems.push(['pub_date', '발표일을 YYYY, YYYY-MM 또는 YYYY-MM-DD로 적어 주세요.']);
    if (links.some((l) => !l.label || !/^https?:\/\/\S+$/.test(l.url))) problems.push(['links', '링크마다 이름과 http(s):// 주소를 함께 적어 주세요.']);
    if (problems.length > 0) {
      await dialog.error('저장하지 못했습니다', fieldList(problems.map(([, m]) => m)));
      focusField(form.current, problems.map(([k]) => k));
      return;
    }

    setSaving(true);
    try {
      const wait = pending.current;
      const done = wait ? await wait : null;
      if (wait && !done) return;
      const pdf = wait ? done : draft.pdf;
      const body: Partial<Publication> = {
        title: draft.title.trim(), title_ko: draft.title_ko.trim(), type: draft.type,
        authors: authors.map((a): Author => (a.person === EXTERNAL ? { name: a.name.trim() } : { person_id: a.person })),
        venue: draft.venue.trim(), pub_date: draft.pub_date.trim(), status: draft.status.trim(), award: draft.award.trim(),
        links, area_ids: draft.area_ids, pdf_file_id: pdf?.id ?? null,
        excerpt: draft.excerpt.trim(), body: draft.body.trim(),
      };
      if (publication) {
        const changed = edit.changes(body);
        if (Object.keys(changed).length === 0) { cancel(); return; }
        if (!(await overwriteOk(dialog, edit.clashes(changed)))) return;
        const res = await api.patch<Publication>(`/publications/${publication.id}`, edit.request(changed, publication.version));
        writeDraft(draftKey(publication.id), null);
        onSaved(res.data, res.publish);
      } else {
        const res = await api.post<Publication>('/publications', body);
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

  const shownAreas = areas.filter((a) => !a.hidden || draft.area_ids.includes(a.id));

  return (
    <form ref={form} className={`admin-form ${styles.form}`} onSubmit={submit} noValidate>
      <Field label="제목">
        <input name="title" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <Field label="국문 제목" optional>
        <input name="title_ko" value={draft.title_ko} onChange={(e) => set({ title_ko: e.target.value })} />
      </Field>
      <Field label="구분">
        <select name="type" value={draft.type} onChange={(e) => set({ type: e.target.value as PublicationType })}>
          {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </Field>

      <fieldset className={styles.group}>
        <legend>저자</legend>
        <ol className={styles.rows}>
          {draft.authors.map((a, i) => (
            <li key={i} className={styles.authorRow}>
              <span className={`${styles.order} num`}>{i + 1}</span>
              <select name={`author-${i}`} aria-label={`저자 ${i + 1}`} value={a.person} onChange={(e) => setAuthor(i, { person: e.target.value })}>
                <option value="" disabled>고르기</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name_ko ? `${p.name} (${p.name_ko})` : p.name}</option>)}
                <option value={EXTERNAL}>외부 저자</option>
              </select>
              {a.person === EXTERNAL && (
                <input aria-label={`저자 ${i + 1} 이름`} value={a.name} onChange={(e) => setAuthor(i, { name: e.target.value })} />
              )}
              <span className={styles.rowActions}>
                <button type="button" className="admin-text-button" disabled={i === 0} onClick={() => moveAuthor(i, -1)}>위로</button>
                <button type="button" className="admin-text-button" disabled={i === draft.authors.length - 1} onClick={() => moveAuthor(i, 1)}>아래로</button>
                <button type="button" className="admin-text-button" disabled={draft.authors.length === 1} onClick={() => set({ authors: draft.authors.filter((_, j) => j !== i) })}>빼기</button>
              </span>
            </li>
          ))}
        </ol>
        <button type="button" className="admin-text-button" onClick={() => set({ authors: [...draft.authors, { person: '', name: '' }] })}>저자 추가</button>
      </fieldset>

      <Field label="학회·저널">
        <input name="venue" value={draft.venue} onChange={(e) => set({ venue: e.target.value })} />
      </Field>
      <Field label="발표일">
        <input name="pub_date" inputMode="numeric" placeholder="YYYY, YYYY-MM, YYYY-MM-DD" value={draft.pub_date} onChange={(e) => set({ pub_date: e.target.value })} />
      </Field>
      <Field label="진행 상태" optional>
        <input name="status" value={draft.status} onChange={(e) => set({ status: e.target.value })} />
      </Field>
      <Field label="수상" optional>
        <input name="award" value={draft.award} onChange={(e) => set({ award: e.target.value })} />
      </Field>
      <Field label="짧은 설명" optional>
        <input name="excerpt" value={draft.excerpt} onChange={(e) => set({ excerpt: e.target.value })} />
      </Field>
      <Field label="본문" optional>
        <textarea name="body" value={draft.body} onChange={(e) => set({ body: e.target.value })} />
      </Field>
      {system.storage.connected && <Field label="PDF" optional limit={`${system.limits.seminar_pdf_upload_mb} MB 이하`} group>
        <FileUpload name="pdf" label="PDF" purpose="publication_pdf" accept="application/pdf" maxBytes={system.limits.seminar_pdf_upload_mb * MB}
          tooLarge={`PDF가 ${system.limits.seminar_pdf_upload_mb} MB를 넘습니다.`} value={draft.pdf}
          onChange={(pdf) => set({ pdf })} onPending={(p) => { pending.current = p; }} />
      </Field>}

      <fieldset className={styles.group}>
        <legend>링크 <small>(선택)</small></legend>
        {draft.links.length > 0 && (
          <ol className={styles.rows}>
            {draft.links.map((l, i) => (
              <li key={i} className={styles.linkRow}>
                <input name={i === 0 ? 'links' : undefined} aria-label={`링크 ${i + 1} 이름`} placeholder="DOI" value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} />
                <input type="url" aria-label={`링크 ${i + 1} 주소`} placeholder="https://" value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} />
                <button type="button" className="admin-text-button" onClick={() => set({ links: draft.links.filter((_, j) => j !== i) })}>빼기</button>
              </li>
            ))}
          </ol>
        )}
        <button type="button" className="admin-text-button" onClick={() => set({ links: [...draft.links, { label: '', url: '' }] })}>링크 추가</button>
      </fieldset>

      {shownAreas.length > 0 && (
        <fieldset className={styles.group}>
          <legend>연구 분야 <small>(선택)</small></legend>
          <div className={styles.checks}>
            {shownAreas.map((a) => (
              <label key={a.id} className="admin-check">
                <input type="checkbox" checked={draft.area_ids.includes(a.id)}
                  onChange={(e) => set({ area_ids: e.target.checked ? [...draft.area_ids, a.id] : draft.area_ids.filter((x) => x !== a.id) })} />
                {a.title}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="admin-actions">
        <button type="submit" className="admin-button" disabled={saving}>{saving ? '저장 중' : '저장'}</button>
        <button type="button" className="admin-text-button" onClick={cancel} disabled={saving}>취소</button>
      </div>
    </form>
  );
}
