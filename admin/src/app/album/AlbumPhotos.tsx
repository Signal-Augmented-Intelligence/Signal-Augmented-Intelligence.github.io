'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDialog } from '@admin/components/Dialog';
import { cell, PhotoGrid, PickPhotos, TextEdit, usePhotoUploads } from '@admin/components/PhotoGrid';
import { api, ApiError, type Publish, signedOut } from '@admin/lib/api';
import { errorBody } from '@admin/lib/errors';
import type { FileInfo } from '@admin/lib/files';
import type { Album, AlbumPhoto, System } from '@admin/lib/types';
import styles from './album.module.css';

/**
 * 펼친 행사의 사진 (api.md 6장, 규칙 문서 3-1): 사진 올리기, 대표로, 설명, 숨기기, 순서.
 * 대표 사진을 고르지 않았으면(cover_photo_id null) 숨기지 않은 첫 사진이 대표입니다.
 * 숨긴 사진은 대표로 고를 수 없고, 대표 사진을 숨기면 관리 서버가 대표를 첫 사진으로 되돌립니다.
 */
/** 목록 줄에 넘길 사진 수와 대표 사진 미리보기. */
function summary(album: Album, photos: AlbumPhoto[]): Album {
  const cover = photos.find((p) => p.id === album.cover_photo_id) ?? photos.find((p) => !p.hidden);
  return { ...album, photo_count: photos.length, cover_preview_url: cover?.preview_url ?? null };
}

const HIDE_BODY = '숨기면 공개 사이트의 앨범에서 보이지 않습니다. 원본은 남아 있어 다시 보이게 할 수 있습니다.';
const MB = 1024 * 1024;

export function AlbumPhotos({ albumId, system, onAlbum, track }: {
  albumId: string;
  system: System;
  /** 행사 정보(사진 수, 대표 사진)가 바뀌면 목록 줄에 알립니다. */
  onAlbum: (a: Album) => void;
  track: (id: string, publish?: Publish) => void;
}) {
  const dialog = useDialog();
  const [album, setAlbum] = useState<Album | null>(null);
  const [busy, setBusy] = useState(false);
  const [altOpen, setAltOpen] = useState<string | null>(null); // 설명을 고치는 사진 id. 고치는 동안 다른 칸의 동작과 올리기를 막습니다.

  const load = useCallback(async () => {
    try {
      const res = await api.get<Album>(`/albums/${albumId}`);
      setAlbum(res.data);
      onAlbum(summary(res.data, res.data.photos ?? []));
    } catch (err) {
      if (signedOut(err)) return;
      if (await dialog.error('불러오지 못했습니다', errorBody(err), { retry: true })) void load();
    }
  }, [albumId, dialog, onAlbum]);

  useEffect(() => { void load(); }, [load]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try { await work(); return true; } catch (err) {
      if (signedOut(err)) return false;
      await dialog.error('저장하지 못했습니다', errorBody(err, { alt: '설명', cover_photo_id: '대표 사진' }));
      if (err instanceof ApiError && err.code === 'CONFLICT') void load();
      return false;
    } finally { setBusy(false); }
  };

  const { limits } = system;
  const { uploads, add } = usePhotoUploads({
    purpose: 'album',
    maxBytes: limits.photo_mb * MB,
    types: limits.photo_types,
    tooLarge: `사진이 ${limits.photo_mb} MB를 넘습니다.`,
    onReady: async (info: FileInfo) => {
      const res = await api.post<unknown>(`/albums/${albumId}/photos`, { photos: [{ file_id: info.id }] });
      track(albumId, res.publish);
      await load();
    },
  });

  if (!album) return <p className="admin-muted">불러오는 중입니다.</p>;
  const photos = album.photos ?? [];
  const cover = album.cover_photo_id ?? photos.find((p) => !p.hidden)?.id ?? null;

  const putPhoto = (p: AlbumPhoto) => setAlbum((a) => a && { ...a, photos: (a.photos ?? []).map((x) => (x.id === p.id ? p : x)) });

  const patchPhoto = (p: AlbumPhoto, change: Partial<AlbumPhoto>) => run(async () => {
    const res = await api.patch<AlbumPhoto>(`/albums/${albumId}/photos/${p.id}`, { ...change, version: p.version });
    track(albumId, res.publish);
    // 숨기기·다시 보이기는 대표 사진이 바뀔 수 있어 행사를 새로 받습니다.
    if ('hidden' in change) await load(); else putPhoto(res.data);
  });

  const hide = async (p: AlbumPhoto) => {
    if (await dialog.confirm('사진을 숨길까요?', HIDE_BODY, '숨기기')) void patchPhoto(p, { hidden: true });
  };

  const makeCover = (p: AlbumPhoto) => void run(async () => {
    const res = await api.patch<Album>(`/albums/${albumId}`, { cover_photo_id: p.id, version: album.version });
    track(albumId, res.publish);
    const next = { ...album, ...res.data, photos };
    setAlbum(next);
    onAlbum(summary(next, photos));
  });

  const move = (from: number, to: number) => void run(async () => {
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const res = await api.put<AlbumPhoto[]>(`/albums/${albumId}/photos/order`, { ids: next.map((p) => p.id) });
    setAlbum((a) => a && { ...a, photos: res.data ?? next });
    track(albumId, res.publish);
  });

  const connected = system.storage.connected;

  return (
    <div className={styles.photos}>
      <div className={styles.photosHead}>
        <h3 className={styles.photosTitle}>사진</h3>
        {connected && <PickPhotos accept={limits.photo_types.join(',')} onFiles={add} disabled={altOpen !== null} />}
      </div>
      {!connected && <p className="admin-muted">원본 파일 저장소가 연결되어 있지 않습니다.</p>}
      {photos.length === 0 && uploads.length === 0 ? (
        connected && <p className="admin-muted">아직 올린 사진이 없습니다.</p>
      ) : (
        <PhotoGrid items={photos} uploads={uploads} onDropFiles={connected && altOpen === null ? add : undefined} onMove={(from, to) => { if (altOpen === null) move(from, to); }} alt={(p) => p.alt}>
          {(p, i) => {
            const locked = busy || altOpen !== null;
            const editing = altOpen === p.id;
            return (
              <>
                <p className={cell.caption}>{p.alt}</p>
                <p className={cell.meta}>{[p.id === cover && '대표', p.hidden ? '숨김' : '공개 중'].filter(Boolean).join(' · ')}</p>
                <span className={cell.actions}>
                  {!editing && p.id !== cover && !p.hidden && <button type="button" className="admin-text-button" disabled={locked} onClick={() => makeCover(p)}>대표로</button>}
                  <TextEdit label="설명" value={p.alt} disabled={locked} open={editing} onOpen={(open) => setAltOpen(open ? p.id : null)} onSave={(alt) => patchPhoto(p, { alt })} />
                  {!editing && (p.hidden
                    ? <button type="button" className="admin-text-button" disabled={locked} onClick={() => patchPhoto(p, { hidden: false })}>다시 보이기</button>
                    : <button type="button" className="admin-text-button" disabled={locked} onClick={() => hide(p)}>숨기기</button>)}
                </span>
                <span className={cell.order}>
                  <button type="button" className="admin-text-button" disabled={locked || i === 0} onClick={() => move(i, i - 1)}>앞으로</button>
                  <button type="button" className="admin-text-button" disabled={locked || i === photos.length - 1} onClick={() => move(i, i + 1)}>뒤로</button>
                </span>
              </>
            );
          }}
        </PhotoGrid>
      )}
    </div>
  );
}
