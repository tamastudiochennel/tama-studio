import Scene from '../../components/Scene.js';
import { cmsItems } from '../../lib/cms.js';
import { PORTFOLIO } from '../../lib/defaults.js';
import { safeUrl } from '../../lib/site.js';

export const revalidate = 300;
export const metadata = { title: 'Portofolio', description: 'Proyek yang sudah dikerjakan TS | TAMA STUDIO.' };

export default async function Portofolio() {
  const items = await cmsItems('portfolio', PORTFOLIO);
  const flow = items.slice();
  while (flow.length < 5) flow.push({ title: 'Giliran proyekmu', tag: 'Slot kosong' });
  return (
    <main className="sec page">
      <h1>Portofolio</h1>
      <p>Seret karusel untuk melihat proyek, klik kartu di tengah untuk membuka websitenya.</p>
      <Scene file="coverflow-carousel" data={flow} opt={{ dist: 7 }} label="Karusel 3D proyek portofolio" />
      <div className="grid4">
        {items.map((p) => (
          <article className="card glass" key={p.title}>
            <h3>{p.title}</h3><p>{p.desc}</p>
            <p><a href={safeUrl(p.url)} target="_blank" rel="noopener noreferrer">Buka website</a></p>
          </article>
        ))}
      </div>
    </main>
  );
}
