import { redirect } from 'next/navigation';
import Island from '../../components/Island.js';
import { sessionUser } from '../../lib/session.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard', robots: { index: false, follow: false } };

export default async function Page() {
  if (!(await sessionUser())) redirect('/masuk');
  return (
    <main className="sec page wide" id="app">
      <p>Memeriksa sesi...</p>
      <Island src="/assets/js/pages/dashboard.js" />
    </main>
  );
}
