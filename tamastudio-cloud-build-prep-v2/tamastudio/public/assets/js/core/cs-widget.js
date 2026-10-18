import { wa } from '../config.js';
import { auth, db, onAuthStateChanged } from './auth.js';
import { esc } from './util.js';
import { signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { collection, onSnapshot, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const HELLO = `<p>Halo! Tulis pertanyaanmu, admin akan membalas di sini. Atau langsung lewat <a href="${wa('Halo TS | TAMA STUDIO, saya ingin konsultasi.')}">WhatsApp</a>.</p>`;
const root = document.createElement('section');
root.className = 'cs-box glass';
root.hidden = true;
root.setAttribute('aria-label', 'Chat dengan admin');
root.innerHTML = `<div class="msgs" id="cs-m" aria-live="polite">${HELLO}</div><form class="send" id="cs-f"><input id="cs-t" placeholder="Tulis pesan" maxlength="1000" autocomplete="off"><button class="btn gold" type="submit">Kirim</button></form><p class="msg" id="cs-e" role="alert"></p>`;
document.body.append(root);
const $ = (s) => root.querySelector(s);
let unsub = null;

function listen(u) {
  if (unsub || !u) return;
  unsub = onSnapshot(query(collection(db, 'chats', u.uid, 'messages'), orderBy('at'), limit(60)), (s) => {
    const rows = s.docs.map((d) => d.data());
    $('#cs-m').innerHTML = rows.length ? rows.map((m) => `<div class="m ${m.from === 'client' ? 'client' : 'staff'}"><p>${esc(m.text)}</p></div>`).join('') : HELLO;
    $('#cs-m').scrollTop = $('#cs-m').scrollHeight;
  });
}

async function send(text) {
  let u = auth.currentUser;
  if (!u) u = (await signInAnonymously(auth)).user;
  listen(u);
  const r = await fetch('/api/chat', {
    method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken: await u.getIdToken(true), text }),
  });
  const result = await r.json().catch(() => ({}));
  if (!r.ok || !result.ok) throw new Error(result.message || 'Pesan belum dapat dikirim.');
}

$('#cs-f').onsubmit = async (e) => {
  e.preventDefault();
  const t = $('#cs-t').value.trim();
  if (!t) return;
  $('#cs-e').textContent = '';
  try {
    await send(t);
    $('#cs-t').value = '';
  } catch (err) {
    $('#cs-e').textContent = /operation-not-allowed|admin-restricted/.test(err.code || '') ? 'Chat tamu belum aktif. Hubungi kami lewat WhatsApp.' : err.message;
  }
};
onAuthStateChanged(auth, (u) => { if (u && !root.hidden) listen(u); });
export function toggle() {
  root.hidden = !root.hidden;
  if (!root.hidden && auth.currentUser) listen(auth.currentUser);
}
