'use client';
import { wa } from '../lib/site.js';

export default function ContactForm() {
  const submit = (e) => {
    e.preventDefault();
    const f = e.currentTarget.elements;
    location.href = wa(`Halo, nama saya ${f.n.value}. ${f.k.value}`);
  };
  return (
    <form className="form box glass" style={{ maxWidth: 520, marginTop: '2rem', textAlign: 'left', justifyItems: 'stretch' }} onSubmit={submit}>
      <h2>Konsultasi cepat</h2>
      <input name="n" placeholder="Nama" autoComplete="name" required />
      <textarea name="k" rows={4} placeholder="Apa yang ingin kamu buat?" required />
      <button className="btn gold" type="submit">Kirim lewat WhatsApp</button>
    </form>
  );
}
