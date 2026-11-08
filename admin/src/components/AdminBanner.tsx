import ph from '@/components/PageHeader.module.css';

/**
 * 관리 화면의 남색 띠: 제목만 둡니다. 설명 문장은 넣지 않습니다(규칙 문서 1부 1장 5).
 * 공개 사이트 PageHeader와 같은 스타일 파일을 쓰되, 아래 여백(gap)은 두지 않습니다.
 */
export function AdminBanner({ title }: { title: string }) {
  return (
    <div className={ph.banner}>
      <div className="container">
        <h1 className={ph.title}>{title}</h1>
      </div>
    </div>
  );
}
