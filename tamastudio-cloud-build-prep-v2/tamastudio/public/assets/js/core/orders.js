import { db, doc, collection, getDocs, query, where } from './db.js';
import { auth } from './auth.js';

export async function myOrders(uid) {
  const s = await getDocs(query(collection(db, 'orders'), where('uid', '==', uid)));
  return s.docs.map((d) => d.data());
}

export async function createOrder(uid, prof, pkg, addons, note) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sesi masuk sudah berakhir. Masuk kembali.');
  const r = await fetch('/api/orders', {
    method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken: await user.getIdToken(true), packageName: pkg.name, addons, note }),
  });
  const result = await r.json().catch(() => ({}));
  if (!r.ok || !result.ok) throw new Error(result.message || 'Pesanan belum dapat dibuat.');
  return result.order;
}

export async function compressImage(file) {
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!file || !allowed.has(file.type) || file.size <= 0 || file.size > 12 * 1024 * 1024) {
    throw new Error('Pilih gambar JPEG, PNG, atau WebP dengan ukuran maksimal 12 MB.');
  }
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { throw new Error('File gambar tidak dapat dibaca.'); }
  try {
    if (bmp.width < 1 || bmp.height < 1 || bmp.width > 8000 || bmp.height > 8000) {
      throw new Error('Dimensi gambar tidak didukung.');
    }
    const k = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * k));
    c.height = Math.max(1, Math.round(bmp.height * k));
    const ctx = c.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Browser tidak dapat memproses gambar.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    for (let q = 0.78; q >= 0.38; q -= 0.1) {
      const u = c.toDataURL('image/jpeg', q);
      if (u.length < 380000) return u;
    }
    throw new Error('Gambar masih terlalu besar setelah dikompres. Pilih foto lain.');
  } finally {
    bmp.close?.();
  }
}

export async function submitProof(orderId, uid, file, retry) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sesi masuk sudah berakhir. Masuk kembali.');
  const image = await compressImage(file);
  const r = await fetch('/api/orders/proof', {
    method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken: await user.getIdToken(true), orderId, image }),
  });
  const result = await r.json().catch(() => ({}));
  if (!r.ok || !result.ok) throw new Error(result.message || 'Bukti pembayaran belum dapat dikirim.');
}
