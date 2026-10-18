import Scene from '../../components/Scene.js';
import { cmsItems } from '../../lib/cms.js';
import { PACKAGES } from '../../lib/defaults.js';
import { wa, rp } from '../../lib/site.js';

export const revalidate = 300;
export const metadata = { title: 'Paket', description: 'Paket harga pembuatan website dan aplikasi dari TS | TAMA STUDIO.' };

export default async function Paket() {
  const items = await cmsItems('packages', PACKAGES);
  return (
    <main className="sec page">
      <h1>Paket</h1>
      <p>Pilih paket yang paling dekat dengan kebutuhanmu. Domain dan hosting bisa ditambahkan saat memesan.</p>
      <Scene file="tilt-pricing-cards" data={items.map((p) => ({ name: p.name, price: rp(p.price) }))} opt={{ dist: 9 }} label="Kartu paket 3D yang miring mengikuti kursor" />
      <div className="grid4">
        {items.map((p) => (
          <article className="card glass price" key={p.name}>
            <h3>{p.name}</h3><p className="rp">{rp(p.price)}</p>
            <ul>{(p.features || []).map((f) => <li key={f}>{f}</li>)}</ul>
            <a className="btn gold" href={'/pesan?paket=' + encodeURIComponent(p.name)}>Pesan paket ini</a>
            <a className="btn ghost" href={wa('Halo, saya ingin konsultasi paket ' + p.name)}>Tanya paket ini</a>
          </article>
        ))}
      </div>
    </main>
  );
}
