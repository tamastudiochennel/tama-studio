import Scene from '../../components/Scene.js';
import { cmsItems } from '../../lib/cms.js';
import { FAQ } from '../../lib/defaults.js';

export const revalidate = 300;
export const metadata = { title: 'FAQ', description: 'Pertanyaan yang sering ditanyakan tentang pemesanan, pembayaran, dan pengerjaan.' };

export default async function Faq() {
  const items = await cmsItems('faq', FAQ);
  return (
    <main className="sec page">
      <h1>FAQ</h1>
      <p>Jawaban untuk pertanyaan yang paling sering masuk.</p>
      <Scene file="question-crystal" opt={{ dist: 6 }} label="Kristal 3D bertanda tanya" />
      <div className="faq" style={{ marginTop: '1.5rem', maxWidth: 720 }}>
        {items.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
      </div>
    </main>
  );
}
