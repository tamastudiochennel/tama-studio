import { readData } from './_ops.js';

export default async function logs(v, c) {
  const e = c.esc;
  v.innerHTML = `<h2>Log aktivitas</h2>
<form id="lf" class="form" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));align-items:end"><label>Dari<input type="date" id="d1"></label><label>Sampai<input type="date" id="d2"></label><label>Admin<select id="ad"><option value="">Semua</option></select></label><button class="btn gold" type="submit">Terapkan</button></form>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>Admin</th><th>Aksi</th><th>Target</th><th>IP / perangkat</th></tr></thead><tbody id="tb"></tbody></table></div>
<p>Log hanya bisa ditambah, tidak bisa diedit atau dihapus dari dashboard. IP dicatat server untuk login admin; entri tanpa IP berasal dari browser.</p>`;
  const tb = v.querySelector('#tb'), ad = v.querySelector('#ad');
  async function load() {
    const d1 = v.querySelector('#d1').value, d2 = v.querySelector('#d2').value;
    const result = await readData(c, 'logs.list', { from: d1, to: d2 });
    let rows = result.rows || [];
    const names = result.names || {};
    const cur = ad.value;
    ad.innerHTML = '<option value="">Semua</option>' + Object.keys(names).map((id) => `<option value="${e(id)}"${id === cur ? ' selected' : ''}>${e(names[id])}</option>`).join('');
    if (cur) rows = rows.filter((r) => r.adminId === cur);
    tb.innerHTML = rows.map((r) => `<tr><td>${e(r.at && r.at.toDate ? r.at.toDate().toLocaleString('id-ID') : '-')}</td><td>${e(names[r.adminId])}</td><td>${e(r.action)}</td><td class="mono">${e(r.targetId)}</td><td>${e(r.ip || '')} ${e(String(r.ua || '').slice(0, 50))}</td></tr>`).join('') || '<tr><td colspan="5">Belum ada log.</td></tr>';
  }
  v.querySelector('#lf').onsubmit = (ev) => { ev.preventDefault(); load().catch((err) => { tb.innerHTML = `<tr><td colspan="5" class="msg">${e(err.message)}</td></tr>`; }); };
  await load();
}
