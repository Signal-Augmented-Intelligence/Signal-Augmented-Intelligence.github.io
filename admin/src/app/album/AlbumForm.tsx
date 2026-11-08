'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useDialog } from '@admin/components/Dialog';
import { Field, focusField } from '@admin/components/Field';
import { api, ApiError, type Publish, signedOut } from '@admin/lib/api';
import { errorBody, fieldList } from '@admin/lib/errors';
import type { Album } from '@admin/lib/types';

/**
 * 행사 정보 폼: 날짜, 행사 이름 (api.md 6장). 날짜를 모르면 "월까지만"으로 연·월만 적습니다.
 * 쓰던 내용은 브라우저에 임시 보관하고, 저장하거나 취소하면 지웁니다. 고치기는 바꾼 칸만 보냅니다.
 *
 * - 새 행사(album 없음): "저장하고 사진 올리기" + "취소". 저장하면 화면이 그 행사를 펼쳐 사진 칸을 보여 줍니다.
 * - 펼친 행사 안(album 있음): "저장"만 둡니다. 바꾼 칸이 없으면 누를 수 없습니다. 닫기는 펼친 행사의 "접기"가 맡습니다
 *   (사진은 누르는 즉시 저장되므로, 폼에 "취소"를 두면 사진도 취소되는 것처럼 읽히기 때문입니다).
 *   바꾸고 저장하지 않은 칸이 있는지는 onDirty로 알립니다.
 */
type Draft = { date: string; monthOnly: boolean; title: string };

const LABELS: Record<string, string> = { date: '날짜', title: '행사 이름' };
const EMPTY: Record<string, string> = { date: '날짜를 넣어 주세요.', title: '행사 이름을 적어 주세요.' };

const draftKey = (id?: string) => `sai-admin:album:${id ?? 'new'}`;
function readDraft(id?: string): Draft | null {
  try { const raw = localStorage.getItem(draftKey(id)); return raw ? JSON.parse(raw) as Draft : null; } catch { return null; }
}
function writeDraft(id: string | undefined, draft: Draft | null) {
  try { if (draft) localStorage.setItem(draftKey(id), JSON.stringify(draft)); else localStorage.removeItem(draftKey(id)); } catch { /* 보관 못 해도 폼은 그대로 */ }
}

/** 펼친 행사를 저장하지 않고 접을 때, 임시 보관한 행사 정보를 지웁니다. */
export function clearAlbumDraft(id: string) {
  writeDraft(id, null);
}

const fromAlbum = (a?: Album): Draft => a ? { date: a.date, monthOnly: a.date.length === 7, title: a.title } : { date: '', monthOnly: false, title: '' };

export function AlbumForm({ album, onSaved, onCancel, onConflict, onDirty }: {
  album?: Album;
  onSaved: (a: Album, publish?: Publish) => void;
  /** 새 행사 폼의 "취소". 펼친 행사 안에서는 쓰지 않습니다. */
  onCancel?: () => void;
  onConflict: () => void;
  onDirty?: (dirty: boolean) => void;
}) {
  const dialog = useDialog();
  const form = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<Draft>(() => readDraft(album?.id) ?? fromAlbum(album));
  const [saving, setSaving] = useState(false);

  const set = (change: Partial<Draft>) => setDraft((d) => {
    const next = { ...d, ...change };
    writeDraft(album?.id, next);
    return next;
  });

  // 월까지만으로 바꾸면 날짜 칸 값을 YYYY-MM으로, 되돌리면 비웁니다(일을 짐작해 넣지 않음).
  const toggleMonth = (monthOnly: boolean) => set({ monthOnly, date: monthOnly ? draft.date.slice(0, 7) : draft.date.length === 10 ? draft.date : '' });

  const cancel = () => { writeDraft(album?.id, null); onCancel?.(); };

  const dirty = !!album && (draft.date !== album.date || draft.title.trim() !== album.title);
  useEffect(() => { onDirty?.(dirty); }, [dirty, onDirty]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const empty = [!draft.date && 'date', !draft.title.trim() && 'title'].filter((x): x is string => !!x);
    if (empty.length > 0) {
      await dialog.error('저장하지 못했습니다', fieldList(empty.map((k) => EMPTY[k])));
      focusField(form.current, empty);
      return;
    }
    const body = { date: draft.date, title: draft.title.trim() };
    setSaving(true);
    try {
      if (album) {
        const changed = Object.fromEntries(Object.entries(body).filter(([k, v]) => album[k as keyof typeof body] !== v));
        if (Object.keys(changed).length === 0) return;
        const res = await api.patch<Album>(`/albums/${album.id}`, { ...changed, version: album.version });
        writeDraft(album.id, null);
        setDraft(fromAlbum(res.data));
        onSaved(res.data, res.publish);
      } else {
        const res = await api.post<Album>('/albums', body);
        writeDraft(undefined, null);
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
    <form ref={form} className="admin-form" onSubmit={submit} noValidate>
      <Field label="날짜">
        <input type={draft.monthOnly ? 'month' : 'date'} name="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} />
      </Field>
      <label className="admin-check">
        <input type="checkbox" checked={draft.monthOnly} onChange={(e) => toggleMonth(e.target.checked)} />
        월까지만
      </label>
      <Field label="행사 이름">
        <input name="title" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <div className="admin-actions">
        {album ? (
          <button type="submit" className="admin-button" disabled={saving || !dirty}>{saving ? '저장 중' : '저장'}</button>
        ) : (
          <>
            <button type="submit" className="admin-button" disabled={saving}>{saving ? '저장 중' : '저장하고 사진 올리기'}</button>
            <button type="button" className="admin-text-button" onClick={cancel} disabled={saving}>취소</button>
          </>
        )}
      </div>
    </form>
  );
}
