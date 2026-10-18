import { readData, op, refresh } from './_ops.js';

const ST = ['Pending', 'Design', 'Development', 'Testing', 'Revision', 'Completed'];
const DEF = { Pending: 0, Design: 20, Development: 45, Testing: 70, Revision: 85, Completed: 100 };

export default async function kanban(v, c) {
  const e = c.esc;
  const rows = (await readData(c, 'orders.kanban')).filter((o) => ['aktif', 'selesai'].includes(o.status));
  const col = (s) => rows.filter((o) => s === 'Completed' ? o.status === 'selesai' : o.status === 'aktif' && (o.stage || 'Pending') === s);
  v.innerHTML = `<h2>Kanban proyek</h2><p>Seret kartu antar kolom, atau pakai pilihan tahap di kartu (untuk HP). Pindah ke Completed menandai pesanan selesai.</p>
<div class="kb">${ST.map((s) => `<div class="kc" data-s="${s}"><h3>${s} (${col(s).length})</h3>${col(s).map((o) => `<div class="kk" draggable="${o.status !== 'selesai'}" data-id="${e(o.publicId)}"><b>${e(o.pkg)}</b><br><span class="mono">${e(o.publicId)}</span><br>${e(o.name)} | ${e(o.progress)}%<select data-id="${e(o.publicId)}" aria-label="Pindah tahap">${(o.status === 'selesai' ? ['Completed'] : ST.filter((x) => x !== 'Completed')).map((x) => `<option${x === s ? ' selected' : ''}>${x}</option>`).join('')}</select></div>`).join('')}</div>`).join('')}</div>`;
  async function move(id, stage) {
    const o = rows.find((x) => x.publicId === id);
    if (!o || o.status === 'selesai' || (o.stage || 'Pending') === stage) return;
    if (c.prof.role === 'support' && o.assignedSupportUid !== c.user.uid) return alert('Proyek ini tidak ditugaskan kepadamu.');
    try {
      if (stage === 'Completed') {
        if (!['owner', 'admin'].includes(c.prof.role)) return alert('Hanya admin yang dapat menyelesaikan proyek.');
        await op(c, 'order.finish', { id });
      } else await op(c, 'order.move', { id, stage });
      refresh();
    } catch (err) { alert(err.message); }
  }
  v.querySelectorAll('.kk[draggable="true"]').forEach((k) => k.addEventListener('dragstart', (ev) => ev.dataTransfer.setData('text/plain', k.dataset.id))); 
  v.querySelectorAll('select[data-id]').forEach((s) => { s.onchange = () => move(s.dataset.id, s.value); });
  v.querySelectorAll('.kc').forEach((k) => {
    k.addEventListener('dragover', (ev) => { ev.preventDefault(); k.classList.add('over'); });
    k.addEventListener('dragleave', () => k.classList.remove('over'));
    k.addEventListener('drop', (ev) => { ev.preventDefault(); k.classList.remove('over'); move(ev.dataTransfer.getData('text/plain'), k.dataset.s); });
  });
}
