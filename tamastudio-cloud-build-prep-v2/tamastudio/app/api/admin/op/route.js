import { FieldValue } from 'firebase-admin/firestore';
import { admin } from '../../../../lib/admin.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WIN = 15 * 60 * 1000;
const STAGES = ['Pending', 'Design', 'Development', 'Testing', 'Revision', 'Completed'];
const SUPPORT_STAGES = ['Pending', 'Design', 'Development', 'Testing', 'Revision'];
const DEF = { Pending: 0, Design: 20, Development: 45, Testing: 70, Revision: 85, Completed: 100 };
const CMS = ['services', 'portfolio', 'faq'];
const ROLES = ['client', 'support', 'admin', 'owner'];
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const ORDER_RE = /^TS-O-[A-Z0-9]{6}$/;
const fail = (message, status = 400) => Response.json({ ok: false, message }, { status, headers: { 'Cache-Control': 'no-store' } });
const clampText = (value, max) => String(value ?? '').trim().slice(0, max);
const links = (items) => (Array.isArray(items) ? items : []).slice(0, 10).filter((x) =>
  x && typeof x.name === 'string' && typeof x.url === 'string' && /^https:\/\//i.test(x.url)
).map((x) => ({ name: x.name.trim().slice(0, 80), url: x.url.slice(0, 500) }));

async function readJson(req, limit = 260_000) {
  const raw = await req.text();
  if (raw.length > limit) throw Object.assign(new Error('Permintaan terlalu besar.'), { status: 413 });
  try { return JSON.parse(raw || '{}'); } catch { throw Object.assign(new Error('Format permintaan tidak valid.'), { status: 400 }); }
}

function allowedOrigin(req) {
  const origin = req.headers.get('origin');
  // Browser state-changing requests must carry an explicit same-origin Origin header.
  // Do not silently accept missing Origin on cookie/session or authenticated mutation endpoints.
  if (!origin) return false;
  const host = (req.headers.get('host') || req.headers.get('x-forwarded-host') || '').split(',')[0].trim().toLowerCase();
  try { return !!host && new URL(origin).host.toLowerCase() === host; } catch { return false; }
}

function validCatalog(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 30 || JSON.stringify(items).length > 100_000) return false;
  const names = new Set();
  return items.every((p) => {
    if (!p || typeof p.name !== 'string' || !p.name.trim() || p.name.trim().length > 60) return false;
    const key = p.name.trim().toLowerCase();
    if (names.has(key)) return false;
    names.add(key);
    return Number.isSafeInteger(p.price) && p.price > 0 && p.price <= 1_000_000_000
      && Array.isArray(p.features) && p.features.length >= 1 && p.features.length <= 30
      && p.features.every((f) => typeof f === 'string' && f.trim().length > 0 && f.length <= 240)
      && (p.description == null || (typeof p.description === 'string' && p.description.length <= 300))
      && (p.revisions == null || (Number.isInteger(p.revisions) && p.revisions >= 0 && p.revisions <= 100))
      && (p.estimatedDays == null || (Number.isInteger(p.estimatedDays) && p.estimatedDays >= 1 && p.estimatedDays <= 365))
      && (p.active == null || typeof p.active === 'boolean')
      && (p.featured == null || typeof p.featured === 'boolean');
  });
}

function validCms(name, items) {
  if (!CMS.includes(name) || !Array.isArray(items) || !items.length || items.length > 50 || JSON.stringify(items).length > 100_000) return false;
  return items.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    if (name === 'services') return typeof item.name === 'string' && item.name.trim().length > 0 && item.name.length <= 100 && typeof item.desc === 'string' && item.desc.length <= 1000;
    if (name === 'portfolio') return typeof item.title === 'string' && item.title.trim().length > 0 && item.title.length <= 120 && typeof item.tag === 'string' && item.tag.length <= 80 && typeof item.desc === 'string' && item.desc.length <= 1000 && (!item.url || (typeof item.url === 'string' && /^https:\/\//i.test(item.url) && item.url.length <= 500));
    return typeof item.q === 'string' && item.q.trim().length > 0 && item.q.length <= 300 && typeof item.a === 'string' && item.a.length <= 2000;
  });
}

export async function POST(req) {
  try {
    if (!allowedOrigin(req)) return fail('Asal permintaan tidak diizinkan.', 403);
    const body = await readJson(req);
    const { auth, db } = admin();
    const token = typeof body.idToken === 'string' && body.idToken.length <= 10_000
      ? await auth.verifyIdToken(body.idToken, true).catch(() => null) : null;
    if (!token || token.firebase?.sign_in_provider !== 'google.com') return fail('Token tidak valid.', 401);
    if (typeof body.sid !== 'string' || body.sid.length < 4 || body.sid.length > 80) return fail('Sesi admin tidak valid.', 401);

    const profileSnap = await db.doc(`users/${token.uid}`).get();
    const profile = profileSnap.data();
    if (!profileSnap.exists || profile?.blocked || !['owner', 'admin', 'support'].includes(profile?.role)) return fail('Akun tidak memiliki akses admin.', 403);
    const isOwner = profile.role === 'owner';
    const isAdmin = isOwner || profile.role === 'admin';
    const ip = (req.headers.get('x-nf-client-connection-ip') || 'unknown').trim().slice(0, 80);
    const ua = (req.headers.get('user-agent') || '').slice(0, 150);
    const gateRef = db.doc(`admin_gate/${token.uid}`);
    const profileRef = db.doc(`users/${token.uid}`);

    // Re-check the live profile and current device session atomically.
    const gateOk = await db.runTransaction(async (tx) => {
      const [snap, liveProfileSnap] = await Promise.all([tx.get(gateRef), tx.get(profileRef)]);
      const g = snap.data();
      const liveProfile = liveProfileSnap.data();
      if (!snap.exists || !liveProfileSnap.exists || liveProfile?.blocked || liveProfile?.role !== profile.role || g?.sessionId !== body.sid || g?.authTime !== token.auth_time || !g?.lastActive || Date.now() - g.lastActive.toMillis() > WIN) return false;
      tx.update(gateRef, { lastActive: FieldValue.serverTimestamp() });
      return true;
    });
    if (!gateOk) return fail('Sesi admin berakhir atau aktif di perangkat lain.', 401);

    // Revalidate the exact session and live role inside mutation transactions so a role revocation
    // or session replacement conflicts with the write instead of racing it.
    const assertGateTx = async (tx) => {
      const [gateSnap, liveProfileSnap] = await Promise.all([tx.get(gateRef), tx.get(profileRef)]);
      const gate = gateSnap.data(), liveProfile = liveProfileSnap.data();
      if (!gateSnap.exists || !liveProfileSnap.exists || liveProfile?.blocked || liveProfile?.role !== profile.role
        || gate?.sessionId !== body.sid || gate?.authTime !== token.auth_time || !gate?.lastActive
        || Date.now() - gate.lastActive.toMillis() > WIN) {
        throw Object.assign(new Error('Sesi admin berakhir atau aktif di perangkat lain.'), { status: 401 });
      }
    };

    const auditRef = () => db.collection('admin_logs').doc();
    const auditData = (action, targetId = '') => ({ adminId: token.uid, action: clampText(action, 200), targetId: clampText(targetId, 80), at: FieldValue.serverTimestamp(), ip, ua });
    const writeAudit = async (action, targetId = '') => db.runTransaction(async (tx) => {
      await assertGateTx(tx);
      tx.create(auditRef(), auditData(action, targetId));
    });
    const writeMessageInTx = (tx, order, text) => {
      const ts = FieldValue.serverTimestamp();
      tx.set(db.collection(`chats/${order.uid}/messages`).doc(), { from: 'staff', name: profile.role === 'support' ? 'Support' : 'Admin', text: text.slice(0, 900), at: ts });
      tx.set(db.doc(`chats/${order.uid}`), { uid: order.uid, name: order.name, accountId: order.accountId, last: text.slice(0, 80), at: ts }, { merge: true });
    };

    const op = typeof body.op === 'string' ? body.op : '';
    const extra = {};

    if (op === 'log') {
      const action = clampText(body.action, 200), targetId = clampText(body.targetId, 80);
      const sessionEvents = ['logout', 'login berhasil (2 langkah)'];
      const lookup = /^cari ID TS-[UO]-[A-Z0-9]{6}$/.test(action);
      const broadcast = /^broadcast: (Semua pengguna|Pernah memesan|Proyek sedang dikerjakan|Pesanan selesai) \(\d{1,4}\)$/.test(action);
      if (sessionEvents.includes(action)) {
        if (targetId !== token.uid) return fail('Target log tidak valid.', 403);
      } else if (lookup) {
        if (profile.role === 'support' && !/^cari ID TS-O-[A-Z0-9]{6}$/.test(action)) return fail('Tidak berwenang.', 403);
      } else if (action === 'backup sekarang') {
        if (!isAdmin) return fail('Hanya admin atau owner.', 403);
      } else if (broadcast) {
        if (!isAdmin) return fail('Hanya admin atau owner.', 403);
      } else return fail('Jenis log tidak diizinkan.', 403);
      await writeAudit(action, targetId);

    } else if (op.startsWith('order.')) {
      const id = typeof body.id === 'string' ? body.id : '';
      if (!ORDER_RE.test(id)) return fail('ID pesanan tidak valid.');
      const orderRef = db.doc(`orders/${id}`);

      if (op === 'order.assign') {
        if (!isAdmin) return fail('Hanya admin atau owner yang boleh menugaskan proyek.', 403);
        const assignedUid = typeof body.uid === 'string' ? body.uid : '';
        if (assignedUid && !UID_RE.test(assignedUid)) return fail('ID support tidak valid.');
        await db.runTransaction(async (tx) => {
          await assertGateTx(tx);
          const reads = [tx.get(orderRef)];
          const supportRef = assignedUid ? db.doc(`users/${assignedUid}`) : null;
          if (supportRef) reads.push(tx.get(supportRef));
          const snaps = await Promise.all(reads);
          const orderSnap = snaps[0];
          if (!orderSnap.exists) throw Object.assign(new Error('Pesanan tidak ditemukan.'), { status: 404 });
          if (supportRef && (!snaps[1].exists || snaps[1].data().role !== 'support' || snaps[1].data().blocked)) throw Object.assign(new Error('Akun tujuan bukan support aktif.'), { status: 400 });
          tx.update(orderRef, { assignedSupportUid: assignedUid || null, assignedAt: FieldValue.serverTimestamp(), assignedBy: token.uid, updatedAt: FieldValue.serverTimestamp() });
          tx.set(auditRef(), auditData(`${assignedUid ? 'tugaskan' : 'lepas penugasan'} proyek ${id}`, id));
        });

      } else if (op === 'order.price') {
        if (!isAdmin) return fail('Hanya admin atau owner yang boleh menetapkan harga.', 403);
        const price = body.price;
        if (!Number.isSafeInteger(price) || price <= 0 || price > 1_000_000_000) return fail('Harga final tidak valid.');
        await db.runTransaction(async (tx) => {
          await assertGateTx(tx);
          const orderSnap = await tx.get(orderRef);
          if (!orderSnap.exists) throw Object.assign(new Error('Pesanan tidak ditemukan.'), { status: 404 });
          const order = orderSnap.data();
          if (!['menunggu_konfirmasi_harga', 'menunggu_persetujuan_harga'].includes(order.status)) throw Object.assign(new Error('Pesanan tidak sedang menunggu penetapan harga.'), { status: 409 });
          tx.update(orderRef, { price, priceStatus: 'quoted', status: 'menunggu_persetujuan_harga', quoteBy: token.uid, quoteAt: FieldValue.serverTimestamp(), priceAcceptedBy: null, priceAcceptedAt: null, updatedAt: FieldValue.serverTimestamp() });
          writeMessageInTx(tx, order, `Harga final pesanan ${id} ditetapkan sebesar Rp${price.toLocaleString('id-ID')}. Silakan setujui harga dari dashboard sebelum mengunggah bukti pembayaran.`);
          tx.set(auditRef(), auditData(`tetapkan harga pesanan ${id}`, id));
        });

      } else if (op === 'order.verify' || op === 'order.reject') {
        if (!isAdmin) return fail('Hanya admin atau owner yang boleh memverifikasi pembayaran.', 403);
        const reason = clampText(body.reason, 200);
        if (op === 'order.reject' && !reason) return fail('Alasan penolakan wajib diisi.');
        await db.runTransaction(async (tx) => {
          await assertGateTx(tx);
          const proofRef = db.doc(`payment_proofs/${id}`);
          const statsDay = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
          const statsRef = db.doc(`stats/d${statsDay}`);
          const [orderSnap, proofSnap] = await Promise.all([tx.get(orderRef), tx.get(proofRef)]);
          if (!orderSnap.exists) throw Object.assign(new Error('Pesanan tidak ditemukan.'), { status: 404 });
          const order = orderSnap.data();
          if (order.status !== 'menunggu_verifikasi') throw Object.assign(new Error('Status pesanan tidak mengizinkan perubahan ini.'), { status: 409 });
          if (!proofSnap.exists || proofSnap.data().uid !== order.uid || proofSnap.data().verdict !== 'menunggu') throw Object.assign(new Error('Bukti pembayaran belum tersedia atau sudah diproses.'), { status: 409 });
          if (op === 'order.verify') {
            if (!Number.isSafeInteger(order.price) || order.price <= 0) throw Object.assign(new Error('Harga final belum ditetapkan.'), { status: 409 });
            tx.update(orderRef, { status: 'aktif', updatedAt: FieldValue.serverTimestamp() });
            tx.update(proofRef, { verdict: 'diterima', reviewedBy: token.uid, reviewedAt: FieldValue.serverTimestamp() });
            tx.set(statsRef, { day: statsDay, revenue: FieldValue.increment(order.price), orders: FieldValue.increment(1) }, { merge: true });
            writeMessageInTx(tx, order, `Pembayaran pesanan ${id} sudah terverifikasi. Pengerjaan dimulai.`);
            tx.set(auditRef(), auditData(`verifikasi pembayaran ${id}`, id));
          } else {
            tx.update(orderRef, { status: 'ditolak', updatedAt: FieldValue.serverTimestamp() });
            tx.update(proofRef, { verdict: 'ditolak', reason, reviewedBy: token.uid, reviewedAt: FieldValue.serverTimestamp() });
            writeMessageInTx(tx, order, `Pembayaran pesanan ${id} ditolak: ${reason}. Unggah ulang bukti yang benar dari dashboard.`);
            tx.set(auditRef(), auditData(`tolak pembayaran ${id}`, id));
          }
        });

      } else if (op === 'order.move') {
        const stage = body.stage;
        if (!(isAdmin ? STAGES : SUPPORT_STAGES).includes(stage)) return fail('Tahap tidak valid atau tidak diizinkan.');
        await db.runTransaction(async (tx) => {
          await assertGateTx(tx);
          const snap = await tx.get(orderRef);
          if (!snap.exists) throw Object.assign(new Error('Pesanan tidak ditemukan.'), { status: 404 });
          const order = snap.data();
          if (profile.role === 'support' && order.assignedSupportUid !== token.uid) throw Object.assign(new Error('Proyek ini tidak ditugaskan kepadamu.'), { status: 403 });
          if (order.status !== 'aktif') throw Object.assign(new Error('Tahap hanya dapat diubah setelah pembayaran diverifikasi.'), { status: 409 });
          if (stage === 'Completed') throw Object.assign(new Error('Gunakan aksi penyelesaian khusus.'), { status: 400 });
          tx.update(orderRef, { stage, progress: Math.max(Number(order.progress) || 0, DEF[stage]), updatedAt: FieldValue.serverTimestamp() });
          tx.set(auditRef(), auditData(`pindah ${id} ke ${stage}`, id));
        });

      } else if (op === 'order.save') {
        if (!isAdmin) return fail('Hanya admin atau owner.', 403);
        if (!STAGES.slice(0, -1).includes(body.stage)) return fail('Tahap tidak valid.');
        if (!Number.isInteger(body.progress) || body.progress < 0 || body.progress > 99) return fail('Progres harus bilangan bulat 0–99.');
        const deliverables = links(body.deliverables);
        await db.runTransaction(async (tx) => {
          await assertGateTx(tx);
          const snap = await tx.get(orderRef);
          if (!snap.exists) throw Object.assign(new Error('Pesanan tidak ditemukan.'), { status: 404 });
          const order = snap.data();
          if (order.status !== 'aktif') throw Object.assign(new Error('Pesanan belum aktif.'), { status: 409 });
          tx.update(orderRef, { stage: body.stage, progress: body.progress, deliverables, updatedAt: FieldValue.serverTimestamp() });
          tx.set(auditRef(), auditData(`simpan progres ${id}`, id));
        });

      } else if (op === 'order.finish') {
        if (!isAdmin) return fail('Hanya admin atau owner yang boleh menyelesaikan proyek.', 403);
        const deliverables = links(body.deliverables);
        await db.runTransaction(async (tx) => {
          await assertGateTx(tx);
          const snap = await tx.get(orderRef);
          if (!snap.exists) throw Object.assign(new Error('Pesanan tidak ditemukan.'), { status: 404 });
          const order = snap.data();
          if (order.status !== 'aktif') throw Object.assign(new Error('Hanya pesanan aktif yang dapat diselesaikan.'), { status: 409 });
          tx.update(orderRef, { status: 'selesai', stage: 'Completed', progress: 100, ...(deliverables.length ? { deliverables } : Array.isArray(order.deliverables) ? { deliverables: order.deliverables } : {}), updatedAt: FieldValue.serverTimestamp() });
          writeMessageInTx(tx, order, `Pesanan ${id} selesai. Terima kasih! Kamu bisa memberi ulasan di dashboard.`);
          tx.set(auditRef(), auditData(`tandai selesai ${id}`, id));
        });
      } else return fail('Aksi pesanan tidak dikenal.');

    } else if (op === 'user.block' || op === 'user.unblock' || op === 'user.role') {
      if (!isAdmin) return fail('Hanya admin atau owner.', 403);
      const uid = typeof body.uid === 'string' ? body.uid : '';
      if (!UID_RE.test(uid) || uid === token.uid) return fail('Target pengguna tidak valid.');
      const userRef = db.doc(`users/${uid}`);
      const target = await userRef.get();
      if (!target.exists) return fail('Pengguna tidak ditemukan.', 404);
      const t = target.data();
      if ((t.role === 'owner' || t.role === 'admin') && !isOwner) return fail('Hanya owner yang boleh mengelola akun admin/owner.', 403);
      if (op === 'user.role') {
        if (!isOwner || !ROLES.includes(body.role) || (t.role === 'owner' && body.role !== 'owner')) return fail('Hanya owner yang boleh mengubah peran.', 403);
        await db.runTransaction(async (tx) => {
          await assertGateTx(tx);
          const snap = await tx.get(userRef);
          if (!snap.exists) throw Object.assign(new Error('Pengguna tidak ditemukan.'), { status: 404 });
          if (snap.data().role !== t.role) throw Object.assign(new Error('Peran berubah bersamaan. Muat ulang lalu coba lagi.'), { status: 409 });
          tx.update(userRef, { role: body.role, roleUpdatedAt: FieldValue.serverTimestamp(), roleUpdatedBy: token.uid });
          tx.set(auditRef(), auditData(`ubah peran ${t.publicId} jadi ${body.role}`, t.publicId));
        });
      } else {
        const blocked = op === 'user.block';
        await db.runTransaction(async (tx) => {
          await assertGateTx(tx);
          const snap = await tx.get(userRef);
          if (!snap.exists) throw Object.assign(new Error('Pengguna tidak ditemukan.'), { status: 404 });
          if (snap.data().role !== t.role) throw Object.assign(new Error('Peran berubah bersamaan. Muat ulang lalu coba lagi.'), { status: 409 });
          tx.update(userRef, { blocked, blockedReason: blocked ? clampText(body.reason, 200) : '', blockedAt: blocked ? FieldValue.serverTimestamp() : null, blockedBy: token.uid });
          tx.set(auditRef(), auditData(`${blocked ? 'blokir ' : 'buka blokir '}${t.publicId}`, t.publicId));
        });
        if (blocked) await auth.revokeRefreshTokens(uid).catch(() => {});
      }

    } else if (op === 'testimonial.set') {
      if (!isAdmin) return fail('Hanya admin atau owner.', 403);
      const id = typeof body.id === 'string' ? body.id : '';
      if (!ORDER_RE.test(id)) return fail('ID testimoni tidak valid.');
      const updates = {};
      if (['approved', 'rejected'].includes(body.status)) updates.status = body.status;
      if (typeof body.reply === 'string') updates.reply = clampText(body.reply, 300);
      if (!Object.keys(updates).length) return fail('Perubahan testimoni kosong.');
      const ref = db.doc(`testimonials/${id}`);
      await db.runTransaction(async (tx) => {
          await assertGateTx(tx);
        const snap = await tx.get(ref);
        if (!snap.exists) throw Object.assign(new Error('Testimoni tidak ditemukan.'), { status: 404 });
        tx.update(ref, { ...updates, reviewedBy: token.uid, reviewedAt: FieldValue.serverTimestamp() });
        tx.set(auditRef(), auditData(`testimoni ${updates.status || 'balas'} ${id}`, id));
      });

    } else if (op === 'catalog.save') {
      if (!isAdmin) return fail('Hanya admin atau owner.', 403);
      if (!validCatalog(body.items)) return fail('Katalog paket tidak valid. Periksa nama, harga, dan fitur.');
      const ref = db.doc('cms/packages');
      await db.runTransaction(async (tx) => {
          await assertGateTx(tx);
        const snap = await tx.get(ref);
        const old = snap.exists && Array.isArray(snap.data().items) ? snap.data().items : [];
        const oldVersion = new Map(old.filter((p) => p && typeof p.name === 'string').map((p) => [p.name.toLowerCase(), Number.isSafeInteger(p.version) ? p.version : 1]));
        const items = body.items.map((p) => ({
          name: p.name.trim(), description: clampText(p.description, 300), price: p.price,
          features: p.features.map((f) => f.trim()), revisions: Number.isInteger(p.revisions) ? p.revisions : 1,
          estimatedDays: Number.isInteger(p.estimatedDays) ? p.estimatedDays : 14,
          active: p.active !== false, featured: p.featured === true,
          version: (oldVersion.get(p.name.trim().toLowerCase()) || 0) + 1,
        }));
        tx.set(ref, { items, updatedAt: FieldValue.serverTimestamp(), updatedBy: token.uid });
        tx.set(auditRef(), auditData('ubah katalog paket', 'packages'));
      });

    } else if (op === 'cms.save') {
      if (!isAdmin) return fail('Hanya admin atau owner.', 403);
      const name = typeof body.name === 'string' ? body.name : '';
      if (!validCms(name, body.items)) return fail('Konten tidak valid. Katalog paket dikelola dari menu Katalog Paket.');
      await db.runTransaction(async (tx) => {
        await assertGateTx(tx);
        tx.set(db.doc(`cms/${name}`), { items: body.items, updatedAt: FieldValue.serverTimestamp(), updatedBy: token.uid });
        tx.set(auditRef(), auditData(`ubah konten ${name}`, name));
      });

    } else if (op === 'chat.reply') {
      const uid = typeof body.uid === 'string' ? body.uid : '';
      const text = clampText(body.text, 900);
      if (!UID_RE.test(uid) || !text) return fail('Pesan atau penerima tidak valid.');
      const threadRef = db.doc(`chats/${uid}`);
      await db.runTransaction(async (tx) => {
        await assertGateTx(tx);
        const thread = await tx.get(threadRef);
        if (!thread.exists) throw Object.assign(new Error('Percakapan tidak ditemukan.'), { status: 404 });
        const ts = FieldValue.serverTimestamp();
        tx.set(db.collection(`chats/${uid}/messages`).doc(), { from: 'staff', name: profile.role === 'support' ? 'Support' : 'Admin', text, at: ts });
        tx.set(threadRef, { last: text.slice(0, 80), at: ts }, { merge: true });
        tx.set(auditRef(), auditData('balas chat', uid));
      });

    } else if (op === 'users.emails') {
      if (!isAdmin) return fail('Hanya admin atau owner.', 403);
      const uids = Array.isArray(body.uids) ? [...new Set(body.uids.filter((x) => typeof x === 'string' && UID_RE.test(x)))] .slice(0, 100) : [];
      const r = uids.length ? await auth.getUsers(uids.map((uid) => ({ uid }))) : { users: [] };
      extra.emails = r.users.map((x) => x.email).filter(Boolean);
      await writeAudit(`ambil email untuk broadcast (${extra.emails.length})`);

    } else if (op === 'backup.list' || op === 'backup.get') {
      if (!isAdmin) return fail('Hanya admin atau owner.', 403);
      const { getStore } = await import('@netlify/blobs');
      const store = getStore('backups');
      if (op === 'backup.list') extra.keys = (await store.list()).blobs.map((x) => x.key).filter((key) => /^backup-\d{4}-\d{2}-\d{2}\.json$/.test(key)).sort().reverse().slice(0, 30);
      else {
        if (!/^backup-\d{4}-\d{2}-\d{2}\.json$/.test(String(body.key))) return fail('Nama backup tidak valid.');
        const data = await store.get(body.key);
        if (typeof data !== 'string' || data.length > 20_000_000) return fail('Backup tidak tersedia atau terlalu besar.', 404);
        extra.data = data;
        await writeAudit(`unduh ${body.key}`);
      }

    } else return fail('Aksi tidak dikenal.');

    await db.runTransaction(async (tx) => { await assertGateTx(tx); });
    return Response.json(Object.assign({ ok: true }, extra), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = [400, 401, 403, 404, 409, 413, 429].includes(error?.status) ? error.status : 500;
    if (status === 500) return fail('Server tidak dapat menyelesaikan aksi. Coba lagi atau periksa log server.', status);
    return fail(error?.message || 'Permintaan ditolak.', status);
  }
}
