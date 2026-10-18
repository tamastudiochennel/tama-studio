import Scene from '../../components/Scene.js';
import { cmsItems } from '../../lib/cms.js';
import { SERVICES } from '../../lib/defaults.js';

export const revalidate = 300;
export const metadata = { title: 'Layanan', description: 'Layanan website, aplikasi Android, UI/UX, dan sistem custom dari TS | TAMA STUDIO.' };

export default async function Layanan() {
  const items = await cmsItems('services', SERVICES);
  return (
    <main className="sec page">
      <h1>Layanan</h1>
      <p>Semua layanan dikerjakan online, dengan progres yang bisa kamu pantau.</p>
      <Scene file="service-planets" data={items} opt={{ dist: 11 }} label="Planet 3D, tiap planet mewakili satu layanan. Seret untuk memutar." />
      <div className="grid4">{items.map((s) => <article className="card glass" key={s.name}><h3>{s.name}</h3><p>{s.desc}</p></article>)}</div>
    </main>
  );
}
