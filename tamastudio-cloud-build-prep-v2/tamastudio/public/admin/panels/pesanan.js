import { safeImageData } from '/assets/js/core/util.js';
import { readData, op, refresh } from './_ops.js';

const rp = (n) => 'Rp' + Number(n).toLocaleString('id-ID');
const ST = ['Pending', 'Design', 'Development', 'Testing', 'Revision'];
const STATUS = ['menunggu_konfirmasi_harga', 'menunggu_persetujuan_harga', 'menunggu_bayar', 'menunggu_verifikasi', 'aktif', 'selesai', 'ditolak', 'dibatalkan'];
const priceLabel = (n) => Number.isSafeInteger(n) && n > 0 ? rp(n) : 'Menunggu penawaran';

export default async function pesanan(v, c) {
  const e = c.esc;
  const rows = await readData(c, 'orders.list');
  v.innerHTML = `<h2>Pesanan dan pembayaran</h2><div class="form" style="max-width:260px"><label>Filter status<select id="fs"><option value="">Semua</option>${STATUS.map((x) => `<option>${x}</option>`).join('')}</select></label></div>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>Pemesan</th><th>Paket</th><th>Status</th><th>Progres</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>`;
  const tb = v.querySelector('#tb');
  const draw = () => {
    const f = v.querySelector('#fs').value;
    tb.innerHTML = rows.filter((o) => !f || o.status === f).map((o) => `<tr><td class="mono">${e(o.publicId)}</td><td>${e(o.name)}<br><small>${e(o.accountId)}</small></td><td>${e(o.pkg)}<br>${e(priceLabel(o.price))}</td><td>${e(o.status)}</td><td>${e(o.progress)}%</td><td><button class="btn ghost" type="button" data-id="${e(o.publicId)}">Buka</button></td></tr>`).join('') || '<tr><td colspan="6">Tidak ada pesanan.</td></tr>';
    tb.querySelectorAll('[data-id]').forEach((b) => { b.onclick = () => open(rows.find((o) => o.publicId === b.dataset.id)); });
  };
  v.querySelector('#fs').onchange = draw;
  draw();

  async function open(selected) {
    let detail;
    try { detail = await readData(c, 'orders.get', { id: selected.publicId }); }
    catch (error) { alert(error.message); return; }
    const o = detail.order;
    const proof = detail.proof;
    const img = proof && safeImageData(proof.img) ? `<a href="${safeImageData(proof.img)}" target="_blank" rel="noopener"><img src="${safeImageData(proof.img)}" alt="Bukti transfer" style="max-width:100%;max-height:260px;border-radius:10px"></a>` : '<p>Belum ada bukti transfer atau format lampiran tidak valid.</p>';
    const dl = (o.deliverables || []).map((x) => x.name + ' | ' + x.url).join('\n');
    const d = document.createElement('dialog');
    d.style.width = 'min(94vw,560px)';
    const isAdmin = ['owner', 'admin'].includes(c.prof.role);
    let supportUsers = [];
    if (isAdmin) { try { supportUsers = (await readData(c, 'users.support')).filter((u) => !u.blocked); } catch (x) {} }
    d.innerHTML = `<h2>${e(o.pkg)} | ${e(priceLabel(o.price))}</h2><p class="mono">${e(o.publicId)}</p><p>${e(o.name)} (${e(o.username)}) | ${e(o.accountId)}</p><p>Status: ${e(o.status)}${proof && proof.verdict ? ' | bukti: ' + e(proof.verdict) : ''}</p><p>Catatan klien: ${e(o.note)}</p><p>Add-on: ${e([o.addons?.domain && 'domain', o.addons?.hosting && 'hosting', o.addons?.customQuote && 'penawaran khusus'].filter(Boolean).join(', ') || 'tidak ada')}</p>${isAdmin ? `<label>Support penanggung jawab<select id="assignee"><option value="">Tidak ditugaskan</option>${supportUsers.map((u) => `<option value="${e(u.uid)}"${u.uid === o.assignedSupportUid ? ' selected' : ''}>${e(u.name)}</option>`).join('')}</select></label><button class="btn ghost" id="assign" type="button">Simpan penugasan</button>` : ''}${img}
<div class="form" style="margin-top:1rem"><label>Tahap<select id="st">${ST.map((x) => `<option${x === o.stage ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
<label>Progres: <b id="pv">${Math.min(99, Number(o.progress) || 0)}</b>%<input type="range" id="pr" min="0" max="99" value="${Math.min(99, Number(o.progress) || 0)}"></label>
<label>Berkas hasil (satu per baris: Nama | https://tautan)<textarea id="dl" rows="3">${e(dl)}</textarea></label></div>
<p class="msg" id="dm" role="alert"></p>
<div class="cta">${isAdmin ? '<button class="btn gold" id="ok" type="button">Simpan progres</button>' : ''}${isAdmin && ['menunggu_konfirmasi_harga', 'menunggu_persetujuan_harga'].includes(o.status) ? '<button class="btn gold" id="quote" type="button">Tetapkan / ubah harga final</button>' : ''}${isAdmin && o.status === 'menunggu_verifikasi' ? '<button class="btn ghost" id="vf" type="button">Verifikasi pembayaran</button><button class="btn ghost" id="rj" type="button">Tolak pembayaran</button>' : ''}${isAdmin && o.status === 'aktif' ? '<button class="btn ghost" id="fin" type="button">Tandai selesai</button>' : ''}<button class="btn ghost" id="cl" type="button">Tutup</button></div>`;
    document.body.append(d);
    d.addEventListener('close', () => d.remove());
    const q = (s) => d.querySelector(s);
    q('#pr').oninput = () => { q('#pv').textContent = q('#pr').value; };
    q('#cl').onclick = () => d.close();
    const links = () => q('#dl').value.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p[0] && /^https?:\/\//i.test(p[1] || '')).map((p) => ({ name: p[0], url: p[1] }));
    const go = (name, extra) => async () => {
      try { await op(c, name, Object.assign({ id: o.publicId }, extra ? extra() : {})); d.close(); refresh(); } catch (err) { q('#dm').textContent = err.message; }
    };
    if (q('#ok')) q('#ok').onclick = go('order.save', () => ({ stage: q('#st').value, progress: Number(q('#pr').value), deliverables: links() }));
    if (q('#vf')) q('#vf').onclick = go('order.verify');
    if (q('#fin')) q('#fin').onclick = go('order.finish', () => ({ deliverables: links() }));
    if (q('#rj')) q('#rj').onclick = () => {
      const reason = (prompt('Alasan penolakan:') || '').slice(0, 200);
      if (reason) go('order.reject', () => ({ reason }))();
    };
    if (q('#assign')) q('#assign').onclick = async () => {
      try { await op(c, 'order.assign', { id: o.publicId, uid: q('#assignee').value }); d.close(); refresh(); } catch (err) { q('#dm').textContent = err.message; }
    };
    if (q('#quote')) q('#quote').onclick = async () => {
      const raw = prompt('Masukkan harga final dalam rupiah. Harga dasar saat ini: ' + rp(o.basePrice || 0));
      if (raw === null) return;
      const price = Number(raw.trim());
      if (!Number.isSafeInteger(price) || price <= 0) { q('#dm').textContent = 'Harga harus bilangan rupiah positif.'; return; }
      try { await op(c, 'order.price', { id: o.publicId, price }); d.close(); refresh(); } catch (err) { q('#dm').textContent = err.message; }
    };
    d.showModal();
  }
}
