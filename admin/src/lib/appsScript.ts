/**
 * Apps Script 전환 빌드의 연결 (계약: sai-lab-admin/docs/apps-script-transition-contract.md 2·3장).
 * 관리 서버 대신 google.script.run으로 접수용 프로젝트(intake)의 공개 함수를 부릅니다.
 * - 조회: snapshot()이 돌려주는 읽기 전용 사본에서 경로별로 꺼냅니다. 사본의 모양은 아래 Snapshot.
 * - 변경: submitMutation()으로 접수하고, 소유자 작업이 적용(applied)할 때까지 사본을 다시 읽으며 기다립니다.
 *   기다리다 시간이 지나면 같은 내용의 다음 저장이 같은 접수 번호를 다시 쓰도록 브라우저에 접수 번호를 남깁니다.
 * - 파일: form 하나를 submitFile()의 유일한 인자로 보냅니다. 전송률은 알 수 없으므로 진행률을 NaN으로 알립니다.
 * - 쿠키·CSRF·비밀번호는 쓰지 않습니다. 권한은 매 호출마다 접수용 프로젝트가 Google 계정으로 확인합니다.
 */
import { ApiError, type ErrorCode, type Publish, type Result } from './api';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** 소유자 작업 상태. 계약 3장의 단계와 현재 owner/Code.gs가 쓰는 queued/running을 함께 받습니다. */
type JobState = 'received' | 'stored' | 'queued' | 'running' | 'processing' | 'applied' | 'backed_up'
  | 'media_staged' | 'publishing' | 'done' | 'failed';
type Job = { request_id: string; kind?: string; state: JobState; error_code?: string | null; message?: string | null;
  /** 적용된 엔티티. 기존 /api/v1 응답의 data와 같은 모양이어야 저장 뒤 화면이 그대로 이어집니다. */
  result?: unknown };

/**
 * 읽기 전용 화면 사본. 소유자 작업이 만듭니다.
 * collections의 열쇠는 화면이 부르는 GET 경로 그대로입니다(예: "/people", "/people?view=picker", "/albums/abc").
 * files의 값은 기존 GET /files/{id} 응답(FileInfo)과 같은 모양입니다.
 */
export type Snapshot = { revision: string | null; updated_at: string | null;
  collections: Record<string, unknown>; files?: Record<string, unknown>; jobs: Record<string, Job> };

type Runner = Record<string, (...args: unknown[]) => void> & {
  withSuccessHandler: (fn: (value: unknown) => void) => Runner;
  withFailureHandler: (fn: (error: Error) => void) => Runner;
};
declare global { interface Window { google?: { script?: { run?: Runner } } } }

const APPLIED: JobState[] = ['applied', 'backed_up', 'media_staged', 'publishing', 'done'];
const SNAPSHOT_MS = 2000;
const WAIT_POLL_MS = 3000;
const WAIT_LIMIT_MS = 10 * 60 * 1000;
const PENDING_STORE = 'sai-admin:apps-script-requests';

const MESSAGES: Record<string, [ErrorCode, string]> = {
  UNAUTHENTICATED: ['UNAUTHENTICATED', 'Google 계정을 확인하지 못했습니다. Google에 로그인한 뒤 다시 열어 주세요.'],
  FORBIDDEN: ['FORBIDDEN', '이 Google 계정에는 관리 권한이 없습니다.'],
  VALIDATION_FAILED: ['VALIDATION_FAILED', '보낸 내용을 받지 못했습니다. 입력을 확인해 주세요.'],
  FILE_TOO_LARGE: ['FILE_TOO_LARGE', '파일이 20 MB를 넘습니다.'],
  UPLOAD_BUSY: ['BUSY', '다른 파일을 처리하는 중입니다. 끝나면 이어서 올립니다.'],
  CONFLICT: ['CONFLICT', '같은 접수 번호로 다른 내용이 이미 접수됐습니다. 새로 고친 뒤 다시 저장해 주세요.'],
  CONFIGURATION_REQUIRED: ['STORAGE_UNAVAILABLE', '관리 저장소 설정이 끝나지 않았습니다.'],
  INBOX_UNAVAILABLE: ['STORAGE_UNAVAILABLE', '이 계정의 접수 폴더를 쓸 수 없습니다.'],
};
const NETWORK_MESSAGE = '관리 화면 서버에 연결할 수 없습니다. 공개 사이트는 그대로 보입니다.';

function toError(error: unknown): ApiError {
  const text = String((error as Error)?.message ?? error ?? '');
  const code = Object.keys(MESSAGES).find((key) => new RegExp(`\\b${key}\\b`).test(text));
  if (code) return new ApiError(MESSAGES[code][0], MESSAGES[code][1], 0);
  if (/network|HTTP 0|connection/i.test(text)) return new ApiError('NETWORK', NETWORK_MESSAGE, 0);
  return new ApiError('INTERNAL', '요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.', 0);
}

function call<T>(name: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = window.google?.script?.run;
    if (!run) { reject(new ApiError('NETWORK', NETWORK_MESSAGE, 0)); return; }
    run.withSuccessHandler((value) => resolve(value as T)).withFailureHandler((err) => reject(toError(err)))[name](...args);
  });
}

let cached: { at: number; value: Promise<Snapshot> } | null = null;
/** 짧은 시간 안의 여러 조회(한 화면이 동시에 부르는 GET 여러 개)는 사본 한 번으로 답합니다. */
function snapshot(fresh = false): Promise<Snapshot> {
  if (!fresh && cached && Date.now() - cached.at < SNAPSHOT_MS) return cached.value;
  const value = call<Snapshot>('snapshot');
  cached = { at: Date.now(), value };
  value.catch(() => { if (cached?.value === value) cached = null; });
  return value;
}

const notFound = () => new ApiError('NOT_FOUND', '찾을 수 없습니다. 목록을 새로 고쳐 주세요.', 404);
const notSupported = (what: string) => new ApiError('NOT_SUPPORTED', `${what}은(는) 전환 빌드에서 아직 쓸 수 없습니다.`, 0);

function publishOf(job: Job | undefined, id: string): Publish {
  if (!job) return { id, state: 'queued' };
  if (job.state === 'done') return { id, state: 'done' };
  if (job.state === 'failed') return { id, state: 'failed', message: job.message ?? null };
  return { id, state: APPLIED.includes(job.state) ? 'running' : 'queued' };
}

/** 파일 정보: 소유자 작업이 만든 FileInfo가 있으면 그것, 없으면 접수 작업의 상태로 만듭니다. */
function fileOf(snap: Snapshot, id: string): unknown {
  const info = snap.files?.[id];
  if (info) return info;
  const job = snap.jobs[id.replace(/^file_/, '')];
  if (!job) return { id, status: 'processing', original_name: '', preview_url: null };
  return job.state === 'failed'
    ? { id, status: 'failed', original_name: '', preview_url: null, error_code: job.error_code ?? null, message: job.message ?? null }
    : { id, status: 'processing', original_name: '', preview_url: null };
}

async function read(path: string): Promise<Result<unknown>> {
  if (path === '/session') {
    await call('session');
    return { data: { logged_in: true, csrf_token: '' } };
  }
  const snap = await snapshot();
  const publish = path.match(/^\/publish\/([^/?]+)$/);
  if (publish) return { data: publishOf(snap.jobs[publish[1]], publish[1]) };
  const file = path.match(/^\/files\/([^/?]+)$/);
  if (file) return { data: fileOf(snap, file[1]) };
  if (!(path in snap.collections)) throw notFound();
  return { data: snap.collections[path] };
}

/* ---------- 변경 접수와 적용 기다리기 ---------- */

function readPending(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(PENDING_STORE) ?? '{}') as Record<string, string>; } catch { return {}; }
}
function writePending(change: (pending: Record<string, string>) => void) {
  try {
    const pending = readPending();
    change(pending);
    if (Object.keys(pending).length > 0) localStorage.setItem(PENDING_STORE, JSON.stringify(pending));
    else localStorage.removeItem(PENDING_STORE);
  } catch { /* 보관하지 못하면 다음 저장이 새 접수 번호를 씁니다. */ }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** PATCH /xs/{id}가 결과를 싣지 않았을 때 목록 사본에서 같은 id를 찾습니다. */
function fromCollection(snap: Snapshot, path: string): unknown {
  const match = path.match(/^(.*)\/([^/]+)$/);
  if (!match) return snap.collections[path];
  const list = snap.collections[match[1]];
  return Array.isArray(list) ? list.find((item: { id?: string }) => item?.id === match[2]) : snap.collections[path];
}

async function mutate(method: Method, path: string, body: unknown): Promise<Result<unknown>> {
  if (method === 'DELETE' && path === '/session') return { data: undefined };
  if (path === '/publish') throw notSupported('다시 반영');
  if (/^\/files\/[^/]+\/retry$/.test(path)) throw notSupported('파일 가공 다시 시도');
  if (method === 'DELETE') throw notSupported('삭제');

  const { version, ...rest } = (body ?? {}) as { version?: number };
  const expected = method === 'PATCH' ? version : undefined;
  const payload = method === 'PATCH' ? rest : body ?? null;
  const fingerprint = JSON.stringify([method, path, payload, expected ?? null]);
  const request_id = readPending()[fingerprint] ?? crypto.randomUUID();
  writePending((pending) => { pending[fingerprint] = request_id; });

  await call('submitMutation', { request_id, method, path, body: payload, expected_version: expected });

  const started = Date.now();
  while (Date.now() - started < WAIT_LIMIT_MS) {
    await sleep(WAIT_POLL_MS);
    const snap = await snapshot(true).catch(() => null);
    const job = snap?.jobs[request_id];
    if (!snap || !job) continue;
    if (job.state === 'failed') {
      writePending((pending) => { delete pending[fingerprint]; });
      const [code, message] = job.error_code === 'CONFLICT'
        ? ['CONFLICT', '다른 곳에서 먼저 고쳤습니다. 새로 고친 뒤 다시 저장해 주세요.'] as const
        : ['INTERNAL', job.message || '저장하지 못했습니다.'] as const;
      throw new ApiError(code, message, 0);
    }
    if (!APPLIED.includes(job.state)) continue;
    writePending((pending) => { delete pending[fingerprint]; });
    const data = job.result ?? (method === 'PATCH' ? fromCollection(snap, path) : undefined);
    if (data === undefined) throw new ApiError('INTERNAL', '저장했지만 결과를 읽지 못했습니다. 화면을 새로 고쳐 주세요.', 0);
    return { data, publish: publishOf(job, request_id) };
  }
  throw new ApiError('PENDING', '접수했지만 아직 적용되지 않았습니다. 잠시 뒤 같은 내용으로 다시 저장하면 이어서 기다립니다.', 0);
}

export function request(method: Method, path: string, body?: unknown): Promise<Result<unknown>> {
  return method === 'GET' ? read(path) : mutate(method, path, body);
}

/* ---------- 파일 하나 접수 ---------- */

const uploadIds = new WeakMap<FormData, string>();

/**
 * 기존 files.ts가 만든 FormData(file, purpose)를 접수용 form으로 옮겨 submitFile(form)에 넘깁니다.
 * 같은 FormData로 다시 부르면(다른 파일 처리 중이라 기다린 뒤) 같은 접수 번호를 씁니다.
 */
export async function upload(form: FormData, onProgress?: (percent: number) => void): Promise<Result<unknown>> {
  const file = form.get('file');
  if (!(file instanceof File)) throw new ApiError('VALIDATION_FAILED', '파일을 고르지 않았습니다.', 0);
  const purpose = String(form.get('purpose') ?? '');
  const request_id = uploadIds.get(form) ?? crypto.randomUUID();
  uploadIds.set(form, request_id);

  const element = document.createElement('form');
  element.hidden = true;
  const field = (name: string, value: string) => {
    const input = document.createElement('input');
    input.type = 'hidden'; input.name = name; input.value = value;
    element.append(input);
  };
  field('request_id', request_id);
  field('purpose', purpose);
  const input = document.createElement('input');
  input.type = 'file'; input.name = 'file';
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  element.append(input);
  document.body.append(element);

  onProgress?.(Number.NaN);
  try {
    const receipt = await call<{ request_id: string; file_id: string }>('submitFile', element);
    return { data: { id: receipt.file_id, purpose, status: 'processing', original_name: file.name, preview_url: null } };
  } finally {
    element.remove();
  }
}
