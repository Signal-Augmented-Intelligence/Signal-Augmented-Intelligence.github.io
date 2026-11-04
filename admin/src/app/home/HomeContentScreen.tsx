'use client';

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Section } from '@/components/Section';
import { useDialog } from '@admin/components/Dialog';
import { Field, focusField } from '@admin/components/Field';
import { api, ApiError, signedOut } from '@admin/lib/api';
import { changedFields, readDraft, writeDraft } from '@admin/lib/edit';
import { errorBody, fieldList } from '@admin/lib/errors';
import { uploadFile, uploadingLabel } from '@admin/lib/files';
import type { LabInfo, PoemInfo } from '@admin/lib/types';
import type { usePublish } from '@admin/lib/usePublish';
import styles from './home-content.module.css';

const LAB_KEY = 'sai-admin:lab-info';
const POEM_KEY = 'sai-admin:poem';
const LAB_FIELDS = [
  ['name', '랩 이름'], ['full_name', '영문 전체 이름'], ['name_ko', '국문 이름'],
  ['institution', '대학교'], ['advisor', '지도교수'], ['intro', '소개'],
  ['email', '공식 이메일'], ['location', '위치'], ['logo', '랩 로고 경로'],
] as const;
type LabField = typeof LAB_FIELDS[number][0];
type LabDraft = Pick<LabInfo, LabField | 'draft'>;
type StanzaDraft = { key: string; id: string | null; text: string; hidden: boolean };
type PoemDraft = { title: string; credit: string; heroKey: string; stanzas: StanzaDraft[] };

const labDraft = (lab: LabInfo): LabDraft => ({
  name: lab.name, full_name: lab.full_name, name_ko: lab.name_ko,
  institution: lab.institution, advisor: lab.advisor, intro: lab.intro,
  email: lab.email, location: lab.location, logo: lab.logo, draft: lab.draft,
});
const poemDraft = (poem: PoemInfo): PoemDraft => {
  const visible = poem.stanzas.filter((s) => !s.hidden);
  return { title: poem.title, credit: poem.credit,
    heroKey: visible[poem.hero - 1]?.id ?? visible[0]?.id ?? '',
    stanzas: poem.stanzas.map((s) => ({ key: s.id, id: s.id, text: s.lines.join('\n'), hidden: s.hidden })) };
};
const status = (item: LabInfo | PoemInfo, waiting: boolean) =>
  waiting || item.publication.state === 'publishing' ? '반영 중'
    : item.publication.state === 'failed' ? '반영 실패' : '공개 중';

export function HomeContentScreen({ publish: { publishing, track, settled } }: { publish: ReturnType<typeof usePublish> }) {
  const dialog = useDialog();
  const labForm = useRef<HTMLFormElement>(null);
  const poemForm = useRef<HTMLFormElement>(null);
  const [lab, setLab] = useState<LabInfo | null>(null);
  const [poem, setPoem] = useState<PoemInfo | null>(null);
  const [labEdit, setLabEdit] = useState<LabDraft | null>(null);
  const [poemEdit, setPoemEdit] = useState<PoemDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoProgress, setLogoProgress] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [labResult, poemResult] = await Promise.all([api.get<LabInfo>('/lab'), api.get<PoemInfo>('/poem')]);
      setLab(labResult.data);
      setPoem(poemResult.data);
    } catch (err) {
      if (signedOut(err)) return;
      if (await dialog.error('불러오지 못했습니다', errorBody(err), { retry: true })) void load();
    }
  }, [dialog]);
  useEffect(() => { void load(); }, [load, settled]);

  const editLab = () => { if (lab) setLabEdit(readDraft<LabDraft>(LAB_KEY) ?? labDraft(lab)); };
  const editPoem = () => { if (poem) setPoemEdit(readDraft<PoemDraft>(POEM_KEY) ?? poemDraft(poem)); };
  const setLabValue = (change: Partial<LabDraft>) => setLabEdit((old) => {
    if (!old) return old;
    const next = { ...old, ...change };
    writeDraft(LAB_KEY, next);
    return next;
  });
  const setPoemValue = (change: Partial<PoemDraft>) => setPoemEdit((old) => {
    if (!old) return old;
    const next = { ...old, ...change };
    writeDraft(POEM_KEY, next);
    return next;
  });
  const cancelLab = () => { writeDraft(LAB_KEY, null); setLabEdit(null); setLogoFile(null); setLogoProgress(null); };
  const cancelPoem = () => { writeDraft(POEM_KEY, null); setPoemEdit(null); };

  const saveLab = async (event: FormEvent) => {
    event.preventDefault();
    if (!lab || !labEdit || saving) return;
    const invalid: [string, string][] = [];
    if (!labEdit.name.trim()) invalid.push(['name', '랩 이름을 적어 주세요.']);
    for (const [key, label] of LAB_FIELDS) {
      if (/[\r\n]/.test(labEdit[key])) invalid.push([key, `${label}은(는) 한 줄로 적어 주세요.`]);
    }
    if (invalid.length) {
      await dialog.error('저장하지 못했습니다', fieldList(invalid.map(([, message]) => message)));
      focusField(labForm.current, invalid.map(([key]) => key));
      return;
    }
    setSaving(true);
    try {
      let logo = labEdit.logo.trim();
      if (logoFile) {
        const uploaded = await uploadFile(logoFile, 'research_figure',
          (percent) => setLogoProgress(`로고 ${uploadingLabel(percent)}`), () => setLogoProgress('로고 처리 중'));
        if (!uploaded.public_path) throw new Error('로고의 공개 경로를 확인하지 못했습니다.');
        logo = uploaded.public_path;
        setLabValue({ logo });
      }
      const next = Object.fromEntries(LAB_FIELDS.map(([key]) => [key, key === 'logo' ? logo : labEdit[key].trim()])) as
        Pick<LabDraft, LabField>;
      const change = changedFields(lab, { ...next, draft: labEdit.draft });
      if (!Object.keys(change).length) { cancelLab(); return; }
      const result = await api.patch<LabInfo>('/lab', { ...change, version: lab.version });
      setLab(result.data);
      track('lab', result.publish);
      cancelLab();
    } catch (err) {
      if (!signedOut(err)) {
        await dialog.error('저장하지 못했습니다', errorBody(err));
        if (err instanceof ApiError && err.code === 'CONFLICT') void load();
      }
    } finally { setSaving(false); }
  };

  const visibleDraft = poemEdit?.stanzas.filter((s) => !s.hidden) ?? [];
  const savePoem = async (event: FormEvent) => {
    event.preventDefault();
    if (!poem || !poemEdit || saving) return;
    const problems: string[] = [];
    if (visibleDraft.length === 0) problems.push('보일 연을 하나 이상 남겨 주세요.');
    if (!visibleDraft.some((s) => s.key === poemEdit.heroKey)) problems.push('첫 화면에 보일 연을 골라 주세요.');
    if (poemEdit.stanzas.some((s) => !s.text.trim() || s.text.split(/\r?\n/).some((line) => !line.trim())))
      problems.push('각 연의 행을 빈 줄 없이 적어 주세요.');
    if (problems.length) {
      await dialog.error('저장하지 못했습니다', fieldList(problems));
      focusField(poemForm.current, ['stanzas']);
      return;
    }
    setSaving(true);
    try {
      const result = await api.patch<PoemInfo>('/poem', {
        version: poem.version, title: poemEdit.title.trim(), credit: poemEdit.credit.trim(),
        hero: visibleDraft.findIndex((s) => s.key === poemEdit.heroKey) + 1,
        stanzas: poemEdit.stanzas.map((s) => ({ id: s.id, hidden: s.hidden,
          lines: s.text.split(/\r?\n/).map((line) => line.trim()) })),
      });
      setPoem(result.data);
      track('poem', result.publish);
      cancelPoem();
    } catch (err) {
      if (!signedOut(err)) {
        await dialog.error('저장하지 못했습니다', errorBody(err));
        if (err instanceof ApiError && err.code === 'CONFLICT') void load();
      }
    } finally { setSaving(false); }
  };

  const updateStanza = (key: string, change: Partial<StanzaDraft>) => {
    if (!poemEdit) return;
    const stanzas = poemEdit.stanzas.map((s) => s.key === key ? { ...s, ...change } : s);
    const heroKey = stanzas.some((s) => s.key === poemEdit.heroKey && !s.hidden)
      ? poemEdit.heroKey : stanzas.find((s) => !s.hidden)?.key ?? '';
    setPoemValue({ stanzas, heroKey });
  };
  const moveStanza = (index: number, offset: number) => {
    if (!poemEdit) return;
    const stanzas = [...poemEdit.stanzas];
    const [moved] = stanzas.splice(index, 1);
    stanzas.splice(index + offset, 0, moved);
    setPoemValue({ stanzas });
  };

  return <>
    <Section title="랩 정보" aside={lab && <span className={styles.status} title={lab.publication.message ?? undefined}>
      {status(lab, publishing('lab'))}</span>}>
      {!lab ? <p className="admin-muted">불러오는 중입니다.</p> : labEdit ? (
        <form ref={labForm} className="admin-form" onSubmit={saveLab} noValidate>
          {LAB_FIELDS.map(([key, label]) => <Field key={key} label={label} optional={key !== 'name'}>
            <input name={key} value={labEdit[key]} onChange={(e) => setLabValue({ [key]: e.target.value })} />
          </Field>)}
          <Field label="로고 이미지" optional><input type="file" accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} /></Field>
          {logoProgress && <p className="admin-muted">{logoProgress}</p>}
          <label className="admin-check"><input type="checkbox" checked={labEdit.draft}
            onChange={(e) => setLabValue({ draft: e.target.checked })} />내부 검토 표시</label>
          <div className="admin-actions">
            <button type="submit" className="admin-button" disabled={saving}>저장</button>
            <button type="button" className="admin-text-button" disabled={saving} onClick={cancelLab}>취소</button>
          </div>
        </form>
      ) : <>
        <dl className={styles.details}>{LAB_FIELDS.map(([key, label]) => <div key={key}>
          <dt>{label}</dt><dd>{lab[key] || '—'}</dd>
        </div>)}<div><dt>내부 검토 표시</dt><dd>{lab.draft ? '켜짐' : '꺼짐'}</dd></div></dl>
        <button type="button" className="admin-text-button" onClick={editLab}>고치기</button>
      </>}
    </Section>
    <Section title="시" aside={poem && <span className={styles.status} title={poem.publication.message ?? undefined}>
      {status(poem, publishing('poem'))}</span>}>
      {!poem ? <p className="admin-muted">불러오는 중입니다.</p> : poemEdit ? (
        <form ref={poemForm} className={`admin-form ${styles.poemForm}`} onSubmit={savePoem} noValidate>
          <Field label="제목"><input name="title" value={poemEdit.title}
            onChange={(e) => setPoemValue({ title: e.target.value })} /></Field>
          <Field label="끝 표기" optional><input name="credit" value={poemEdit.credit}
            onChange={(e) => setPoemValue({ credit: e.target.value })} /></Field>
          <Field label="첫 화면에 보일 연">
            <select name="hero" value={poemEdit.heroKey} onChange={(e) => setPoemValue({ heroKey: e.target.value })}>
              {visibleDraft.map((s, i) => <option key={s.key} value={s.key}>{i + 1}연</option>)}
            </select>
          </Field>
          <div className={styles.stanzas}>
            {poemEdit.stanzas.map((s, i) => <div key={s.key} className={styles.stanza}>
              <div className={styles.stanzaHead}>
                <strong>{i + 1}연{s.hidden ? ' · 숨김' : ''}</strong>
                <span className={styles.stanzaActions}>
                  <button type="button" className="admin-text-button" disabled={i === 0}
                    onClick={() => moveStanza(i, -1)}>위로</button>
                  <button type="button" className="admin-text-button" disabled={i === poemEdit.stanzas.length - 1}
                    onClick={() => moveStanza(i, 1)}>아래로</button>
                  <button type="button" className="admin-text-button"
                    onClick={() => updateStanza(s.key, { hidden: !s.hidden })}>{s.hidden ? '다시 보이기' : '숨기기'}</button>
                </span>
              </div>
              <Field label="행" limit="줄마다 한 행">
                <textarea name={i === 0 ? 'stanzas' : undefined} value={s.text}
                  onChange={(e) => updateStanza(s.key, { text: e.target.value })} />
              </Field>
            </div>)}
          </div>
          <button type="button" className="admin-text-button" onClick={() => setPoemValue({
            stanzas: [...poemEdit.stanzas, { key: crypto.randomUUID(), id: null, text: '', hidden: false }],
          })}>연 추가</button>
          <div className="admin-actions">
            <button type="submit" className="admin-button" disabled={saving}>저장</button>
            <button type="button" className="admin-text-button" disabled={saving} onClick={cancelPoem}>취소</button>
          </div>
        </form>
      ) : <>
        <p className={styles.poemTitle}>{poem.title}</p>
        {poem.stanzas.map((s, i) => <div key={s.id} className={styles.readStanza}>
          <strong>{i + 1}연{s.hidden ? ' · 숨김' : poem.stanzas.filter((part) => !part.hidden).indexOf(s) === poem.hero - 1 ? ' · 첫 화면' : ''}</strong>
          <p>{s.lines.join('\n')}</p>
        </div>)}
        {poem.credit && <p>{poem.credit}</p>}
        <button type="button" className="admin-text-button" onClick={editPoem}>고치기</button>
      </>}
    </Section>
  </>;
}
