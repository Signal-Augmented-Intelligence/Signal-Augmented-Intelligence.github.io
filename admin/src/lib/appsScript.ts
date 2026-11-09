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
// An authenticated tab rechecks its session every 30 seconds. Keep its snapshot
// warm between those checks so moving between sections does not wait on Drive.
const SNAPSHOT_MS = 45_000;
const WAIT_POLL_MS = 3000;
const WAIT_LIMIT_MS = 10 * 60 * 1000;
const PENDING_STORE = 'sai-admin:apps-script-requests';

const MESSAGES: Record<string, [ErrorCode, string]> = {
  UNAUTHENTICATED: ['UNAUTHENTICATED', 'Google 계정을 확인하지 못했습니다. Google에 로그인한 뒤 다시 열어 주세요.'],
  FORBIDDEN: ['FORBIDDEN', '이 Google 계정에는 관리 권한이 없습니다.'],
  VALIDATION_FAILED: ['VALIDATION_FAILED', '보낸 내용을 받지 못했습니다. 입력을 확인해 주세요.'],
  FILE_TOO_LARGE: ['FILE_TOO_LARGE', '파일이 20 MB를 넘습니다.'],
  UPLOAD_BUSY: ['BUSY', '처리를 기다리는 파일이 많습니다. 차례가 오면 이어서 올립니다.'],
  CONFLICT: ['CONFLICT', '같은 접수 번호로 다른 내용이 이미 접수됐습니다. 새로고침한 뒤 다시 저장해 주세요.'],
  CONFIGURATION_REQUIRED: ['STORAGE_UNAVAILABLE', '관리 저장소 설정이 끝나지 않았습니다.'],
  INBOX_UNAVAILABLE: ['STORAGE_UNAVAILABLE', '이 계정의 접수 폴더를 쓸 수 없습니다.'],
};
const NETWORK_MESSAGE = '관리 화면에 연결할 수 없습니다. 공개 사이트는 그대로 보입니다.';

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

let cached: { at: number; value: Snapshot } | null = null;
let loading: Promise<Snapshot> | null = null;
let requested = 0;
let applied = 0;

function remember(value: Snapshot, order: number) {
  // A slower, earlier request must not replace a newer snapshot.
  if (order < applied) return;
  applied = order;
  cached = { at: Date.now(), value };
}

/** Share one in-flight read and reuse the verified snapshot while the session is warm. */
function snapshot(fresh = false): Promise<Snapshot> {
  if (!fresh && cached && Date.now() - cached.at < SNAPSHOT_MS) return Promise.resolve(cached.value);
  if (loading) return loading;
  const order = ++requested;
  const value = call<Snapshot>('snapshot').then((result) => {
    remember(result, order);
    return result;
  }).finally(() => { if (loading === value) loading = null; });
  loading = value;
  return value;
}

const notFound = () => new ApiError('NOT_FOUND', '찾을 수 없습니다. 목록을 새로고침해 주세요.', 404);

/** 공개 반영 작업(실행기가 사본의 collections['/publish-jobs']에 실음). request_ids는 그 작업이 실은 접수 번호. */
type SitePublish = { id: string; state: 'queued' | 'running' | 'deploying' | 'done' | 'failed'; message?: string | null;
  request_ids?: string[] };
/**
 * 접수 하나가 실린 공개 반영 작업. 저장 결과가 공개 반영 작업 자체인 접수(다시 반영)는 그 작업 번호로 찾습니다.
 * 사본에 목록이 없으면(이전 실행기) undefined.
 */
function sitePublishOf(snap: Snapshot, job: Job | undefined, requestId: string): SitePublish | undefined {
  const jobs = snap.collections['/publish-jobs'];
  if (!Array.isArray(jobs)) return undefined;
  const ownId = (job?.result as { id?: unknown } | null | undefined)?.id;
  return (jobs as SitePublish[]).find((item) => item?.request_ids?.includes(requestId)
    || (typeof ownId === 'string' && ownId.startsWith('pub_') && item?.id === ownId));
}
/**
 * 저장과 공개 사이트 반영은 따로입니다. 공개 반영 작업이 사본에 있으면 그 상태(배포 중도 '반영 중'),
 * 없으면 이전처럼 접수 작업 상태로 판단합니다(실행이 끝나야 공개 완료).
 */
function publishOf(snap: Snapshot, job: Job | undefined, id: string): Publish {
  const site = sitePublishOf(snap, job, id);
  if (site?.state === 'done') return { id, state: 'done' };
  if (site?.state === 'failed') return { id, state: 'failed', message: site.message ?? null };
  if (site) return { id, state: site.state === 'queued' ? 'queued' : 'running' };
  if (!job) return { id, state: 'queued' };
  if (job.state === 'done') return { id, state: 'done' };
  if (job.state === 'failed') return { id, state: 'failed', message: job.message ?? null };
  // Saved but still publishing the site: the worker records the result first.
  return { id, state: APPLIED.includes(job.state) || job.result != null ? 'running' : 'queued' };
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
    const order = ++requested;
    const value = call<{ session: { authenticated: boolean }; snapshot: Snapshot }>('bootstrap').then((first) => {
      if (!first.session.authenticated) throw new ApiError('UNAUTHENTICATED', MESSAGES.UNAUTHENTICATED[1], 0);
      remember(first.snapshot, order);
      return first.snapshot;
    }).finally(() => { if (loading === value) loading = null; });
    loading = value;
    await value;
    return { data: { logged_in: true, csrf_token: '' } };
  }
  const publish = path.match(/^\/publish\/([^/?]+)$/);
  const file = path.match(/^\/files\/([^/?]+)$/);
  // These two paths are polled while work is running; a cached result would
  // make a completed save or file appear stuck until the cache expires.
  const snap = await snapshot(Boolean(publish || file));
  if (publish) {
    const job = snap.jobs[publish[1]];
    if (!job) throw notFound();
    return { data: publishOf(snap, job, publish[1]) };
  }
  if (file) return { data: fileOf(snap, file[1]) };
  if (!(path in snap.collections)) throw notFound();
  return { data: snap.collections[path] };
}

/* ---------- 변경 접수와 적용 기다리기 ---------- */

/**
 * 저장은 끝났지만(결과가 사본에 실림) 같은 실행의 공개 사이트 반영이 아직인 접수 번호.
 * 화면 아래에 "저장됨 · 공개 사이트 반영 중"으로 보이고, 실행이 끝나면(done·failed) 알림 없이 빠집니다.
 */
const SITE_STORE = 'sai-admin:site-publishing';
const REQUEST_ID = /^[a-f0-9-]{36}$/;
const siteListeners = new Set<(count: number) => void>();
function readSite(): string[] {
  try { const raw = localStorage.getItem(SITE_STORE); return raw ? (JSON.parse(raw) as string[]).filter((id) => REQUEST_ID.test(id)) : []; } catch { return []; }
}
function writeSite(ids: string[]) {
  try { if (ids.length > 0) localStorage.setItem(SITE_STORE, JSON.stringify(ids)); else localStorage.removeItem(SITE_STORE); } catch { /* 이 창에서만 보입니다. */ }
  siteListeners.forEach((listener) => listener(ids.length));
}
export function onSitePublishing(listener: (count: number) => void): () => void {
  siteListeners.add(listener);
  listener(readSite().length);
  return () => { siteListeners.delete(listener); };
}
/** 사본을 새로 읽어 실행이 끝난 접수 번호를 뺍니다. 남은 개수를 돌려줍니다. */
export async function refreshSitePublishing(): Promise<number> {
  const ids = readSite();
  if (ids.length === 0) return 0;
  const snap = await snapshot(true);
  const left = ids.filter((id) => {
    const job = snap.jobs[id];
    if (!job) return false;
    const state = publishOf(snap, job, id).state;
    return state !== 'done' && state !== 'failed';
  });
  writeSite(left);
  return left.length;
}

/** 기다리는 변경의 단계. sending: 보내는 중, received: 접수됨(소유자 작업 대기), applying: 적용·반영 처리 중. */
export type PendingStage = 'sending' | 'received' | 'applying';
const pendingStages = new Map<string, PendingStage>();
const pendingListeners = new Set<(stages: PendingStage[]) => void>();
function setPending(id: string, stage: PendingStage | null) {
  if (stage) pendingStages.set(id, stage); else pendingStages.delete(id);
  const stages = [...pendingStages.values()];
  pendingListeners.forEach((listener) => listener(stages));
}
/** 저장을 기다리는 동안 화면 아래에 상태를 보이려고 씁니다 (admin/gas/PendingNotice.tsx). */
export function onPending(listener: (stages: PendingStage[]) => void): () => void {
  pendingListeners.add(listener);
  listener([...pendingStages.values()]);
  return () => { pendingListeners.delete(listener); };
}

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

export type RecoveredRequest = { id: string; label: string;
  phase: 'unconfirmed' | 'received' | 'applying' | 'saved' | 'done' | 'failed'; message: string | null };

/** Find accepted saves left behind when the tab was closed before a result arrived. */
export async function recoverPendingRequests(): Promise<RecoveredRequest[]> {
  const entries = Object.entries(readPending()).filter(([, id]) => !pendingStages.has(id));
  if (!entries.length) return [];
  const snap = await snapshot(true);
  const labels: Record<string, string> = { lab: '랩 정보', poem: '시', professor: '교수님 페이지',
    seminars: '세미나', albums: '행사', people: '멤버', publications: '논문',
    news: '소식', notices: '공지', 'home-slides': '첫 화면 사진', 'research-areas': '연구 분야', publish: '공개 반영' };
  return entries.map(([fingerprint, id]) => {
    let route = '';
    try { route = String(JSON.parse(fingerprint)?.[1] ?? ''); } catch { /* Old receipt: use a generic label. */ }
    const label = labels[route.split('/')[1]] ?? '관리 항목';
    const job = snap.jobs[id];
    const phase = !job ? 'unconfirmed' : ['received', 'stored', 'queued'].includes(job.state) ? 'received'
      : job.state === 'failed' ? 'failed'
        : job.state === 'done' ? 'done'
          : job.result != null || APPLIED.includes(job.state) ? 'saved' : 'applying';
    return { id, label, phase,
      message: !job ? '접수 기록을 찾는 중입니다. 잠시 후에도 그대로면 같은 내용으로 다시 저장해 주세요.'
        : job.state === 'failed' ? job.message ?? '작업 기록을 확인해 주세요.' : null };
  });
}

export function dismissRecoveredRequest(id: string): void {
  writePending((pending) => {
    for (const [fingerprint, savedId] of Object.entries(pending)) if (savedId === id) delete pending[fingerprint];
  });
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

  const { version, ...rest } = (body ?? {}) as { version?: number };
  const versioned = method === 'PATCH' || method === 'DELETE';
  const expected = versioned ? version : undefined;
  const payload = versioned ? rest : body ?? null;
  const fingerprint = JSON.stringify([method, path, payload, expected ?? null]);
  const request_id = readPending()[fingerprint] ?? crypto.randomUUID();
  writePending((pending) => { pending[fingerprint] = request_id; });

  setPending(request_id, 'sending');
  try {
    await call('submitMutation', { request_id, method, path, body: payload, expected_version: expected });
    setPending(request_id, 'received');
    return await waitApplied(request_id, method, path, fingerprint);
  } finally {
    setPending(request_id, null);
  }
}

async function waitApplied(request_id: string, method: Method, path: string, fingerprint: string): Promise<Result<unknown>> {
  const started = Date.now();
  while (Date.now() - started < WAIT_LIMIT_MS) {
    await sleep(WAIT_POLL_MS);
    const snap = await snapshot(true).catch(() => null);
    const job = snap?.jobs[request_id];
    if (!snap || !job) continue;
    if (job.state !== 'received' && job.state !== 'stored') setPending(request_id, 'applying');
    if (job.state === 'failed' && !(job.error_code === 'PUBLISH_FAILED' && job.result != null)) {
      writePending((pending) => { delete pending[fingerprint]; });
      const [code, message] = job.error_code === 'CONFLICT'
        ? ['CONFLICT', '다른 곳에서 먼저 수정했습니다. 새로고침한 뒤 다시 저장해 주세요.'] as const
        : ['INTERNAL', job.message || '저장하지 못했습니다.'] as const;
      throw new ApiError(code, message, 0);
    }
    // The worker records the result before publishing the site, so a result means the save is done.
    if (!APPLIED.includes(job.state) && job.state !== 'failed' && job.result == null) continue;
    writePending((pending) => { delete pending[fingerprint]; });
    const site = publishOf(snap, job, request_id).state;
    if (site !== 'done' && site !== 'failed') writeSite([...new Set([...readSite(), request_id])]);
    const data = path === '/publish' ? publishOf(snap, job, request_id)
      : job.result ?? (method === 'PATCH' ? fromCollection(snap, path) : undefined);
    if (data === undefined) throw new ApiError('INTERNAL', '저장했지만 결과를 읽지 못했습니다. 화면을 새로고침해 주세요.', 0);
    return { data, publish: publishOf(snap, job, request_id) };
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

