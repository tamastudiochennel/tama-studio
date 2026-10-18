import { app } from './firebase.js';
import { getAuth, onAuthStateChanged, signOut as fbSignOut, signInWithPopup, linkWithPopup, GoogleAuthProvider, GithubAuthProvider } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

export const auth = getAuth(app);
export const db = getFirestore(app);
export { onAuthStateChanged };

export async function signOut(a) {
  const uid = a?.currentUser?.uid;
  if (uid) {
    try {
      sessionStorage.removeItem('sess:' + uid);
      sessionStorage.removeItem('prof:' + uid);
      sessionStorage.removeItem('adminSid:' + uid);
    } catch (e) {}
  }
  await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
  return fbSignOut(a);
}

export async function syncSession(user) {
  // Do not trust a sessionStorage flag as proof that the httpOnly server cookie still exists.
  const r = await fetch('/api/session', {
    method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken: await user.getIdToken(true) }),
  });
  if (!r.ok) { try { sessionStorage.removeItem('sess:' + user.uid); } catch (e) {} return false; }
  try { sessionStorage.setItem('sess:' + user.uid, '1'); } catch (e) {}
  return true;
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const linked = (user, id) => user.providerData.some((p) => p.providerId === id);
export const hasGithub = (user) => linked(user, 'github.com');
export const hasGoogle = (user) => linked(user, 'google.com');

export function newId(prefix, n = 6) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = crypto.getRandomValues(new Uint8Array(n));
  return prefix + Array.from(b, (x) => abc[x % abc.length]).join('');
}

export const loginGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const loginGithub = () => signInWithPopup(auth, new GithubAuthProvider());

export async function linkGithub() {
  await linkWithPopup(auth.currentUser, new GithubAuthProvider());
  await auth.currentUser.reload();
}

export async function linkGoogle() {
  await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
  await auth.currentUser.reload();
  await auth.currentUser.getIdToken(true);
}

export async function getProfile(uid) {
  const s = await getDoc(doc(db, 'users', uid));
  return s.exists() ? s.data() : null;
}

export async function completeAccount(rawName) {
  const user = auth.currentUser, username = String(rawName || '').trim().toLowerCase();
  if (!user) throw new Error('Masuk terlebih dahulu.');
  if (!USERNAME_RE.test(username)) throw new Error('Username 3-20 karakter: huruf kecil, angka, atau garis bawah.');
  const r = await fetch('/api/account/complete', {
    method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken: await user.getIdToken(true), username }),
  });
  const result = await r.json().catch(() => ({}));
  if (!r.ok || !result.ok) throw new Error(result.message || 'Akun gagal disimpan. Coba username lain.');
  return result.publicId;
}

export const normWa = (v) => {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  return d.length >= 10 && d.length <= 15 ? d : '';
};

export async function saveWa(uid, v) {
  const wa = normWa(v);
  if (!wa) throw new Error('Nomor WhatsApp tidak valid. Contoh: 0812-3456-7890');
  await updateDoc(doc(db, 'users', uid), { wa });
  return wa;
}
