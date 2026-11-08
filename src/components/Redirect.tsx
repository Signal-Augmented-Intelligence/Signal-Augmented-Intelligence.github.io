import Link from 'next/link';

/** Static stand-in for a server redirect (GitHub Pages has none): old URLs forward to their new page. */
export function Redirect({ to }: { to: string }) {
  return (
    <div className="container" style={{ paddingTop: 72 }}>
      <meta httpEquiv="refresh" content={`0; url=${to}`} />
      <link rel="canonical" href={to} />
      <p>This page has moved to <Link href={to}>{to}</Link>.</p>
    </div>
  );
}

export const redirectMetadata = { robots: { index: false, follow: true } };
