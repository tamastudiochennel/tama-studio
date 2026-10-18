import { createHash, randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { admin } from '../../../lib/admin.js';
import { PACKAGES } from '../../../lib/defaults.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const fail = (message, status = 400) => Response.json({ ok: false, message }, { status, headers: { 'Cache-Control': 'no-store' } });
const newPublicId = () => 'TS-O-' + Array.from(randomBytes(6), (b) => ALPHABET[b & 31]).join('');

async function readJson(req, limit = 12_000) {
  const raw = await req.text();
  if (raw.length > limit) throw Object.assign(new Error('Ukuran permintaan terlalu besar.'), { status: 413 });
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

function validPackage(p) {
  return p && typeof p.name === 'string' && p.name.trim().length > 0 && p.name.trim().length <= 60
    && Number.isSafeInteger(p.price) && p.price > 0 && p.price <= 1_000_000_000
    && (p.active == null || p.active === true)
    && Array.isArray(p.features) && p.features.length >= 1 && p.features.length <= 30
    && p.features.every((feature) => typeof feature === 'string' && feature.trim().length > 0 && feature.length <= 240)
    && (p.description == null || (typeof p.description === 'string' && p.description.length <= 300));
}

export async function POST(req) {
  try {
    if (!allowedOrigin(req)) return fail('Asal permintaan tidak diizinkan.', 403);
    const body = await readJson(req);
    if (typeof body.idToken !== 'string' || body.idToken.length > 10_000) return fail('Sesi tidak valid.', 401);
    const pkgName = typeof body.packageName === 'string' ? body.packageName.trim().slice(0, 80) : '';
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    const addons = { domain: body.addons?.domain === true, hosting: body.addons?.hosting === true, customQuote: body.addons?.customQuote === true };
    if (!pkgName || !note || note.length > 1000) return fail('Paket dan kebutuhan proyek wajib diisi.');

    const { auth, db } = admin();
    const token = await auth.verifyIdToken(body.idToken, true).catch(() => null);
    if (!token || !(token.firebase?.identities && token.firebase.identities['google.com'])) return fail('Masuk dengan Google diperlukan.', 401);
    const profileRef = db.doc(`users/${token.uid}`);
    const catalogRef = db.doc('cms/packages');
    // Reject accounts that cannot place orders before consuming a shared IP quota.
    const eligibleProfile = await profileRef.get();
    if (!eligibleProfile.exists) return fail('Selesaikan profil akun sebelum memesan.', 403);
    if (eligibleProfile.data().blocked) return fail('Akun ini diblokir.', 403);
    const now = Date.now();
    const rateRef = db.doc(`rate_limits/order_${token.uid}`);
    const ip = (req.headers.get('x-nf-client-connection-ip') || '').trim();
    const ipHash = ip ? createHash('sha256').update(ip).digest('hex').slice(0, 32) : null;
    const ipRateRef = ipHash ? db.doc(`rate_limits/order_ip_${ipHash}`) : null;
    const publicId = newPublicId();
    const orderRef = db.doc(`orders/${publicId}`);
    const idRef = db.doc(`ids/${publicId}`);

    // Reserve rate-limit capacity before validating package names so invalid-package
    // requests also consume quota instead of allowing cheap database-read floods.
    await db.runTransaction(async (tx) => {
      const refs = [tx.get(rateRef)];
      if (ipRateRef) refs.push(tx.get(ipRateRef));
      const snaps = await Promise.all(refs);
      const userRate = snaps[0].exists ? snaps[0].data() : {};
      const ipRate = ipRateRef && snaps[1]?.exists ? snaps[1].data() : {};
      const activeWindow = Number.isFinite(userRate.windowStart) && now - userRate.windowStart < 10 * 60 * 1000;
      const count = activeWindow ? Number(userRate.count) || 0 : 0;
      const ipWindowActive = Number.isFinite(ipRate.windowStart) && now - ipRate.windowStart < 10 * 60 * 1000;
      const ipCount = ipWindowActive ? Number(ipRate.count) || 0 : 0;
      if (count >= 5) throw Object.assign(new Error('Terlalu banyak pesanan dalam waktu singkat. Coba lagi beberapa menit.'), { status: 429 });
      if (ipRateRef && ipCount >= 12) throw Object.assign(new Error('Batas pembuatan pesanan dari jaringan ini tercapai. Coba lagi beberapa menit.'), { status: 429 });
      tx.set(rateRef, { windowStart: activeWindow ? userRate.windowStart : now, count: count + 1, expiresAt: new Date(now + 24 * 60 * 60 * 1000), updatedAt: FieldValue.serverTimestamp() });
      if (ipRateRef) tx.set(ipRateRef, { windowStart: ipWindowActive ? ipRate.windowStart : now, count: ipCount + 1, expiresAt: new Date(now + 24 * 60 * 60 * 1000), updatedAt: FieldValue.serverTimestamp() });
    });

    const result = await db.runTransaction(async (tx) => {
      const [profileSnap, catalogSnap, orderSnap, idSnap] = await Promise.all([
        tx.get(profileRef), tx.get(catalogRef), tx.get(orderRef), tx.get(idRef),
      ]);
      if (!profileSnap.exists) throw Object.assign(new Error('Selesaikan profil akun sebelum memesan.'), { status: 403 });
      const profile = profileSnap.data();
      if (profile.blocked) throw Object.assign(new Error('Akun ini diblokir.'), { status: 403 });
      if (orderSnap.exists || idSnap.exists) throw Object.assign(new Error('ID pesanan bentrok. Silakan coba lagi.'), { status: 409 });

      // An intentionally empty catalog must stay empty; never revive retired defaults.
      const catalog = catalogSnap.exists && Array.isArray(catalogSnap.data().items)
        ? catalogSnap.data().items : PACKAGES;
      const pkg = catalog.find((item) => item && item.name === pkgName && item.active !== false);
      if (!validPackage(pkg)) throw Object.assign(new Error('Paket tidak tersedia atau konfigurasinya belum valid.'), { status: 400 });

      const needsQuote = addons.domain || addons.hosting || addons.customQuote;
      const order = {
        uid: token.uid,
        publicId,
        name: String(profile.displayName || 'Klien').slice(0, 100),
        username: String(profile.username || '').slice(0, 20),
        accountId: String(profile.publicId || '').slice(0, 20),
        pkg: pkg.name,
        packageSnapshot: { name: pkg.name, description: String(pkg.description || '').slice(0, 300), features: pkg.features.slice(0, 30), revisions: Number.isInteger(pkg.revisions) ? pkg.revisions : null, estimatedDays: Number.isInteger(pkg.estimatedDays) ? pkg.estimatedDays : null, version: Number.isSafeInteger(pkg.version) ? pkg.version : 1 },
        basePrice: pkg.price,
        price: needsQuote ? null : pkg.price,
        addons,
        priceStatus: needsQuote ? 'quote_required' : 'fixed',
        note,
        status: needsQuote ? 'menunggu_konfirmasi_harga' : 'menunggu_bayar',
        progress: 0,
        stage: 'Pending',
        createdAt: FieldValue.serverTimestamp(),
      };
      tx.set(orderRef, order);
      tx.set(idRef, { kind: 'order', uid: token.uid, orderId: publicId, createdAt: FieldValue.serverTimestamp() });
      return {
        publicId,
        pkg: order.pkg,
        price: order.price,
        basePrice: order.basePrice,
        addons: order.addons,
        status: order.status,
      };
    });

    return Response.json({ ok: true, order: result }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = [400, 401, 403, 409, 413, 429].includes(error?.status) ? error.status : 400;
    const message = status === 413 || (status === 400 && error?.message === 'Ukuran permintaan terlalu besar.')
      ? error.message
      : (error?.status ? error.message : 'Pesanan belum dapat dibuat. Periksa data lalu coba lagi.');
    return fail(message, status);
  }
}
