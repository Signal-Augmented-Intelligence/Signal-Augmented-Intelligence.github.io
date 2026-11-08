import Link from 'next/link';
import { type Person, personHref } from '@/lib/content';

/**
 * A name that links to the member's place on Members when it matches content/people.yml.
 * linkFaculty={false} keeps the professor as plain text (publication author lists).
 */
export function PersonName({ name, people, linkFaculty = true }: { name: string; people: Person[]; linkFaculty?: boolean }) {
  const person = people.find((p) => p.name === name || p.id === name || p.aliases.includes(name));
  if (!person) return <>{name}</>;
  const label = person.id === name ? person.name : name;   // keep the spelling printed in the paper
  if (!linkFaculty && person.group === 'faculty') return <>{label}</>;
  return <Link href={personHref(person)} className="person-link">{label}</Link>;
}
