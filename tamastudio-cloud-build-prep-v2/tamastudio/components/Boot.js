'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function Boot() {
  const path = usePathname();
  useEffect(() => { import(/* webpackIgnore: true */ /* turbopackIgnore: true */ '/assets/js/core/guard.js').catch(() => {}); }, []);
  if (path.startsWith('/dashboard')) return null;
  return (
    <button className="cs-fab" type="button" onClick={async () => (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ '/assets/js/core/cs-widget.js')).toggle()}>
      Chat dengan kami
    </button>
  );
}
