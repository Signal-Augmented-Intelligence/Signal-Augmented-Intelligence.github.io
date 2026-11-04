'use client';

import { useCallback, useEffect, useState } from 'react';
import { Section } from '@/components/Section';
import { useDialog } from '@admin/components/Dialog';
import list from '@admin/components/List.module.css';
import { api, ApiError, type Publish, signedOut } from '@admin/lib/api';
import { errorBody } from '@admin/lib/errors';
import type { Member, MemberGroup, System } from '@admin/lib/types';
import { usePublish } from '@admin/lib/usePublish';
import { MemberForm } from './MemberForm';
import styles from './members.module.css';
import { canDelete, useDeletePost } from '@admin/lib/deletePost';

const GROUP_NAMES: Record<MemberGroup, string> = {
  faculty: 'Faculty', phd: 'Ph.D. Students', ms: 'M.S. Students',
  undergrad: 'Undergraduate Researchers', alumni: 'Alumni',
};
const HIDE_BODY = '숨기면 공개 사이트에서 보이지 않습니다. 원본 자료와 사진은 남습니다.';

function statusLabel(member: Member, pending: boolean): string {
  if (pending || member.publication?.state === 'publishing') return '반영 중';
  if (member.publication?.state === 'failed') return '반영 실패';
  if (member.hidden) return '숨김';
  if (!member.publication || member.publication.state === 'unverified') return '반영 확인 필요';
  return '공개 중';
}

export function MembersScreen() {
  const dialog = useDialog();
  const { publishing, track, settled } = usePublish();
  // Called after render only, so load is defined by then.
  const { remove, deleting } = useDeletePost(() => void load());
  const [system, setSystem] = useState<System | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [sys, list] = await Promise.all([api.get<System>('/system'), api.get<Member[]>('/people')]);
      setSystem(sys.data);
      setMembers(list.data.filter((member) => member.group !== 'faculty'));
    } catch (error) {
      if (signedOut(error)) return;
      if (await dialog.error('불러오지 못했습니다', errorBody(error), { retry: true })) void load();
    }
  }, [dialog]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (settled) void load(); }, [settled]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!system || !members) return <p className="admin-muted">불러오는 중입니다.</p>;

  const saved = (member: Member, publish?: Publish) => {
    setMembers((current) => current && [...current.filter((item) => item.id !== member.id), member]
      .sort((a, b) => a.sort_order - b.sort_order));
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

  return (
    <Section title="멤버" aside={editing !== 'new' && (
      <button type="button" className="admin-text-button" disabled={editing !== null} onClick={() => setEditing('new')}>멤버 추가</button>
    )}>
      {editing === 'new' && <div className={list.open}>
        <h3 className="admin-form-title">새 멤버</h3>
        <MemberForm system={system} onSaved={saved} onCancel={() => setEditing(null)} onConflict={load} />
      </div>}
      {members.length === 0 && editing !== 'new' ? <p className="admin-muted">등록된 멤버가 없습니다.</p> : (
        <ul className={list.list}>
          {members.map((member) => editing === member.id ? (
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
                  <p className={list.meta}><span>{GROUP_NAMES[member.group]}</span></p>
                  {member.publication?.state === 'failed' && member.publication.message &&
                    <p className={list.meta}>반영 실패: {member.publication.message}</p>}
                </div>
              </div>
              <span className={list.status}>{statusLabel(member, publishing(member.id))}</span>
              <span className={list.actions}>
                <button type="button" className="admin-text-button" disabled={busyRow === member.id || editing !== null}
                  onClick={() => setEditing(member.id)}>고치기</button>
                <button type="button" className="admin-text-button" disabled={busyRow === member.id || editing !== null}
                  onClick={() => void setHidden(member, !member.hidden)}>{member.hidden ? '다시 보이기' : '숨기기'}</button>
                {canDelete(member, publishing(member.id)) && <button type="button" className="admin-text-button"
                  disabled={deleting !== null || busyRow === member.id || editing !== null}
                  onClick={() => void remove('people', member, '멤버를 삭제할까요?')}>{deleting === member.id ? '삭제 중' : '삭제'}</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
