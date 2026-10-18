import { createHash, randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { admin } from '../../../../lib/admin.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const fail = (message, status = 400) => Response.json({ ok: false, message }, { status, headers: { 'Cache-Control': 'no-store' } });
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newPublicId = () => 'TS-U-' + Array.from(randomBytes(6), (b) => ALPHABET[b & 31]).join('');

function allowedOrigin(req) {
  const origin = req.headers.get('origin');
  // Browser state-changing requests must carry an explicit same-origin Origin header.
  // Do not silently accept missing Origin on cookie/session or authenticated mutation endpoints.
  if (!origin) return false;
  const host = (req.headers.get('host') || req.headers.get('x-forwarded-host') || '').split(',')[0].trim().toLowerCase();
  try { return !!host && new URL(origin).host.toLowerCase() === host; } catch { return false; }
}

export async function POST(req) {
  try {
    if (!allowedOrigin(req)) return fail('Asal permintaan tidak diizinkan.', 403);
    const raw = await req.text();
    if (raw.length > 12_000) return fail('Permintaan terlalu besar.', 413);
    let body;
    try { body = JSON.parse(raw || '{}'); } catch { return fail('Format permintaan tidak valid.'); }
    if (typeof body.idToken !== 'string' || body.idToken.length > 10_000) return fail('Sesi tidak valid.', 401);
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    if (!USERNAME_RE.test(username)) return fail('Username 3–20 karakter: huruf kecil, angka, atau garis bawah.');

    const { auth, db } = admin();
    const token = await auth.verifyIdToken(body.idToken, true).catch(() => null);
    if (!token || !(token.firebase?.identities && token.firebase.identities['google.com'])) return fail('Masuk dengan Google diperlukan.', 401);
    const profileRef = db.doc(`users/${token.uid}`);
    const usernameRef = db.doc(`usernames/${username}`);
    const uidRateRef = db.doc(`rate_limits/account_${token.uid}`);
    const publicId = newPublicId();
    const idRef = db.doc(`ids/${publicId}`);
    const ip = (req.headers.get('x-nf-client-connection-ip') || '').trim();
    const ipHash = ip ? createHash('sha256').update(ip).digest('hex').slice(0, 32) : null;
    const ipRateRef = ipHash ? db.doc(`rate_limits/account_ip_${ipHash}`) : null;
    const now = Date.now();

    // Count attempts separately so failed username guesses also consume the rate limit.
    const limited = await db.runTransaction(async (tx) => {
      const reads = [tx.get(profileRef), tx.get(uidRateRef)];
      if (ipRateRef) reads.push(tx.get(ipRateRef));
      const snaps = await Promise.all(reads);
      if (snaps[0].exists) return { error: 'Akun ini sudah selesai dibuat.', status: 409 };
      const update = (snap, max) => {
        const data = snap.exists ? snap.data() : {};
        const active = Number.isFinite(data.windowStart) && now - data.windowStart < 10 * 60 * 1000;
        const count = active ? Number(data.count) || 0 : 0;
        if (count >= max) return { limited: true };
        return { windowStart: active ? data.windowStart : now, count: count + 1, expiresAt: new Date(now + 24 * 60 * 60 * 1000), updatedAt: FieldValue.serverTimestamp() };
      };
      const uidRate = update(snaps[1], 4);
      const ipRate = ipRateRef ? update(snaps[2], 25) : null;
      if (uidRate.limited || ipRate?.limited) return { error: 'Terlalu banyak percobaan username. Coba lagi beberapa menit.', status: 429 };
      tx.set(uidRateRef, uidRate);
      if (ipRateRef) tx.set(ipRateRef, ipRate);
      return { ok: true };
    });
    if (!limited.ok) return fail(limited.error, limited.status);

    await db.runTransaction(async (tx) => {
      const [profileSnap, usernameSnap, idSnap] = await Promise.all([tx.get(profileRef), tx.get(usernameRef), tx.get(idRef)]);
      if (profileSnap.exists) throw Object.assign(new Error('Akun ini sudah selesai dibuat.'), { status: 409 });
      if (usernameSnap.exists) throw Object.assign(new Error('Username sudah dipakai.'), { status: 409 });
      if (idSnap.exists) throw Object.assign(new Error('Coba lagi untuk membuat ID baru.'), { status: 409 });
      const displayName = String(token.name || username).slice(0, 100);
      const photoURL = typeof token.picture === 'string' && /^https:\/\//i.test(token.picture) ? token.picture.slice(0, 1000) : '';
      tx.create(usernameRef, { uid: token.uid, createdAt: FieldValue.serverTimestamp() });
      tx.create(idRef, { kind: 'account', uid: token.uid, createdAt: FieldValue.serverTimestamp() });
      tx.create(profileRef, { username, publicId, displayName, photoURL, role: 'client', blocked: false, createdAt: FieldValue.serverTimestamp() });
    });
    return Response.json({ ok: true, publicId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = [400, 401, 403, 409, 413, 429].includes(error?.status) ? error.status : 400;
    return fail(error?.status ? error.message : 'Akun belum dapat diselesaikan. Coba lagi.', status);
  }
}
