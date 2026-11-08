'use client';

import { useCallback, useEffect, useState } from 'react';
import { Section } from '@/components/Section';
import { useDialog } from '@admin/components/Dialog';
import { PublishFailure } from '@admin/components/PublishFailure';
import { cell, PhotoGrid, PickPhotos, TextEdit, usePhotoUploads } from '@admin/components/PhotoGrid';
import { api, ApiError, signedOut } from '@admin/lib/api';
import { errorBody } from '@admin/lib/errors';
import type { FileInfo } from '@admin/lib/files';
import type { HomeSlide, System } from '@admin/lib/types';
import type { usePublish } from '@admin/lib/usePublish';

/**
 * Home › 첫 화면 사진 (api.md 7장). 사진 칸 목록에서 올리기, 메모, 숨기기, 순서.
 * 메모는 관리 화면에서만 보이고 공개 사이트에는 나오지 않습니다.
 * 칸은 공개 사이트 첫 화면과 같은 16:9입니다. 메모를 고치는 동안에는 다른 칸의 동작과 "사진 올리기"를 막습니다.
 */
const HIDE_BODY = '숨기면 공개 사이트 첫 화면에서 보이지 않습니다. 원본은 남아 있어 다시 보이게 할 수 있습니다.';
const MB = 1024 * 1024;

export function HomeSlidesScreen({ publish: { publishing, track, settled } }: { publish: ReturnType<typeof usePublish> }) {
  const dialog = useDialog();
  const [system, setSystem] = useState<System | null>(null);
  const [slides, setSlides] = useState<HomeSlide[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [noteOpen, setNoteOpen] = useState<string | null>(null); // 메모를 고치는 칸 id

  const load = useCallback(async () => {
    try {
      const [sys, list] = await Promise.all([api.get<System>('/system'), api.get<HomeSlide[]>('/home-slides')]);
      setSystem(sys.data);
      setSlides(list.data);
    } catch (err) {
      if (signedOut(err)) return;
      if (await dialog.error('불러오지 못했습니다', errorBody(err), { retry: true })) void load();
    }
  }, [dialog]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (settled) void load(); }, [settled, load]);

  /** 저장 하나를 실행하고, 실패하면 오류 팝업. 동시 수정이면 새로 불러옵니다. 성공하면 true. */
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try { await work(); return true; } catch (err) {
      if (signedOut(err)) return false;
      await dialog.error('저장하지 못했습니다', errorBody(err, { note: '메모' }));
      if (err instanceof ApiError && err.code === 'CONFLICT') void load();
      return false;
    } finally { setBusy(false); }
  };

  const limits = system?.limits;
  const { uploads, add } = usePhotoUploads({
    purpose: 'home',
    maxBytes: (limits?.photo_mb ?? 0) * MB,
    types: limits?.photo_types ?? [],
    tooLarge: `사진이 ${limits?.photo_mb} MB를 넘습니다.`,
    onReady: async (info: FileInfo) => {
      const res = await api.post<HomeSlide>('/home-slides', { file_id: info.id });
      setSlides((s) => [...(s ?? []), res.data]);
      track(res.data.id, res.publish);
    },
  });

  if (!system || !slides) return <p className="admin-muted">불러오는 중입니다.</p>;

  const put = (s: HomeSlide) => setSlides((list) => list && list.map((x) => (x.id === s.id ? s : x)));

  const patch = (s: HomeSlide, change: Partial<HomeSlide>) => run(async () => {
    const res = await api.patch<HomeSlide>(`/home-slides/${s.id}`, { ...change, version: s.version });
    put(res.data);
    track(s.id, res.publish);
  });

  const hide = async (s: HomeSlide) => {
    if (await dialog.confirm('사진을 숨길까요?', HIDE_BODY, '숨기기')) void patch(s, { hidden: true });
  };

  const move = (from: number, to: number) => void run(async () => {
    const next = [...slides];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const res = await api.put<HomeSlide[]>('/home-slides/order', { ids: next.map((s) => s.id) });
    setSlides(res.data ?? next);
    track(moved.id, res.publish);
  });

  const connected = system.storage.connected;
  const status = (s: HomeSlide) => publishing(s.id) || s.publication.state === 'publishing' ? '반영 중'
    : s.publication.state === 'failed' ? '반영 실패' : s.hidden ? '숨김' : '공개 중';

  return (
    <Section title="첫 화면 사진" aside={connected && (
      <PickPhotos accept={system.limits.photo_types.join(',')} onFiles={add} disabled={noteOpen !== null} />
    )}>
      {!connected && <p className="admin-muted">원본 파일 저장소가 연결되어 있지 않습니다.</p>}
      {slides.length === 0 && uploads.length === 0 ? (
        connected && <p className="admin-muted">아직 등록된 사진이 없습니다.</p>
      ) : (
        <PhotoGrid items={slides} uploads={uploads} onDropFiles={connected && noteOpen === null ? add : undefined} onMove={(from, to) => { if (noteOpen === null) move(from, to); }} alt={(s) => s.note} wide>
          {(s, i) => {
            const locked = busy || noteOpen !== null;
            return (
              <>
                <p className={cell.caption}>{s.note}</p>
                <p className={cell.meta}>{status(s)}</p>
                <PublishFailure className={cell.meta} publication={s.publication} pending={publishing(s.id)} />
                <span className={cell.actions}>
                  <TextEdit label="메모" value={s.note} disabled={locked} open={noteOpen === s.id} onOpen={(open) => setNoteOpen(open ? s.id : null)} onSave={(note) => patch(s, { note })} />
                  {noteOpen !== s.id && (s.hidden
                    ? <button type="button" className="admin-text-button" disabled={locked} onClick={() => patch(s, { hidden: false })}>다시 보이기</button>
                    : <button type="button" className="admin-text-button" disabled={locked} onClick={() => hide(s)}>숨기기</button>)}
                </span>
                <span className={cell.order}>
                  <button type="button" className="admin-text-button" disabled={locked || i === 0} onClick={() => move(i, i - 1)}>앞으로</button>
                  <button type="button" className="admin-text-button" disabled={locked || i === slides.length - 1} onClick={() => move(i, i + 1)}>뒤로</button>
                </span>
              </>
            );
          }}
        </PhotoGrid>
      )}
    </Section>
  );
}
