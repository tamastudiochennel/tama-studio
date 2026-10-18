'use client';
import { usePathname } from 'next/navigation';
import Header from './Header.js';
import Boot from './Boot.js';
import BgField from './BgField.js';
import { wa } from '../lib/site.js';

export default function Chrome({ children, footer }) {
  const path = usePathname();
  if (path.startsWith('/admin')) return children;
  return (
    <>
      <BgField />
      <Header />
      {children}
      {footer}
      <a className="wa-float" href={wa('Halo TS | TAMA STUDIO, saya ingin konsultasi.')} aria-label="Chat WhatsApp">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /></svg>
      </a>
      <Boot />
    </>
  );
}
