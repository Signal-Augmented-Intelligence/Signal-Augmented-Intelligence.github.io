import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { getPeople, getSeminars } from '@/lib/content';
import { SeminarsExplorer } from './SeminarsExplorer';

export const metadata: Metadata = { title: 'Seminars', description: 'Seminar slides from SAI Lab.' };

/** Adds the presenter's names: English for the list, English and Korean for the search (the data stores a people.yml id or a guest's name). */
function withPresenterNames() {
  const people = getPeople();
  return getSeminars().map((s) => {
    const person = people.find((p) => p.id === s.presenter);
    return { ...s, presenterName: person ? person.name : s.presenter, presenterNames: person ? `${person.name} ${person.name_ko}` : s.presenter };
  });
}

export default function SeminarsPage() {
  return (
    <>
      <PageHeader title="Seminars" />
      <div className="container">
        <SeminarsExplorer seminars={withPresenterNames()} />
      </div>
    </>
  );
}
