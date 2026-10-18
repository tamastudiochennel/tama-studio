import { db, doc, getDoc } from './db.js';

export async function cms(name, fallback) {
  const k = 'cms:' + name;
  try {
    const hit = JSON.parse(sessionStorage.getItem(k) || 'null');
    if (hit && Date.now() - hit.t < (name === 'packages' ? 60_000 : 600_000)) return hit.items;
  } catch (e) {}
  try {
    if (name === 'packages') {
      const response = await fetch('/api/catalog', { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.ok && Array.isArray(result.items)) {
        try { sessionStorage.setItem(k, JSON.stringify({ t: Date.now(), items: result.items })); } catch (e) {}
        return result.items;
      }
    } else {
      const s = await getDoc(doc(db, 'cms', name));
      const items = s.exists() && s.data().items;
      if (Array.isArray(items) && items.length) {
        try { sessionStorage.setItem(k, JSON.stringify({ t: Date.now(), items })); } catch (e) {}
        return items;
      }
    }
  } catch (e) {}
  // Do not show fallback prices when the trusted catalog API is unavailable.
  return name === 'packages' ? [] : fallback;
}
