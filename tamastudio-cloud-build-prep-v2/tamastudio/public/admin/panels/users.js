import { op, refresh, readData } from './_ops.js';

export default async function users(v, c) {
  const e = c.esc, owner = c.prof.role === 'owner';
  const rows = await readData(c, 'users.list');
  v.innerHTML = `<h2>Pengguna</h2><div class="form" style="max-width:420px"><input id="q" placeholder="Cari nama, username, atau ID akun"></div>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nama</th><th>ID akun</th><th>Peran</th><th>Status</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>`;
  const tb = v.querySelector('#tb');
  const upd = async (u, name, params) => {
    try { await op(c, name, Object.assign({ uid: u.id }, params)); refresh(); } catch (err) { alert(err.message); }
  };
  const draw = () => {
    const q = v.querySelector('#q').value.trim().toLowerCase();
    const list = rows.filter((u) => !q || [u.displayName, u.username, u.publicId].join(' ').toLowerCase().includes(q));
    tb.innerHTML = list.map((u) => `<tr><td>${e(u.displayName)}<br><small>${e(u.username)}</small></td><td class="mono">${e(u.publicId)}</td><td>${owner && u.id !== c.user.uid ? `<select data-r="${e(u.id)}">${['client', 'support', 'admin', 'owner'].map((r) => `<option${r === u.role ? ' selected' : ''}>${r}</option>`).join('')}</select>` : e(u.role)}</td><td>${u.blocked ? 'Diblokir: ' + e(u.blockedReason) : 'Aktif'}</td><td>${u.id === c.user.uid ? '' : `<button class="btn ghost" type="button" data-b="${e(u.id)}">${u.blocked ? 'Buka blokir' : 'Blokir'}</button>`}</td></tr>`).join('') || '<tr><td colspan="5">Tidak ada pengguna.</td></tr>';
    tb.querySelectorAll('[data-b]').forEach((b) => {
      const u = rows.find((x) => x.id === b.dataset.b);
      b.onclick = () => {
        if (u.blocked) return upd(u, 'user.unblock', {});
        const r = (prompt('Alasan blokir:') || '').slice(0, 200);
        if (r) upd(u, 'user.block', { reason: r });
      };
    });
    tb.querySelectorAll('[data-r]').forEach((s) => { s.onchange = () => upd(rows.find((x) => x.id === s.dataset.r), 'user.role', { role: s.value }); });
  };
  v.querySelector('#q').oninput = draw;
  draw();
}
