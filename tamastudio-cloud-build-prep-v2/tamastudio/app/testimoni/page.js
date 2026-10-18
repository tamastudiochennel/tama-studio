import Scene from '../../components/Scene.js';
import { approvedTestimonials } from '../../lib/cms.js';

export const revalidate = 300;
export const metadata = { title: 'Testimoni', description: 'Testimoni dari klien TS | TAMA STUDIO yang pesanannya sudah selesai.' };

export default async function Testimoni() {
  const list = await approvedTestimonials();
  return (
    <main className="sec page">
      <h1>Testimoni</h1>
      <p>Hanya klien yang pesanannya sudah selesai yang bisa menulis testimoni.</p>
      <Scene file="star-orbit" opt={{ dist: 7 }} label="Bintang emas 3D yang mengorbit" />
      <div className="grid4">
        {list.length ? list.map((t, i) => {
          const n = Math.max(0, Math.min(5, Number(t.rating) || 0));
          return (
            <article className="card glass" key={i}>
              <p className="stars" aria-label={n + ' dari 5 bintang'}>{'★'.repeat(n) + '☆'.repeat(5 - n)}</p>
              <p>{t.text}</p><h3 style={{ marginTop: '.8rem' }}>{t.name}</h3>
              {t.reply ? <p><b>Balasan admin:</b> {t.reply}</p> : null}
            </article>
          );
        }) : <p>Belum ada testimoni yang ditampilkan.</p>}
      </div>
    </main>
  );
}
