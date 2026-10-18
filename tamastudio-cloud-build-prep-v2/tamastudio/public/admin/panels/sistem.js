import { op, readData } from './_ops.js';

const COLS = ['users', 'orders', 'testimonials', 'cms'];

export default async function sistem(v, c) {
  let n;
  try { n = await readData(c, 'system.counts'); } catch (e) { n = { users: '-', orders: '-', testimonials: '-', admin_logs: '-' }; }
  v.innerHTML = `<h2>Sistem dan backup</h2>
<div class="grid4"><article class="card glass"><h3>${n.users}</h3><p>Pengguna</p></article><article class="card glass"><h3>${n.orders}</h3><p>Pesanan</p></article><article class="card glass"><h3>${n.testimonials}</h3><p>Testimoni</p></article><article class="card glass"><h3>${n.admin_logs}</h3><p>Entri log</p></article></div>
<h3 class="sub">Backup</h3><p>Unduh salinan data (pengguna, pesanan, testimoni, konten, dan indeks ID) sebagai file JSON. Ekspor manual dibatasi 5.000 dokumen per koleksi; jika terlampaui, gunakan backup otomatis atau ekspor tersegmentasi. Bukti transfer tidak ikut. File berisi data pribadi, simpan di tempat aman.</p>
<div class="cta"><button class="btn gold" id="bk" type="button">Backup sekarang</button></div><p class="msg" id="bm" role="alert"></p>`;
  v.querySelector('#bk').onclick = async () => {
    const m = v.querySelector('#bm');
    m.textContent = 'Menyiapkan...';
    try {
      const out = await readData(c, 'system.export');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
      a.download = 'backup-tamastudio-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      await c.audit('backup sekarang', '');
      m.textContent = 'Backup diunduh.';
    } catch (err) { m.textContent = err.message; }
  };

  const box = document.createElement('div');
  box.innerHTML = '<h3 class="sub">Backup otomatis harian</h3><p>Server membuat salinan data tiap hari dan menyimpannya 14 hari. Unduh dari daftar ini. Bukti transfer tidak disertakan dalam backup otomatis.</p><div class="cta" id="bl"><p>Memuat...</p></div><h3 class="sub">Pulihkan konten (CMS)</h3><p>Pilih file backup, lalu paket, layanan, portofolio, dan FAQ dikembalikan. Data pengguna dan pesanan tidak dipulihkan dari sini.</p><div class="form" style="max-width:420px"><input type="file" id="rf" accept="application/json"></div><p class="msg" id="rm" role="alert"></p>';
  v.append(box);
  const q = (s) => box.querySelector(s);
  const dl = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click(); };
  op(c, 'backup.list').then((r) => {
    q('#bl').innerHTML = r.keys.length ? r.keys.map((k) => `<button class="btn ghost" type="button" data-k="${c.esc(k)}">${c.esc(k.slice(7, 17))}</button>`).join('') : '<p>Belum ada backup otomatis. Yang pertama dibuat dalam 24 jam setelah deploy.</p>';
    q('#bl').querySelectorAll('[data-k]').forEach((b) => {
      b.onclick = async () => { try { const r2 = await op(c, 'backup.get', { key: b.dataset.k }); dl(b.dataset.k, r2.data); } catch (e) { q('#rm').textContent = e.message; } };
    });
  }).catch((e) => { q('#bl').innerHTML = `<p class="msg">${c.esc(e.message)}</p>`; });
  q('#rf').onchange = async () => {
    const m = q('#rm');
    try {
      const data = JSON.parse(await q('#rf').files[0].text());
      let n = 0;
      for (const r of Array.isArray(data.cms) ? data.cms : []) {
        if (['packages', 'services', 'portfolio', 'faq'].includes(r.id) && Array.isArray(r.items)) { if (r.id === 'packages') await op(c, 'catalog.save', { items: r.items }); else await op(c, 'cms.save', { name: r.id, items: r.items }); n++; }
      }
      m.style.color = n ? 'var(--gold)' : '';
      m.textContent = n ? 'Konten dipulihkan: ' + n + ' bagian.' : 'Tidak ada konten CMS di file ini.';
    } catch (e) { m.style.color = ''; m.textContent = e.message; }
  };
}
