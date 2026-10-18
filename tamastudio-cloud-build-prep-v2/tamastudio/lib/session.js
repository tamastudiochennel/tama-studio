import { cookies } from 'next/headers';
import { admin } from './admin.js';

export async function sessionUser() {
  const cookie = (await cookies()).get('__session');
  if (!cookie) return null;
  try {
    const { auth, db } = admin();
    const decoded = await auth.verifySessionCookie(cookie.value, true);
    // Session cookies can outlive profile changes. Fail closed on every protected page,
    // even if token revocation propagation or a provider call fails during an admin action.
    const profile = await db.doc(`users/${decoded.uid}`).get();
    if (!profile.exists || profile.data()?.blocked === true) return null;
    return decoded;
  } catch {
    return null;
  }
}
