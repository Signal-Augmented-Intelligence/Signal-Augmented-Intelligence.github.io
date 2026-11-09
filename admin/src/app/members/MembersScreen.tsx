'use client';

import { useCallback, useEffect, useState } from 'react';
import { Section } from '@/components/Section';
import { useDialog } from '@admin/components/Dialog';
import list from '@admin/components/List.module.css';
import { PublishFailure } from '@admin/components/PublishFailure';
import { api, ApiError, type Publish, signedOut } from '@admin/lib/api';
import { errorBody } from '@admin/lib/errors';
import type { Member, System } from '@admin/lib/types';
import { usePublish } from '@admin/lib/usePublish';
import { GRADES, MemberForm } from './MemberForm';
import styles from './members.module.css';
import { canDelete, useDeletePost } from '@admin/lib/deletePost';

const HIDE_BODY = '숨기면 공개 사이트에서 보이지 않습니다. 원본 자료와 사진은 남습니다.';
const UNDERGRAD = 'Undergraduate Researchers';

/**
 * 공개 Our Team과 같은 묶음: 구분, 학부생은 학년마다(4학년부터), 학년을 정하지 않은 학부생은 그 뒤.
 * 위로·아래로는 한 묶음 안에서만 움직입니다. 묶음 사이 이동은 폼에서 구분·학년을 바꿉니다.
 */
function rowsOf(members: Member[]): { key: string; title: string; members: Member[] }[] {
  const undergrads = members.filter((member) => member.group === 'undergrad');
  const graded = undergrads.some((member) => member.grade);
  return [
    { key: 'phd', title: 'Ph.D. Students', members: members.filter((member) => member.group === 'phd') },
    { key: 'ms', title: 'M.S. Students', members: members.filter((member) => member.group === 'ms') },
    ...GRADES.map((grade) => ({ key: `undergrad-${grade}`, title: `${UNDERGRAD} · ${grade}학년`,
      members: undergrads.filter((member) => member.grade === grade) })),
    { key: 'undergrad', title: graded ? `${UNDERGRAD} · 학년 없음` : UNDERGRAD,
      members: undergrads.filter((member) => !member.grade) },
    { key: 'alumni', title: 'Alumni', members: members.filter((member) => member.group === 'alumni') },
  ].filter((row) => row.members.length > 0);
}

function statusLabel(member: Member, pending: boolean): string {
  if (pending || member.publication?.state === 'publishing') return '반영 중';
  if (member.publication?.state === 'failed') return '반영 실패';
  if (member.hidden) return '숨김';
  if (!member.publication || member.publication.state === 'unverified') return '반영 확인 필요';
  return '공개 중';
}

const byOrder = (a: Member, b: Member) => a.sort_order - b.sort_order;

export function MembersScreen() {
  const dialog = useDialog();
  const { publishing, track, settled } = usePublish();
  // Called after render only, so load is defined by then.
  const { remove, deleting } = useDeletePost(() => void load());
  const [system, setSystem] = useState<System | null>(null);
  /** 교수님까지 모든 멤버. 순서 저장에는 모든 id가 필요합니다. 화면에는 교수님을 빼고 보입니다. */
  const [people, setPeople] = useState<Member[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [sys, all] = await Promise.all([api.get<System>('/system'), api.get<Member[]>('/people')]);
      setSystem(sys.data);
      setPeople([...all.data].sort(byOrder));
    } catch (error) {
      if (signedOut(error)) return;
      if (await dialog.error('불러오지 못했습니다', errorBody(error), { retry: true })) void load();
    }
  }, [dialog]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (settled) void load(); }, [settled]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!system || !people) return <p className="admin-muted">불러오는 중입니다.</p>;
  const members = people.filter((member) => member.group !== 'faculty');
  const rows = rowsOf(members);

  const saved = (member: Member, publish?: Publish) => {
    setPeople((current) => current && [...current.filter((item) => item.id !== member.id), member].sort(byOrder));
    track(member.id, publish);
    setEditing(null);
  };

  const setHidden = async (member: Member, hidden: boolean) => {
    if (hidden && !(await dialog.confirm('멤버를 숨길까요?', HIDE_BODY, '숨기기'))) return;
    setBusyRow(member.id);
    try {
      const result = await api.patch<Member>(`/people/${member.id}`, { hidden, version: member.version });
      saved(result.data, result.publish);
    } catch (error) {
      if (signedOut(error)) return;
      await dialog.error('저장하지 못했습니다', errorBody(error));
      if (error instanceof ApiError && error.code === 'CONFLICT') void load();
    } finally { setBusyRow(null); }
  };

  /** 같은 묶음의 앞이나 뒤 사람과 자리를 바꿉니다. 저장을 기다리는 동안 바뀐 순서로 보여 줍니다. */
  const move = async (member: Member, neighbour: Member) => {
    const ids = people.map((person) => person.id);
    const a = ids.indexOf(member.id);
    const b = ids.indexOf(neighbour.id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    setPeople(ids.map((id, order) => ({ ...people.find((person) => person.id === id)!, sort_order: order })));
    setBusyRow(member.id);
    try {
      const result = await api.put<Member[]>('/people/order', { ids });
      if (Array.isArray(result.data)) setPeople([...result.data].sort(byOrder));
      track(member.id, result.publish);
      track(neighbour.id, result.publish);
    } catch (error) {
      if (signedOut(error)) return;
      await dialog.error('순서를 저장하지 못했습니다', errorBody(error));
      void load();
    } finally { setBusyRow(null); }
  };

  return (
    <Section title="멤버" aside={editing !== 'new' && (
      <button type="button" className="admin-text-button" disabled={editing !== null} onClick={() => setEditing('new')}>멤버 추가</button>
    )}>
      {editing === 'new' && <div className={list.open}>
        <h3 className="admin-form-title">새 멤버</h3>
        <MemberForm system={system} onSaved={saved} onCancel={() => setEditing(null)} onConflict={load} />
      </div>}
      {members.length === 0 && editing !== 'new' && <p className="admin-muted">등록된 멤버가 없습니다.</p>}
      {rows.map((row) => (
        <div key={row.key} className={styles.group}>
          <h3 className={styles.groupTitle}>{row.title}</h3>
          <ul className={list.list}>
            {row.members.map((member, index) => editing === member.id ? (
              <li key={member.id} className={list.open}>
                <MemberForm key={member.id} member={member} system={system} onSaved={saved}
                  onCancel={() => setEditing(null)} onConflict={load} />
              </li>
            ) : (
              <li key={member.id} className={list.row}>
                <div className={styles.rowMain}>
                  {member.photo_preview_url
                    ? <img className={styles.portrait} src={member.photo_preview_url} alt="" />
                    : <span className={styles.portrait} aria-hidden="true" />}
                  <div className={list.main}>
                    <p className={list.title}>{member.name} {member.name_ko && <span>({member.name_ko})</span>}</p>
                    {member.email && <p className={list.meta}><span>{member.email}</span></p>}
                    <PublishFailure publication={member.publication} pending={publishing(member.id)} />
                  </div>
                </div>
                <span className={list.status}>{statusLabel(member, publishing(member.id))}</span>
                <span className={list.actions}>
                  <button type="button" className="admin-text-button" disabled={busyRow !== null || editing !== null || index === 0}
                    onClick={() => void move(member, row.members[index - 1])}>위로</button>
                  <button type="button" className="admin-text-button"
                    disabled={busyRow !== null || editing !== null || index === row.members.length - 1}
                    onClick={() => void move(member, row.members[index + 1])}>아래로</button>
                  <button type="button" className="admin-text-button" disabled={busyRow === member.id || editing !== null}
                    onClick={() => setEditing(member.id)}>수정</button>
                  <button type="button" className="admin-text-button" disabled={busyRow === member.id || editing !== null}
                    onClick={() => void setHidden(member, !member.hidden)}>{member.hidden ? '다시 보이기' : '숨기기'}</button>
                  {canDelete(member, publishing(member.id)) && <button type="button" className="admin-text-button"
                    disabled={deleting !== null || busyRow === member.id || editing !== null}
                    onClick={() => void remove('people', member, '멤버를 삭제할까요?')}>{deleting === member.id ? '삭제 중' : '삭제'}</button>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Section>
  );
}
