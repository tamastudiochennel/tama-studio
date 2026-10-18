import { createHash, randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { admin } from '../../../lib/admin.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const fail = (message, status = 400) => Response.json({ ok: false, message }, { status, headers: { 'Cache-Control': 'no-store' } });
const JPEG_DATA_URL = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;
function validJpegDataUrl(value) {
  if (typeof value !== 'string' || value.length > 400_000 || !JPEG_DATA_URL.test(value)) return false;
  try {
    const comma = value.indexOf(',');
    const bytes = Buffer.from(value.slice(comma + 1), 'base64');
    return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  } catch { return false; }
}

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
    if (raw.length > 410_000) return fail('Pesan atau lampiran terlalu besar.', 413);
    const body = JSON.parse(raw || '{}');
    if (typeof body.idToken !== 'string' || body.idToken.length > 10_000) return fail('Sesi tidak valid.', 401);
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const image = typeof body.image === 'string' ? body.image : '';
    if (!text && !image) return fail('Pesan tidak boleh kosong.');
    if (text.length > 1000) return fail('Pesan terlalu panjang.');
    if (image && (image.length > 390_000 || !validJpegDataUrl(image))) return fail('Lampiran harus berupa JPEG yang valid dan berukuran kecil.');

    const { auth, db } = admin();
    const token = await auth.verifyIdToken(body.idToken, true).catch(() => null);
    if (!token) return fail('Sesi tidak valid.', 401);
    const isGuest = token.firebase?.sign_in_provider === 'anonymous';
    const hasGoogle = !!(token.firebase?.identities && token.firebase.identities['google.com']);
    if (!isGuest && !hasGoogle) return fail('Masuk dengan Google atau gunakan chat tamu.', 401);

    let name = 'Tamu', accountId = 'tamu';
    const profileRef = !isGuest ? db.doc(`users/${token.uid}`) : null;
    if (!isGuest) {
      const profile = await profileRef.get();
      if (!profile.exists || profile.data().blocked) return fail('Akun tidak diizinkan.', 403);
      name = String(profile.data().displayName || 'Pengguna').slice(0, 100);
      accountId = String(profile.data().publicId || '').slice(0, 20);
    }

    const ip = (req.headers.get('x-nf-client-connection-ip') || '').trim();
    const ipKey = ip ? createHash('sha256').update(ip).digest('hex').slice(0, 32) : null;
    const uidRateRef = db.doc(`rate_limits/chat_uid_${token.uid}`);
    const ipRateRef = ipKey ? db.doc(`rate_limits/chat_ip_${ipKey}`) : null;
    const threadRef = db.doc(`chats/${token.uid}`);
    const messageRef = db.collection(`chats/${token.uid}/messages`).doc(randomUUID());
    const now = Date.now();

    await db.runTransaction(async (tx) => {
      const refs = [tx.get(uidRateRef), tx.get(threadRef)];
      if (profileRef) refs.push(tx.get(profileRef));
      if (ipRateRef) refs.push(tx.get(ipRateRef));
      const snaps = await Promise.all(refs);
      const uidRate = snaps[0].exists ? snaps[0].data() : {};
      const threadSnap = snaps[1];
      const profileSnap = profileRef ? snaps[2] : null;
      if (profileRef && (!profileSnap.exists || profileSnap.data().blocked)) throw Object.assign(new Error('Akun tidak diizinkan.'), { status: 403 });
      const ipSnap = ipRateRef ? snaps[profileRef ? 3 : 2] : null;
      const ipRate = ipSnap?.exists ? ipSnap.data() : {};
      const readRate = (rate) => {
        const active = Number.isFinite(rate.windowStart) && now - rate.windowStart < 60_000;
        return { active, count: active ? Number(rate.count) || 0 : 0, start: active ? rate.windowStart : now };
      };
      const ur = readRate(uidRate), ir = readRate(ipRate);
      if (ur.count >= 10) throw Object.assign(new Error('Terlalu banyak pesan. Coba lagi sebentar.'), { status: 429 });
      if (ipRateRef && ir.count >= 45) throw Object.assign(new Error('Batas chat dari jaringan ini tercapai. Coba lagi sebentar.'), { status: 429 });

      const last = (text || 'Mengirim lampiran').slice(0, 80);
      tx.set(messageRef, {
        from: 'client', name, text: text.slice(0, 1000),
        ...(image ? { img: image } : {}), at: FieldValue.serverTimestamp(),
      });
      tx.set(threadRef, { uid: token.uid, name, accountId, last, at: FieldValue.serverTimestamp() }, { merge: true });
      tx.set(uidRateRef, { windowStart: ur.start, count: ur.count + 1, expiresAt: new Date(now + 24 * 60 * 60 * 1000), updatedAt: FieldValue.serverTimestamp() });
      if (ipRateRef) tx.set(ipRateRef, { windowStart: ir.start, count: ir.count + 1, expiresAt: new Date(now + 24 * 60 * 60 * 1000), updatedAt: FieldValue.serverTimestamp() });
    });

    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = [400, 401, 403, 429].includes(error?.status) ? error.status : 400;
    return fail(error?.status ? error.message : 'Pesan belum dapat dikirim. Coba lagi.', status);
  }
}
