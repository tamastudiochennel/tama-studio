import Link from 'next/link';

export const metadata = { title: 'Halaman tidak ditemukan' };
export default function NotFound() {
  return (
    <main className="sec page" style={{ display: 'grid', alignContent: 'center', justifyItems: 'start', gap: '1rem' }}>
      <h1>Halaman tidak ditemukan</h1>
      <p>Alamat yang kamu buka belum ada atau sudah dipindahkan.</p>
      <Link className="btn gold" href="/">Kembali ke Beranda</Link>
    </main>
  );
}
