import { AdminBanner } from '@admin/components/AdminBanner';
import { AdminShell } from '@admin/components/AdminShell';
import { ResearchScreen } from './ResearchScreen';

export const metadata = { title: 'Research' };

export default function ResearchPage() {
  return <><AdminBanner title="Research" /><AdminShell><ResearchScreen /></AdminShell></>;
}
