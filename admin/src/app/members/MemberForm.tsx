'use client';

import { type FormEvent, useRef, useState } from 'react';
import { useDialog } from '@admin/components/Dialog';
import { Field, FilePicker, focusField } from '@admin/components/Field';
import { api, ApiError, type Publish, signedOut } from '@admin/lib/api';
import { errorBody, fieldList } from '@admin/lib/errors';
import { uploadFile, uploadingLabel } from '@admin/lib/files';
import type { Member, MemberGroup, System } from '@admin/lib/types';
import styles from './members.module.css';

/** The role is not edited on screen: it follows 구분 and is sent so the server's role field stays filled. */
const ROLES: Record<Exclude<MemberGroup, 'faculty'>, string> = {
  phd: 'Ph.D. Student', ms: 'M.S. Student', undergrad: 'Undergraduate Researcher', alumni: 'Alumni',
};
const GROUPS = [
  ['phd', 'Ph.D. Students'], ['ms', 'M.S. Students'],
  ['undergrad', 'Undergraduate Researchers'], ['alumni', 'Alumni'],
] as const;

type Draft = {
  name: string; name_ko: string; group: Exclude<MemberGroup, 'faculty'>;
  since: string; until: string; bio: string; bio_en: string; url: string; after: string; aliases: string;
};
const fromMember = (member?: Member): Draft => ({
  name: member?.name ?? '', name_ko: member?.name_ko ?? '',
  group: member?.group === 'faculty' ? 'undergrad' : member?.group ?? 'undergrad',
  since: member?.since ?? '', until: member?.until ?? '',
  bio: member?.bio ?? '', bio_en: member?.bio_en ?? '', url: member?.url ?? '', after: member?.after ?? '',
  aliases: member?.aliases.join(', ') ?? '',
});

export function MemberForm({ member, system, onSaved, onCancel, onConflict }: {
  member?: Member; system: System;
  onSaved: (member: Member, publish?: Publish) => void;
  onCancel: () => void; onConflict: () => void;
}) {
  const dialog = useDialog();
  const form = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState(() => fromMember(member));
  const [photo, setPhoto] = useState<File | null>(null);
  const [readyPhoto, setReadyPhoto] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const set = (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const missing = [!draft.name.trim() && 'name', !draft.name_ko.trim() && 'name_ko',
      !member && !consent && 'consent'].filter((x): x is string => !!x);
    if (missing.length) {
      await dialog.error('저장하지 못했습니다', fieldList(missing.map((field) => ({
        name: '영문 이름', name_ko: '국문 이름', consent: '공개 동의 확인',
      })[field] + '을(를) 확인해 주세요.')));
      focusField(form.current, missing);
      return;
    }
    if (!/^[\x20-\x7e]+$/.test(draft.name.trim()) || !/[a-z]/i.test(draft.name)) {
      await dialog.error('저장하지 못했습니다', '영문 이름을 로마자로 적어 주세요.');
      focusField(form.current, ['name']);
      return;
    }
    if (draft.url && !/^https?:\/\/\S+$/.test(draft.url.trim())) {
      await dialog.error('저장하지 못했습니다', 'Website 주소를 http:// 또는 https://로 시작해 주세요.');
      focusField(form.current, ['url']);
      return;
    }
    const invalidDate = (['since', 'until'] as const).find((key) =>
      draft[key] && !/^\d{4}-\d{2}(?:-\d{2})?$/.test(draft[key].trim()));
    if (invalidDate) {
      await dialog.error('저장하지 못했습니다', '날짜는 YYYY-MM 또는 YYYY-MM-DD 형식으로 적어 주세요.');
      focusField(form.current, [invalidDate]);
      return;
    }
    setSaving(true);
    try {
      let photoId = readyPhoto;
      if (photo && !photoId) {
        if (photo.size > system.limits.photo_mb * 1024 * 1024) throw new Error(`사진이 ${system.limits.photo_mb} MB를 넘습니다.`);
        if (photo.type && !system.limits.photo_types.includes(photo.type)) throw new Error('지원하지 않는 사진 형식입니다.');
        const uploaded = await uploadFile(photo, 'person',
          (percent) => setProgress(`사진 ${uploadingLabel(percent)}`), () => setProgress('사진 처리 중'));
        photoId = uploaded.id;
        setReadyPhoto(photoId);
      }
      setProgress('멤버 저장 중');
      const body: Record<string, unknown> = {
        ...draft, name: draft.name.trim(), name_ko: draft.name_ko.trim(), role: ROLES[draft.group],
        bio: draft.bio.trim(), bio_en: draft.bio_en.trim(), url: draft.url.trim(), after: draft.after.trim(),
        aliases: draft.aliases.split(',').map((alias) => alias.trim()).filter(Boolean),
      };
      if (photoId) body.photo_file_id = photoId;
      else if (removePhoto) body.photo_file_id = null;
      const result = member
        ? await api.patch<Member>(`/people/${member.id}`, { ...body, version: member.version })
        : await api.post<Member>('/people', body);
      onSaved(result.data, result.publish);
    } catch (error) {
      if (signedOut(error)) return;
      await dialog.error('저장하지 못했습니다', error instanceof Error && !(error instanceof ApiError) ? error.message : errorBody(error));
      if (error instanceof ApiError && error.code === 'CONFLICT') onConflict();
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  return (
    <form ref={form} className={`admin-form ${styles.form}`} onSubmit={(event) => void submit(event)} noValidate>
      <Field label="영문 이름"><input name="name" value={draft.name} onChange={(event) => set({ name: event.target.value })} /></Field>
      <Field label="국문 이름"><input name="name_ko" value={draft.name_ko} onChange={(event) => set({ name_ko: event.target.value })} /></Field>
      <Field label="구분"><select name="group" value={draft.group} onChange={(event) => set({ group: event.target.value as Draft['group'] })}>{GROUPS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="연구실 합류" optional><input name="since" inputMode="numeric" placeholder="YYYY-MM" value={draft.since} onChange={(event) => set({ since: event.target.value })} /></Field>
      {draft.group === 'alumni' && <Field label="연구실 종료" optional><input name="until" inputMode="numeric" placeholder="YYYY-MM" value={draft.until} onChange={(event) => set({ until: event.target.value })} /></Field>}
      <Field label="한 줄 소개 (한국어)" optional><input name="bio" lang="ko" value={draft.bio} onChange={(event) => set({ bio: event.target.value })} /></Field>
      <Field label="한 줄 소개 (영어)" optional><input name="bio_en" lang="en" value={draft.bio_en} onChange={(event) => set({ bio_en: event.target.value })} /></Field>
      <Field label="Website" optional><input type="url" name="url" value={draft.url} onChange={(event) => set({ url: event.target.value })} /></Field>
      <Field label="논문에 쓰인 다른 영문 표기" optional><input name="aliases" value={draft.aliases} onChange={(event) => set({ aliases: event.target.value })} placeholder="쉼표로 구분" /></Field>
      {draft.group === 'alumni' && <Field label="현재 소속" optional><input name="after" value={draft.after} onChange={(event) => set({ after: event.target.value })} /></Field>}
      {member?.photo_preview_url && !removePhoto && !photo && <img className={styles.formPortrait} src={member.photo_preview_url} alt="현재 멤버 사진" />}
      <Field label="사진" optional limit={`3:4, ${system.limits.photo_mb} MB 이하`}>
        <FilePicker name="photo" accept={system.limits.photo_types.join(',')} onFiles={(files) => {
          setPhoto(files[0] ?? null); setReadyPhoto(null); setRemovePhoto(false);
        }} />
      </Field>
      {member?.photo_preview_url && !photo && <button type="button" className="admin-text-button" onClick={() => setRemovePhoto((value) => !value)}>
        {removePhoto ? '사진 유지' : '사진 연결 해제'}
      </button>}
      {!member && <label className="admin-check"><input type="checkbox" name="consent" checked={consent} onChange={(event) => setConsent(event.target.checked)} />이름·소개·사진의 공개 동의를 확인했습니다.</label>}
      {progress && <p className={styles.formNote} role="status">{progress}</p>}
      <div className="admin-actions">
        <button type="submit" className="admin-button" disabled={saving}>{saving ? '저장 중' : '저장'}</button>
        <button type="button" className="admin-text-button" onClick={onCancel} disabled={saving}>취소</button>
      </div>
    </form>
  );
}
