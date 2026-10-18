const csp = (inline) => [
  "default-src 'self'",
  "script-src 'self'" + (inline ? " 'unsafe-inline'" : '') + ' https://cdn.jsdelivr.net https://www.gstatic.com https://apis.google.com https://www.google.com',
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.googleapis.com https://www.google.com",
  'frame-src https://*.firebaseapp.com https://accounts.google.com https://github.com https://www.google.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const common = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
];

export default {
  poweredByHeader: false,
  serverExternalPackages: ['firebase-admin'],
  async redirects() {
    return ['layanan', 'paket', 'portofolio', 'testimoni', 'faq', 'kontak', 'masuk', 'pesan', 'dashboard']
      .map((p) => ({ source: '/' + p + '.html', destination: '/' + p, permanent: true }))
      .concat([{ source: '/index.html', destination: '/', permanent: true }]);
  },
  async headers() {
    const strict = [{ key: 'Content-Security-Policy', value: csp(false) }];
    return [
      { source: '/:path*', headers: [...common, { key: 'Content-Security-Policy', value: csp(true) }] },
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};
