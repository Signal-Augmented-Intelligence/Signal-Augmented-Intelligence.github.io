'use client';

import { useCallback, useEffect, useState } from 'react';
import { Section } from '@/components/Section';
import { useDialog } from '@admin/components/Dialog';
import list from '@admin/components/List.module.css';
import { api, ApiError, type Publish, signedOut } from '@admin/lib/api';
import { errorBody } from '@admin/lib/errors';
import { formatDay } from '@admin/lib/format';
import type { Album, System } from '@admin/lib/types';
import { usePublish } from '@admin/lib/usePublish';
import { AlbumForm, clearAlbumDraft } from './AlbumForm';
import { AlbumPhotos } from './AlbumPhotos';
import styles from './album.module.css';
import { canDelete, useDeletePost } from '@admin/lib/deletePost';

/**
 * Album 한 화면 (규칙 문서 3-1, api.md 6장).
 * - 행사 목록(대표 사진 칸, 날짜 최신순). 행사 이름이나 "고치기"를 누르면 그 자리에서 행사가 펼쳐집니다:
 *   머리 줄(대표 사진, 이름, 상태, "접기") → 행사 정보(날짜·이름, "저장") → 사진(올리기, 대표, 설명, 숨기기, 순서).
 * - "행사 추가": 목록 맨 위에 행사 정보만 열리고, "저장하고 사진 올리기"를 누르면 같은 자리에서 그 행사가 펼쳐집니다.
 *   접으면 날짜 순서 자리로 들어갑니다.
 * - 펼친 행사는 하나뿐입니다. 펼쳐 있는 동안에는 다른 줄의 동작과 "행사 추가"를 막습니다(목록의 폼 잠금 규칙).
 * - 공개 사이트에는 숨기지 않은 사진이 1장 이상인 행사만 나옵니다. 그런 사진이 없으면 상태를 "사진 없음"으로 씁니다.
 */
const HIDE_BODY = '숨기면 공개 사이트에서 이 행사가 보이지 않습니다. 원본은 남아 있어 다시 보이게 할 수 있습니다.';
const DISCARD_BODY = '접으면 고친 날짜와 행사 이름은 저장되지 않습니다. 사진은 이미 저장되어 있습니다.';

const byDate = (a: Album, b: Album) => b.date.localeCompare(a.date);

export function AlbumScreen() {
  const dialog = useDialog();
  const { publishing, track, settled } = usePublish();
  // Called after render only, so load is defined by then.
  const { remove, deleting } = useDeletePost(() => void load());
  const [system, setSystem] = useState<System | null>(null);
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [open, setOpen] = useState<string | null>(null); // 'new' 또는 펼친 행사 id
  const [pinned, setPinned] = useState<string | null>(null); // 방금 추가해 맨 위에서 펼쳐 둔 행사 id
  const [dirty, setDirty] = useState(false); // 펼친 행사의 날짜·이름을 고치고 저장하지 않았는지
  const [busyRow, setBusyRow] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [sys, list] = await Promise.all([api.get<System>('/system'), api.get<Album[]>('/albums')]);
      setSystem(sys.data);
      setAlbums([...list.data].sort(byDate));
    } catch (err) {
      if (signedOut(err)) return;
      if (await dialog.error('불러오지 못했습니다', errorBody(err), { retry: true })) void load();
    }
  }, [dialog]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (settled) void load(); }, [settled, load]);

  const replace = useCallback((a: Album) => setAlbums((l) => l && [{ ...l.find((x) => x.id === a.id), ...a, photos: undefined }, ...l.filter((x) => x.id !== a.id)].sort(byDate)), []);
  const fromPhotos = useCallback((a: Album) => setAlbums((l) => l && l.map((x) => (x.id === a.id ? { ...x, ...a, photos: undefined } : x))), []);

  if (!system || !albums) return <p className="admin-muted">불러오는 중입니다.</p>;

  const added = (a: Album, publish?: Publish) => {
    replace({ ...a, photo_count: a.photo_count ?? 0, cover_preview_url: a.cover_preview_url ?? null });
    track(a.id, publish);
    setPinned(a.id);
    setOpen(a.id);
  };

  const saved = (a: Album, publish?: Publish) => {
    replace(a);
    track(a.id, publish);
  };

  const collapse = async () => {
    if (open && open !== 'new' && dirty) {
      if (!(await dialog.confirm('저장하지 않은 행사 정보가 있습니다', DISCARD_BODY, '접기'))) return;
      clearAlbumDraft(open);
    }
    setDirty(false);
    setOpen(null);
    setPinned(null);
  };

  const setHidden = async (a: Album, hidden: boolean) => {
    if (hidden && !(await dialog.confirm('행사를 숨길까요?', HIDE_BODY, '숨기기'))) return;
    setBusyRow(a.id);
    try {
      const res = await api.patch<Album>(`/albums/${a.id}`, { hidden, version: a.version });
      replace({ ...a, ...res.data });
      track(a.id, res.publish);
    } catch (err) {
      if (signedOut(err)) return;
      await dialog.error('저장하지 못했습니다', errorBody(err));
      if (err instanceof ApiError && err.code === 'CONFLICT') void load();
    } finally {
      setBusyRow(null);
    }
  };

  const status = (a: Album) => publishing(a.id) || a.publication.state === 'publishing' ? '반영 중'
    : a.publication.state === 'failed' ? '반영 실패' : a.hidden ? '숨김' : !a.cover_preview_url ? '사진 없음' : '공개 중';
  const locked = (a: Album) => busyRow === a.id || open !== null;

  /** 줄 왼쪽: 대표 사진 칸, 행사 이름, 날짜·사진 수. 접힌 줄에서는 이름을 눌러 펼칩니다. */
  const summary = (a: Album, onOpen?: () => void) => (
    <>
      <span className={styles.thumb}>{a.cover_preview_url && <img src={a.cover_preview_url} alt="" />}</span>
      <div className={list.main}>
        {onOpen
          ? <p className={list.title}><button type="button" className={styles.titleButton} disabled={open !== null} onClick={onOpen}>{a.title}</button></p>
          : <p className={list.title}>{a.title}</p>}
        <p className={list.meta}>
          <span className="num">{formatDay(a.date)}</span>
          <span>사진 <span className="num">{a.photo_count}</span>장</span>
        </p>
      </div>
      <span className={list.status} title={a.publication.message ?? undefined}>{status(a)}</span>
    </>
  );

  /** 펼친 행사: 머리 줄, 행사 정보, 사진. */
  const editor = (a: Album) => (
    <li key={a.id} className={styles.editor}>
      <div className={`${list.row} ${styles.row} ${styles.editorHead}`}>
        {summary(a)}
        <span className={list.actions}>
          <button type="button" className="admin-text-button" aria-expanded="true" onClick={() => void collapse()}>접기</button>
        </span>
      </div>
      <div className={styles.editorBody}>
        <section className={styles.part} aria-label="행사 정보">
          <h3 className={styles.partTitle}>행사 정보</h3>
          <div className={styles.form}>
            <AlbumForm album={a} onSaved={saved} onConflict={load} onDirty={setDirty} />
          </div>
        </section>
        <AlbumPhotos albumId={a.id} system={system} onAlbum={fromPhotos} track={track} />
      </div>
    </li>
  );

  const pinnedAlbum = pinned ? albums.find((a) => a.id === pinned) : undefined;
  const rest = pinnedAlbum ? albums.filter((a) => a.id !== pinned) : albums;

  return (
    <Section title="행사" aside={open === null && (
      <button type="button" className="admin-text-button" onClick={() => setOpen('new')}>행사 추가</button>
    )}>
      {open === 'new' && (
        <div className={`${list.open} ${styles.form}`}>
          <h3 className="admin-form-title">새 행사</h3>
          <AlbumForm onSaved={added} onCancel={() => setOpen(null)} onConflict={load} />
        </div>
      )}
      {albums.length === 0 && open !== 'new' ? (
        <p className="admin-muted">아직 등록된 행사가 없습니다.</p>
      ) : (
        <ul className={list.list}>
          {pinnedAlbum && editor(pinnedAlbum)}
          {rest.map((a) => open === a.id ? editor(a) : (
            <li key={a.id} className={`${list.row} ${styles.row}`}>
              {summary(a, () => setOpen(a.id))}
              <span className={list.actions}>
                <button type="button" className="admin-text-button" disabled={locked(a)} onClick={() => setOpen(a.id)}>수정</button>
                {a.hidden
                  ? <button type="button" className="admin-text-button" disabled={locked(a)} onClick={() => setHidden(a, false)}>다시 보이기</button>
                  : <button type="button" className="admin-text-button" disabled={locked(a)} onClick={() => setHidden(a, true)}>숨기기</button>}
                {canDelete(a, publishing(a.id)) && <button type="button" className="admin-text-button" disabled={deleting !== null || locked(a)}
                  onClick={() => void remove('albums', a, '행사를 삭제할까요?')}>{deleting === a.id ? '삭제 중' : '삭제'}</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
