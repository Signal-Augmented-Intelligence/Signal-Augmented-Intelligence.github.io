/**
 * 관리 서버 API 연결 (계약: admin/docs/api.md 1장).
 * - 주소는 같은 origin의 /api/v1/. GitHub 등 다른 곳에는 요청하지 않고, 토큰도 갖지 않습니다.
 * - 바꾸는 요청에는 GET /session에서 받은 CSRF 토큰을 X-CSRF-Token으로 붙입니다.
 * - 성공은 `{ data, publish? }`, 실패는 `{ error: { code, message, fields? } }`를 ApiError로 바꿉니다.
 * - 관리 서버에 연결되지 않으면 code "NETWORK"인 ApiError를 던집니다.
 * - 401(로그인 필요·만료)이면 setUnauthenticatedHandler로 넘긴 함수를 부르고 ApiError를 던집니다.
 *   화면은 이 오류를 팝업으로 띄우지 않습니다(signedOut). 그 자리에 로그인 칸이 나옵니다.
 */

import * as appsScript from './appsScript';

const BASE = '/api/v1';

/** Apps Script 전환 빌드인지. 빌드할 때 정해집니다. 기존 빌드는 Apps Script 연결을 부르지 않고 /api/v1만 씁니다. */
export const APPS_SCRIPT = process.env.NEXT_PUBLIC_ADMIN_TRANSPORT === 'apps-script';

export type ErrorCode =
  | 'VALIDATION_FAILED' | 'UNAUTHENTICATED' | 'NOT_FOUND' | 'CONFLICT'
  | 'FILE_TOO_LARGE' | 'UNSUPPORTED_FILE' | 'STORAGE_UNAVAILABLE' | 'INTERNAL'
  | 'NETWORK' | 'FILE_FAILED'
  | 'FORBIDDEN' | 'BUSY' | 'PENDING' | 'NOT_SUPPORTED';
// NETWORK: 관리 서버에 닿지 않음. FILE_FAILED: 파일 처리 결과가 failed (api.md 5장). 둘 다 화면에서만 쓰는 코드입니다.
// FORBIDDEN·BUSY·PENDING·NOT_SUPPORTED: Apps Script 전환 빌드에서만 나옵니다 (lib/appsScript.ts).

export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** 저장 응답에 붙는 공개 반영 정보 (api.md 4장). */
export type Publish = { id: string; state: 'queued' | 'running' | 'done' | 'failed'; message?: string | null };
export type Result<T> = { data: T; publish?: Publish };

const NETWORK_MESSAGE = '관리 서버에 연결할 수 없습니다. 공개 사이트는 그대로 보입니다.';
const FALLBACK_MESSAGE = '요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';

let csrfToken = '';
/** GET /session 응답에서 받은 CSRF 토큰을 기억합니다. 로그인·로그아웃 뒤에도 다시 넣습니다. */
export function setCsrfToken(token: string) {
  csrfToken = token;
}

let onUnauthenticated: () => void = () => {};
/** 로그인이 풀린 응답(401)을 받으면 부를 함수. Session이 넣습니다. */
export function setUnauthenticatedHandler(handler: () => void) {
  onUnauthenticated = handler;
}

/** 로그인이 풀려서 난 오류인지. 이때는 오류 팝업 대신 로그인 칸이 나오므로 화면은 아무것도 하지 않습니다. */
export const signedOut = (err: unknown) => err instanceof ApiError && err.code === 'UNAUTHENTICATED';

function toError(json: unknown, status: number): ApiError {
  const error = (json as { error?: { code?: ErrorCode; message?: string; fields?: Record<string, string> } } | null)?.error;
  const err = new ApiError(error?.code ?? (status === 401 ? 'UNAUTHENTICATED' : 'INTERNAL'), error?.message ?? FALLBACK_MESSAGE, status, error?.fields ?? {});
  if (err.code === 'UNAUTHENTICATED') onUnauthenticated();
  return err;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown): Promise<Result<T>> {
  if (APPS_SCRIPT) {
    try {
      return await appsScript.request(method, path, body) as Result<T>;
    } catch (err) {
      if (err instanceof ApiError && err.code === 'UNAUTHENTICATED') onUnauthenticated();
      throw err;
    }
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, { method, headers, body: payload, credentials: 'same-origin' });
  } catch {
    throw new ApiError('NETWORK', NETWORK_MESSAGE, 0);
  }
  if (response.status === 204) return { data: undefined as T };

  let json: unknown = null;
  try { json = await response.json(); } catch { /* 본문 없음 */ }

  if (!response.ok) throw toError(json, response.status);
  return json as Result<T>;
}

/**
 * 파일 하나 올리기 (api.md 5장). fetch는 올라간 비율을 알려 주지 않아서 이것만 XMLHttpRequest를 씁니다.
 * onProgress에는 0~100을 넘깁니다.
 */
function upload<T>(path: string, form: FormData, onProgress?: (percent: number) => void): Promise<Result<T>> {
  if (APPS_SCRIPT) return appsScript.upload(form, onProgress) as Promise<Result<T>>;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}${path}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    if (csrfToken) xhr.setRequestHeader('X-CSRF-Token', csrfToken);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)); };
    xhr.onerror = () => reject(new ApiError('NETWORK', NETWORK_MESSAGE, 0));
    xhr.onload = () => {
      let json: unknown = null;
      try { json = JSON.parse(xhr.responseText); } catch { /* 본문 없음 */ }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(json as Result<T>);
      reject(toError(json, xhr.status));
    };
    xhr.send(form);
  });
}

export const api = {
  upload,
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};
