import { auth, onAuthStateChanged, signOut, loginGoogle, loginGithub, linkGoogle, linkGithub, hasGoogle, hasGithub, completeAccount, getProfile, syncSession, saveWa } from '../core/auth.js';

export default function mountMasuk() {
  const $ = (s) => document.querySelector(s);
  const VIEWS = ['v-load', 'v-out', 'v-google', 'v-complete', 'v-done'];
  const show = (id) => VIEWS.forEach((v) => { const el = $('#' + v); if (el) el.hidden = v !== id; });
  const say = (t) => { const el = $('#msg'); if (el) el.textContent = t || ''; };
  const ERR = {
    'auth/popup-closed-by-user': 'Jendela login ditutup sebelum selesai.',
    'auth/popup-blocked': 'Pop-up diblokir browser. Izinkan pop-up lalu coba lagi.',
    'auth/cancelled-popup-request': 'Login sebelumnya masih berjalan. Tunggu jendelanya tertutup, lalu coba sekali saja.',
    'auth/account-exists-with-different-credential': 'Email GitHub itu sudah terdaftar lewat Google. Masuk dengan Google, lalu hubungkan GitHub dari dashboard.',
    'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
    'auth/credential-already-in-use': 'Akun itu sudah terhubung ke pengguna lain. Keluar, lalu masuk dengan akun tersebut.',
    'auth/unauthorized-domain': 'Domain situs ini belum didaftarkan di Firebase (Authorized domains).',
    'auth/operation-not-allowed': 'Metode login ini belum diaktifkan di Firebase Console.',
    'permission-denied': 'Akses ditolak. Pastikan aturan Firestore sudah dipublikasikan.',
  };
  let busy = false, disposed = false;
  const lock = (value) => document.querySelectorAll('#v-out button, #v-google button').forEach((b) => { b.disabled = value; });
  const run = (fn) => async (event) => {
    if (event) event.preventDefault();
    if (busy || disposed) return;
    busy = true;
    lock(true);
    say();
    try { await fn(); } catch (err) { if (!disposed) say(ERR[err.code] || err.message || 'Terjadi kesalahan.'); }
    busy = false;
    if (!disposed) lock(false);
  };

  $('#g-login').onclick = run(loginGoogle);
  $('#gh-login').onclick = run(loginGithub);
  $('#g-link').onclick = run(async () => { await linkGoogle(); await render(auth.currentUser); });
  $('#f-complete').onsubmit = run(async () => { await completeAccount($('#c-u').value); const w = $('#c-wa').value.trim(); if (w) await saveWa(auth.currentUser.uid, w).catch((e) => say('Akun dibuat, tetapi ' + e.message)); await render(auth.currentUser); });
  $('#gh').onclick = run(async () => { await linkGithub(); await render(auth.currentUser); });
  ['out0', 'out1', 'out2'].forEach((id) => { $('#' + id).onclick = () => signOut(auth); });

  async function render(user) {
    if (disposed) return;
    $('#who').textContent = user && !user.isAnonymous ? 'Masuk sebagai ' + (user.email || user.displayName || 'pengguna') : '';
    if (!user || user.isAnonymous) return show('v-out');
    if (!hasGoogle(user)) return show('v-google');
    const prof = await getProfile(user.uid);
    if (disposed) return;
    if (!prof) {
      $('#c-hello').textContent = `Halo, ${user.displayName || 'pengguna baru'}. Pilih username untuk menyelesaikan akun.`;
      return show('v-complete');
    }
    await syncSession(user).catch(() => false);
    if (disposed) return;
    $('#d-name').textContent = prof.displayName;
    $('#d-user').textContent = prof.username;
    $('#d-id').textContent = prof.publicId;
    $('#blocked').hidden = !prof.blocked;
    if (prof.blocked) $('#blocked').textContent = `Akun ini diblokir. Alasan: ${prof.blockedReason || 'tidak disebutkan'}.`;
    $('#gh').hidden = hasGithub(user);
    show('v-done');
  }

  const unsubscribe = onAuthStateChanged(auth, (user) => render(user).catch((err) => { if (!disposed) { say(ERR[err.code] || err.message); show('v-out'); } }));
  return () => {
    disposed = true;
    unsubscribe();
    for (const id of ['g-login', 'gh-login', 'g-link', 'gh', 'out0', 'out1', 'out2']) {
      const el = $('#' + id); if (el) el.onclick = null;
    }
    const form = $('#f-complete'); if (form) form.onsubmit = null;
  };
}
