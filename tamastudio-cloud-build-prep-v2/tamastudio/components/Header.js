'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [['/layanan', 'Layanan'], ['/paket', 'Paket'], ['/portofolio', 'Portofolio'], ['/testimoni', 'Testimoni'], ['/faq', 'FAQ'], ['/kontak', 'Kontak']];

export default function Header() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <header className={'nav' + (open ? ' open' : '')} id="nav">
      <Link className="brand" href="/">
        <img src="https://i.postimg.cc/XJvGhxHV/tama-studio-logo-new.jpg" alt="" width="34" height="34" />
        <span>TS | TAMA STUDIO</span>
      </Link>
      <button className="burger" type="button" aria-label="Buka menu" aria-expanded={open} onClick={() => setOpen(!open)}><i /><i /></button>
      <nav className="menu" onClick={() => setOpen(false)}>
        <Link href="/">Beranda</Link>
        {LINKS.map(([h, t]) => <Link key={h} href={h} aria-current={path === h ? 'page' : undefined}>{t}</Link>)}
        <a href="/dashboard">Dashboard</a>
        <a href="/masuk">Masuk</a>
      </nav>
    </header>
  );
}
