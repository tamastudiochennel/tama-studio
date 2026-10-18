TAMA STUDIO — panduan pengembangan
Next.js App Router + React + Firebase Admin/Firestore + Netlify

STATUS
Salinan ini sudah mendapat perbaikan awal keamanan, alur pesanan, chat, dan panel Katalog Paket. Namun, build Next.js dan Firebase Emulator belum berhasil dijalankan pada lingkungan audit. Jangan anggap hasil ini siap produksi sampai seluruh checklist pre-launch di SECURITY-IMPLEMENTATION.md lulus di staging.

STRUKTUR PENTING
app/                         Halaman Next.js dan API server
app/api/session              Membuat/menghapus cookie sesi server
app/api/admin/gate           Gerbang admin GitHub lalu Google
app/api/admin/data           Pembacaan data admin dengan validasi sesi/peran
app/api/admin/op             Operasi admin dengan validasi aksi/peran dan audit log
app/api/catalog              Katalog publik dengan field yang diizinkan
app/api/orders               Pembuatan pesanan; harga ditentukan server
app/api/orders/proof         Pengiriman bukti bayar melalui server
app/api/orders/accept-quote  Persetujuan harga final oleh pelanggan
app/api/chat                Pengiriman chat dengan validasi dan pembatasan frekuensi
app/api/account/complete     Reservasi username dan pembuatan profil secara atomik
public/assets/js/            Modul browser dan 3D
public/admin/                Panel admin termasuk Katalog Paket
firestore.rules              Aturan akses Firestore yang baru
netlify/functions/backup.mjs Fungsi backup terjadwal
SECURITY-IMPLEMENTATION.md   Rangkuman perbaikan dan daftar pekerjaan yang belum teruji

PERSIAPAN PENGEMBANGAN (LAKUKAN DI STAGING TERLEBIH DAHULU)
1. Simpan repo GitHub sebagai PRIVATE dan jangan memasukkan kredensial ke repo atau ZIP.
2. Arsip ini belum menyertakan `package-lock.json`. Untuk uji pertama, Netlify memasang dependensi di cloud dan menjalankan build; tidak perlu menjalankan npm di perangkatmu. Untuk produksi, lockfile tetap harus dibuat dari registry tepercaya dan disimpan ke repo agar instalasi bisa direproduksi.
3. `netlify.toml` menjalankan `npm run check:all && npm run build`. Build Next.js belum pernah terbukti berhasil untuk salinan ini, jadi hasil pertama di Netlify adalah uji build, bukan bukti otomatis bahwa situs siap produksi.
4. Siapkan proyek Firebase STAGING. Penting: konfigurasi web yang dikirim ke browser saat ini masih menunjuk ke proyek `tama-studio-store` di `public/assets/js/config.js`. `FIREBASE_PROJECT_ID` pada server wajib cocok dengan proyek yang dipakai konfigurasi web, karena token dari proyek berbeda akan ditolak. Untuk staging terpisah, ubah juga konfigurasi web ke nilai proyek staging (jangan hanya mengganti environment server), lalu uji pada Deploy Preview. Isi environment variables server di Netlify Deploy Preview/staging:
   FIREBASE_PROJECT_ID = ID proyek yang sama dengan konfigurasi web aktif
   FIREBASE_CLIENT_EMAIL = nilai client_email service account
   FIREBASE_PRIVATE_KEY = private_key service account; pertahankan newline atau bentuk \n yang didukung kode
   Jangan simpan nilai tersebut dalam file source, ZIP publik, atau variabel yang diekspos ke browser.
5. Firebase Authentication: aktifkan Google. Aktifkan GitHub untuk proses admin dan tautkan ke UID Google yang sama. Anonymous hanya diperlukan bila fitur chat tamu dipakai. Tambahkan domain staging ke Authorized domains dan periksa callback OAuth sesuai proyek Firebase/GitHub.
6. Untuk bootstrap pertama, buat akun Google owner, selesaikan profil, lalu tetapkan role `owner` pada dokumen `users/{uid}` melalui Firebase Console hanya untuk akun yang benar-benar kamu kendalikan. Sesudah bootstrap, kelola peran lewat alur server admin.
7. Jalankan Firestore Emulator atau proyek staging, uji skenario di SECURITY-IMPLEMENTATION.md, baru publikasikan firestore.rules ke proyek staging. Jangan tempel Rules ini ke proyek produksi sebelum semua tes lulus.
8. Atur Firestore TTL untuk field `expiresAt` pada collection groups `rate_limits` dan `auth_fail`. Pembersihan TTL bersifat asinkron; pembatasan frekuensi tetap memeriksa timestamp window.
9. Uji backup Netlify Blobs, restore, Scheduled Function, serta secrets di staging. Jangan mengandalkan backup sebelum pemulihan berhasil diuji.
10. App Check BELUM diwajibkan oleh API. Konfigurasikan provider web melalui Firebase Console dan implementasikan/ujikan verifikasi App Check server-side pada staging sebelum enforcement. Jangan menaruh private secret dalam `public/assets/js/config.js`; kode browser bersifat publik.

KATALOG PAKET
Menu Admin → Katalog Paket memungkinkan admin/owner mengatur nama, harga, fitur, deskripsi, revisi, estimasi hari, status aktif/unggulan, dan urutan tampilan. Paket nonaktif disembunyikan dari katalog publik dan tidak dapat dipesan. Perubahan harga baru tidak mengubah snapshot penawaran/pesanan lama.

Pesanan dengan domain, hosting, atau kebutuhan di luar paket memasuki alur penawaran. Admin menetapkan harga final, pelanggan menyetujuinya, lalu pelanggan dapat mengirim bukti bayar. Nominal yang dikirim browser tidak dipercaya sebagai sumber harga.

PERAN ADMIN
- Owner: kewenangan administratif tertinggi dan pengelolaan peran.
- Admin: katalog, CMS, pesanan, penawaran harga, verifikasi pembayaran, moderasi testimoni, dan backup.
- Support: chat dan proyek yang ditugaskan; dapat memindahkan tahap yang diizinkan, tetapi tidak mengelola harga, memverifikasi pembayaran, menandai proyek selesai final, mengubah peran, atau membaca backup.

CATATAN KEAMANAN
- 2 langkah aplikasi GitHub → Google bukan bukti bahwa 2-Step Verification Google dipaksakan oleh kode. Aktifkan 2-Step Verification pada akun Google dan 2FA pada GitHub melalui pengaturan masing-masing.
- CSP masih memuat `unsafe-inline` pada `script-src`. Hardening nonce/CSP ketat perlu dilakukan setelah skrip Next.js, CDN, dan alur login diuji.
- Bukti pembayaran masih berupa data URL JPEG di Firestore. Pertimbangkan Firebase Storage privat dan URL berumur pendek sebelum skala penggunaan meningkat.
- Rate limit berbasis IP memerlukan header IP dari Netlify. Batas frekuensi tidak menggantikan App Check/WAF, validasi server, atau pemantauan kuota.
- Perubahan file tidak memodifikasi Firebase Console, Netlify, OAuth providers, atau domain mana pun. Tidak ada deployment yang dilakukan.

PEMERIKSAAN PRA-PELUNCURAN
- Build bersih dari lockfile: `npm ci` dan `npm run build`.
- Uji Rules: pengguna biasa, diblokir, tanpa profil, Anonymous, data pengguna lain, support dengan dan tanpa penugasan, admin, owner, dan sesi admin dari perangkat lain.
- Uji API: token invalid/dicabut, harga palsu, paket nonaktif, kutipan harga, bukti hilang/terulang, transisi status ilegal, spam/reservasi username, dan dua verifikasi pembayaran bersamaan.
- Uji UI/browser: login-keluar-login, GitHub → Google admin, chat, upload bukti, katalog, Kanban, navigasi bolak-balik, listener cleanup, perangkat seluler, dan pengurangan gerakan.
- Tinjau header CSP/HSTS, Firebase API key restrictions, Authorized domains, dan callback OAuth setelah domain final dipilih.
- Lakukan backup dan pemulihan percobaan.
- Gunakan SECURITY-IMPLEMENTATION.md sebagai daftar kontrol; target OWASP ASVS 5.0 Level 2 adalah target pengujian, bukan klaim sertifikasi.

PERSIAPAN LOCKFILE TANPA NPM DI KOMPUTER
1. Setelah source diunggah ke repositori GitHub, buka tab Actions dan pilih workflow “Prepare npm lockfile (cloud)”.
2. Klik Run workflow. Workflow ini hanya membuat `package-lock.json` dengan `--ignore-scripts` lalu mengunggahnya sebagai artifact; workflow tidak diberi izin menulis ke repositori.
3. Unduh artifact `tamastudio-package-lock`, ekstrak `package-lock.json`, lalu unggah file tersebut ke root repositori menggunakan antarmuka web GitHub dan commit. Jangan unggah file ZIP artifact itu sebagai pengganti lockfile.
4. Setelah `package-lock.json` sudah ada di repositori, Netlify dapat memakai lockfile yang sama untuk instalasi dan menjalankan build otomatis. Jika workflow gagal mengakses npm registry, jangan buat lockfile manual; coba lagi nanti.

PREFLIGHT RILIS
- `npm run check:release` tetap memeriksa keberadaan lockfile. Saat ZIP ini dibuat, pemeriksaan tersebut akan menandai `package-lock.json` sebagai blocker karena registry npm tidak dapat diakses di lingkungan audit.
- Build Netlify sekarang menjalankan pemeriksaan sintaks, import, keamanan statis, dan unit test sebelum `next build`. Netlify memasang dependensi di cloud; pengguna tidak perlu menjalankan npm di laptop. Namun, lockfile yang mungkin dibuat di lingkungan build tidak otomatis tersimpan ke repo, sehingga lockfile yang dikomit masih wajib sebelum produksi.
- `.nvmrc` menetapkan Node.js 20 agar versi lokal konsisten dengan konfigurasi Netlify.

CATATAN KECocokan PROYEK FIREBASE
- `public/assets/js/config.js` masih menunjuk ke Firebase project `tama-studio-store`. Jangan memasang service-account staging yang berbeda sambil mempertahankan konfigurasi web tersebut; autentikasi lintas proyek akan gagal dan dapat menyebabkan alur login/pemesanan tidak berfungsi. Pisahkan konfigurasi web staging dan produksi sebelum uji end-to-end.

VALIDASI LOKAL TERBARU
- Salin .env.example ke .env.local dan isi hanya kredensial Firebase STAGING yang sesuai.
- Jangan masukkan nilai service-account ke browser atau commit ke Git.
- Jalankan `npm run check:all` untuk mengulang pemeriksaan sintaks, import, assertions keamanan, dan tes unit.
- Backup terjadwal kini membaca koleksi per halaman 500 dokumen dan retensi hanya menghapus blob dengan nama backup bertanggal. Backup tetap tidak menyertakan bukti transfer; lakukan kebijakan penyimpanan bukti secara terpisah.
- Build penuh tetap wajib dan harus berhasil di Netlify. ZIP ini belum memiliki package-lock.json karena registry npm tidak tersedia pada lingkungan audit; build cloud awal adalah langkah verifikasi, bukan bukti bahwa lockfile produksi sudah tersedia.
- Server Firebase Admin sekarang fail-closed: tanpa ketiga environment variable kredensial yang lengkap, API server akan menolak berjalan; tidak ada lagi fallback otomatis ke ID proyek Firebase tertentu.
