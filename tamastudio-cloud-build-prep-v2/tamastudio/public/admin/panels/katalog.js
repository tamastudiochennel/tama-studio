import { op, readData } from './_ops.js';
import { PACKAGES } from '/assets/js/data/defaults.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const normalize = (p) => ({
  name: String(p.name || ''), description: String(p.description || ''),
  price: Number.isSafeInteger(p.price) ? p.price : Number(p.price) || 0,
  features: Array.isArray(p.features) ? p.features.map(String) : [],
  revisions: Number.isInteger(p.revisions) ? p.revisions : 1,
  estimatedDays: Number.isInteger(p.estimatedDays) ? p.estimatedDays : 14,
  active: p.active !== false, featured: p.featured === true,
  version: Number.isSafeInteger(p.version) ? p.version : 1,
});
const rp = (price) => 'Rp' + Number(price || 0).toLocaleString('id-ID');

export default async function katalog(v, c) {
  const e = c.esc, q = (s) => v.querySelector(s);
  let items = [];
  v.innerHTML = `<h2>Katalog Paket</h2>
<p>Atur paket yang tampil di halaman publik. Paket nonaktif tidak dapat dipesan. Perubahan harga tidak mengubah snapshot pesanan lama.</p>
<div id="catalog-list" style="margin-top:1rem"></div>
<p class="msg" id="catalog-msg" role="status"></p>
<div class="cta"><button class="btn ghost" id="catalog-add" type="button">Tambah paket</button><button class="btn ghost" id="catalog-preview" type="button">Pratinjau</button><button class="btn gold" id="catalog-save" type="button">Simpan katalog</button></div>
<section id="catalog-preview-area" class="card glass" hidden style="margin-top:1rem"><h3>Pratinjau publik</h3><div id="catalog-preview-items" class="grid4"></div></section>`;
  const say = (text, ok = false) => { q('#catalog-msg').textContent = text || ''; q('#catalog-msg').style.color = ok ? 'var(--gold)' : ''; };
  const blank = () => ({ name: '', description: '', price: 0, features: [], revisions: 1, estimatedDays: 14, active: true, featured: false, version: 1 });

  function draw() {
    q('#catalog-list').innerHTML = items.map((p, i) => `<article class="card glass form" data-i="${i}" style="margin-bottom:1rem;text-align:left;justify-items:stretch">
      <h3>Paket ${i + 1}</h3>
      <label>Nama paket<input data-k="name" maxlength="60" value="${e(p.name)}" required></label>
      <label>Deskripsi singkat<textarea data-k="description" rows="2" maxlength="300">${e(p.description)}</textarea></label>
      <label>Harga final (rupiah)<input data-k="price" type="number" min="1" max="1000000000" step="1" value="${e(p.price)}" required></label>
      <label>Fitur (satu per baris)<textarea data-k="features" rows="4" maxlength="7200">${e(p.features.join('\n'))}</textarea></label>
      <div class="grid4">
        <label>Batas revisi (0 = tanpa batas)<input data-k="revisions" type="number" min="0" max="100" step="1" value="${e(p.revisions)}"></label>
        <label>Estimasi hari kerja<input data-k="estimatedDays" type="number" min="1" max="365" step="1" value="${e(p.estimatedDays)}"></label>
      </div>
      <label class="chk"><input data-k="active" type="checkbox"${p.active ? ' checked' : ''}> Paket aktif dan dapat dipesan</label>
      <label class="chk"><input data-k="featured" type="checkbox"${p.featured ? ' checked' : ''}> Tandai sebagai paket unggulan</label>
      <div class="cta"><button class="btn ghost" type="button" data-op="up">Naik</button><button class="btn ghost" type="button" data-op="down">Turun</button><button class="btn ghost" type="button" data-op="del">Hapus</button></div>
    </article>`).join('') || '<p>Belum ada paket. Klik Tambah paket.</p>';
  }

  async function load() {
    items = clone(PACKAGES).map(normalize);
    try {
      const snap = await readData(c, 'cms.get', { name: 'packages' });
      if (snap && Array.isArray(snap.items)) items = snap.items.map(normalize);
    } catch (error) { say('Katalog bawaan dimuat karena data katalog belum bisa dibaca.'); }
    draw();
  }

  q('#catalog-list').addEventListener('input', (event) => {
    const key = event.target.dataset.k;
    if (!key) return;
    const i = Number(event.target.closest('[data-i]')?.dataset.i);
    if (!Number.isInteger(i) || !items[i]) return;
    if (event.target.type === 'checkbox') items[i][key] = event.target.checked;
    else if (key === 'features') items[i][key] = event.target.value.split('\n').map((x) => x.trim()).filter(Boolean);
    else if (['price', 'revisions', 'estimatedDays'].includes(key)) items[i][key] = event.target.value === '' ? 0 : Number(event.target.value);
    else items[i][key] = event.target.value;
  });

  q('#catalog-list').addEventListener('change', (event) => {
    if (event.target.type === 'checkbox') {
      const key = event.target.dataset.k, i = Number(event.target.closest('[data-i]')?.dataset.i);
      if (key && Number.isInteger(i) && items[i]) items[i][key] = event.target.checked;
    }
  });

  q('#catalog-list').addEventListener('click', (event) => {
    const action = event.target.dataset.op;
    if (!action) return;
    const card = event.target.closest('[data-i]');
    const i = Number(card?.dataset.i);
    if (!Number.isInteger(i) || !items[i]) return;
    if (action === 'del') items.splice(i, 1);
    else {
      const j = action === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= items.length) return;
      [items[i], items[j]] = [items[j], items[i]];
    }
    draw();
  });

  q('#catalog-add').onclick = () => { if (items.length >= 30) return say('Maksimal 30 paket.'); items.push(blank()); draw(); };
  q('#catalog-preview').onclick = () => {
    const box = q('#catalog-preview-area');
    box.hidden = !box.hidden;
    q('#catalog-preview-items').innerHTML = items.filter((p) => p.active).map((p) => `<article class="card glass price"><h3>${e(p.name)}</h3><p class="rp">${rp(p.price)}</p><p>${e(p.description)}</p><ul>${p.features.map((f) => `<li>${e(f)}</li>`).join('')}</ul><p>${p.revisions === 0 ? 'Revisi tanpa batas' : `${e(p.revisions)} kali revisi`} · Estimasi ${e(p.estimatedDays)} hari kerja</p></article>`).join('') || '<p>Tidak ada paket aktif untuk ditampilkan.</p>';
  };

  q('#catalog-save').onclick = async () => {
    try {
      if (!items.length) throw new Error('Katalog harus memiliki minimal satu paket.');
      const names = new Set();
      for (const p of items) {
        const name = p.name.trim().toLowerCase();
        if (!name || names.has(name)) throw new Error('Nama paket wajib diisi dan tidak boleh duplikat.');
        names.add(name);
        if (!Number.isSafeInteger(p.price) || p.price <= 0) throw new Error(`Harga paket ${p.name || '(tanpa nama)'} harus bilangan rupiah positif.`);
        if (!p.features.length || p.features.some((f) => !f || f.length > 240)) throw new Error(`Tambahkan fitur yang valid untuk paket ${p.name}.`);
      }
      q('#catalog-save').disabled = true;
      await op(c, 'catalog.save', { items });
      say('Katalog tersimpan. Perubahan publik mengikuti revalidasi cache halaman.', true);
    } catch (error) { say(error.message); }
    finally { q('#catalog-save').disabled = false; }
  };

  await load();
}
