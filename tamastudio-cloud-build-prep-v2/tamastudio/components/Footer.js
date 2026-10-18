import { SITE, wa } from '../lib/site.js';

export default function Footer() {
  return (
    <footer className="foot">
      <span>&copy; {new Date().getFullYear()} {SITE.name}</span>
      <span><a href={wa('Halo TS | TAMA STUDIO, saya ingin konsultasi.')}>{SITE.waDisplay}</a> | <a href={'mailto:' + SITE.email}>{SITE.email}</a></span>
    </footer>
  );
}
