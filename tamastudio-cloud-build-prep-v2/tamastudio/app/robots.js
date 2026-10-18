export default function robots() {
  const base = process.env.URL || 'https://tamastudio.netlify.app';
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/dashboard', '/pesan', '/masuk'] }], sitemap: base + '/sitemap.xml' };
}
