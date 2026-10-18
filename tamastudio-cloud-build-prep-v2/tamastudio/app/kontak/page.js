import Scene from '../../components/Scene.js';
import ContactForm from '../../components/ContactForm.js';
import { SITE, wa } from '../../lib/site.js';

export const metadata = { title: 'Kontak', description: 'Hubungi TS | TAMA STUDIO lewat WhatsApp atau email.' };

export default function Kontak() {
  return (
    <main className="sec page">
      <h1>Kontak</h1>
      <p>Ceritakan kebutuhanmu, kami balas lewat WhatsApp.</p>
      <Scene file="envelope-wa" opt={{ dist: 7 }} label="Amplop 3D yang terbuka saat disentuh" />
      <div className="grid4">
        <article className="card glass"><h3>WhatsApp</h3><p><a href={wa('Halo TS | TAMA STUDIO, saya ingin konsultasi.')}>{SITE.waDisplay}</a></p></article>
        <article className="card glass"><h3>Email</h3><p><a href={'mailto:' + SITE.email}>{SITE.email}</a></p></article>
      </div>
      <ContactForm />
    </main>
  );
}
