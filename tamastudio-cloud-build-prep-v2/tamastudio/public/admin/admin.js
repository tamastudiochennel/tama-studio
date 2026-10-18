import { auth, db, onAuthStateChanged, signOut, loginGithub, loginGoogle, getProfile, newId } from '/assets/js/core/auth.js';
import { doc, getDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { esc } from '/assets/js/core/util.js';
import { scene } from '/assets/js/core/page3d.js';

export default function mountAdmin() {
  let disposed = false, authUnsub = null, sceneDispose = null;

const $ = (s) => document.querySelector(s);
const IDLE = 14 * 60 * 1000;
const PANELS = [['home', 'Ringkasan dan cari ID'], ['analitik', 'Analitik 3D'], ['pesanan', 'Pesanan dan pembayaran'], ['kanban', 'Kanban proyek'], ['users', 'Pengguna'], ['chat', 'Chat klien'], ['testimoni', 'Testimoni'], ['cms', 'Konten (CMS)'], ['katalog', 'Katalog Paket'], ['sistem', 'Sistem dan backup'], ['broadcast', 'Broadcast'], ['logs', 'Log aktivitas']];
const V = { step: 0 };
const ERR = {
  'auth/account-exists-with-different-credential': 'Email GitHub itu sudah terdaftar lewat Google. Masuk dengan Google, hubungkan GitHub dari dashboard, lalu ulangi.',
  'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi nanti.',
  'auth/popup-closed-by-user': 'Jendela Google ditutup sebelum selesai.',
  'auth/popup-blocked': 'Pop-up diblokir browser. Izinkan pop-up lalu coba lagi.',
  'permission-denied': 'Akses ditolak. Cek peran akun dan pastikan aturan Firestore sudah dipublikasikan.',
};
let uid1 = null, sid = null, busy = false, lastAct = Date.now(), timer = 0, unsub = null, ctx = null, panelCleanup = null, routeSequence = 0;
const visiblePanels = () => ctx && ctx.prof.role === 'support' ? PANELS.filter(([k]) => ['pesanan', 'kanban', 'chat'].includes(k)) : PANELS;

const dev = () => {
  const s = [navigator.userAgent, screen.width + 'x' + screen.height, Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.language].join('|');
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h.toString(16);
};
const say = (t) => { $('#gm').textContent = t || ''; };
const why = (e) => ERR[e.code] || e.message || 'Terjadi kesalahan.';

async function audit(action, targetId = '') {
  await fetch('/api/admin/op', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'log', sid, idToken: await auth.currentUser.getIdToken(), action, targetId }) });
}

const GERR = {
  locked: 'Terlalu banyak percobaan gagal. Akses dikunci 30 menit.',
  'bukan-admin': 'Akun ini tidak punya akses admin. Hubungkan GitHub ke akun admin dari dashboard, lalu coba lagi.',
  'langkah-1': 'Langkah 1 tidak valid. Masuk dengan GitHub yang terhubung ke akun admin.',
  'langkah-2': 'Langkah 2 tidak valid atau sudah lewat 15 menit. Ulangi dari langkah 1.',
  sesi: 'Sesi admin berakhir atau dipakai di perangkat lain.',
  server: 'Server belum siap. Cek kunci Firebase Admin di pengaturan Netlify.',
};

async function gateCall(step, user) {
  const r = await fetch('/api/admin/gate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ step, sid, idToken: await user.getIdToken(step !== 'beat') }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(GERR[j.error] || 'Verifikasi admin gagal.');
}

function gate(step, msg) {
  V.step = step;
  $('#gate').hidden = false;
  $('#app').hidden = true;
  $('#f1').hidden = step !== 0;
  $('#s2').hidden = step !== 1;
  $('#gt').textContent = step === 0 ? 'Masuk admin' : 'Verifikasi admin';
  $('#gs').textContent = step === 0 ? 'Langkah 1 dari 2: masuk dengan akun GitHub admin.' : 'Langkah 2 dari 2: konfirmasi dengan akun Google admin yang sama. Aktifkan 2-Step Verification di pengaturan keamanan Google.';
  say(msg);
}

async function lock(msg) {
  if (disposed) return;
  clearInterval(timer);
  if (unsub) { unsub(); unsub = null; }
  if (panelCleanup) { try { panelCleanup(); } catch (e) {} panelCleanup = null; }
  const endingUser = auth.currentUser;
  if (endingUser && sid) { try { sessionStorage.removeItem('adminSid:' + endingUser.uid); await gateCall('end', endingUser); } catch (e) {} }
  ctx = null;
  try { await signOut(auth); } catch (e) {}
  gate(0, msg);
}

async function unlock(user, mySid) {
  if (disposed) return;
  sid = mySid;
  const prof = await getProfile(user.uid);
  if (disposed || !prof) return;
  ctx = { db, user, prof, esc, audit, sid: () => sid, dev: dev(), idleLeft: () => Math.max(0, IDLE - (Date.now() - lastAct)) };
  V.step = 2;
  lastAct = Date.now();
  $('#gate').hidden = true;
  $('#app').hidden = false;
  $('#app').innerHTML = `<div class="adm"><nav class="card glass side-nav" aria-label="Menu admin"><p class="mono">${esc(prof.username)} | ${esc(prof.role)}</p>${visiblePanels().map(([k, t]) => `<a href="#/${k}" data-p="${k}">${t}</a>`).join('')}<button class="btn ghost" id="lo" type="button">Keluar</button></nav><section id="view"></section></div>`;
  $('#lo').onclick = async () => { try { await audit('logout', user.uid); } catch (e) {} lock('Kamu sudah keluar.'); };
  unsub = onSnapshot(doc(db, 'admin_gate', user.uid), (s) => {
    const d = s.data();
    if (d && d.sessionId !== mySid) lock('Akun ini login di perangkat lain. Sesi ini ditutup.');
  });
  let beat = Date.now();
  clearInterval(timer);
  timer = setInterval(async () => {
    if (Date.now() - lastAct > IDLE) return lock('Sesi berakhir karena tidak ada aktivitas selama 15 menit.');
    if (Date.now() - lastAct < 35000 && Date.now() - beat > 25000) {
      beat = Date.now();
      try { await gateCall('beat', user); } catch (e) { lock('Sesi admin berakhir. Masuk lagi.'); }
    }
  }, 30000);
  try { await audit('login berhasil (2 langkah)', user.uid); } catch (e) {}
  route();
}

async function route() {
  if (!ctx || disposed) return;
  const sequence = ++routeSequence;
  if (panelCleanup) { try { panelCleanup(); } catch (e) {} panelCleanup = null; }
  const allowed = visiblePanels();
  const p = allowed.find((x) => '#/' + x[0] === location.hash) || allowed[0] || PANELS[0];
  document.querySelectorAll('.side-nav a').forEach((a) => a.setAttribute('aria-current', a.dataset.p === p[0]));
  const v = $('#view');
  v.innerHTML = '<p>Memuat...</p>';
  try {
    const m = await import(`./panels/${p[0]}.js`);
    if (disposed || sequence !== routeSequence) return;
    const cleanup = await m.default(v, ctx);
    if (disposed || sequence !== routeSequence) { if (typeof cleanup === 'function') cleanup(); return; }
    if (typeof cleanup === 'function') panelCleanup = cleanup;
  } catch (e) {
    if (!disposed && sequence === routeSequence) v.innerHTML = `<p class="msg">${esc(why(e))}</p>`;
  }
}

const recordActivity = () => { lastAct = Date.now(); };
['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((ev) => addEventListener(ev, recordActivity, { passive: true }));
addEventListener('hashchange', route);
const vaultEl = $('#vault');
scene(vaultEl, 'gate-vault', V, { dist: 6 }).then((dispose) => {
  if (typeof dispose !== 'function') return;
  if (disposed || !vaultEl?.isConnected) dispose();
  else sceneDispose = dispose;
}).catch(() => {});

$('#g1').onclick = async () => {
  busy = true;
  say('');
  try {
    const { user } = await loginGithub();
    if (disposed) { await signOut(auth); return; }
    sid = newId('S-', 10);
    try {
      sessionStorage.setItem('adminSid:' + user.uid, sid);
      await gateCall(1, user);
    } catch (err) {
      try { sessionStorage.removeItem('adminSid:' + user.uid); } catch (e) {}
      await signOut(auth);
      throw err;
    }
    uid1 = user.uid;
    gate(1);
  } catch (err) {
    say(why(err));
  } finally {
    busy = false;
  }
};

$('#g2').onclick = async () => {
  busy = true;
  say('');
  try {
    const { user } = await loginGoogle();
    if (disposed) { await signOut(auth); return; }
    if (user.uid !== uid1) { await signOut(auth); gate(0, 'Akun Google itu bukan milik admin ini. Ulangi dari langkah 1.'); return; }
    await gateCall(2, user);
    await unlock(user, sid);
  } catch (err) {
    say(why(err));
  } finally {
    busy = false;
  }
};
$('#back').onclick = () => lock('');

authUnsub = onAuthStateChanged(auth, async (user) => {
  if (disposed || busy || ctx) return;
  if (!user) return gate(0);
  try {
    const t = await user.getIdTokenResult();
    if (disposed) return;
    const g = await getDoc(doc(db, 'admin_gate', user.uid));
    if (disposed) return;
    const data = g.exists() ? g.data() : {};
    const last = data.lastActive;
    const fresh = last && Date.now() - last.toMillis() < 14 * 60 * 1000;
    const localSid = sessionStorage.getItem('adminSid:' + user.uid);
    if (fresh && localSid && data.sessionId === localSid && data.authTime === t.claims.auth_time && t.signInProvider === 'google.com') { sid = localSid; return unlock(user, localSid); }
    if (fresh && localSid && data.sessionId === localSid && t.signInProvider === 'github.com') { uid1 = user.uid; sid = localSid; return gate(1); }
    if (localSid) sessionStorage.removeItem('adminSid:' + user.uid);
  } catch (e) {}
  if (!disposed) gate(0);
});

  return () => {
    disposed = true;
    clearInterval(timer);
    authUnsub?.();
    unsub?.();
    if (panelCleanup) { try { panelCleanup(); } catch (error) {} panelCleanup = null; }
    sceneDispose?.();
    ctx = null;
    removeEventListener('hashchange', route);
    ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((eventName) => removeEventListener(eventName, recordActivity));
    const gateButtons = ['g1', 'g2', 'back'];
    gateButtons.forEach((id) => { const element = document.getElementById(id); if (element) element.onclick = null; });
    const logoutButton = document.getElementById('lo'); if (logoutButton) logoutButton.onclick = null;
  };
}
