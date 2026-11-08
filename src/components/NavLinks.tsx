'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from '@/lib/site';
import { langOf } from '@/lib/format';

/** Renders links and marks the one for the current page (aria-current). */
export function NavLinks({ items, className, linkClassName }: { items: NavItem[]; className?: string; linkClassName?: string }) {
  const pathname = usePathname() ?? '/';
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return (
    <ul className={className}>
      {items.map((item) => {
        const current = item.match ? item.match.some((m) => path.startsWith(m)) : path === item.href;
        return (
          <li key={item.href}>
            <Link href={item.href} className={linkClassName} aria-current={current ? 'page' : undefined} lang={langOf(item.title)}>
              {item.title}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
