import { op, readData } from './_ops.js';

const SEG = { all: 'Semua pengguna', ordered: 'Pernah memesan', active: 'Proyek sedang dikerjakan', done: 'Pesanan selesai' };

export default async function broadcast(v, c) {
  const e = c.esc, q = (s) => v.querySelector(s);
  const sources = await readData(c, 'broadcast.sources');
  const users = sources.users.filter((u) => u.role === 'client' && !u.blocked);
  const orders = sources.orders;
  const has = (u, f) => orders.some((o) => o.uid === u.id && f(o));
  const pick = (s) => users.filter((u) => s === 'all' || (s === 'ordered' && has(u, () => true)) || (s === 'active' && has(u, (o) => o.status === 'aktif')) || (s === 'done' && has(u, (o) => o.status === 'selesai')));
  v.innerHTML = `<h2>Broadcast</h2><p>Pesan dikirim lewat WhatsApp dan email milikmu sendiri: kamu klik tiap tautan untuk mengirim. Tulis {nama} untuk menyapa dengan nama.</p>
<div class="form" style="max-width:560px"><label>Segmen<select id="sg">${Object.entries(SEG).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></label>
<label>Pesan<textarea id="ms" rows="4">Halo {nama}, </textarea></label><button class="btn gold" id="go" type="button">Tampilkan penerima</button></div>
<div id="out" style="margin-top:1.2rem"></div>`;
  q('#go').onclick = async () => {
    const seg = q('#sg').value, list = pick(seg), msg = q('#ms').value, withWa = list.filter((u) => u.wa);
    q('#out').innerHTML = `<p>${list.length} penerima di segmen ini, ${withWa.length} punya nomor WhatsApp.</p>
<div class="grid4">${withWa.map((u) => `<article class="card glass"><h3>${e(u.displayName)}</h3><p class="mono">${e(u.publicId)}</p><a class="btn gold" target="_blank" rel="noopener" href="https://wa.me/${e(u.wa)}?text=${encodeURIComponent(msg.replace(/\{nama\}/g, u.displayName))}">Kirim WhatsApp</a></article>`).join('')}</div>
<div class="cta" style="margin-top:1rem"><button class="btn ghost" id="em" type="button">Ambil email (maks. 100 pertama)</button></div><div id="el" class="cta" style="margin-top:.8rem"></div>`;
    try { await c.audit('broadcast: ' + SEG[seg] + ' (' + list.length + ')', ''); } catch (x) {}
    q('#em').onclick = async () => {
      const el = q('#el');
      try {
        const r = await op(c, 'users.emails', { uids: list.map((u) => u.id).slice(0, 100) });
        const body = encodeURIComponent(msg.replace(/\{nama\}/g, 'Kak')), chunks = [];
        for (let i = 0; i < r.emails.length; i += 30) chunks.push(r.emails.slice(i, i + 30));
        el.innerHTML = chunks.length ? chunks.map((ch, i) => `<a class="btn ghost" href="mailto:?bcc=${encodeURIComponent(ch.join(','))}&subject=${encodeURIComponent('Info dari TS | TAMA STUDIO')}&body=${body}">Buka email ${i + 1} (${ch.length} penerima)</a>`).join('') : '<p>Tidak ada email.</p>';
      } catch (err) { el.innerHTML = `<p class="msg">${e(err.message)}</p>`; }
    };
  };
}
