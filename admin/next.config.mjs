/**
 * 관리 화면: 공개 사이트와 따로 빌드하는 정적 앱입니다 (`npm run build:admin` → admin/out/).
 * GitHub Pages에는 올리지 않고, 랩 서버가 관리 서버와 같은 주소로 내보냅니다.
 * 공개 사이트의 디자인 토큰·글꼴·컴포넌트는 ../src 에서 그대로 가져다 씁니다 (tsconfig의 @/).
 */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
