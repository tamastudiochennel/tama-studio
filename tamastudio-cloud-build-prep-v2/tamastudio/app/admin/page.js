import Island from '../../components/Island.js';

export const metadata = { title: 'Admin', robots: { index: false, follow: false } };

export default function Admin() {
  return (
    <>
      <header className="nav"><span className="brand">TS | TAMA STUDIO Admin</span></header>
      <main className="sec page wide">
        <div id="gate" className="box glass" style={{ maxWidth: 480, margin: 'auto', textAlign: 'left', justifyItems: 'stretch' }}>
          <div className="scene vault" id="vault" role="img" aria-label="Brankas 3D yang terbuka setelah dua langkah login"></div>
          <h1 style={{ fontSize: '1.6rem' }} id="gt">Masuk admin</h1>
          <p id="gs"></p>
          <p className="msg" id="gm" role="alert"></p>
          <div id="f1" className="form"><button className="btn gold" id="g1" type="button">Langkah 1: masuk dengan GitHub</button></div>
          <div id="s2" className="form" hidden>
            <button className="btn gold" id="g2" type="button">Verifikasi dengan Google</button>
            <button className="btn ghost" id="back" type="button">Mulai ulang</button>
          </div>
        </div>
        <div id="app" hidden></div>
      </main>
      <Island src="/admin/admin.js" />
    </>
  );
}
