import { wa } from '../config.js';
import { auth, db, onAuthStateChanged, signOut, getProfile, linkGithub, hasGithub, saveWa } from '../core/auth.js';
import { esc, safeUrl, safeImageData } from '../core/util.js';
import { compressImage } from '../core/orders.js';
import { scene } from '../core/page3d.js';
import { collection, doc, getDoc, setDoc, updateDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

export default function mountDashboard() {
  let disposed = false, authUnsub = null, orderUnsub = null, chatUnsub = null;
  const sceneDisposers = [], toastTimers = new Set();
  function trackScene(el, file, data, opt) {
    if (!el) return;
    scene(el, file, data, opt).then((dispose) => {
      if (typeof dispose !== 'function') return;
      if (disposed || !el.isConnected) dispose();
      else sceneDisposers.push(dispose);
    }).catch(() => {});
  }
  function stopSubscriptions() {
    orderUnsub?.(); orderUnsub = null;
    chatUnsub?.(); chatUnsub = null;
    sceneDisposers.splice(0).forEach((dispose) => { try { dispose(); } catch (error) {} });
    toastTimers.forEach((timer) => clearTimeout(timer));
    toastTimers.clear();
  }

const $ = (s) => document.querySelector(s);
const app = $('#app');
const rp = (n) => 'Rp' + Number(n).toLocaleString('id-ID');
const priceText = (n) => Number.isSafeInteger(n) && n > 0 ? rp(n) : 'Harga menunggu konfirmasi';
const LBL = { menunggu_konfirmasi_harga: 'Menunggu konfirmasi harga', menunggu_persetujuan_harga: 'Menunggu persetujuan harga', menunggu_bayar: 'Menunggu pembayaran', menunggu_verifikasi: 'Menunggu verifikasi', aktif: 'Dikerjakan', selesai: 'Selesai', ditolak: 'Pembayaran ditolak', dibatalkan: 'Dibatalkan' };
const S = { progress: 0 }, P = { glow: 0 };
const fail = (e) => esc(e.code === 'permission-denied' ? 'Akses ditolak. Pastikan aturan Firestore sudah dipublikasikan.' : e.message);
const SKELETON = `<div class="d-head"><div id="dh"></div><span class="chip" id="chip"></span></div>
<div class="scene road" id="road" role="img" aria-label="Jalan 3D progres proyek. Seret untuk memutar."></div>
<div class="bar"><i id="fill"></i></div>
<p><span class="big" id="pct">0%</span> <span id="stg"></span></p>
<div class="cta" id="acts"></div>
<h3 class="sub">Berkas hasil</h3><div class="cta" id="dl"></div><div id="rv"></div>`;
const prev = {};
let orders = [], sel = new URLSearchParams(location.search).get('id'), booted = false;

authUnsub = onAuthStateChanged(auth, async (user) => {
  if (disposed) return;
  if (!user) { booted = false; stopSubscriptions(); app.innerHTML = '<h1>Dashboard</h1><p>Masuk dulu untuk melihat pesananmu.</p><a class="btn gold" href="/masuk">Masuk atau daftar</a>'; return; }
  if (booted) return;
  try {
    const prof = await getProfile(user.uid);
    if (disposed) return;
    if (!prof) app.innerHTML = '<h1>Dashboard</h1><p>Selesaikan akunmu dulu dengan memilih username.</p><a class="btn gold" href="/masuk">Selesaikan akun</a>';
    else if (prof.blocked) app.innerHTML = `<h1>Akun diblokir</h1><p>Alasan: ${esc(prof.blockedReason || 'tidak disebutkan')}.</p>`;
    else { booted = true; boot(user, prof); }
  } catch (e) {
    if (!disposed) app.innerHTML = `<h1>Dashboard</h1><p class="msg">${fail(e)}</p>`;
  }
});

function boot(user, prof) {
  if (disposed) return;
  app.innerHTML = `<h1>Halo, ${esc(prof.displayName)}</h1><p>Pantau pesananmu, kirim gambar, dan chat dengan admin dari sini.</p>
<div class="dash"><aside class="side">
  <div class="card glass"><h3>Akunmu</h3><p>Username: ${esc(prof.username)}</p><p>ID akun: <span class="mono">${esc(prof.publicId)}</span></p><p>Kirim ID akun atau ID pesanan ke admin kalau butuh bantuan.</p>
    <form class="send" id="wf" style="margin-top:.6rem"><input id="wi" placeholder="Nomor WhatsApp" inputmode="tel" value="${esc(prof.wa || '')}"><button class="btn ghost" type="submit">Simpan</button></form>
    <div class="cta" style="margin-top:.8rem"><button class="btn ghost" id="cp" type="button">Salin ID akun</button>${hasGithub(user) ? '' : '<button class="btn ghost" id="gh" type="button">Hubungkan GitHub</button>'}<button class="btn ghost" id="so" type="button">Keluar</button></div><p class="msg" id="am" role="alert"></p></div>
  <div class="card glass stats" id="stats"></div>
  <div><h3 style="margin-bottom:.6rem">Pesanan</h3><div id="olist"></div><a class="btn gold" href="/pesan">Pesan paket baru</a></div>
</aside>
<section class="side">
  <div class="card glass" id="detail"><p>Memuat pesanan...</p></div>
  <div class="card glass"><h3>Chat dengan admin</h3><div class="msgs" id="msgs" aria-live="polite"></div>
    <form class="send" id="sf"><input id="st" placeholder="Tulis pesan" maxlength="1000" autocomplete="off"><button class="btn gold" type="submit">Kirim</button></form>
    <div class="portal" id="pt"><div class="scene" id="pscene" role="img" aria-label="Portal 3D untuk mengirim gambar"></div><span>Tarik gambar ke portal atau klik untuk memilih. File lain: kirim tautan Google Drive lewat chat.</span><input type="file" id="pf" accept="image/jpeg,image/png,image/webp" hidden></div>
    <p class="msg" id="cm" role="alert"></p></div>
</section></div>`;

  $('#cp').onclick = () => navigator.clipboard.writeText(prof.publicId).then(() => { $('#cp').textContent = 'Tersalin'; });
  $('#so').onclick = () => signOut(auth);
  $('#wf').onsubmit = async (e) => {
    e.preventDefault();
    try { const wa = await saveWa(user.uid, $('#wi').value); if (!disposed && $('#am')) { prof.wa = wa; $('#am').textContent = 'Nomor WhatsApp tersimpan.'; } } catch (err) { if (!disposed && $('#am')) $('#am').textContent = err.message; }
  };
  if ($('#gh')) $('#gh').onclick = async () => {
    try { await linkGithub(); if (!disposed) $('#gh')?.remove(); } catch (e) { if (!disposed && $('#am')) $('#am').textContent = e.code === 'auth/credential-already-in-use' ? 'Akun GitHub itu sudah terhubung ke pengguna lain.' : e.message; }
  };

  orderUnsub = onSnapshot(query(collection(db, 'orders'), where('uid', '==', user.uid)), (s) => {
    if (disposed) return;
    orders = s.docs.map((d) => d.data()).sort((a, b) => ((b.createdAt && b.createdAt.seconds) || 0) - ((a.createdAt && a.createdAt.seconds) || 0));
    if (!orders.some((o) => o.publicId === sel)) sel = orders[0] && orders[0].publicId;
    orders.forEach((o) => {
      const p = prev[o.publicId];
      if (p && (p.progress !== o.progress || p.status !== o.status || p.stage !== o.stage)) toast(`Pesanan ${o.publicId}: ${LBL[o.status] || o.status}, progres ${Number(o.progress) || 0}%, tahap ${o.stage || 'Pending'}`);
      prev[o.publicId] = { progress: o.progress, status: o.status, stage: o.stage };
    });
    stats(); list(prof); show(prof);
  }, (e) => { if (!disposed && $('#detail')) $('#detail').innerHTML = `<p class="msg">${fail(e)}</p>`; });

  const box = $('#msgs'), cm = (t) => { $('#cm').textContent = t; };
  chatUnsub = onSnapshot(query(collection(db, 'chats', user.uid, 'messages'), orderBy('at'), limit(100)), (s) => {
    if (disposed || !box.isConnected) return;
    box.innerHTML = s.docs.map((d) => {
      const m = d.data();
      const img = safeImageData(m.img) ? `<img src="${safeImageData(m.img)}" alt="Lampiran">` : '';
      return `<div class="m ${m.from === 'client' ? 'client' : 'staff'}"><p>${esc(m.text)}</p>${img}</div>`;
    }).join('') || '<p>Belum ada pesan. Tanyakan apa saja ke admin.</p>';
    box.scrollTop = box.scrollHeight;
  }, (e) => { if (!disposed && box.isConnected) box.innerHTML = `<p class="msg">${fail(e)}</p>`; });

  async function send(text, img) {
    if (disposed) return;
    const r = await fetch('/api/chat', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: await user.getIdToken(true), text: String(text || '').slice(0, 1000), ...(img ? { image: img } : {}) }),
    });
    const result = await r.json().catch(() => ({}));
    if (!r.ok || !result.ok) throw new Error(result.message || 'Pesan belum dapat dikirim.');
  }
  $('#sf').onsubmit = async (e) => {
    e.preventDefault();
    const t = $('#st').value.trim();
    if (!t) return;
    cm('');
    try { await send(t); if (!disposed && $('#st')) $('#st').value = ''; } catch (err) { if (!disposed) cm(fail(err)); }
  };

  const pt = $('#pt'), pf = $('#pf');
  trackScene($('#pscene'), 'portal-dropzone', P, { dist: 5 });
  async function upload(f) {
    if (!f) return;
    cm('');
    try {
      if (!f.type.startsWith('image/')) throw new Error('Portal hanya menerima gambar. Untuk file lain (ZIP, PDF, dll), kirim tautan Google Drive lewat chat.');
      const image = await compressImage(f);
      if (disposed) return;
      await send(('Lampiran: ' + f.name).slice(0, 200), image);
    } catch (err) { if (!disposed) cm(fail(err)); }
  }
  ['dragenter', 'dragover'].forEach((ev) => pt.addEventListener(ev, (e) => { e.preventDefault(); P.glow = 1; }));
  ['dragleave', 'drop'].forEach((ev) => pt.addEventListener(ev, () => { P.glow = 0; }));
  pt.addEventListener('drop', (e) => { e.preventDefault(); upload(e.dataTransfer.files[0]); });
  pt.addEventListener('pointerenter', () => { P.glow = 0.5; });
  pt.addEventListener('pointerleave', () => { P.glow = 0; });
  pt.addEventListener('click', () => pf.click());
  pf.onchange = () => { upload(pf.files[0]); pf.value = ''; };
}

function stats() {
  const n = (st) => orders.filter((o) => o.status === st).length;
  $('#stats').innerHTML = `<div><b>${orders.length}</b>Total</div><div><b>${n('aktif')}</b>Dikerjakan</div><div><b>${n('selesai')}</b>Selesai</div>`;
}

function list(prof) {
  $('#olist').innerHTML = orders.map((o) => `<button type="button" class="ob" data-id="${esc(o.publicId)}" aria-current="${o.publicId === sel}">${esc(o.pkg)} <small>${esc(o.publicId)} | ${esc(LBL[o.status] || o.status)}</small></button>`).join('');
  $('#olist').querySelectorAll('.ob').forEach((b) => { b.onclick = () => { sel = b.dataset.id; list(prof); show(prof); }; });
}

function show(prof) {
  const o = orders.find((x) => x.publicId === sel), d = $('#detail');
  if (!o) { d.innerHTML = '<h3>Belum ada pesanan</h3><p>Pesan paket pertamamu, lalu progresnya muncul di sini secara realtime.</p><a class="btn gold" href="/pesan">Pesan paket</a>'; return; }
  if (!$('#road')) { d.innerHTML = SKELETON; trackScene($('#road'), 'road-progress-3d', S, { dist: 9 }); }
  S.progress = Math.max(0, Math.min(100, Number(o.progress) || 0));
  $('#dh').innerHTML = `<h2>${esc(o.pkg)}</h2><p class="mono">${esc(o.publicId)}</p><p>${esc(priceText(o.price))}</p>${o.status === 'menunggu_konfirmasi_harga' ? `<p>Harga final sedang disiapkan admin.</p>` : ''}${o.status === 'menunggu_persetujuan_harga' ? `<p>Admin sudah mengirim penawaran. Periksa nominal di atas lalu setujui harga untuk melanjutkan pembayaran.</p>` : ''}`;
  $('#chip').textContent = LBL[o.status] || o.status;
  $('#pct').textContent = S.progress + '%';
  $('#stg').textContent = 'Tahap: ' + (o.stage || 'Pending');
  $('#fill').style.width = S.progress + '%';
  $('#acts').innerHTML = `${Number.isSafeInteger(o.price) && o.price > 0 && o.status !== 'menunggu_persetujuan_harga' ? '<button class="btn gold" id="inv" type="button">Invoice</button>' : ''}${o.status === 'menunggu_persetujuan_harga' ? '<button class="btn gold" id="aq" type="button">Setujui harga dan lanjutkan</button>' : ''}${o.status === 'menunggu_bayar' || o.status === 'ditolak' ? `<a class="btn ghost" href="/pesan">${o.status === 'ditolak' ? 'Unggah ulang bukti' : 'Bayar sekarang'}</a>` : ''}<a class="btn ghost" href="${wa('Halo, saya ingin tanya pesanan ' + o.publicId)}">Tanya via WhatsApp</a>${o.status === 'menunggu_bayar' || o.status === 'ditolak' || o.status === 'menunggu_konfirmasi_harga' || o.status === 'menunggu_persetujuan_harga' ? '<button class="btn ghost" id="cx" type="button">Batalkan pesanan</button>' : ''}`;
  if ($('#inv')) $('#inv').onclick = () => invoice(o, prof);
  if ($('#aq')) $('#aq').onclick = async (ev) => {
    const btn = ev.currentTarget; btn.disabled = true;
    try {
      const r = await fetch('/api/orders/accept-quote', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: await auth.currentUser.getIdToken(true), orderId: o.publicId }) });
      const result = await r.json().catch(() => ({}));
      if (!r.ok || !result.ok) throw new Error(result.message || 'Harga belum dapat disetujui.');
    } catch (error) { alert(error.message); btn.disabled = false; }
  };
  if ($('#cx')) $('#cx').onclick = async () => {
    if (!confirm('Batalkan pesanan ' + o.publicId + '?')) return;
    try { await updateDoc(doc(db, 'orders', o.publicId), { status: 'dibatalkan', updatedAt: serverTimestamp() }); } catch (e) { alert(e.message); }
  };
  const dl = o.deliverables || [];
  $('#dl').innerHTML = dl.length ? dl.map((x) => `<a class="btn ghost" href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener">${esc(x.name)}</a>`).join('') : '<p>Belum ada berkas hasil.</p>';
  review(o, prof);
}

async function review(o, prof) {
  const box = $('#rv');
  if (o.status !== 'selesai') { box.innerHTML = ''; box.dataset.id = ''; return; }
  if (box.dataset.id === o.publicId) return;
  box.dataset.id = o.publicId;
  let done = false;
  try { done = (await getDoc(doc(db, 'testimonials', o.publicId))).exists(); } catch (e) {}
  if (disposed || !box.isConnected) return;
  if (done) { box.innerHTML = '<h3 class="sub">Ulasan</h3><p>Terima kasih, ulasanmu sudah dikirim dan menunggu persetujuan admin.</p>'; return; }
  box.innerHTML = `<h3 class="sub">Beri ulasan</h3><form class="form" id="rf"><select id="rr">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${'★'.repeat(n)} (${n})</option>`).join('')}</select><textarea id="rt" rows="3" maxlength="600" placeholder="Ceritakan pengalamanmu" required></textarea><p class="msg" id="rm" role="alert"></p><button class="btn gold" type="submit">Kirim ulasan</button></form>`;
  $('#rf').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'testimonials', o.publicId), { uid: auth.currentUser.uid, orderId: o.publicId, name: prof.displayName, rating: Number($('#rr').value), text: $('#rt').value.trim(), status: 'pending', createdAt: serverTimestamp() });
      if (disposed || !box.isConnected) return;
      box.dataset.id = '';
      review(o, prof);
    } catch (err) { if (!disposed && $('#rm')) $('#rm').textContent = fail(err); }
  };
}

function invoice(o, prof) {
  if (!Number.isSafeInteger(o.price) || o.price <= 0) { alert('Invoice final tersedia setelah harga disepakati admin.'); return; }
  const paid = o.status === 'aktif' || o.status === 'selesai';
  const date = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate().toLocaleDateString('id-ID', { dateStyle: 'long' }) : '-';
  const add = [o.addons && o.addons.domain && 'Domain', o.addons && o.addons.hosting && 'Hosting', o.addons && o.addons.customQuote && 'Penawaran khusus'].filter(Boolean).join(', ') || '-';
  const w = window.open('', '_blank');
  if (!w) { alert('Izinkan pop-up untuk membuka invoice.'); return; }
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Invoice ${esc(o.publicId)}</title><style>body{font:15px/1.6 system-ui,sans-serif;max-width:680px;margin:2rem auto;padding:0 1rem;color:#111}h1{font-size:1.7rem;margin:0}table{width:100%;border-collapse:collapse;margin:1.5rem 0}td,th{border-bottom:1px solid #ddd;padding:.6rem;text-align:left}.r{text-align:right}.tag{display:inline-block;padding:.15rem .8rem;border:1px solid #111;border-radius:99px}button{padding:.6rem 1.2rem;font:inherit}@media print{button{display:none}}</style>
<h1>INVOICE</h1><p>TS | TAMA STUDIO<br>${esc(wa('').slice(0, 0))}tamastudiochennel@gmail.com</p>
<p>No. invoice: <b>INV-${esc(o.publicId)}</b><br>Tanggal: ${esc(date)}<br>Pelanggan: ${esc(prof.displayName)} (${esc(prof.username)})<br>ID akun: ${esc(prof.publicId)}</p>
<table><tr><th>Item</th><th>Add-on</th><th class="r">Harga</th></tr><tr><td>Paket ${esc(o.pkg)}</td><td>${esc(add)}</td><td class="r">${rp(o.price)}</td></tr><tr><th colspan="2">Total</th><th class="r">${rp(o.price)}</th></tr></table>
<p>Status pembayaran: <span class="tag">${paid ? 'Lunas' : esc(LBL[o.status] || o.status)}</span></p><p>Pembayaran manual via GoPay admin. Add-on domain/hosting dikonfirmasi terpisah oleh admin.</p>
<button id="pb">Cetak / Simpan PDF</button>`);
  w.document.close();
  w.document.getElementById('pb').onclick = () => w.print();
}

function toast(t) {
  const d = document.createElement('div');
  d.className = 'toast';
  d.setAttribute('role', 'status');
  d.textContent = t;
  document.body.append(d);
  const timer = setTimeout(() => { d.remove(); toastTimers.delete(timer); }, 6000);
  toastTimers.add(timer);
}

  return () => {
    disposed = true;
    authUnsub?.();
    stopSubscriptions();
    sceneDisposers.splice(0).forEach((dispose) => { try { dispose(); } catch (error) {} });
    toastTimers.forEach((timer) => clearTimeout(timer));
    toastTimers.clear();
    const dialog = document.getElementById('pay');
    if (dialog) dialog.remove();
  };
}
