export default function sitemap() {
  const base = process.env.URL || 'https://tamastudio.netlify.app';
  return ['', '/layanan', '/paket', '/portofolio', '/testimoni', '/faq', '/kontak'].map((p) => ({ url: base + p }));
}
