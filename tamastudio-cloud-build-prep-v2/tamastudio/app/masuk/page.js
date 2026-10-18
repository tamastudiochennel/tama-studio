import Island from '../../components/Island.js';

export const metadata = { title: 'Masuk', robots: { index: false, follow: false } };

export default function Masuk() {
  return (
    <main className="sec" style={{ paddingTop: '7rem', minHeight: '100svh' }}>
      <div className="box glass" style={{ maxWidth: 520, margin: 'auto', textAlign: 'left', justifyItems: 'stretch' }}>
        <h1 style={{ fontSize: '1.8rem' }}>Masuk atau daftar</h1>
        <p className="msg" id="msg" role="alert"></p>
        <p id="who"></p>

        <section id="v-load"><p>Memeriksa sesi...</p></section>

        <section id="v-out" className="form" hidden>
          <button className="btn gold" id="g-login" type="button">Lanjutkan dengan Google</button>
          <button className="btn ghost" id="gh-login" type="button">Masuk dengan GitHub</button>
          <p>Akun baru dimulai dari Google, lalu kamu memilih username. Tombol GitHub hanya untuk akun yang sudah menghubungkan GitHub.</p>
        </section>

        <section id="v-google" className="form" hidden>
          <p>Setiap akun wajib terhubung ke Google. Hubungkan sekarang untuk melanjutkan.</p>
          <button className="btn gold" id="g-link" type="button">Hubungkan Google</button>
          <button className="btn ghost" id="out0" type="button">Keluar</button>
        </section>

        <section id="v-complete" className="form" hidden>
          <p id="c-hello"></p>
          <form id="f-complete" className="form">
            <input id="c-u" placeholder="Username (huruf kecil, angka, _)" autoComplete="username" required />
            <input id="c-wa" placeholder="Nomor WhatsApp (opsional)" inputMode="tel" autoComplete="tel" />
            <button className="btn gold" type="submit">Selesaikan akun</button>
          </form>
          <button className="btn ghost" id="out1" type="button">Keluar</button>
        </section>

        <section id="v-done" className="form" hidden>
          <p>Halo, <b id="d-name"></b>. Username: <span className="mono" id="d-user"></span></p>
          <p>ID akun: <span className="mono" id="d-id"></span><br />Kirim ID ini ke admin kalau kamu butuh bantuan.</p>
          <p className="msg" id="blocked" hidden></p>
          <button className="btn ghost" id="gh" type="button" hidden>Hubungkan GitHub (opsional)</button>
          <a className="btn gold" href="/dashboard">Ke Dashboard</a>
          <button className="btn ghost" id="out2" type="button">Keluar</button>
        </section>

        <p style={{ fontSize: '.85rem' }}>Yang disimpan: nama dan foto dari akun Google, username, ID akun, dan nomor WhatsApp (jika kamu mengisinya), di Firebase (Google Cloud) milik TS | TAMA STUDIO. Tidak ada password yang disimpan.</p>
      </div>
      <Island src="/assets/js/pages/masuk.js" />
    </main>
  );
}
