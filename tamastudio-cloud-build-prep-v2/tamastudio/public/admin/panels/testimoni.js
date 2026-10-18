import { op, refresh, readData } from './_ops.js';

export default async function testimoni(v, c) {
  const e = c.esc;
  const rows = await readData(c, 'testimonials.list');
  v.innerHTML = `<h2>Testimoni</h2><div class="grid4">${rows.map((t) => `<article class="card glass"><p class="stars">${'★'.repeat(Math.max(0, Math.min(5, Number(t.rating) || 0)))}</p><p>${e(t.text)}</p><h3>${e(t.name)}</h3><p class="mono">${e(t.orderId)} | ${e(t.status)}</p>${t.reply ? `<p>Balasan: ${e(t.reply)}</p>` : ''}
<div class="cta"><button class="btn gold" type="button" data-a="approved" data-id="${e(t.orderId)}">Setujui</button><button class="btn ghost" type="button" data-a="rejected" data-id="${e(t.orderId)}">Sembunyikan</button><button class="btn ghost" type="button" data-a="reply" data-id="${e(t.orderId)}">Balas</button></div></article>`).join('') || '<p>Belum ada testimoni.</p>'}</div>`;
  v.querySelectorAll('[data-a]').forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.id, a = b.dataset.a, patch = {};
      if (a === 'reply') { const r = (prompt('Balasan untuk klien:') || '').slice(0, 300); if (!r) return; patch.reply = r; } else patch.status = a;
      try { await op(c, 'testimonial.set', Object.assign({ id }, patch)); refresh(); } catch (err) { alert(err.message); }
    };
  });
}
