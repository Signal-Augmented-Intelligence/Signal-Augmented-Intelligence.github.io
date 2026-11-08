import { api, ApiError } from './api';

/** 파일 (api.md 5장). 항목과 따로 먼저 올리고, ready가 된 파일의 id를 항목에 넣어 저장합니다. */
export type FilePurpose = 'album' | 'home' | 'seminar_pdf' | 'seminar_cover' | 'person' | 'research_figure' | 'publication_pdf' | 'notice';
export type FileInfo = {
  id: string;
  purpose: FilePurpose;
  status: 'processing' | 'ready' | 'failed';
  original_name: string;
  preview_url: string | null;
  content_url?: string | null;
  public_path?: string | null;
  public_size_bytes?: number | null;
  message?: string | null;
  error_code?: string | null;
  warnings?: string[];
};

const POLL_MS = 1000;
const BUSY_RETRY_MS = 2000;
const BUSY_RETRIES = 60;
let uploadQueue: Promise<void> = Promise.resolve();
const RETRYABLE = new Set(['PROCESSING_FAILED', 'PROCESSING_TIMEOUT', 'STORAGE_UNAVAILABLE']);

export class FileProcessingError extends ApiError {
  readonly retryable: boolean;
  constructor(public readonly fileId: string, code: string | null | undefined, message: string) {
    super('FILE_FAILED', message, 200);
    this.retryable = RETRYABLE.has(code ?? '');
  }
}

/** 한 브라우저에서 파일 가공이 끝날 때까지 다음 파일의 전송을 기다립니다. */
function inUploadOrder<T>(work: () => Promise<T>): Promise<T> {
  const result = uploadQueue.then(work, work);
  uploadQueue = result.then(() => undefined, () => undefined);
  return result;
}

/**
 * 올리고, 처리가 끝날 때까지 기다립니다. 처리 실패는 code "FILE_FAILED"인 ApiError로 던집니다.
 * onProcessing에는 처리 중인 파일 정보를 넘깁니다. 이때부터는 id로 다시 기다릴 수 있습니다(waitForFile).
 */
export function uploadFile(file: File, purpose: FilePurpose, onProgress: (percent: number) => void,
  onProcessing: (info: FileInfo) => void, onQueued?: () => void): Promise<FileInfo> {
  onQueued?.();
  return inUploadOrder(async () => {
    const form = new FormData();
    form.append('file', file);
    form.append('purpose', purpose);
    let data: FileInfo | undefined;
    for (let attempt = 0; attempt <= BUSY_RETRIES; attempt += 1) {
      try {
        onProgress(0);
        data = (await api.upload<FileInfo>('/files', form, onProgress)).data;
        break;
      } catch (err) {
        if (!(err instanceof ApiError && (err.code === 'CONFLICT' || err.code === 'BUSY')) || attempt === BUSY_RETRIES) throw err;
        onQueued?.();
        await new Promise((resolve) => setTimeout(resolve, BUSY_RETRY_MS));
      }
    }
    if (!data) throw new ApiError('INTERNAL', '파일을 올리지 못했습니다.', 500);
    if (data.status === 'processing') onProcessing(data);
    return waitForFile(data);
  });
}

/** 서버에 남아 있는 원본으로 가공만 다시 시도합니다. */
export function retryFile(id: string, onQueued?: () => void, onProcessing?: (info: FileInfo) => void): Promise<FileInfo> {
  onQueued?.();
  return inUploadOrder(async () => {
    let data: FileInfo | undefined;
    for (let attempt = 0; attempt <= BUSY_RETRIES; attempt += 1) {
      try {
        data = (await api.post<FileInfo>(`/files/${id}/retry`)).data;
        break;
      } catch (err) {
        const busy = err instanceof ApiError && (err.code === 'BUSY' || (err.code === 'CONFLICT' && err.message.includes('다른 파일')));
        if (!busy || attempt === BUSY_RETRIES) throw err;
        onQueued?.();
        await new Promise((resolve) => setTimeout(resolve, BUSY_RETRY_MS));
      }
    }
    if (!data) throw new ApiError('INTERNAL', '파일을 다시 처리하지 못했습니다.', 500);
    if (data.status === 'processing') onProcessing?.(data);
    return waitForFile(data);
  });
}

/** 처리 중인 파일이 ready 또는 failed가 될 때까지 묻습니다. 새로고침 뒤 처리 중이던 파일을 이어서 기다릴 때도 씁니다. */
export async function waitForFile(start: Pick<FileInfo, 'id' | 'status'> & Partial<FileInfo>): Promise<FileInfo> {
  let info = start;
  while (info.status === 'processing') {
    await new Promise((r) => setTimeout(r, POLL_MS));
    info = (await api.get<FileInfo>(`/files/${info.id}`)).data;
  }
  if (info.status === 'failed') throw new FileProcessingError(info.id, info.error_code, info.message || '파일을 처리하지 못했습니다.');
  return info as FileInfo;
}

export const getFile = async (id: string) => (await api.get<FileInfo>(`/files/${id}`)).data;

/** 올리는 중 글자. 전송률을 알 수 없으면(Apps Script 전환 빌드는 NaN을 넘김) 퍼센트를 붙이지 않습니다. */
export const uploadingLabel = (percent: number) => (Number.isNaN(percent) ? '올리는 중' : `올리는 중 ${percent}%`);

/** 8.4 MB, 820 KB */
export function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
