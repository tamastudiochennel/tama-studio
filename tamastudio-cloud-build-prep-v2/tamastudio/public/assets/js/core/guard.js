import { auth, onAuthStateChanged, getProfile, hasGoogle, syncSession } from './auth.js';

if (!location.pathname.startsWith('/masuk') && !location.pathname.startsWith('/admin')) {
  let checkedUid = null;
  onAuthStateChanged(auth, async (user) => {
    if (!user || user.isAnonymous) { checkedUid = null; return; }
    if (checkedUid === user.uid) return;
    checkedUid = user.uid;
    try {
      if (!hasGoogle(user) || !(await getProfile(user.uid))) {
        checkedUid = null;
        location.replace('/masuk');
        return;
      }
      const ok = await syncSession(user);
      if (!ok) {
        checkedUid = null;
        location.replace('/masuk');
      }
    } catch (e) {
      checkedUid = null;
      // Do not redirect on transient network errors; protected server pages still enforce their cookie.
    }
  });
}
