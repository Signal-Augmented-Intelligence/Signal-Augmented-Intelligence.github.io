import { Redirect, redirectMetadata } from '@/components/Redirect';

export const metadata = redirectMetadata;

export default function Page() {
  return <Redirect to="/members/our-team/" />;
}
