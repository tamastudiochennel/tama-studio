export const SITE = { name: 'TS | TAMA STUDIO', waDisplay: '0882-0023-40869', waNumber: '62882002340869', email: 'tamastudiochennel@gmail.com' };
export const wa = (t) => `https://wa.me/${SITE.waNumber}?text=${encodeURIComponent(t)}`;
export const rp = (n) => 'Rp' + Number(n).toLocaleString('id-ID');
export const safeUrl = (value) => {
  if (typeof value !== 'string' || value.length > 2000) return '#';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return '#';
    return url.href;
  } catch { return '#'; }
};
