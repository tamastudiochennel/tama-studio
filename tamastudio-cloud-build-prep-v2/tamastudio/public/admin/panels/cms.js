import { op, readData } from './_ops.js';
import { SERVICES, PORTFOLIO, FAQ } from '/assets/js/data/defaults.js';

const S = {
  services: { name: 'Layanan', def: SERVICES, blank: () => ({ name: '', desc: '' }), f: [['name', 'Nama layanan', 'text'], ['desc', 'Deskripsi', 'area']] },
  portfolio: { name: 'Portofolio', def: PORTFOLIO, blank: () => ({ title: '', tag: '', desc: '', url: '' }), f: [['title', 'Judul', 'text'], ['tag', 'Label singkat', 'text'], ['desc', 'Deskripsi', 'area'], ['url', 'Tautan website (https://...)', 'text']] },
  faq: { name: 'FAQ', def: FAQ, blank: () => ({ q: '', a: '' }), f: [['q', 'Pertanyaan', 'text'], ['a', 'Jawaban', 'area']] },
};
const copy = (x) => JSON.parse(JSON.stringify(x));

export default async function cms(v, c) {
  const e = c.esc, q = (s) => v.querySelector(s);
  let items = [];
  v.innerHTML = `<h2>Konten situs (CMS)</h2><p>Ubah isi halaman publik lewat formulir, lalu klik Simpan. Pengunjung melihat perubahan setelah cache halaman diperbarui. Harga dan fitur paket dikelola pada menu Katalog Paket.</p>
<div class="form" style="max-width:260px"><label>Bagian<select id="n">${Object.keys(S).map((k) => `<option value="${k}">${S[k].name}</option>`).join('')}</select></label></div>
<div id="list" style="margin-top:1rem"></div><p class="msg" id="m" role="alert"></p>
<div class="cta"><button class="btn ghost" id="add" type="button">Tambah item</button><button class="btn gold" id="sv" type="button">Simpan</button><button class="btn ghost" id="rs" type="button">Kembalikan isi bawaan</button></div>`;
  const say = (t, ok) => { q('#m').textContent = t; q('#m').style.color = ok ? 'var(--gold)' : ''; };
  const draw = () => {
    const sc = S[q('#n').value];
    q('#list').innerHTML = items.map((it, i) => `<div class="card glass form" data-i="${i}"><h3>Item ${i + 1}</h3>${sc.f.map(([k, lb, t]) => `<label>${lb}${t === 'area' || t === 'lines' ? `<textarea data-k="${k}" rows="${t === 'lines' ? 4 : 3}">${e(t === 'lines' ? (it[k] || []).join('\n') : it[k])}</textarea>` : `<input data-k="${k}" type="${t}" value="${e(it[k])}">`}</label>`).join('')}<div class="cta"><button class="btn ghost" type="button" data-op="up">Naik</button><button class="btn ghost" type="button" data-op="down">Turun</button><button class="btn ghost" type="button" data-op="del">Hapus</button></div></div>`).join('') || '<p>Belum ada item. Klik Tambah item.</p>';
  };
  async function load() {
    const n = q('#n').value;
    say('');
    items = copy(S[n].def);
    try { const s = await readData(c, 'cms.get', { name: n }); if (s && Array.isArray(s.items)) items = s.items; } catch (x) {}
    draw();
  }
  q('#list').oninput = (ev) => {
    const k = ev.target.dataset.k;
    if (!k) return;
    const i = Number(ev.target.closest('[data-i]').dataset.i), t = S[q('#n').value].f.find((x) => x[0] === k)[2];
    items[i][k] = t === 'number' ? Number(ev.target.value) : t === 'lines' ? ev.target.value.split('\n').map((x) => x.trim()).filter(Boolean) : ev.target.value;
  };
  q('#list').onclick = (ev) => {
    const op = ev.target.dataset.op;
    if (!op) return;
    const i = Number(ev.target.closest('[data-i]').dataset.i);
    if (op === 'del') items.splice(i, 1);
    else {
      const j = op === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= items.length) return;
      [items[i], items[j]] = [items[j], items[i]];
    }
    draw();
  };
  q('#add').onclick = () => { items.push(S[q('#n').value].blank()); draw(); };
  q('#rs').onclick = () => { items = copy(S[q('#n').value].def); draw(); say('Isi bawaan dimuat. Klik Simpan untuk menerapkannya.', true); };
  q('#n').onchange = load;
  q('#sv').onclick = async () => {
    const n = q('#n').value, first = S[n].f[0][0];
    try {
      if (!items.length) throw new Error('Minimal harus ada satu item.');
      if (items.some((it) => !String(it[first] || '').trim())) throw new Error('Kolom pertama setiap item wajib diisi.');
      if (n === 'packages' && items.some((it) => !(Number(it.price) > 0))) throw new Error('Harga paket harus berupa angka lebih dari 0.');
      if (n === 'portfolio' && items.some((it) => it.url && !/^https?:\/\//i.test(it.url))) throw new Error('Tautan harus diawali https://');
      await op(c, 'cms.save', { name: n, items });
      say('Tersimpan.', true);
    } catch (err) { say(err.message); }
  };
  await load();
}
