/** api.md에 적힌 응답 모양 (쓰는 것만). */
export type Common = { id: string; hidden: boolean; sort_order: number; version: number; updated_at: string };

export type Presenter = { person_id: string } | { name: string };
export type Seminar = Common & {
  date: string;
  presenter: Presenter;
  title: string;
  summary: string;
  area_id: string | null;
  pdf_file_id: string | null;
  cover_file_id: string | null;
  highlight: boolean;
  publication: { state: 'publishing' | 'published' | 'failed'; job_id: string | null; message: string | null; commit_sha: string | null };
};
export type SeminarArea = Common & { name: string; seminar_count: number };
export type PickerPerson = { id: string; name: string; name_ko: string; group: string };
export type MemberGroup = 'faculty' | 'phd' | 'ms' | 'undergrad' | 'alumni';
export type Member = Common & {
  name: string; name_ko: string; aliases: string[]; group: MemberGroup; role: string;
  /** 학부생의 학년 1~4, 없으면 null. 서버가 아직 받지 않으면 빠져서 옵니다. */
  grade?: number | null;
  since: string; until: string;
  /** 한 줄 소개: bio는 한국어, bio_en은 영어. bio_en은 서버가 아직 받지 않으면 빠져서 옵니다. */
  bio: string; bio_en?: string; url: string; after: string;
  /** 학교 메일(@hs.ac.kr)만. 서버가 아직 받지 않으면 빠져서 옵니다. */
  email?: string;
  photo_file_id: string | null; photo_preview_url: string | null;
  /** Absent on older management server releases. */
  publication?: ContentPublication | { state: 'unverified'; job_id: null; message: null; commit_sha: null };
};

export type System = {
  storage: { connected: boolean };
  last_publish?: LastRun | null;
  last_backup?: LastRun | null;
  limits: { seminar_pdf_upload_mb: number; seminar_pdf_public_mb: number; photo_mb: number; photo_types: string[] };
  password_rule: string;
};

/** 앨범 행사 (api.md 6장). 목록에서는 photos 없이 photo_count만 옵니다. */
export type Album = Common & {
  slug: string;
  date: string; // YYYY-MM-DD 또는 YYYY-MM
  title: string;
  cover_photo_id: string | null;
  photo_count: number;
  /** 목록에서만: 대표 사진(없으면 숨기지 않은 첫 사진)의 미리보기. 보일 사진이 없으면 null. */
  cover_preview_url?: string | null;
  publication: ContentPublication;
  photos?: AlbumPhoto[];
};
export type AlbumPhoto = Common & { file_id: string; preview_url: string | null; alt: string };

/** 첫 화면 사진 (api.md 7장). note는 관리 화면에서만 보입니다. */
export type HomeSlide = Common & { file_id: string; preview_url: string | null; note: string; publication: ContentPublication };
export type ContentPublication = { state: 'publishing' | 'published' | 'failed'; job_id: string | null;
  message: string | null; commit_sha: string | null };
export type LabInfo = { id: 'main'; name: string; full_name: string; name_ko: string;
  institution: string; advisor: string; intro: string; email: string; location: string; logo: string;
  draft: boolean; version: number; updated_at: string; publication: ContentPublication };
export type ProfessorSection = 'links' | 'education' | 'career' | 'research_areas' | 'teaching' |
  'publications' | 'software' | 'patents' | 'projects' | 'services' | 'student_awards';
export type ProfessorItem = { id: string | null; hidden: boolean; data: Record<string, string> };
export type ProfessorInfo = { id: 'main'; name: string; name_ko: string; position: string; affiliation: string;
  field: string; office: string; email: string; phone: string; photo: string; bio: string; keywords: string;
  sources_note: string; sections: Record<ProfessorSection, ProfessorItem[]>;
  version: number; updated_at: string; publication: ContentPublication };
export type PoemStanza = { id: string; lines: string[]; hidden: boolean };
export type PoemInfo = { id: 'main'; title: string; hero: number; credit: string;
  stanzas: PoemStanza[]; version: number; updated_at: string; publication: ContentPublication };

/** GET /system의 마지막 반영·백업 (api.md 4장). */
export type LastRun = { id?: string; state: 'queued' | 'running' | 'done' | 'failed'; finished_at: string | null; message?: string | null };

/* ---------- Research, News (설계: SAI-Lab-관리화면-Research-News-설계.md, API는 관리 서버 반영 전) ---------- */

/** 논문 저자 한 명: 멤버면 person_id, 외부 저자면 이름. 순서가 저자 순서입니다. */
export type Author = { person_id: string } | { name: string };
export type PublicationType = 'journal' | 'conference-paper' | 'conference-poster' | 'other';
export type Publication = Common & {
  title: string;
  title_ko: string;
  type: PublicationType;
  authors: Author[];
  venue: string;
  pub_date: string; // YYYY, YYYY-MM, YYYY-MM-DD
  status: string;
  award: string;
  links: { label: string; url: string }[];
  area_ids: string[];
  pdf_file_id: string | null;
  pdf_content_url: string | null;
  excerpt: string;
  body: string;
  /** 관리 서버가 처음 저장할 때 만들고 바꾸지 않음 (연구 분야·News 연결용). 읽기 전용. */
  permalink: string;
  publication: { state: 'publishing' | 'published' | 'failed'; job_id: string | null; message: string | null; commit_sha: string | null };
};
export type ResearchArea = Common & {
  title: string;
  summary: string;
  body: string;
  figure_file_id: string | null;
  figure_preview_url: string | null;
  figure_alt: string;
  figure_caption: string;
  /** 읽기 전용 */
  publication_count: number;
  publication: { state: 'publishing' | 'published' | 'failed'; job_id: string | null; message: string | null; commit_sha: string | null };
};
export type NewsItem = Common & {
  date: string; text: string; publication_id: string | null; link_url: string | null;
  publication: { state: 'publishing' | 'published' | 'failed'; job_id: string | null; message: string | null; commit_sha: string | null };
};
export type NoticeItem = Common & {
  date: string; event_date: string; kind: 'seminar' | 'conference' | 'recruitment' | 'other';
  title: string; body: string; link: string; popup: boolean; pinned: boolean;
  host: string; paper_deadline: string; registration_deadline: string;
  photo_file_id: string | null; photo_preview_url: string | null; publication: ContentPublication;
};
