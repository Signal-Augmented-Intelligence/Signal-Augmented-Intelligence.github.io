'use client';

import { useState } from 'react';
import { useDialog } from '@admin/components/Dialog';
import { api, ApiError, signedOut } from '@admin/lib/api';
import { errorBody } from '@admin/lib/errors';

/**
 * 영구 삭제. 숨김이 공개 사이트에 반영된 글만 지울 수 있습니다(사이트에서 먼저, DB에서 나중에).
 * 첨부 원본 파일은 남고, 잘못 지운 글은 랩 계정 Drive의 일일 백업(30일)에서 되살립니다.
 */
type Deletable = { id: string; version: number; hidden: boolean; publication?: { state: string } | null };

export const canDelete = (item: Deletable, publishing: boolean) =>
  item.hidden && !publishing && item.publication?.state === 'published';

const BODY = '공개 사이트에서는 이미 빠져 있고, 관리 화면에서도 지워집니다. 되돌리려면 일일 백업에서 복구해야 합니다. 첨부한 원본 파일은 남습니다.';

export function useDeletePost(reload: () => void) {
  const dialog = useDialog();
  const [deleting, setDeleting] = useState<string | null>(null);
  const remove = async (kind: 'seminars' | 'news' | 'notices' | 'albums' | 'people' | 'publications', item: Deletable, title: string) => {
    if (deleting || !(await dialog.confirm(title, BODY, '삭제'))) return;
    setDeleting(item.id);
    try {
      await api.delete(`/${kind}/${item.id}`, { version: item.version });
      reload();
    } catch (err) {
      if (!signedOut(err)) await dialog.error('삭제하지 못했습니다', errorBody(err));
      if (err instanceof ApiError && err.code === 'CONFLICT') reload();
    } finally { setDeleting(null); }
  };
  return { remove, deleting };
}
