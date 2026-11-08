import { AdminBanner } from '@admin/components/AdminBanner';
import { AdminShell } from '@admin/components/AdminShell';
import { NewsScreen } from './NewsScreen';

export const metadata = { title: '뉴스' };

export default function NewsPage() {
  return <><AdminBanner title="뉴스" /><AdminShell><NewsScreen /></AdminShell></>;
}
