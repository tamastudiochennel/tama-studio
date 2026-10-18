import { createHash } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { admin } from '../../../../lib/admin.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const WIN = 15 * 60 * 1000;
const reply = (error, status) => Response.json({ ok: !error, error }, { status, headers: { 'Cache-Control': 'no-store' } });
const clientIp = (req) => (req.headers.get('x-nf-client-connection-ip') || 'unknown').trim();

function allowedOrigin(req) {
  const origin = req.headers.get('origin');
  // Browser state-changing requests must carry an explicit same-origin Origin header.
  // Do not silently accept missing Origin on cookie/session or authenticated mutation endpoints.
  if (!origin) return false;
  const host = (req.headers.get('host') || req.headers.get('x-forwarded-host') || '').split(',')[0].trim().toLowerCase();
  try { return !!host && new URL(origin).host.toLowerCase() === host; } catch { return false; }
}

async function parseBody(req) {
  const raw = await req.text();
  if (raw.length > 16_000) throw new Error('body-too-large');
  try { return JSON.parse(raw || '{}'); } catch { throw new Error('body-invalid'); }
}

export async function POST(req) {
  if (!allowedOrigin(req)) return reply('origin', 403);
  const ip = clientIp(req);
  const safe = createHash('sha256').update(ip || 'unknown').digest('hex').slice(0, 32);
  try {
    const { auth, db } = admin();
    const body = await parseBody(req);
    const { step, sid, idToken } = body;
    if (typeof idToken !== 'string' || idToken.length > 10_000 || typeof sid !== 'string' || sid.length < 4 || sid.length > 80) return reply('token', 401);
    const lockRef = db.doc(`auth_fail/${safe}`);
    const log = (adminId, action) => db.collection('admin_logs').add({ adminId, action, targetId: '', at: FieldValue.serverTimestamp(), ip: ip.slice(0, 80), ua: (req.headers.get('user-agent') || '').slice(0, 150) });
    const lock = await lockRef.get();
    if (lock.exists && lock.data().until && lock.data().until.toMillis() > Date.now()) return reply('locked', 429);

    let decoded;
    try { decoded = await auth.verifyIdToken(idToken, true); } catch { return reply('token', 401); }
    const provider = decoded.firebase?.sign_in_provider;
    const userRef = db.doc(`users/${decoded.uid}`);
    const userSnap = await userRef.get();
    const user = userSnap.data();
    const staff = userSnap.exists && !user?.blocked && ['owner', 'admin', 'support'].includes(user?.role)
      && !!(decoded.firebase?.identities && decoded.firebase.identities['google.com']);
    const gateRef = db.doc(`admin_gate/${decoded.uid}`);

    const deny = async (why) => {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(lockRef);
        const old = snap.data() || {};
        if (old.until && old.until.toMillis && old.until.toMillis() > Date.now()) return;
        const n = (Number(old.n) || 0) + 1;
        tx.set(lockRef, { n: n >= 5 ? 0 : n, until: n >= 5 ? Timestamp.fromMillis(Date.now() + 30 * 60 * 1000) : null, expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000), updatedAt: FieldValue.serverTimestamp() });
      });
      await log(decoded.uid, 'GAGAL ' + String(why).slice(0, 80));
      const latest = await lockRef.get();
      if (latest.exists && latest.data().until?.toMillis() > Date.now()) return reply('locked', 429);
      return reply(why, 403);
    };

    if (step === 'end') {
      const ended = await db.runTransaction(async (tx) => {
        const gate = await tx.get(gateRef);
        if (!gate.exists || gate.data().sessionId !== sid) return false;
        tx.update(gateRef, { sessionId: '', authTime: null, lastActive: Timestamp.fromMillis(0), endedAt: FieldValue.serverTimestamp() });
        return true;
      });
      if (ended) {
        await log(decoded.uid, 'admin logout');
      }
      return reply(null, 200);
    }

    if (!staff) return deny('bukan-admin');
    if (step === 1) {
      if (provider !== 'github.com') return deny('langkah-1');
      await gateRef.set({ step1At: FieldValue.serverTimestamp(), lastActive: FieldValue.serverTimestamp(), sessionId: sid, ip: ip.slice(0, 80) });
      return reply(null, 200);
    }

    if (provider !== 'google.com') return deny('langkah-2');
    if (step === 'beat') {
      const alive = await db.runTransaction(async (tx) => {
        const gate = await tx.get(gateRef);
        const g = gate.data();
        if (!gate.exists || g?.sessionId !== sid || g?.authTime !== decoded.auth_time || !g?.lastActive || Date.now() - g.lastActive.toMillis() > WIN) return false;
        tx.update(gateRef, { lastActive: FieldValue.serverTimestamp() });
        return true;
      });
      return alive ? reply(null, 200) : reply('sesi', 401);
    }

    const fresh = await db.runTransaction(async (tx) => {
      const gate = await tx.get(gateRef);
      const g = gate.data();
      if (!gate.exists || g?.sessionId !== sid || !g?.lastActive || Date.now() - g.lastActive.toMillis() > WIN) return false;
      tx.update(gateRef, { lastActive: FieldValue.serverTimestamp(), authTime: decoded.auth_time });
      return true;
    });
    if (!fresh || step !== 2) return step === 2 ? deny('langkah-2') : reply('sesi', 401);

    await lockRef.delete().catch(() => {});
    await log(decoded.uid, 'login 2 langkah berhasil');
    return reply(null, 200);
  } catch (error) {
    return reply(error?.message === 'body-too-large' ? 'body-too-large' : 'server', error?.message === 'body-too-large' ? 413 : 500);
  }
}
