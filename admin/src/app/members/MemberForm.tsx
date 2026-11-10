'use client';

import { type FormEvent, useRef, useState } from 'react';
import { useDialog } from '@admin/components/Dialog';
import { Field, FilePicker, focusField } from '@admin/components/Field';
import { api, ApiError, type Publish, signedOut } from '@admin/lib/api';
import { overwriteOk, readDraft, useEditBase, writeDraft } from '@admin/lib/edit';
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
/** 학부생만 학년을 둡니다. 공개 Our Team은 학년마다 줄을 나눕니다. */
export const GRADES = [4, 3, 2, 1] as const;
/** 공개 사이트 검사가 개인 메일을 막으므로 학교 메일만 받습니다(서버도 같은 규칙). */
const SCHOOL_EMAIL = /^[A-Za-z0-9._%+-]+@hs\.ac\.kr$/i;

type Draft = {
  name: string; name_ko: string; group: Exclude<MemberGroup, 'faculty'>; grade: string;
  since: string; until: string; bio: string; bio_en: string; url: string; email: string; after: string;
};
const draftKey = (id?: string) => `sai-admin:members:${id ?? 'new'}`;
const fromMember = (member?: Member): Draft => ({
  name: member?.name ?? '', name_ko: member?.name_ko ?? '',
  group: member?.group === 'faculty' ? 'undergrad' : member?.group ?? 'undergrad',
  grade: member?.grade ? String(member.grade) : '',
  since: member?.since ?? '', until: member?.until ?? '',
  bio: member?.bio ?? '', bio_en: member?.bio_en ?? '', url: member?.url ?? '', email: member?.email ?? '',
  after: member?.after ?? '',
});

export function MemberForm({ member, system, onSaved, onCancel, onConflict }: {
  member?: Member; system: System;
  onSaved: (member: Member, publish?: Publish) => void;
  onCancel: () => void; onConflict: () => void;
}) {
  const dialog = useDialog();
  const edit = useEditBase(member);
  const form = useRef<HTMLFormElement>(null);
  // 글자 칸만 임시 보관합니다. 고른 사진 파일과 공개 동의 확인은 다시 열면 새로 합니다.
  const [draft, setDraft] = useState<Draft>(() => ({ ...fromMember(member), ...readDraft<Draft>(draftKey(member?.id)) }));
  const [photo, setPhoto] = useState<File | null>(null);
  const [readyPhoto, setReadyPhoto] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const set = (change: Partial<Draft>) => setDraft((current) => {
    const next = { ...current, ...change };
    writeDraft(draftKey(member?.id), next);
    return next;
  });
  const cancel = () => { writeDraft(draftKey(member?.id), null); onCancel(); };

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
    if (draft.email.trim() && !SCHOOL_EMAIL.test(draft.email.trim())) {
      await dialog.error('저장하지 못했습니다', '학교 메일은 @hs.ac.kr 주소만 적을 수 있습니다.');
      focusField(form.current, ['email']);
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
      const { grade, ...fields } = draft;
      const body: Partial<Member> = {
        ...fields, grade: draft.group === 'undergrad' && grade ? Number(grade) : null, name: draft.name.trim(), name_ko: draft.name_ko.trim(), role: ROLES[draft.group],
        since: draft.since.trim(), until: draft.until.trim(),
        bio: draft.bio.trim(), bio_en: draft.bio_en.trim(), url: draft.url.trim(), email: draft.email.trim(), after: draft.after.trim(),
      };
      // 새 멤버의 빈 학년·메일은 보내지 않습니다.
      if (!member && body.grade === null) delete body.grade;
      if (!member && !body.email) delete body.email;
      if (photoId) body.photo_file_id = photoId;
      else if (removePhoto) body.photo_file_id = null;
      // 수정은 바꾼 칸만 보냅니다. 오래된 임시 입력이 다른 사람이 고친 칸을 덮어쓰지 않게 합니다.
      const changed = edit.changes(body);
      if (member && Object.keys(changed).length === 0) { cancel(); return; }
      if (!(await overwriteOk(dialog, edit.clashes(changed)))) return;
      const result = member
        ? await api.patch<Member>(`/people/${member.id}`, { ...changed, version: member.version })
        : await api.post<Member>('/people', body);
      writeDraft(draftKey(member?.id), null);
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
      {draft.group === 'undergrad' && <Field label="학년" optional><select name="grade" value={draft.grade} onChange={(event) => set({ grade: event.target.value })}>
        <option value="">정하지 않음</option>
        {GRADES.map((grade) => <option key={grade} value={grade}>{grade}학년</option>)}
      </select></Field>}
      <Field label="연구실 합류 시기" optional><input name="since" inputMode="numeric" placeholder="YYYY-MM" value={draft.since} onChange={(event) => set({ since: event.target.value })} /></Field>
      {draft.group === 'alumni' && <Field label="연구실 종료" optional><input name="until" inputMode="numeric" placeholder="YYYY-MM" value={draft.until} onChange={(event) => set({ until: event.target.value })} /></Field>}
      <Field label="한 줄 소개 (국문)" optional><input name="bio" lang="ko" value={draft.bio} onChange={(event) => set({ bio: event.target.value })} /></Field>
      <Field label="한 줄 소개 (영문)" optional><input name="bio_en" lang="en" value={draft.bio_en} onChange={(event) => set({ bio_en: event.target.value })} /></Field>
      <Field label="학교 메일" optional><input type="email" name="email" inputMode="email" autoComplete="off" placeholder="id@hs.ac.kr" value={draft.email} onChange={(event) => set({ email: event.target.value })} /></Field>
      <Field label="Website" optional><input type="url" name="url" value={draft.url} onChange={(event) => set({ url: event.target.value })} /></Field>
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
      {!member && <label className="admin-check"><input type="checkbox" name="consent" checked={consent} onChange={(event) => setConsent(event.target.checked)} />이름·소개·사진·메일의 공개 동의를 확인했습니다.</label>}
      {progress && <p className={styles.formNote} role="status">{progress}</p>}
      <div className="admin-actions">
        <button type="submit" className="admin-button" disabled={saving}>{saving ? '저장 중' : '저장'}</button>
        <button type="button" className="admin-text-button" onClick={cancel} disabled={saving}>취소</button>
      </div>
    </form>
  );
}
