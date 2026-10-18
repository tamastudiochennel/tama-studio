import { FieldValue } from 'firebase-admin/firestore';
import { admin } from '../../../../lib/admin.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const fail = (message, status = 400) => Response.json({ ok: false, message }, { status, headers: { 'Cache-Control': 'no-store' } });

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
    const id = typeof body.orderId === 'string' ? body.orderId : '';
    if (!/^TS-O-[A-Z0-9]{6}$/.test(id)) return fail('ID pesanan tidak valid.');
    if (typeof body.idToken !== 'string' || body.idToken.length > 10_000) return fail('Sesi tidak valid.', 401);

    const { auth, db } = admin();
    const token = await auth.verifyIdToken(body.idToken, true).catch(() => null);
    if (!token || !(token.firebase?.identities && token.firebase.identities['google.com'])) return fail('Masuk dengan Google diperlukan.', 401);
    const profileRef = db.doc(`users/${token.uid}`);
    const orderRef = db.doc(`orders/${id}`);
    await db.runTransaction(async (tx) => {
      const [profileSnap, snap] = await Promise.all([tx.get(profileRef), tx.get(orderRef)]);
      if (!profileSnap.exists || profileSnap.data().blocked) throw Object.assign(new Error('Akun tidak diizinkan.'), { status: 403 });
      if (!snap.exists || snap.data().uid !== token.uid) throw Object.assign(new Error('Pesanan tidak ditemukan.'), { status: 404 });
      const order = snap.data();
      if (order.status !== 'menunggu_persetujuan_harga' || order.priceStatus !== 'quoted' || !Number.isSafeInteger(order.price) || order.price <= 0) {
        throw Object.assign(new Error('Tidak ada penawaran harga yang menunggu persetujuan.'), { status: 409 });
      }
      tx.update(orderRef, {
        status: 'menunggu_bayar', priceStatus: 'accepted', priceAcceptedBy: token.uid,
        priceAcceptedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
    });
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = [400, 401, 403, 404, 409, 413, 429].includes(error?.status) ? error.status : 500;
    return fail(status === 500 ? 'Harga belum dapat disetujui. Coba lagi.' : error.message, status);
  }
}
