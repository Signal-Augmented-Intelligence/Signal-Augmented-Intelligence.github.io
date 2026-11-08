import { AdminBanner } from '@admin/components/AdminBanner';
import { AdminShell } from '@admin/components/AdminShell';
import { MembersScreen } from './MembersScreen';

export const metadata = { title: 'Members' };

export default function MembersPage() {
  return <><AdminBanner title="Members" /><AdminShell><MembersScreen /></AdminShell></>;
}
