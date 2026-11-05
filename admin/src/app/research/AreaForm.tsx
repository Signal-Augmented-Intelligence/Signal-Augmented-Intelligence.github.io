'use client';

import { type FormEvent, useRef, useState } from 'react';
import { useDialog } from '@admin/components/Dialog';
import { Field, focusField } from '@admin/components/Field';
import { FileUpload, type FileValue } from '@admin/components/FileUpload';
import { api, ApiError, type Publish, signedOut } from '@admin/lib/api';
import { changedFields, readDraft, writeDraft } from '@admin/lib/edit';
import { errorBody, fieldList } from '@admin/lib/errors';
import type { ResearchArea, System } from '@admin/lib/types';
import styles from './research.module.css';

/**
 * 연구 분야 추가·고치기 폼 (설계 문서 2-1): 제목, 요약, 본문, 대표 그림(설명·출처).
 * 관련 논문은 여기서 고르지 않고 논문 폼의 "연구 분야"에서 고릅니다.
 * 그림 칸은 그대로면 보내지 않고, 새 그림이면 새 id, 빼기면 null을 보냅니다.
 */
type Draft = { title: string; summary: string; body: string; figure: FileValue | null; figure_alt: string; figure_caption: string };

const fromArea = (a?: ResearchArea): Draft => ({
  title: a?.title ?? '', summary: a?.summary ?? '', body: a?.body ?? '',
  figure: a?.figure_file_id ? { id: a.figure_file_id, name: '대표 그림', size: null, preview_url: a.figure_preview_url, warnings: [] } : null,
  figure_alt: a?.figure_alt ?? '', figure_caption: a?.figure_caption ?? '',
});
const draftKey = (id?: string) => `sai-admin:research-area:${id ?? 'new'}`;
const LABELS: Record<string, string> = { title: '제목', summary: '요약', body: '본문', figure_file_id: '대표 그림', figure_alt: '그림 설명', figure_caption: '그림 출처' };
const MB = 1024 * 1024;

export function AreaForm({ area, system, onSaved, onCancel, onConflict }: {
  area?: ResearchArea;
  system: System;
  onSaved: (a: ResearchArea, publish?: Publish) => void;
  onCancel: () => void;
  onConflict: () => void;
}) {
  const dialog = useDialog();
  const form = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<Draft>(() => ({ ...fromArea(area), ...readDraft<Draft>(draftKey(area?.id)) }));
  const [saving, setSaving] = useState(false);
  const pending = useRef<Promise<FileValue | null> | null>(null);

  const set = (change: Partial<Draft>) => setDraft((d) => {
    const next = { ...d, ...change };
    writeDraft(draftKey(area?.id), next);
    return next;
  });
  const cancel = () => { writeDraft(draftKey(area?.id), null); onCancel(); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const empty = [!draft.title.trim() && 'title', !draft.summary.trim() && 'summary'].filter((x): x is string => !!x);
    if (empty.length > 0) {
      await dialog.error('저장하지 못했습니다', fieldList(empty.map((k) => `${LABELS[k]}을(를) 적어 주세요.`)));
      focusField(form.current, empty);
      return;
    }
    setSaving(true);
    try {
      const wait = pending.current;
      const done = wait ? await wait : null;
      if (wait && !done) return; // 그림 올리기 실패: 팝업이 이미 떴습니다.
      const figure = wait ? done : draft.figure;
      if (figure && !draft.figure_alt.trim()) {
        await dialog.error('저장하지 못했습니다', '그림 설명을 적어 주세요.');
        focusField(form.current, ['figure_alt']);
        return;
      }
      const body: Partial<ResearchArea> = {
        title: draft.title.trim(), summary: draft.summary.trim(), body: draft.body.trim(),
        figure_file_id: figure?.id ?? null, figure_alt: figure ? draft.figure_alt.trim() : '',
        figure_caption: figure ? draft.figure_caption.trim() : '',
      };
      if (area) {
        const changed = changedFields(area, body);
        if (Object.keys(changed).length === 0) { cancel(); return; }
        const res = await api.patch<ResearchArea>(`/research-areas/${area.id}`, { ...changed, version: area.version });
        writeDraft(draftKey(area.id), null);
        onSaved(res.data, res.publish);
      } else {
        const res = await api.post<ResearchArea>('/research-areas', body);
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

  return (
    <form ref={form} className={`admin-form ${styles.form}`} onSubmit={submit} noValidate>
      <Field label="제목">
        <input name="title" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <Field label="요약" limit="한 문장">
        <input name="summary" value={draft.summary} onChange={(e) => set({ summary: e.target.value })} />
      </Field>
      <Field label="본문" optional>
        <textarea name="body" value={draft.body} onChange={(e) => set({ body: e.target.value })} />
      </Field>
      {system.storage.connected ? (
        <Field label="대표 그림" optional limit={`${system.limits.photo_mb} MB 이하`} group>
          <FileUpload
            name="figure" label="대표 그림" purpose="research_figure" accept={system.limits.photo_types.join(',')}
            maxBytes={system.limits.photo_mb * MB} tooLarge={`그림이 ${system.limits.photo_mb} MB를 넘습니다.`}
            value={draft.figure} onChange={(figure) => set({ figure })}
            onPending={(p) => { pending.current = p; }}
          />
        </Field>
      ) : <p className="admin-muted">원본 파일 저장소가 연결되어 있지 않습니다.</p>}
      {draft.figure && (
        <>
          <Field label="그림 설명">
            <input name="figure_alt" value={draft.figure_alt} onChange={(e) => set({ figure_alt: e.target.value })} />
          </Field>
          <Field label="그림 출처" optional>
            <input name="figure_caption" value={draft.figure_caption} onChange={(e) => set({ figure_caption: e.target.value })} />
          </Field>
        </>
      )}
      <div className="admin-actions">
        <button type="submit" className="admin-button" disabled={saving}>{saving ? '저장 중' : '저장'}</button>
        <button type="button" className="admin-text-button" onClick={cancel} disabled={saving}>취소</button>
      </div>
    </form>
  );
}
