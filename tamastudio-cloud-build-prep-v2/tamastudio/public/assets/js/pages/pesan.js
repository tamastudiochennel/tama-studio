import { SITE, wa } from '../config.js';
import { auth, onAuthStateChanged, getProfile } from '../core/auth.js';
import { cms } from '../core/content.js';
import { esc } from '../core/util.js';
import { PACKAGES } from '../data/defaults.js';
import { createOrder, submitProof, myOrders } from '../core/orders.js';

export default function mountPesan() {
  let disposed = false, unsubscribe = null, activeDialog = null, renderSequence = 0;
  const $ = (selector) => document.querySelector(selector);
  const app = $('#app');
  const rp = (n) => 'Rp' + Number(n).toLocaleString('id-ID');
  const LBL = { menunggu_konfirmasi_harga: 'Menunggu konfirmasi harga', menunggu_persetujuan_harga: 'Menunggu persetujuan harga', menunggu_bayar: 'Menunggu pembayaran', menunggu_verifikasi: 'Menunggu verifikasi', aktif: 'Dikerjakan', selesai: 'Selesai', ditolak: 'Pembayaran ditolak', dibatalkan: 'Dibatalkan' };
  const priceText = (n) => Number.isSafeInteger(n) && n > 0 ? rp(n) : 'Harga menunggu konfirmasi';
  const fail = (error) => esc(error.code === 'permission-denied' ? 'Akses ditolak. Pastikan aturan Firestore sudah dipublikasikan.' : error.message);

  async function init() {
    if (!app) return;
    const pkgs = await cms('packages', PACKAGES);
    if (disposed) return;
    const want = new URLSearchParams(location.search).get('paket');

    unsubscribe = onAuthStateChanged(auth, async (user) => {
      const sequence = ++renderSequence;
      if (disposed) return;
      if (!user) {
        app.innerHTML = '<h1>Pesan paket</h1><p>Masuk dulu supaya pesananmu tersimpan di akunmu.</p><a class="btn gold" href="/masuk">Masuk atau daftar</a>';
        return;
      }
      try {
        const prof = await getProfile(user.uid);
        if (disposed || sequence !== renderSequence) return;
        if (!prof) app.innerHTML = '<h1>Pesan paket</h1><p>Selesaikan akunmu dulu dengan memilih username.</p><a class="btn gold" href="/masuk">Selesaikan akun</a>';
        else if (prof.blocked) app.innerHTML = `<h1>Akun diblokir</h1><p>Alasan: ${esc(prof.blockedReason || 'tidak disebutkan')}.</p>`;
        else await view(user, prof, pkgs, want);
      } catch (error) {
        if (!disposed && sequence === renderSequence) app.innerHTML = `<h1>Pesan paket</h1><p class="msg">${fail(error)}</p>`;
      }
    });
  }

  async function view(user, prof, pkgs, want) {
    const orders = (await myOrders(user.uid)).sort((a, b) => ((b.createdAt && b.createdAt.seconds) || 0) - ((a.createdAt && a.createdAt.seconds) || 0));
    if (disposed || !app?.isConnected) return;
    app.innerHTML = `<h1>Pesan paket</h1>
${pkgs.length ? `<form id="f" class="form box glass" style="max-width:560px;text-align:left;justify-items:stretch">
  <label>Paket<select id="p">${pkgs.map((p, i) => `<option value="${i}"${p.name === want ? ' selected' : ''}>${esc(p.name)} - ${rp(p.price)}</option>`).join('')}</select></label>
  <label class="chk"><input type="checkbox" id="d"> Saya butuh domain</label>
  <label class="chk"><input type="checkbox" id="h"> Saya butuh hosting</label>
  <label class="chk"><input type="checkbox" id="cq"> Kebutuhan di luar paket / perlu penawaran khusus</label>
  <p>Domain, hosting, dan pekerjaan di luar lingkup paket akan ditawarkan oleh admin. Kamu dapat meninjau nominal final sebelum melanjutkan pembayaran.</p>
  <textarea id="n" rows="4" maxlength="1000" placeholder="Ceritakan kebutuhanmu: fitur, referensi, nama domain yang diinginkan" required></textarea>
  <p class="msg" id="msg" role="alert"></p>
  <button class="btn gold" type="submit">Buat pesanan</button>
</form>` : '<p>Belum ada paket aktif yang dapat dipesan. Silakan hubungi Tama Studio untuk konsultasi.</p>'}
<h2 style="margin-top:2.5rem">Pesanan saya</h2>
<div class="grid4">${orders.length ? orders.map((o) => `<article class="card glass"><h3>${esc(o.pkg)}</h3><p class="mono">${esc(o.publicId)}</p><p>${esc(LBL[o.status] || o.status)} | ${esc(priceText(o.price))}</p>${o.status === 'menunggu_persetujuan_harga' ? `<button class="btn gold" type="button" data-quote="${esc(o.publicId)}">Setujui harga ${esc(priceText(o.price))}</button>` : ''}${o.status === 'menunggu_bayar' || o.status === 'ditolak' ? `<button class="btn ghost" type="button" data-pay="${esc(o.publicId)}">${o.status === 'ditolak' ? 'Unggah ulang bukti' : 'Bayar sekarang'}</button>` : ''}</article>`).join('') : '<p>Belum ada pesanan.</p>'}</div>`;
    app.querySelectorAll('[data-pay]').forEach((button) => { button.onclick = () => pay(orders.find((order) => order.publicId === button.dataset.pay), user, prof, pkgs, want); });
    app.querySelectorAll('[data-quote]').forEach((button) => { button.onclick = async () => {
      button.disabled = true;
      try {
        const response = await fetch('/api/orders/accept-quote', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: await user.getIdToken(true), orderId: button.dataset.quote }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) throw new Error(result.message || 'Harga belum dapat disetujui.');
        await view(user, prof, pkgs, want);
      } catch (error) { alert(error.message); if (!disposed) button.disabled = false; }
    }; });
    const form = $('#f');
    if (form) form.onsubmit = async (event) => {
      event.preventDefault();
      const message = $('#msg');
      if (message) message.textContent = '';
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        const order = await createOrder(user.uid, prof, pkgs[$('#p').value], { domain: $('#d').checked, hosting: $('#h').checked, customQuote: $('#cq').checked }, $('#n').value.trim());
        if (disposed) return;
        if (order.status === 'menunggu_konfirmasi_harga') {
          alert(`Pesanan ${order.publicId} berhasil dibuat. Admin akan menyiapkan penawaran harga final.`);
          await view(user, prof, pkgs, want);
          return;
        }
        pay(order, user, prof, pkgs, want);
      } catch (error) {
        if (message && !disposed) message.textContent = fail(error);
      } finally { if (submit && !disposed) submit.disabled = false; }
    };
  }

  function pay(order, user, prof, pkgs, want) {
    if (!order || !['menunggu_bayar', 'ditolak'].includes(order.status) || !Number.isSafeInteger(order.price) || order.price <= 0) { alert('Harga final belum siap dibayar.'); return; }
    activeDialog?.remove();
    const dialog = document.createElement('dialog');
    activeDialog = dialog;
    dialog.id = 'pay';
    dialog.innerHTML = `<h2>Bayar pesanan</h2><p>ID pesanan: <span class="mono">${esc(order.publicId)}</span> (simpan ID ini)</p>
<p>TF ke GoPay Admin ${SITE.waDisplay} sejumlah <b>${rp(order.price)}</b></p>
<label>Unggah bukti transfer<input type="file" id="pf" accept="image/jpeg,image/png,image/webp"></label>
<p class="msg" id="pm" role="alert"></p>
<div class="cta"><button class="btn gold" id="ps" type="button">Kirim bukti</button><button class="btn ghost" id="pc" type="button">Tutup</button></div>`;
    document.body.append(dialog);
    dialog.addEventListener('close', () => { dialog.remove(); if (activeDialog === dialog) activeDialog = null; if (!disposed) view(user, prof, pkgs, want).catch(() => {}); }, { once: true });
    dialog.querySelector('#pc').onclick = () => dialog.close();
    dialog.querySelector('#ps').onclick = async (event) => {
      const button = event.currentTarget, message = dialog.querySelector('#pm');
      message.textContent = '';
      try {
        const file = dialog.querySelector('#pf').files[0];
        if (!file) throw new Error('Pilih foto bukti transfer dulu.');
        button.disabled = true;
        await submitProof(order.publicId, user.uid, file, order.status === 'ditolak');
        if (disposed || !dialog.isConnected) return;
        dialog.innerHTML = `<h2>Bukti terkirim</h2><p>Admin akan memverifikasi pembayaranmu. Konfirmasi lewat WhatsApp supaya lebih cepat.</p><div class="cta"><a class="btn gold" href="${wa(`Halo, nama saya ${prof.displayName} ingin memesan paket ${order.pkg} - Order ID ${order.publicId}. Saya sudah TF ke GoPay ${SITE.waDisplay}`)}">Konfirmasi lewat WhatsApp</a><button class="btn ghost" id="pc2" type="button">Tutup</button></div>`;
        dialog.querySelector('#pc2').onclick = () => dialog.close();
      } catch (error) {
        if (!disposed) { message.textContent = fail(error); button.disabled = false; }
      }
    };
    dialog.showModal();
  }

  init().catch((error) => { if (!disposed && app) app.innerHTML = `<h1>Pesan paket</h1><p class="msg">${fail(error)}</p>`; });
  return () => {
    disposed = true;
    renderSequence += 1;
    unsubscribe?.();
    if (activeDialog?.open) activeDialog.close();
    activeDialog?.remove();
    activeDialog = null;
    const form = $('#f'); if (form) form.onsubmit = null;
  };
}
