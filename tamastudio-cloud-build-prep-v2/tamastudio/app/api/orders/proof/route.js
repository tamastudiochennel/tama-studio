import { FieldValue } from 'firebase-admin/firestore';
import { admin } from '../../../../lib/admin.js';

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

async function readJson(req, limit = 420_000) {
  const raw = await req.text();
  if (raw.length > limit) throw Object.assign(new Error('Bukti terlalu besar. Pilih gambar yang lebih kecil.'), { status: 413 });
  return JSON.parse(raw || '{}');
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
    const body = await readJson(req);
    const orderId = typeof body.orderId === 'string' ? body.orderId : '';
    const image = typeof body.image === 'string' ? body.image : '';
    if (!/^TS-O-[A-Z0-9]{6}$/.test(orderId)) return fail('ID pesanan tidak valid.');
    if (image.length > 400_000 || !validJpegDataUrl(image)) return fail('Bukti harus berupa gambar JPEG yang valid dan berukuran kecil.');

    const { auth, db } = admin();
    const token = typeof body.idToken === 'string' ? await auth.verifyIdToken(body.idToken, true).catch(() => null) : null;
    if (!token || !(token.firebase?.identities && token.firebase.identities['google.com'])) return fail('Sesi tidak valid.', 401);
    const profileRef = db.doc(`users/${token.uid}`);
    const orderRef = db.doc(`orders/${orderId}`);
    const proofRef = db.doc(`payment_proofs/${orderId}`);
    const rateRef = db.doc(`rate_limits/proof_${token.uid}`);
    const now = Date.now();
    await db.runTransaction(async (tx) => {
      const [profileSnap, orderSnap, proofSnap, rateSnap] = await Promise.all([tx.get(profileRef), tx.get(orderRef), tx.get(proofRef), tx.get(rateRef)]);
      if (!profileSnap.exists || profileSnap.data().blocked) throw Object.assign(new Error('Akun tidak diizinkan.'), { status: 403 });
      if (!orderSnap.exists || orderSnap.data().uid !== token.uid) throw Object.assign(new Error('Pesanan tidak ditemukan.'), { status: 404 });
      const order = orderSnap.data();
      if (order.status !== 'menunggu_bayar' && order.status !== 'ditolak') throw Object.assign(new Error('Pesanan belum siap menerima bukti pembayaran.'), { status: 409 });
      if (order.price == null || !Number.isSafeInteger(order.price) || order.price <= 0) throw Object.assign(new Error('Harga final belum disepakati. Tunggu konfirmasi admin.'), { status: 409 });
      if (proofSnap.exists && (order.status !== 'ditolak' || proofSnap.data().verdict !== 'ditolak' || proofSnap.data().uid !== token.uid)) {
        throw Object.assign(new Error('Bukti pembayaran sudah dikirim atau sedang diperiksa.'), { status: 409 });
      }
      const rate = rateSnap.exists ? rateSnap.data() : {};
      const active = Number.isFinite(rate.windowStart) && now - rate.windowStart < 10 * 60 * 1000;
      const count = active ? Number(rate.count) || 0 : 0;
      if (count >= 6) throw Object.assign(new Error('Terlalu banyak percobaan unggah. Coba lagi nanti.'), { status: 429 });

      tx.set(proofRef, { uid: token.uid, img: image, verdict: 'menunggu', createdAt: FieldValue.serverTimestamp() });
      tx.update(orderRef, { status: 'menunggu_verifikasi', updatedAt: FieldValue.serverTimestamp() });
      tx.set(rateRef, { windowStart: active ? rate.windowStart : now, count: count + 1, expiresAt: new Date(now + 24 * 60 * 60 * 1000), updatedAt: FieldValue.serverTimestamp() });
    });
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = [400, 401, 403, 404, 409, 413, 429].includes(error?.status) ? error.status : 400;
    return fail(error?.status ? error.message : (error?.message === 'Bukti terlalu besar. Pilih gambar yang lebih kecil.' ? error.message : 'Bukti pembayaran belum dapat dikirim.'), status);
  }
}
