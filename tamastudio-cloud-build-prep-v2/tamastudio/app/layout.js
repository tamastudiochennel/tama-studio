import Chrome from '../components/Chrome.js';
import Footer from '../components/Footer.js';

export const metadata = {
  metadataBase: new URL(process.env.URL || 'https://tamastudio.netlify.app'),
  title: { default: 'TS | TAMA STUDIO - Jasa Website, Aplikasi Android, UI/UX dan Sistem Custom', template: '%s | TS | TAMA STUDIO' },
  description: 'Studio digital untuk website, aplikasi Android, UI/UX, dan sistem custom. Konsultasi lewat WhatsApp, progres proyek bisa dipantau realtime.',
  openGraph: { siteName: 'TS | TAMA STUDIO', locale: 'id_ID', type: 'website' },
};
export const viewport = { themeColor: '#080808', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" />
        <link rel="stylesheet" href="/assets/css/site.css" />
      </head>
      <body>
        <Chrome footer={<Footer />}>{children}</Chrome>
      </body>
    </html>
  );
}
