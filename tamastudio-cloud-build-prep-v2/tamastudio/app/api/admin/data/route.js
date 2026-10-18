import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { admin } from '../../../../lib/admin.js';
import { serializeFirestoreValue } from '../../../../lib/firestore-serialize.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const WINDOW_MS = 15 * 60 * 1000;
const fail = (message, status = 400) => Response.json({ ok: false, message }, { status, headers: { 'Cache-Control': 'no-store' } });
const ok = (data) => Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
const ID_RE = /^TS-[UO]-[A-Z0-9]{6}$/;
const ORDER_RE = /^TS-O-[A-Z0-9]{6}$/;
const CMS = new Set(['packages', 'services', 'portfolio', 'faq']);
const isAdminRole = (p) => p.role === 'owner' || p.role === 'admin';

function allowedOrigin(req) {
  const origin = req.headers.get('origin');
  // Browser state-changing requests must carry an explicit same-origin Origin header.
  // Do not silently accept missing Origin on cookie/session or authenticated mutation endpoints.
  if (!origin) return false;
  const host = (req.headers.get('host') || req.headers.get('x-forwarded-host') || '').split(',')[0].trim().toLowerCase();
  try { return !!host && new URL(origin).host.toLowerCase() === host; } catch { return false; }
}

async function readBody(req) {
  const raw = await req.text();
  if (raw.length > 24_000) throw Object.assign(new Error('Permintaan terlalu besar.'), { status: 413 });
  try { return JSON.parse(raw || '{}'); } catch { throw Object.assign(new Error('Format permintaan tidak valid.'), { status: 400 }); }
}

// Serialize Firestore Timestamp/Date values explicitly so the browser can revive them
// consistently instead of receiving SDK-specific private JSON shapes.
const one = (snap) => snap.exists ? serializeFirestoreValue({ id: snap.id, ...snap.data() }) : null;
const many = (snap) => snap.docs.map((d) => serializeFirestoreValue({ id: d.id, ...d.data() }));

export async function POST(req) {
  try {
    if (!allowedOrigin(req)) return fail('Asal permintaan tidak diizinkan.', 403);
    const body = await readBody(req);
    if (typeof body.idToken !== 'string' || body.idToken.length > 10_000 || typeof body.sid !== 'string' || body.sid.length < 4 || body.sid.length > 80) return fail('Sesi admin tidak valid.', 401);

    const { auth, db } = admin();
    const token = await auth.verifyIdToken(body.idToken, true).catch(() => null);
    if (!token || token.firebase?.sign_in_provider !== 'google.com') return fail('Token tidak valid.', 401);
    const profileSnap = await db.doc(`users/${token.uid}`).get();
    const profile = profileSnap.data();
    if (!profileSnap.exists || profile?.blocked || !['owner', 'admin', 'support'].includes(profile?.role)) return fail('Akun tidak memiliki akses staf.', 403);
    const gateRef = db.doc(`admin_gate/${token.uid}`);
    const profileRef = db.doc(`users/${token.uid}`);
    const gateOk = await db.runTransaction(async (tx) => {
      const [snap, liveProfileSnap] = await Promise.all([tx.get(gateRef), tx.get(profileRef)]);
      const g = snap.data(), liveProfile = liveProfileSnap.data();
      if (!snap.exists || !liveProfileSnap.exists || liveProfile?.blocked || liveProfile?.role !== profile.role || g?.sessionId !== body.sid || g?.authTime !== token.auth_time || !g?.lastActive || Date.now() - g.lastActive.toMillis() > WINDOW_MS) return false;
      tx.update(gateRef, { lastActive: FieldValue.serverTimestamp() });
      return true;
    });
    if (!gateOk) return fail('Sesi admin berakhir atau aktif di perangkat lain.', 401);

    const isAdmin = isAdminRole(profile);
    const action = typeof body.action === 'string' ? body.action : '';
    const args = body.args && typeof body.args === 'object' && !Array.isArray(body.args) ? body.args : {};
    let result;

    if (action === 'cms.get') {
      const name = typeof args.name === 'string' ? args.name : '';
      if (!CMS.has(name) && name !== 'packages') return fail('Bagian CMS tidak valid.');
      if (name === 'packages' && !isAdmin) return fail('Hanya admin atau owner yang boleh membaca katalog privat.', 403);
      result = one(await db.doc(`cms/${name}`).get());

    } else if (action === 'analytics') {
      if (!isAdmin) return fail('Hanya admin atau owner.', 403);
      const [days, waiting, active] = await Promise.all([
        db.collection('stats').orderBy('day', 'desc').limit(14).get(),
        db.collection('orders').where('status', '==', 'menunggu_verifikasi').count().get(),
        db.collection('orders').where('status', '==', 'aktif').count().get(),
      ]);
      result = { days: many(days).reverse(), waiting: waiting.data().count, active: active.data().count };

    } else if (action === 'broadcast.sources') {
      if (!isAdmin) return fail('Hanya admin atau owner.', 403);
      const [users, orders] = await Promise.all([
        db.collection('users').orderBy('createdAt', 'desc').limit(500).get(),
        db.collection('orders').orderBy('createdAt', 'desc').limit(500).get(),
      ]);
      result = { users: many(users), orders: many(orders) };

    } else if (action === 'users.list') {
      if (!isAdmin) return fail('Hanya admin atau owner.', 403);
      result = many(await db.collection('users').orderBy('createdAt', 'desc').limit(200).get());

    } else if (action === 'users.support') {
      if (!isAdmin) return fail('Hanya admin atau owner.', 403);
      result = (await db.collection('users').where('role', '==', 'support').limit(100).get()).docs
        .map((d) => ({ uid: d.id, name: d.data().displayName || d.data().username || d.id, blocked: d.data().blocked === true }));

    } else if (action === 'orders.list' || action === 'orders.kanban') {
      let snap;
      if (profile.role === 'support') snap = await db.collection('orders').where('assignedSupportUid', '==', token.uid).limit(action === 'orders.list' ? 100 : 250).get();
      else if (action === 'orders.kanban') snap = await db.collection('orders').where('status', 'in', ['aktif', 'selesai']).limit(500).get();
      else snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(100).get();
      result = many(snap).filter((o) => action !== 'orders.kanban' || ['aktif', 'selesai'].includes(o.status))
        .sort((a, b) => ((b.createdAt?.seconds) || 0) - ((a.createdAt?.seconds) || 0));

    } else if (action === 'orders.get') {
      const id = typeof args.id === 'string' ? args.id : '';
      if (!ORDER_RE.test(id)) return fail('ID pesanan tidak valid.');
      const orderSnap = await db.doc(`orders/${id}`).get();
      if (!orderSnap.exists) return fail('Pesanan tidak ditemukan.', 404);
      const order = orderSnap.data();
      if (profile.role === 'support' && order.assignedSupportUid !== token.uid) return fail('Proyek ini tidak ditugaskan kepadamu.', 403);
      result = { order: { id: orderSnap.id, ...order }, proof: isAdmin ? one(await db.doc(`payment_proofs/${id}`).get()) : null };

    } else if (action === 'home.lookup') {
      const id = typeof args.id === 'string' ? args.id.toUpperCase() : '';
      if (!ID_RE.test(id)) return fail('Format ID tidak valid.');
      if (profile.role === 'support' && !ORDER_RE.test(id)) return fail('Support hanya dapat mencari ID pesanan.', 403);
      const idSnap = await db.doc(`ids/${id}`).get();
      if (!idSnap.exists) result = { found: false };
      else {
        const index = idSnap.data();
        if (index.kind === 'account') {
          if (!isAdmin) return fail('Tidak berwenang mencari akun.', 403);
          const [userSnap, orders] = await Promise.all([
            db.doc(`users/${index.uid}`).get(),
            db.collection('orders').where('uid', '==', index.uid).limit(200).get(),
          ]);
          result = { found: true, kind: 'account', user: one(userSnap), orders: many(orders) };
        } else if (index.kind === 'order') {
          const orderId = typeof index.orderId === 'string' ? index.orderId : id;
          const orderSnap = await db.doc(`orders/${orderId}`).get();
          if (!orderSnap.exists) result = { found: true, kind: 'order', order: null, proof: null };
          else {
            const order = orderSnap.data();
            if (profile.role === 'support' && order.assignedSupportUid !== token.uid) return fail('Proyek ini tidak ditugaskan kepadamu.', 403);
            result = { found: true, kind: 'order', order: { id: orderSnap.id, ...order }, proof: isAdmin ? one(await db.doc(`payment_proofs/${orderId}`).get()) : null };
          }
        } else return fail('Jenis ID tidak valid.');
      }

    } else if (action === 'chat.threads') {
      result = many(await db.collection('chats').orderBy('at', 'desc').limit(50).get());

    } else if (action === 'chat.messages') {
      const uid = typeof args.uid === 'string' ? args.uid : '';
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return fail('ID akun tidak valid.');
      if (!(await db.doc(`chats/${uid}`).get()).exists) return fail('Percakapan tidak ditemukan.', 404);
      result = many(await db.collection(`chats/${uid}/messages`).orderBy('at', 'asc').limit(100).get());

    } else if (action === 'testimonials.list') {
      if (!isAdmin) return fail('Hanya admin atau owner.', 403);
      result = many(await db.collection('testimonials').orderBy('createdAt', 'desc').limit(100).get());

    } else if (action === 'logs.list') {
      if (!isAdmin) return fail('Hanya admin atau owner.', 403);
      let q = db.collection('admin_logs');
      if (typeof args.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.from)) q = q.where('at', '>=', Timestamp.fromDate(new Date(`${args.from}T00:00:00+07:00`)));
      if (typeof args.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.to)) q = q.where('at', '<=', Timestamp.fromDate(new Date(`${args.to}T23:59:59.999+07:00`)));
      const rows = many(await q.orderBy('at', 'desc').limit(300).get());
      const ids = [...new Set(rows.map((r) => r.adminId).filter((uid) => typeof uid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(uid)))];
      const users = ids.length ? await db.getAll(...ids.map((uid) => db.doc(`users/${uid}`))) : [];
      const names = Object.fromEntries(users.filter((u) => u.exists).map((u) => [u.id, u.data().username || u.id.slice(0, 6)]));
      result = { rows, names };

    } else if (action === 'system.counts') {
      if (!isAdmin) return fail('Hanya admin atau owner.', 403);
      const keys = ['users', 'orders', 'testimonials', 'admin_logs'];
      const counts = await Promise.all(keys.map(async (key) => [key, (await db.collection(key).count().get()).data().count]));
      result = Object.fromEntries(counts);

    } else if (action === 'system.export') {
      if (!isAdmin) return fail('Hanya admin atau owner.', 403);
      // Do not silently produce a partial backup: fetch one extra document to detect
      // collections that exceed the manual export cap and direct the operator to the
      // scheduled backup path instead. The ID index is part of the advertised backup.
      const EXPORT_LIMIT = 5000;
      const out = {};
      for (const name of ['users', 'orders', 'testimonials', 'cms', 'ids']) {
        const snap = await db.collection(name).limit(EXPORT_LIMIT + 1).get();
        if (snap.size > EXPORT_LIMIT) {
          throw Object.assign(new Error(`Ekspor manual melebihi batas ${EXPORT_LIMIT} dokumen pada koleksi ${name}. Gunakan backup otomatis atau ekspor tersegmentasi.`), { status: 413 });
        }
        out[name] = many(snap);
      }
      result = out;

    } else return fail('Jenis pembacaan tidak diizinkan.', 403);

    // Recheck authorization after potentially slow reads (exports, chat history, user lists).
    const stillAllowed = await db.runTransaction(async (tx) => {
      const [gateSnap, liveProfileSnap] = await Promise.all([tx.get(gateRef), tx.get(profileRef)]);
      const gate = gateSnap.data(), liveProfile = liveProfileSnap.data();
      if (!gateSnap.exists || !liveProfileSnap.exists || liveProfile?.blocked || liveProfile?.role !== profile.role
        || gate?.sessionId !== body.sid || gate?.authTime !== token.auth_time || !gate?.lastActive
        || Date.now() - gate.lastActive.toMillis() > WINDOW_MS) return false;
      tx.update(gateRef, { lastActive: FieldValue.serverTimestamp() });
      return true;
    });
    if (!stillAllowed) return fail('Sesi admin berakhir atau aktif di perangkat lain.', 401);
    return ok(serializeFirestoreValue(result));
  } catch (error) {
    const status = [400, 401, 403, 404, 413, 429].includes(error?.status) ? error.status : 500;
    return fail(status === 500 ? 'Server tidak dapat membaca data. Coba lagi atau periksa log server.' : (error?.message || 'Permintaan ditolak.'), status);
  }
}
