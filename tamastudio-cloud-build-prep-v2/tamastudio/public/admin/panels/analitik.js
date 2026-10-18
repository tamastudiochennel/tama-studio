import { readData } from './_ops.js';
import { scene } from '/assets/js/core/page3d.js';

const rp = (n) => 'Rp' + Number(n).toLocaleString('id-ID');

export default async function analitik(v, c) {
  const summary = await readData(c, 'analytics');
  const days = summary.days || [];
  const wait = summary.waiting ?? '-';
  const act = summary.active ?? '-';
  const t = days.find((d) => d.day === new Date().toLocaleDateString('sv-SE'));
  const total = days.reduce((s, d) => s + (d.revenue || 0), 0);
  v.innerHTML = `<h2>Analitik</h2><div class="grid4"><article class="card glass"><h3>${rp(t ? t.revenue : 0)}</h3><p>Pendapatan hari ini</p></article><article class="card glass"><h3>${rp(total)}</h3><p>14 hari terakhir</p></article><article class="card glass"><h3>${wait}</h3><p>Menunggu verifikasi</p></article><article class="card glass"><h3>${act}</h3><p>Proyek aktif</p></article></div>
<div class="scene strip" id="bc" role="img" aria-label="Grafik batang 3D pendapatan harian"></div><p id="cap" class="mono">${days.length ? 'Arahkan kursor ke batang untuk melihat nilainya.' : 'Belum ada data. Grafik terisi setelah pembayaran diverifikasi.'}</p>`;
  scene(v.querySelector('#bc'), 'bar-chart-3d', { days: days.map((d) => ({ label: d.day.slice(5), value: d.revenue || 0 })) }, { dist: 11 });
}
