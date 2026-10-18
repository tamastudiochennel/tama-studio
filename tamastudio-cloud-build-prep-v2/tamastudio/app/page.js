import Scene from '../components/Scene.js';
import HomeFx from '../components/HomeFx.js';
import { cmsItems } from '../lib/cms.js';
import { SERVICES, PACKAGES } from '../lib/defaults.js';
import { wa, rp } from '../lib/site.js';

export const revalidate = 300;
const STEPS = [['Konsultasi', 'Ceritakan kebutuhanmu lewat WhatsApp.'], ['Pesan', 'Pilih paket dan isi detail pesanan.'], ['Bayar manual', 'Transfer ke GoPay admin, lalu unggah bukti.'], ['Tracking realtime', 'Pantau progres 0 sampai 100 persen di dashboard.'], ['Selesai dan review', 'Terima hasil akhir, lalu beri ulasan.']];

export default async function Home() {
  const [services, packages] = await Promise.all([cmsItems('services', SERVICES), cmsItems('packages', PACKAGES)]);
  const hello = wa('Halo TS | TAMA STUDIO, saya ingin konsultasi.');
  return (
    <main>
      <HomeFx />
      <section className="hero">
        <div className="hero-copy">
          <h1>Website, aplikasi Android, dan sistem custom yang dikerjakan di depan matamu.</h1>
          <p>Konsultasi gratis, bayar manual lewat GoPay, lalu pantau progres proyekmu dari 0 sampai 100 persen secara realtime.</p>
          <div className="cta"><a className="btn gold" href={hello}>Konsultasi lewat WhatsApp</a><a className="btn ghost" href="#paket">Lihat paket</a></div>
        </div>
        <Scene file="hero-isometric-workspace" opt={{ ortho: 4.6 }} className="scene hero-scene" label="Ilustrasi 3D meja kerja studio, bisa diputar dengan menyeret" />
      </section>

      <section id="layanan" className="sec">
        <h2>Yang kami kerjakan</h2>
        <div className="grid4">{services.map((s) => <article className="card glass" key={s.name}><h3>{s.name}</h3><p>{s.desc}</p></article>)}</div>
      </section>

      <section id="proses" className="sec split">
        <div>
          <h2>Dari konsultasi sampai selesai</h2>
          <ol className="steps">{STEPS.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}</ol>
        </div>
        <Scene file="timeline-staircase" opt={{ dist: 9 }} className="scene" label="Tangga 3D lima langkah, bola emas naik mengikuti scroll" />
      </section>

      <section id="teknologi" className="sec">
        <h2>Teknologi yang kami pakai</h2>
        <p>Putar silinder dengan menyeret, atau scroll halaman.</p>
        <Scene file="tech-cylinder" opt={{ dist: 9 }} className="scene wide" label="Silinder 3D berisi nama teknologi" />
      </section>

      <section className="sec split">
        <Scene file="globe-connections" opt={{ dist: 7.5 }} className="scene" label="Globe 3D dengan garis koneksi antar kota" />
        <div><h2>Klien dari mana saja</h2><p>Konsultasi, pembayaran, sampai serah terima dilakukan online, jadi lokasi bukan hambatan.</p></div>
      </section>

      <section id="paket" className="sec">
        <h2>Paket</h2>
        <div className="grid4">
          {packages.map((p) => (
            <article className="card glass price" key={p.name}>
              <h3>{p.name}</h3><p className="rp">{rp(p.price)}</p>
              <ul>{(p.features || []).map((f) => <li key={f}>{f}</li>)}</ul>
              <a className="btn gold" href={'/pesan?paket=' + encodeURIComponent(p.name)}>Pesan paket ini</a>
              <a className="btn ghost" href={wa('Halo, saya ingin konsultasi paket ' + p.name)}>Tanya paket ini</a>
            </article>
          ))}
        </div>
      </section>

      <section id="kontak" className="sec">
        <div className="box glass"><h2>Mulai dengan satu pesan</h2><p>Ceritakan ide atau masalahmu. Kami balas lewat WhatsApp.</p><a className="btn gold" href={hello}>Chat 0882-0023-40869</a></div>
      </section>
    </main>
  );
}
