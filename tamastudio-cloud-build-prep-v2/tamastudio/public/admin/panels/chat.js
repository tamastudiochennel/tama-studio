import { op, readData } from './_ops.js';
import { safeImageData } from '/assets/js/core/util.js';

export default async function chat(v, c) {
  const e = c.esc;
  const threads = (await readData(c, 'chat.threads')).map((t) => ({ ...t, uid: t.uid || t.id }));
  v.innerHTML = `<h2>Chat klien</h2><p>Pesan diperbarui berkala saat panel ini terbuka.</p><div class="adm" style="grid-template-columns:260px 1fr"><div id="th">${threads.map((t) => `<button class="ob" type="button" data-u="${e(t.uid)}">${e(t.name || 'Tamu')}<small>${e(t.accountId || 'tamu')} | ${e(t.last || '')}</small></button>`).join('') || '<p>Belum ada percakapan.</p>'}</div>
<div class="card glass"><div class="msgs" id="mm"><p>Pilih percakapan.</p></div><form class="send" id="rf"><input id="rt" placeholder="Balas sebagai staf" maxlength="900" autocomplete="off"><button class="btn gold" type="submit">Kirim</button></form><p class="msg" id="err" role="alert"></p></div></div>`;
  let curUid = null, stopped = false, loading = false;
  const box = v.querySelector('#mm'), errorBox = v.querySelector('#err');

  async function loadMessages() {
    if (stopped || !curUid || loading) return;
    loading = true;
    try {
      const messages = await readData(c, 'chat.messages', { uid: curUid });
      if (stopped || !box.isConnected) return;
      box.innerHTML = messages.map((m) => {
        const imgUrl = safeImageData(m.img);
        const img = imgUrl ? `<a href="${imgUrl}" target="_blank" rel="noopener"><img src="${imgUrl}" alt="Lampiran"></a>` : '';
        return `<div class="m ${m.from === 'staff' ? 'client' : 'staff'}"><p>${e(m.text || '')}</p>${img}</div>`;
      }).join('') || '<p>Belum ada pesan.</p>';
      box.scrollTop = box.scrollHeight;
      errorBox.textContent = '';
    } catch (error) {
      if (!stopped) errorBox.textContent = error.message;
    } finally { loading = false; }
  }

  v.querySelectorAll('[data-u]').forEach((b) => {
    b.onclick = () => {
      curUid = b.dataset.u;
      v.querySelectorAll('.ob').forEach((x) => x.setAttribute('aria-current', x === b));
      loadMessages();
    };
  });
  v.querySelector('#rf').onsubmit = async (event) => {
    event.preventDefault();
    const input = v.querySelector('#rt'), text = input.value.trim();
    if (!text || !curUid) return;
    const uid = curUid;
    try {
      await op(c, 'chat.reply', { uid, text });
      input.value = '';
      await loadMessages();
    } catch (error) { errorBox.textContent = error.message; }
  };
  const timer = setInterval(loadMessages, 6000);
  return () => { stopped = true; clearInterval(timer); };
}
