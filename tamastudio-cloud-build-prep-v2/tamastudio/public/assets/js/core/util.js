export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const safeUrl = (value) => {
  if (typeof value !== 'string' || value.length > 2000) return '#';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return '#';
    return url.href;
  } catch { return '#'; }
};

// Only accept inert JPEG data URLs produced by the image compressor.
export const safeImageData = (v) => typeof v === 'string' && v.length <= 400000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(v) ? v : '';
