function revive(value) {
  if (Array.isArray(value)) return value.map(revive);
  if (!value || typeof value !== 'object') return value;
  if (value.__timestamp === true && Number.isFinite(value.seconds)) {
    const seconds = value.seconds, nanoseconds = Number(value.nanoseconds) || 0;
    return {
      seconds, nanoseconds,
      toDate: () => new Date(seconds * 1000 + nanoseconds / 1e6),
      toMillis: () => seconds * 1000 + nanoseconds / 1e6,
    };
  }
  if (typeof value.__date === 'string') return new Date(value.__date);
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, revive(v)]));
}

export async function readData(c, action, args = {}) {
  const r = await fetch('/api/admin/data', {
    method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, args, sid: c.sid(), idToken: await c.user.getIdToken() }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.message || 'Data tidak dapat dimuat dari server.');
  return revive(j.data);
}

export async function op(c, name, params = {}) {
  const r = await fetch('/api/admin/op', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ op: name, sid: c.sid(), idToken: await c.user.getIdToken() }, params)) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || 'Aksi ditolak server.');
  return j;
}
export const refresh = () => dispatchEvent(new Event('hashchange'));
