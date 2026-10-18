import { safeImageData } from '/assets/js/core/util.js';
import { readData } from './_ops.js';

const rp = (n) => 'Rp' + Number(n).toLocaleString('id-ID');
const priceText = (n) => Number.isSafeInteger(n) && n > 0 ? rp(n) : 'Menunggu penawaran';
const when = (t) => (t && typeof t.toDate === 'function' ? t.toDate().toLocaleString('id-ID') : '-');

export default function home(v, c) {
  const e = c.esc;
  v.innerHTML = `<h2>Ringkasan</h2>
<div class="grid4"><article class="card glass"><h3>Sesi</h3><p>${e(c.prof.username)} (${e(c.prof.role)})</p><p>Sidik perangkat: <span class="mono">${e(c.dev)}</span></p><p id="idle"></p></article>
<article class="card glass"><h3>Keamanan</h3><p>Gerbang aplikasi memerlukan verifikasi GitHub lalu Google. Pastikan 2-Step Verification juga aktif di pengaturan akun Google. Sesi berakhir otomatis setelah 15 menit tanpa aktivitas; satu sesi server aktif per akun. Aksi penting dicatat di log.</p></article></div>
<h2 style="margin-top:2rem">Cari ID</h2><p>Masukkan ID akun (TS-U-...) atau ID pesanan (TS-O-...). Cocok untuk laporan pesanan yang hilang.</p>
<form id="sf" class="form" style="max-width:520px;margin-top:.8rem"><input id="q" placeholder="TS-O-XXXXXX atau TS-U-XXXXXX" autocomplete="off" required><button class="btn gold" type="submit">Cari</button></form><div id="res" style="margin-top:1rem"></div>`;
  const tick = () => {
    const el = v.querySelector('#idle');
    if (!el || !el.isConnected) return clearInterval(t);
    const s = Math.ceil(c.idleLeft() / 1000);
    el.textContent = `Sesi berakhir dalam ${Math.floor(s / 60)} menit ${s % 60} detik jika tidak ada aktivitas.`;
  };
  const t = setInterval(tick, 1000);
  tick();

  const order = (o, proof) => `<div class="card glass"><h3>${e(o.pkg)} | ${e(priceText(o.price))}</h3><p class="mono">${e(o.publicId)}</p>
<p>Status: ${e(o.status)} | Progres: ${e(o.progress)}% | Tahap: ${e(o.stage)}</p><p>Pemesan: ${e(o.name)} (${e(o.username)}) | ID akun: ${e(o.accountId)}</p>
<p>Add-on: ${[o.addons && o.addons.domain && 'domain', o.addons && o.addons.hosting && 'hosting', o.addons && o.addons.customQuote && 'penawaran khusus'].filter(Boolean).join(', ') || '-'} | Dibuat: ${e(when(o.createdAt))}</p><p>Catatan: ${e(o.note)}</p>
${proof && safeImageData(proof.img) ? `<a href="${safeImageData(proof.img)}" target="_blank" rel="noopener"><img src="${safeImageData(proof.img)}" alt="Bukti transfer" style="max-width:240px;border-radius:10px"></a>` : '<p>Belum ada bukti transfer atau format lampiran tidak valid.</p>'}</div>`;

  v.querySelector('#sf').onsubmit = async (ev) => {
    ev.preventDefault();
    const id = v.querySelector('#q').value.trim().toUpperCase(), out = v.querySelector('#res');
    out.innerHTML = '<p>Mencari...</p>';
    try {
      const result = await readData(c, 'home.lookup', { id });
      if (!result.found) { out.innerHTML = '<p>ID tidak ditemukan.</p>'; return; }
      await c.audit('cari ID ' + id, id);
      if (result.kind === 'account') {
        const d = result.user;
        out.innerHTML = `<div class="card glass"><h3>${e(d.displayName)}</h3><p>Username: ${e(d.username)} | Peran: ${e(d.role)}${d.blocked ? ' | DIBLOKIR' : ''}</p><p class="mono">${e(d.publicId)}</p><p>Daftar: ${e(when(d.createdAt))}</p></div><h3 style="margin:1rem 0 .6rem">Pesanan akun ini</h3>${(result.orders || []).map((o) => order(o)).join('') || '<p>Belum ada pesanan.</p>'}`;
      } else out.innerHTML = result.order ? order(result.order, result.proof) : '<p>ID terdaftar, tetapi dokumen pesanannya tidak ada.</p>';
    } catch (err) {
      out.innerHTML = `<p class="msg">${e(err.message)}</p>`;
    }
  };
  return () => clearInterval(t);
}
