/**
 * 로컬 확인용 가짜 google.script.run (admin/gas-dist/mock.html에만 들어갑니다).
 * apps-script/intake/Code.gs의 공개 함수(session, snapshot, submitMutation, submitFile)와
 * 소유자 작업의 단계 진행(received → stored → applied → publishing → done)을 브라우저 메모리에서 흉내 냅니다.
 * 주소 뒤 ?account=forbidden | none 으로 권한 없음·계정 없음을 시험합니다.
 * 주소 뒤 ?publication=failed 로 모든 항목을 공개 반영 실패 상태로 시작합니다.
 * 콘솔에서 __mock.failNext = 'CONFLICT' | 'WORKFLOW_FAILED' 로 다음 변경 하나를 실패시킵니다.
 */
type Item = Record<string, unknown> & { id: string; version: number; sort_order: number; hidden: boolean };
type Job = { request_id: string; kind: string; state: string; error_code: string | null; message: string | null; result?: unknown };

const now = () => new Date().toISOString();
const params = new URLSearchParams(location.search);
const pub = params.get('publication') === 'failed'
  ? { state: 'failed', job_id: 'job1', message: '공개 반영 작업이 실패했습니다.', commit_sha: null }
  : { state: 'published', job_id: null, message: null, commit_sha: null };
const common = (id: string, sort_order: number) => ({ id, hidden: false, sort_order, version: 1, updated_at: '2026-10-30T09:00:00Z', publication: pub });
const swatch = (color: string, label: string) => `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="100%" height="100%" fill="${color}"/><text x="24" y="296" font-family="sans-serif" font-size="28" fill="#fff">${label}</text></svg>`)}`;

const lists: Record<string, Item[]> = {
  '/people': [
    { ...common('p1', 0), name: 'Minji Kim', name_ko: '김민지', aliases: [], group: 'faculty', role: 'Professor', since: '2019', until: '', bio: '', bio_en: '', url: '', after: '', photo_file_id: null, photo_preview_url: null },
    { ...common('p2', 1), name: 'Jun Lee', name_ko: '이준', aliases: [], group: 'ms', role: 'M.S. Student', since: '2025', until: '', bio: '', bio_en: '', url: '', after: '', photo_file_id: null, photo_preview_url: swatch('#4b6b5a', 'Jun') },
  ],
  '/albums': [
    { ...common('a1', 0), slug: '2026-workshop', date: '2026-09', title: '가을 워크숍', cover_photo_id: 'ph1', photo_count: 2, cover_preview_url: swatch('#2f5d8a', 'workshop') },
  ],
  '/home-slides': [
    { ...common('h1', 0), file_id: 'file_h1', preview_url: swatch('#7a4b2f', 'slide 1'), note: '연구실 전경' },
  ],
  '/seminar-areas': [{ ...common('sa1', 0), name: 'Speech', seminar_count: 1 }],
  '/seminars': [
    { ...common('s1', 0), date: '2026-10-21', presenter: { person_id: 'p2' }, title: 'Whisper 미세조정 실험', summary: '', area_id: 'sa1', pdf_file_id: null, cover_file_id: null, highlight: false },
  ],
  '/research-areas': [
    { ...common('r1', 0), title: 'Speech Recognition', summary: '음성 인식', body: '', figure_file_id: null, figure_preview_url: null, figure_alt: '', figure_caption: '', publication_count: 1 },
  ],
  '/publications': [
    { ...common('pb1', 0), title: 'Robust Korean ASR', title_ko: '', type: 'conference-paper', authors: [{ person_id: 'p2' }, { person_id: 'p1' }], venue: 'Interspeech', pub_date: '2026-09', status: '', award: '', links: [], area_ids: ['r1'], pdf_file_id: null, pdf_content_url: null, excerpt: '', body: '', permalink: '/publications/robust-korean-asr/' },
  ],
  '/news': [{ ...common('n1', 0), date: '2026-10-01', text: '논문이 채택되었습니다.', publication_id: 'pb1', link_url: null }],
  '/notices': [{ ...common('nt1', 0), date: '2026-10-15', event_date: '2026-11-10', kind: 'seminar', title: '11월 세미나', body: '', link: '', popup: false, pinned: false, host: '', paper_deadline: '', registration_deadline: '' }],
};
const photos: Record<string, Item[]> = {
  a1: [
    { ...common('ph1', 0), file_id: 'file_ph1', preview_url: swatch('#2f5d8a', 'photo 1'), alt: '' },
    { ...common('ph2', 1), file_id: 'file_ph2', preview_url: swatch('#5a3f7a', 'photo 2'), alt: '' },
  ],
};
const singles: Record<string, Record<string, unknown> & { version: number }> = {
  '/lab': { id: 'main', name: 'SAI Lab', full_name: 'Signal Augmented Intelligence Lab', name_ko: '신호증강지능연구실', institution: '한신대학교', advisor: '', intro: '', email: '', location: '', draft: false, version: 1, updated_at: '2026-10-30T09:00:00Z', publication: pub },
  '/poem': { id: 'main', title: '', hero: 0, credit: '', stanzas: [], version: 1, updated_at: '2026-10-30T09:00:00Z', publication: pub },
  '/professor': { id: 'main', name: 'Minji Kim', name_ko: '김민지', position: 'Professor', affiliation: '한신대학교', field: '', office: '', email: '', phone: '', photo: '', bio: '', keywords: '', sources_note: '',
    sections: { links: [], education: [{ id: 'pe1', hidden: false, data: { degree: 'Ph.D.', date: '2015', school: '예시대학교' } }], career: [], research_areas: [], teaching: [], publications: [], software: [], patents: [], projects: [], services: [], student_awards: [] },
    version: 1, updated_at: '2026-10-30T09:00:00Z', publication: pub },
};
const files: Record<string, unknown> = {};
const jobs: Record<string, Job> = {};
const fingerprints: Record<string, string> = {};
let activeUpload: string | null = null;
let lastPublish: { id: string; state: string; finished_at: string | null; message?: string | null } | null = { id: 'old', state: 'done', finished_at: '2026-10-30T09:05:00Z' };
const mock = { failNext: null as string | null };
(window as unknown as { __mock: typeof mock }).__mock = mock;

const fail = (code: string) => { throw new Error(code); };
function actor() {
  const account = params.get('account');
  if (account === 'none') fail('UNAUTHENTICATED');
  if (account === 'forbidden') fail('FORBIDDEN');
  return 'lab.member@example.com';
}

function snapshot() {
  actor();
  const collections: Record<string, unknown> = {
    '/system': {
      storage: { connected: true }, last_publish: lastPublish, last_backup: { state: 'done', finished_at: '2026-10-30T03:00:00Z' },
      limits: { seminar_pdf_upload_mb: 20, seminar_pdf_public_mb: 10, photo_mb: 20, photo_types: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] },
      password_rule: '',
    },
    '/people?view=picker': lists['/people'].map(({ id, name, name_ko, group }) => ({ id, name, name_ko, group })),
    ...Object.fromEntries(Object.entries(lists).map(([path, items]) => [path, structuredClone(items)])),
    ...structuredClone(singles),
  };
  for (const album of lists['/albums']) {
    collections[`/albums/${album.id}`] = { ...structuredClone(album), photos: structuredClone(photos[album.id] ?? []) };
  }
  return { format: 1, revision: now(), updated_at: now(), collections, files: structuredClone(files), jobs: structuredClone(jobs) };
}

const MUTATIONS = [
  /^\/(?:seminars|seminar-areas|people|albums|home-slides|research-areas|publications|news|notices)(?:\/[a-zA-Z0-9_-]+)?$/,
  /^\/(?:lab|poem|professor)$/,
  /^\/(?:seminar-areas|research-areas|home-slides)\/order$/,
  /^\/albums\/[a-zA-Z0-9_-]+\/photos(?:\/[a-zA-Z0-9_-]+|\/order)?$/,
];
const ID = /^[a-f0-9-]{36}$/i;

/** 소유자 작업이 하는 일: 버전을 확인하고 바꾼 엔티티를 돌려줍니다. */
function apply(method: string, path: string, body: Record<string, unknown> | null, expected: number | null): unknown {
  const order = path.match(/^(.*)\/order$/);
  const photoPath = path.match(/^\/albums\/([^/]+)\/photos(?:\/([^/]+))?$/);
  if (order) {
    const albumPhotos = order[1].match(/^\/albums\/([^/]+)\/photos$/);
    const list = albumPhotos ? photos[albumPhotos[1]] : lists[order[1]];
    const ids = (body?.ids as string[]) ?? [];
    list.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)).forEach((item, i) => { item.sort_order = i; });
    return structuredClone(list);
  }
  if (singles[path]) {
    if (singles[path].version !== expected) fail('CONFLICT');
    Object.assign(singles[path], body, { version: singles[path].version + 1, updated_at: now() });
    return structuredClone(singles[path]);
  }
  if (photoPath && method === 'POST') {
    const list = (photos[photoPath[1]] ??= []);
    for (const { file_id } of (body?.photos as { file_id: string }[]) ?? []) {
      const info = files[file_id] as { preview_url?: string } | undefined;
      list.push({ ...common(`ph${Date.now()}${list.length}`, list.length), file_id, preview_url: info?.preview_url ?? null, alt: '' });
    }
    const album = lists['/albums'].find((a) => a.id === photoPath[1]);
    if (album) album.photo_count = list.length;
    return structuredClone(list);
  }
  const target = photoPath ? photos[photoPath[1]] : lists[path.replace(/\/[^/]+$/, '')] ?? lists[path];
  if (method === 'POST') {
    const created = { ...common(`x${Date.now()}`, target.length), ...body } as Item;
    if (path === '/home-slides') created.preview_url = (files[body?.file_id as string] as { preview_url?: string })?.preview_url ?? null;
    target.push(created);
    return structuredClone(created);
  }
  const id = path.split('/').pop();
  const item = target?.find((x) => x.id === id);
  if (!item) fail('NOT_FOUND');
  if (item!.version !== expected) fail('CONFLICT');
  if (method === 'DELETE') {
    if (!(item as { hidden?: boolean }).hidden) fail('DELETE_NOT_READY');
    target.splice(target.indexOf(item!), 1);
    return { id, deleted: true };
  }
  Object.assign(item!, body, { version: item!.version + 1, updated_at: now() });
  return structuredClone(item);
}

const later = (ms: number, work: () => void) => setTimeout(work, ms);

function runJob(id: string, work: () => unknown) {
  const job = jobs[id];
  const failure = mock.failNext;
  mock.failNext = null;
  later(1500, () => { job.state = 'stored'; });
  later(3500, () => {
    if (failure === 'CONFLICT') { Object.assign(job, { state: 'failed', error_code: 'CONFLICT', message: '버전이 맞지 않습니다.' }); return; }
    try { job.result = work(); job.state = 'applied'; }
    catch (err) { Object.assign(job, { state: 'failed', error_code: (err as Error).message, message: '적용하지 못했습니다.' }); return; }
    lastPublish = { id, state: 'running', finished_at: null };
    later(2000, () => { job.state = 'publishing'; });
    later(5000, () => {
      if (failure === 'WORKFLOW_FAILED') {
        Object.assign(job, { state: 'failed', error_code: 'WORKFLOW_FAILED', message: '공개 반영 작업이 실패했습니다.' });
        lastPublish = { id, state: 'failed', finished_at: now(), message: job.message };
        return;
      }
      job.state = 'done';
      lastPublish = { id, state: 'done', finished_at: now() };
    });
  });
}

function submitMutation(command: { request_id: string; method: string; path: string; body: unknown; expected_version?: number }) {
  actor();
  const { request_id: id, method, path, body } = command;
  if (!ID.test(id) || !['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) || !MUTATIONS.some((re) => re.test(path))) fail('VALIDATION_FAILED');
  if ((method === 'PATCH' || method === 'DELETE') && !Number.isInteger(command.expected_version)) fail('VALIDATION_FAILED');
  const fingerprint = JSON.stringify([method, path, body, command.expected_version ?? null]);
  if (fingerprints[id]) {
    if (fingerprints[id] !== fingerprint) fail('CONFLICT');
    return { request_id: id, state: 'received' };
  }
  fingerprints[id] = fingerprint;
  jobs[id] = { request_id: id, kind: 'mutation', state: 'received', error_code: null, message: null };
  runJob(id, () => apply(method, path, body as Record<string, unknown> | null, command.expected_version ?? null));
  return { request_id: id, state: 'received' };
}

function submitFile(form: HTMLFormElement) {
  actor();
  const id = String((form.elements.namedItem('request_id') as HTMLInputElement).value);
  const purpose = String((form.elements.namedItem('purpose') as HTMLInputElement).value);
  const file = (form.elements.namedItem('file') as HTMLInputElement).files?.[0];
  if (!ID.test(id) || !file || file.size === 0) fail('VALIDATION_FAILED');
  if (file!.size > 20 * 1024 * 1024) fail('FILE_TOO_LARGE');
  if (activeUpload && activeUpload !== id && !['done', 'failed'].includes(jobs[activeUpload]?.state)) fail('UPLOAD_BUSY');
  const fileId = `file_${id}`;
  if (jobs[id]) return { request_id: id, file_id: fileId, state: 'received' };
  activeUpload = id;
  jobs[id] = { request_id: id, kind: 'file', state: 'received', error_code: null, message: null };
  const url = URL.createObjectURL(file!);
  later(1500, () => { jobs[id].state = 'stored'; });
  later(4000, () => {
    const pdf = file!.type === 'application/pdf';
    files[fileId] = { id: fileId, purpose, status: 'ready', original_name: file!.name, preview_url: pdf ? null : url,
      content_url: pdf ? url : null, public_size_bytes: file!.size, warnings: [] };
    jobs[id].state = 'done';
  });
  return { request_id: id, file_id: fileId, state: 'received' };
}

const api: Record<string, (...args: never[]) => unknown> = { session: () => ({ authenticated: true, email: actor() }),
  bootstrap: () => ({ session: { authenticated: true, email: actor() }, snapshot: snapshot() }), snapshot, submitMutation, submitFile };

function runner(success: (v: unknown) => void = () => {}, failure: (e: Error) => void = () => {}): unknown {
  const self: Record<string, unknown> = {
    withSuccessHandler: (fn: (v: unknown) => void) => runner(fn, failure),
    withFailureHandler: (fn: (e: Error) => void) => runner(success, fn),
  };
  for (const [name, fn] of Object.entries(api)) {
    self[name] = (...args: never[]) => later(300, () => {
      try { success(structuredClone(fn(...args))); } catch (err) { failure(err as Error); }
    });
  }
  return self;
}

(window as unknown as { google: unknown }).google = { script: { get run() { return runner(); } } };
