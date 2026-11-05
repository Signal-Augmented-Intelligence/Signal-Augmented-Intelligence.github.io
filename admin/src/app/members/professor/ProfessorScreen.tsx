'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Section } from '@/components/Section';
import { useDialog } from '@admin/components/Dialog';
import { Field } from '@admin/components/Field';
import { api, ApiError, signedOut } from '@admin/lib/api';
import { errorBody } from '@admin/lib/errors';
import { uploadFile, uploadingLabel } from '@admin/lib/files';
import type { ProfessorInfo, ProfessorItem, ProfessorSection } from '@admin/lib/types';
import { usePublish } from '@admin/lib/usePublish';
import styles from './professor.module.css';

const FIELDS = [
  ['name', '영문 이름'], ['name_ko', '국문 이름'], ['position', '직위'], ['affiliation', '소속'],
  ['field', '연구 분야'], ['office', '연구실'], ['email', '이메일'], ['phone', '전화'],
  ['photo', '프로필 사진 파일명'], ['bio', '소개'], ['keywords', '키워드'], ['sources_note', '자료 출처 메모'],
] as const;
type FieldKey = typeof FIELDS[number][0];
const DRAFT_KEY = 'sai-admin:professor-draft';
const savedDraft = (current: ProfessorInfo): ProfessorInfo | null => {
  try {
    const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as ProfessorInfo | null;
    return draft?.version === current.version && draft.sections ? draft : null;
  } catch { return null; }
};
const storeDraft = (draft: ProfessorInfo | null) => {
  try { if (draft) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else sessionStorage.removeItem(DRAFT_KEY); } catch { /* Editing remains possible without storage. */ }
};
const SECTIONS: { key: ProfessorSection; title: string; fields: readonly [string, string][] }[] = [
  { key: 'links', title: '링크', fields: [['label', '이름'], ['url', '주소']] },
  { key: 'education', title: '학력', fields: [['degree', '학위'], ['date', '연도'], ['school', '학교']] },
  { key: 'career', title: '경력', fields: [['period', '기간'], ['role', '내용']] },
  { key: 'research_areas', title: '연구 분야', fields: [['en', '영문'], ['ko', '국문']] },
  { key: 'teaching', title: '강의', fields: [['course', '과목'], ['terms', '학기']] },
  { key: 'publications', title: '주요 논문', fields: [['date', '연도'], ['title', '제목'], ['venue', '학술지/학회'], ['authors', '저자'], ['doi', 'DOI']] },
  { key: 'software', title: '소프트웨어', fields: [['date', '연도'], ['title', '이름'], ['note', '설명']] },
  { key: 'patents', title: '특허', fields: [['status', '상태'], ['date', '연도'], ['title', '제목'], ['number', '번호']] },
  { key: 'projects', title: '과제', fields: [['period', '기간'], ['title', '과제명'], ['role', '역할'], ['funding', '지원 기관']] },
  { key: 'services', title: '학술 활동', fields: [['date', '연도'], ['text', '내용']] },
  { key: 'student_awards', title: '학생 수상', fields: [['text', '내용']] },
];

export function ProfessorScreen() {
  const dialog = useDialog();
  const { publishing, track, settled } = usePublish();
  const [professor, setProfessor] = useState<ProfessorInfo | null>(null);
  const [draft, setDraft] = useState<ProfessorInfo | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try { setProfessor((await api.get<ProfessorInfo>('/professor')).data); }
    catch (error) {
      if (!signedOut(error) && await dialog.error('불러오지 못했습니다', errorBody(error), { retry: true })) void load();
    }
  }, [dialog]);
  useEffect(() => { void load(); }, [load, settled]);
  const edit = () => { if (professor) setDraft(savedDraft(professor) ?? structuredClone(professor)); };
  const cancel = () => { storeDraft(null); setDraft(null); setPhoto(null); setProgress(null); };
  const changeDraft = (change: (current: ProfessorInfo) => ProfessorInfo) => setDraft((current) => {
    if (!current) return current;
    const next = change(current);
    storeDraft(next);
    return next;
  });
  const setField = (key: FieldKey, value: string) => changeDraft((current) => ({ ...current, [key]: value }));
  const changeItems = (section: ProfessorSection, change: (items: ProfessorItem[]) => ProfessorItem[]) =>
    changeDraft((current) => ({ ...current, sections: { ...current.sections,
      [section]: change(current.sections[section]) } }));
  const changeItem = (section: ProfessorSection, index: number, change: Partial<ProfessorItem>) =>
    changeItems(section, (items) => items.map((item, i) => i === index ? { ...item, ...change } : item));
  const move = (section: ProfessorSection, index: number, offset: number) => changeItems(section, (items) => {
    const next = [...items]; const [item] = next.splice(index, 1); next.splice(index + offset, 0, item); return next;
  });
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!professor || !draft || saving) return;
    if (!draft.name.trim()) { await dialog.error('저장하지 못했습니다', '영문 이름을 적어 주세요.'); return; }
    setSaving(true);
    try {
      let photoName = draft.photo.trim();
      if (photo) {
        const uploaded = await uploadFile(photo, 'person',
          (percent) => setProgress(`사진 ${uploadingLabel(percent)}`), () => setProgress('사진 처리 중'));
        if (!uploaded.public_path?.startsWith('/images/people/')) throw new Error('사진의 공개 경로를 확인하지 못했습니다.');
        photoName = uploaded.public_path.split('/').at(-1)!;
      }
      const body = Object.fromEntries(FIELDS.map(([key]) => [key, key === 'photo' ? photoName : draft[key].trim()]));
      const result = await api.patch<ProfessorInfo>('/professor', {
        ...body, version: professor.version, sections: draft.sections,
      });
      setProfessor(result.data);
      track('professor', result.publish);
      cancel();
    } catch (error) {
      if (!signedOut(error)) {
        await dialog.error('저장하지 못했습니다', errorBody(error));
        if (error instanceof ApiError && error.code === 'CONFLICT') void load();
      }
    } finally { setSaving(false); }
  };
  const state = publishing('professor') || professor?.publication.state === 'publishing' ? '반영 중'
    : professor?.publication.state === 'failed' ? '반영 실패' : '공개 중';
  return <Section title="교수님 페이지" aside={professor && <span title={professor.publication.message ?? undefined}>{state}</span>}>
    {!professor ? <p className="admin-muted">불러오는 중입니다.</p> : draft ? <form className="admin-form" onSubmit={save}>
      <div className="admin-actions"><button type="submit" className="admin-button" disabled={saving}>{saving ? '저장 중' : '저장'}</button>
        <button type="button" className="admin-text-button" disabled={saving} onClick={cancel}>취소</button></div>
      <p className="admin-muted">이 탭에서 다른 화면으로 이동해도 작성 중인 내용은 보관됩니다.</p>
      {FIELDS.map(([key, label]) => <Field key={key} label={label} optional={key !== 'name'}>
        {key === 'bio' || key === 'sources_note' ? <textarea value={draft[key]} onChange={(e) => setField(key, e.target.value)} />
          : <input value={draft[key]} onChange={(e) => setField(key, e.target.value)} />}
      </Field>)}
      <Field label="프로필 사진 올리기" optional><input type="file" accept="image/jpeg,image/png,image/webp,image/heic"
        onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></Field>
      {progress && <p className="admin-muted">{progress}</p>}
      {SECTIONS.map(({ key, title, fields }) => <details key={key} className={styles.section}>
        <summary>{title} <span className={styles.count}>{draft.sections[key].filter((item) => !item.hidden).length}개 공개 ·
          {draft.sections[key].filter((item) => item.hidden).length}개 숨김</span></summary>
        {draft.sections[key].map((item, index) => <div key={item.id ?? `new-${index}`} className={styles.item}>
          <div className={styles.actions}>
            <strong>{index + 1}{item.hidden ? ' · 숨김' : ''}</strong>
            <button type="button" className="admin-text-button" disabled={index === 0} onClick={() => move(key, index, -1)}>위로</button>
            <button type="button" className="admin-text-button" disabled={index === draft.sections[key].length - 1}
              onClick={() => move(key, index, 1)}>아래로</button>
            <button type="button" className="admin-text-button" onClick={() => changeItem(key, index, { hidden: !item.hidden })}>
              {item.hidden ? '다시 보이기' : '숨기기'}</button>
          </div>
          {fields.map(([field, label]) => <Field key={field} label={label} optional>
            <input value={item.data[field] ?? ''} onChange={(e) => changeItem(key, index,
              { data: { ...item.data, [field]: e.target.value } })} />
          </Field>)}
        </div>)}
        <button type="button" className="admin-text-button" onClick={() => changeItems(key, (items) =>
          [...items, { id: null, hidden: false, data: Object.fromEntries(fields.map(([field]) => [field, ''])) }])}>
          항목 추가</button>
      </details>)}
      <div className="admin-actions"><button type="submit" className="admin-button" disabled={saving}>저장</button>
        <button type="button" className="admin-text-button" disabled={saving} onClick={cancel}>취소</button></div>
    </form> : <>
      <p>{professor.name} {professor.name_ko && `(${professor.name_ko})`}</p>
      <p>{professor.position} · {professor.affiliation}</p>
      <p className={styles.bio}>{professor.bio}</p>
      {SECTIONS.map(({ key, title, fields }) => <div key={key} className={styles.section}>
        <h2>{title}</h2><p>{professor.sections[key].filter((item) => !item.hidden).length}개 공개 ·
          {professor.sections[key].filter((item) => item.hidden).length}개 숨김</p>
        {professor.sections[key].filter((item) => !item.hidden).slice(0, 3).map((item) =>
          <p key={item.id}>{fields.map(([field]) => item.data[field]).filter(Boolean).join(' · ')}</p>)}
      </div>)}
      <button type="button" className="admin-text-button" onClick={edit}>수정</button>
    </>}
  </Section>;
}

