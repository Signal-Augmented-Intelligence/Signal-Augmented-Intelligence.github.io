import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { getLab } from '@/lib/content';

export const metadata: Metadata = { title: 'Contact', description: 'Contact SAI Lab, Hanshin University.' };

export default function ContactPage() {
  const lab = getLab();
  return (
    <>
      <PageHeader title="Contact" />
      <div className="container">
        <p>{lab.name}, {lab.full_name}</p>
        <p>{lab.institution}</p>
        {lab.location && <p>{lab.location}</p>}
        {lab.email ? <p><a href={`mailto:${lab.email}`}>{lab.email}</a></p> : <p className="muted">Official contact details will be posted here.</p>}
      </div>
    </>
  );
}
