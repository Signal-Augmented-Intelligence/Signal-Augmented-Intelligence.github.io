import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';

export default function NotFound() {
  return (
    <>
      <PageHeader title="Page not found" />
      <p className="container">This address has no page. Go to the <Link href="/">home page</Link>.</p>
    </>
  );
}
