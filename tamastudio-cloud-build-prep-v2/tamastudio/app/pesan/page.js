import { redirect } from 'next/navigation';
import Island from '../../components/Island.js';
import { sessionUser } from '../../lib/session.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pesan paket', robots: { index: false, follow: false } };

export default async function Page() {
  if (!(await sessionUser())) redirect('/masuk');
  return (
    <main className="sec page" id="app">
      <p>Memeriksa sesi...</p>
      <Island src="/assets/js/pages/pesan.js" />
    </main>
  );
}
