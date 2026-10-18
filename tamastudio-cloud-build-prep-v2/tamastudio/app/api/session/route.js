import { cookies } from 'next/headers';
import { admin } from '../../../lib/admin.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const MAX = 5 * 24 * 60 * 60 * 1000;

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
  if (raw.length > 12_000) throw new Error('too-large');
  try { return JSON.parse(raw || '{}'); } catch { throw new Error('invalid-json'); }
}

export async function POST(req) {
  if (!allowedOrigin(req)) return Response.json({ ok: false, error: 'origin' }, { status: 403 });
  try {
    const { idToken } = await readBody(req);
    if (typeof idToken !== 'string' || idToken.length > 10_000) return Response.json({ ok: false, error: 'invalid' }, { status: 401 });
    const { auth, db } = admin();
    const decoded = await auth.verifyIdToken(idToken, true);
    if (!(decoded.firebase?.identities && decoded.firebase.identities['google.com'])) {
      return Response.json({ ok: false, error: 'google' }, { status: 403 });
    }
    const p = await db.doc('users/' + decoded.uid).get();
    if (!p.exists) return Response.json({ ok: false, error: 'profile' }, { status: 403 });
    if (p.data().blocked) return Response.json({ ok: false, error: 'blocked' }, { status: 403 });
    const cookie = await auth.createSessionCookie(idToken, { expiresIn: MAX });
    (await cookies()).set('__session', cookie, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: MAX / 1000,
    });
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = error?.message === 'too-large' ? 413 : 401;
    return Response.json({ ok: false, error: status === 413 ? 'too-large' : 'invalid' }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function DELETE(req) {
  if (!allowedOrigin(req)) return Response.json({ ok: false, error: 'origin' }, { status: 403 });
  (await cookies()).delete('__session');
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
