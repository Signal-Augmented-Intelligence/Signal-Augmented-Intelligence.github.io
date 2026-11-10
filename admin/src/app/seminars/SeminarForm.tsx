'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useDialog } from '@admin/components/Dialog';
import { Field, focusField } from '@admin/components/Field';
import { FileUpload, type FileValue } from '@admin/components/FileUpload';
import { api, ApiError, type Publish, signedOut } from '@admin/lib/api';
import { overwriteOk, useEditBase } from '@admin/lib/edit';
import { errorBody, fieldList } from '@admin/lib/errors';
import { getFile } from '@admin/lib/files';
import type { Presenter, Seminar } from '@admin/lib/types';
import type { Loaded } from './SeminarsScreen';
import styles from './seminars.module.css';

/**
 * 세미나 올리기·고치기 폼 (세미나 업로드 설계 5장). 목록 맨 위(올리기) 또는 그 줄 자리(고치기)에서 펼쳐집니다.
 * 쓰던 내용은 브라우저에 임시 보관하고, 저장하거나 취소하면 지웁니다.
 * 파일이 올라가는 중에 저장을 누르면 버튼이 "저장 중"이 되고, 파일이 준비되면 이어서 저장합니다.
 * 고치기는 바꾼 칸만 보냅니다(api.md 1장 PATCH). 파일 칸도 바꾸지 않았으면 보내지 않아서, 붙어 있던 파일은 그대로 남습니다.
 * 파일 칸: 그대로(보내지 않음) / 새 파일(새 id) / 빼기(null).
 */
const EXTERNAL = '__external';

type Draft = {
  date: string;
  presenter: string; // 멤버 id 또는 EXTERNAL
  external: string;
  title: string;
  summary: string;
  area: string;
  pdf: FileValue | null;
  cover: FileValue | null;
};

const LABELS: Record<string, string> = {
  date: '세미나 날짜', presenter: '발표자', external: '외부 발표자 이름', title: '제목', summary: '개요',
  area_id: '분야', pdf_file_id: 'PDF', cover_file_id: '표지',
};
const EMPTY: Record<string, string> = {
  date: '세미나 날짜를 넣어 주세요.', presenter: '발표자를 골라 주세요.', external: '외부 발표자 이름을 적어 주세요.',
  title: '제목을 적어 주세요.', summary: '개요를 적어 주세요.',
};
const system0 = (l: Loaded) => l.system.storage.connected;
const FIELD_NAME: Record<string, string> = { area_id: 'area', pdf_file_id: 'pdf', cover_file_id: 'cover' };

const draftKey = (id?: string) => `sai-admin:seminar:${id ?? 'new'}`;
function readDraft(id?: string): Draft | null {
  try { const raw = localStorage.getItem(draftKey(id)); return raw ? JSON.parse(raw) as Draft : null; } catch { return null; }
}
function writeDraft(id: string | undefined, draft: Draft | null) {
  try { if (draft) localStorage.setItem(draftKey(id), JSON.stringify(draft)); else localStorage.removeItem(draftKey(id)); } catch { /* 보관 못 해도 폼은 그대로 */ }
}

function fromSeminar(s?: Seminar): Draft {
  if (!s) return { date: '', presenter: '', external: '', title: '', summary: '', area: '', pdf: null, cover: null };
  const external = 'name' in s.presenter;
  return {
    date: s.date,
    presenter: external ? EXTERNAL : (s.presenter as { person_id: string }).person_id,
    external: external ? (s.presenter as { name: string }).name : '',
    title: s.title,
    summary: s.summary,
    area: s.area_id ?? '',
    pdf: null,
    cover: null,
  };
}

/** 고치기: 원래 값과 다른 칸만 (발표자처럼 객체인 칸은 내용으로 비교). */
function changedFields(seminar: Seminar, body: Partial<Seminar>): Partial<Seminar> {
  return Object.fromEntries(Object.entries(body).filter(([k, v]) =>
    JSON.stringify(v) !== JSON.stringify(seminar[k as keyof Seminar] ?? null)));
}

const toFileValue = (f: Awaited<ReturnType<typeof getFile>>): FileValue =>
  ({ id: f.id, name: f.original_name, size: f.public_size_bytes ?? null, preview_url: f.preview_url, warnings: [] });

export function SeminarForm({ loaded, seminar, onSaved, onCancel, onConflict }: {
  loaded: Loaded;
  seminar?: Seminar;
  onSaved: (s: Seminar, publish?: Publish) => void;
  onCancel: () => void;
  onConflict: () => void;
}) {
  const dialog = useDialog();
  const edit = useEditBase(seminar, changedFields);
  const form = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<Draft>(() => readDraft(seminar?.id) ?? fromSeminar(seminar));
  // ready: 파일 칸을 씀. keep: 파일 칸을 쓸 수 없어(저장소 없음, 정보 못 불러옴) 붙어 있던 파일을 그대로 둠.
  const [files, setFiles] = useState<'loading' | 'ready' | 'keep'>(() =>
    !system0(loaded) ? 'keep' : !seminar || !!readDraft(seminar.id) || (!seminar.pdf_file_id && !seminar.cover_file_id) ? 'ready' : 'loading');
  const [saving, setSaving] = useState(false);
  const pending = useRef<{ pdf: Promise<FileValue | null> | null; cover: Promise<FileValue | null> | null }>({ pdf: null, cover: null });
  const { system, people, areas } = loaded;
  const MB = 1024 * 1024;

  // 고치기: 이미 붙은 파일의 이름·크기·미리보기를 불러옵니다.
  useEffect(() => {
    if (files !== 'loading' || !seminar) return;
    Promise.all([
      seminar.pdf_file_id ? getFile(seminar.pdf_file_id).then(toFileValue) : null,
      seminar.cover_file_id ? getFile(seminar.cover_file_id).then(toFileValue) : null,
    ]).then(([pdf, cover]) => { setDraft((d) => ({ ...d, pdf, cover })); setFiles('ready'); })
      .catch(() => setFiles('keep'));
  }, [files, seminar]);

  const set = (change: Partial<Draft>) => setDraft((d) => {
    const next = { ...d, ...change };
    writeDraft(seminar?.id, next);
    return next;
  });

  const cancel = () => { writeDraft(seminar?.id, null); onCancel(); };

  const missing = (d: Draft) => [
    !d.date && 'date', !d.presenter && 'presenter', d.presenter === EXTERNAL && !d.external.trim() && 'external',
    !d.title.trim() && 'title', !d.summary.trim() && 'summary',
  ].filter((x): x is string => !!x);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const empty = missing(draft);
    if (empty.length > 0) {
      await dialog.error('저장하지 못했습니다', fieldList(empty.map((k) => EMPTY[k])));
      focusField(form.current, empty);
      return;
    }

    setSaving(true);
    try {
      // 올라가는 중인 파일을 기다립니다. 실패한 파일은 칸이 비고 오류 팝업이 이미 떴으므로 저장을 멈춥니다.
      const [pdfWait, coverWait] = [pending.current.pdf, pending.current.cover];
      const [pdfDone, coverDone] = await Promise.all([pdfWait, coverWait]);
      if ((pdfWait && !pdfDone) || (coverWait && !coverDone)) return;
      const pdf = pdfWait ? pdfDone : draft.pdf;
      const cover = pdf ? (coverWait ? coverDone : draft.cover) : null;
      const keep = files === 'keep';

      const warnings = [...(pdf?.warnings ?? []), ...(cover?.warnings ?? [])];
      if (warnings.length > 0 && !(await dialog.confirm('이대로 올릴까요?', fieldList(warnings), '올리기'))) return;

      const presenter: Presenter = draft.presenter === EXTERNAL ? { name: draft.external.trim() } : { person_id: draft.presenter };
      const body: Partial<Seminar> = {
        date: draft.date, presenter, title: draft.title.trim(), summary: draft.summary.trim(),
        area_id: draft.area || null,
        ...(keep ? {} : { pdf_file_id: pdf?.id ?? null, cover_file_id: cover?.id ?? null }),
      };
      if (seminar) {
        const changed = edit.changes(body);
        if (Object.keys(changed).length === 0) { cancel(); return; }
        if (!(await overwriteOk(dialog, edit.clashes(changed)))) return;
        const res = await api.patch<Seminar>(`/seminars/${seminar.id}`, edit.request(changed, seminar.version));
        writeDraft(seminar.id, null);
        onSaved(res.data, res.publish);
        return;
      }
      const res = await api.post<Seminar>('/seminars', body);
      writeDraft(undefined, null);
      onSaved(res.data, res.publish);
    } catch (err) {
      if (signedOut(err)) return;
      await dialog.error('저장하지 못했습니다', errorBody(err, LABELS));
      if (err instanceof ApiError) {
        if (err.code === 'CONFLICT') onConflict();
        focusField(form.current, Object.keys(err.fields).map((k) => FIELD_NAME[k] ?? k));
      }
    } finally {
      setSaving(false);
    }
  };

  const shownAreas = areas.filter((a) => !a.hidden || a.id === draft.area);

  return (
    <form ref={form} className={`admin-form ${styles.form}`} onSubmit={submit} noValidate>
      <Field label="세미나 날짜">
        <input type="date" name="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} />
      </Field>
      <Field label="발표자">
        <select name="presenter" value={draft.presenter} onChange={(e) => set({ presenter: e.target.value })}>
          <option value="" disabled>고르기</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name_ko ? `${p.name_ko} (${p.name})` : p.name}</option>)}
          <option value={EXTERNAL}>외부 발표자</option>
        </select>
      </Field>
      {draft.presenter === EXTERNAL && (
        <Field label="외부 발표자 이름">
          <input name="external" value={draft.external} onChange={(e) => set({ external: e.target.value })} />
        </Field>
      )}
      <Field label="제목">
        <input name="title" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <Field label="개요" limit="한 문장">
        <input name="summary" value={draft.summary} onChange={(e) => set({ summary: e.target.value })} />
      </Field>
      <Field label="분야" optional>
        <select name="area" value={draft.area} onChange={(e) => set({ area: e.target.value })}>
          <option value="">없음</option>
          {shownAreas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>

      {!system.storage.connected ? (
        <p className="admin-muted">원본 파일 저장소가 연결되어 있지 않습니다.</p>
      ) : files === 'keep' ? (
        <p className="admin-muted">파일 정보를 불러오지 못했습니다.</p>
      ) : files === 'loading' ? (
        <p className="admin-muted">불러오는 중입니다.</p>
      ) : (
        <>
          <Field label="PDF" optional limit={`${system.limits.seminar_pdf_upload_mb} MB 이하`} group>
            <FileUpload
              name="pdf" label="PDF" purpose="seminar_pdf" accept="application/pdf"
              maxBytes={system.limits.seminar_pdf_upload_mb * MB}
              tooLarge={`PDF가 ${system.limits.seminar_pdf_upload_mb} MB를 넘습니다.`}
              value={draft.pdf}
              onChange={(pdf) => set(pdf ? { pdf } : { pdf: null, cover: null })}
              onPending={(p) => { pending.current.pdf = p; }}
            />
          </Field>
          {draft.pdf && (
            <Field label="표지" optional group>
              <FileUpload
                name="cover" label="표지" purpose="seminar_cover" accept={system.limits.photo_types.join(',')}
                maxBytes={system.limits.photo_mb * MB}
                tooLarge={`표지 이미지가 ${system.limits.photo_mb} MB를 넘습니다.`}
                value={draft.cover}
                onChange={(cover) => set({ cover })}
                onPending={(p) => { pending.current.cover = p; }}
              />
            </Field>
          )}
        </>
      )}

      <div className="admin-actions">
        <button type="submit" className="admin-button" disabled={saving}>{saving ? '저장 중' : '저장'}</button>
        <button type="button" className="admin-text-button" onClick={cancel} disabled={saving}>취소</button>
      </div>
    </form>
  );
}
