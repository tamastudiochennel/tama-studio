# Tama Studio — Catatan Implementasi Keamanan

Dokumen ini menjelaskan perubahan pada salinan proyek yang disiapkan untuk pengembangan. Ini bukan sertifikasi, audit penetrasi independen, atau bukti bahwa aplikasi telah aman untuk produksi.

## Perubahan yang sudah diterapkan di source

### Identitas, sesi, dan aturan data

- Endpoint sesi memverifikasi Firebase ID token dengan pemeriksaan pencabutan, mewajibkan identitas Google tertaut untuk sesi aplikasi klien, menolak profil yang diblokir, dan menerbitkan cookie `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` dengan respons `no-store`. Halaman terproteksi memeriksa ulang profil live untuk menolak akun yang hilang/diblokir meskipun cookie sesi masih ada.
- Gerbang admin mempertahankan langkah GitHub lalu Google, sesi server tunggal, kedaluwarsa aktivitas, serta penguncian percobaan gagal.
- Endpoint operasi admin memverifikasi `sid` terhadap `admin_gate`, mencocokkan `auth_time`, dan memeriksa kembali status/peran profil saat menyegarkan aktivitas.
- Data staf yang sensitif dipindahkan ke `POST /api/admin/data`; panel admin tidak lagi melakukan query Firestore langsung. Endpoint ini mengecek token, role, sesi, dan `sid`, serta menerapkan pembatasan per aksi.
- Firestore Rules menolak pembuatan/perubahan profil, username, ID, pesanan, bukti pembayaran, chat, statistik, log, dan gerbang admin secara langsung dari browser kecuali pembaruan profil/ pembatalan pesanan/testimoni klien yang secara eksplisit diizinkan. Pembacaan langsung pesanan, chat, dan bukti dibatasi ke pemiliknya.
- Logout membersihkan penanda sesi browser; penanda `sessionStorage` tidak lagi dianggap bukti bahwa cookie server masih berlaku.

### Pesanan dan pembayaran

- Katalog paket privat (`cms/packages`) tidak dapat dibaca langsung oleh klien. `GET /api/catalog` hanya mengembalikan field yang diizinkan untuk paket aktif; endpoint ini tidak memublikasikan draft atau paket nonaktif. Katalog publik lain tetap dibaca sesuai Rules. Server membaca katalog terpercaya, memilih harga di server, menyimpan snapshot paket/fitur/versi/harga, membuat ID dan dokumen indeks secara transaksional, serta membatasi percobaan pembuatan pesanan per akun dan—bila header IP tepercaya tersedia—per IP. Kuota dicadangkan sebelum pemeriksaan paket sehingga percobaan paket palsu ikut dihitung.
- Bukti pembayaran dikirim melalui `POST /api/orders/proof`, memeriksa kepemilikan dan status pesanan di dalam transaksi, memerlukan harga final, memeriksa awalan byte JPEG, serta membatasi percobaan unggah per akun.
- Harga yang memerlukan konsultasi/add-on melalui status `menunggu_konfirmasi_harga` → `menunggu_persetujuan_harga` → `menunggu_bayar`. Pelanggan harus menyetujui penawaran final sebelum mengirim bukti pembayaran.
- Verifikasi/penolakan pembayaran dilakukan secara transaksional. Bukti harus ada dan belum diproses; verifikasi menggunakan kenaikan statistik pendapatan dalam transaksi supaya retry tidak menghitung pembayaran yang sama berulang kali.
- Pembatalan klien terbatas pada status yang diizinkan oleh Firestore Rules.

### Chat, pendaftaran akun, dan input

- Pesan chat dimediasi server. Nama/ID akun dibuat server, bukan diterima dari browser. Pesan dan gambar memiliki batas ukuran serta pembatasan frekuensi per UID; pembatasan tambahan per IP hanya tersedia bila Netlify mengirim `x-nf-client-connection-ip`.
- Pembuatan profil/username/ID dilakukan server dengan reservasi username atomik dan penghitung percobaan per UID/IP.
- Komponen Island, dashboard, halaman masuk/pesan, dan scene 3D memiliki jalur cleanup untuk menghentikan listener, timer, observer, dan resource renderer ketika dilepas. Cleanup ini sudah diperiksa secara statis, tetapi masih perlu browser smoke test.
- Gambar yang disisipkan ke panel admin hanya diterima bila cocok dengan bentuk data URL JPEG kecil dan byte awal JPEG. Teks dari data pengguna harus tetap di-escape; jangan mengembalikan interpolasi input mentah ke `innerHTML`.

### Peran staf

- **Owner:** pengaturan peran/sistem dan seluruh operasi administratif.
- **Admin:** paket, CMS, pesanan, penawaran harga, pembayaran, dan moderasi testimoni; tidak dapat mengubah peran admin/owner.
- **Support:** melihat pesanan yang ditugaskan, mengerjakan tahap Kanban yang diizinkan, dan menangani chat. Support tidak dapat mengubah katalog, memverifikasi/menolak pembayaran, menyelesaikan proyek secara final, mengubah peran, atau mengakses backup.
- Peran ditegakkan di endpoint server, bukan hanya dengan menyembunyikan menu.

### Katalog paket admin

Menu **Admin → Katalog Paket** disediakan untuk mengubah nama, deskripsi, harga, fitur, revisi, estimasi pengerjaan, status aktif/unggulan, dan urutan paket. Endpoint `catalog.save` memvalidasi data dan mencatat audit. Paket nonaktif tidak ditampilkan pada katalog publik atau dapat dipesan.

Perubahan harga katalog tidak mengubah pesanan lama karena detail yang disepakati disimpan sebagai snapshot pada pesanan. Harga add-on yang membutuhkan konsultasi harus ditetapkan sebagai penawaran oleh admin dan diterima pelanggan sebelum pembayaran.

## Pemeriksaan yang bisa diulang

Jalankan dari direktori proyek:

```sh
npm run check:syntax
npm ci
npm run build
```

`npm run check:syntax` memeriksa sintaks modul JS server dan browser, serta memeriksa bahwa panel admin tidak melakukan query Firestore langsung. Pemeriksaan ini bukan pengganti build Next.js, unit test, atau pengujian keamanan runtime.

Hasil pada sesi audit: `npm run check:syntax` lulus untuk 62 modul JS yang dicakup skrip; parser sintaks tambahan memeriksa 87 file JS/MJS/JSX (0 parse error), dan pemeriksaan import relatif menemukan 0 import hilang. `npm run build` belum bisa dimulai karena executable `next` tidak tersedia (`node_modules` tidak ada). Ini bukan hasil build yang lulus, dan tidak ada pengujian Firebase Emulator/runtime yang diklaim lulus.

## Hal yang belum dibuktikan dan harus diselesaikan sebelum produksi

1. **Build belum diuji.** ZIP awal tidak menyertakan lockfile atau `node_modules`. Pengambilan paket npm dari registry gagal pada lingkungan audit (`EAI_AGAIN`), jadi instalasi dependensi dan `next build` belum berhasil diverifikasi. Buat `package-lock.json` dengan versi Node/NPM yang ditetapkan setelah koneksi registry tersedia, commit lockfile, lalu gunakan `npm ci`.
2. **Firestore Emulator belum dijalankan.** Uji skenario pengguna biasa, terblokir, tanpa profil, tamu, pemilik pesanan lain, support dengan/tanpa penugasan, admin, owner, dan perangkat admin kedua. Pastikan indeks Firestore yang diperlukan tersedia.
3. **Rules harus dipublikasikan secara sengaja** ke proyek Firebase yang tepat setelah pengujian staging. File dalam ZIP tidak mengubah Firebase Console.
4. **Aktifkan TTL Firestore** pada field `expiresAt` untuk collection group `rate_limits` dan `auth_fail`. Sampai TTL diset di konsol, dokumen rate-limit lama tidak otomatis dibersihkan; pembatasan window tetap menghitung berdasarkan waktunya.
5. **App Check belum diaktifkan.** Konfigurasikan provider web di Firebase Console, uji token App Check di staging, pantau metrik, lalu aktifkan enforcement pada layanan yang didukung. App Check tidak menggantikan validasi API atau pembatasan laju.
6. **Restriksi Firebase API key dan authorized domains** masih harus disetel di Firebase Console sesuai domain final. Tidak ada perubahan Console atau deployment yang dilakukan sebagai bagian pekerjaan ini.
7. **CSP masih mengandung `unsafe-inline` pada `script-src`.** Ini belum diperkeras ke nonce-based CSP karena perlu diuji pada script Next.js, modul CDN, dan alur login. Lakukan hardening setelah build dan browser smoke test.
8. **Backup dan pemulihan belum diuji pada Netlify.** Periksa environment secrets Firebase Admin, akses Netlify Blobs, schedule fungsi, retensi backup, dan prosedur pemulihan di staging.
9. **Bukti pembayaran masih disimpan sebagai data URL JPEG di Firestore.** Akses langsung dibatasi dan pembacaan staf dimediasi server, tetapi untuk pertumbuhan dan privasi jangka panjang, pertimbangkan memindahkan gambar ke Firebase Storage privat dengan Rules, batas ukuran, dan URL yang berumur pendek.
10. **Migrasi TypeScript belum dijalankan dalam tahap ini.** Karena `next build` belum dapat dieksekusi, migrasi tipe ditunda agar tidak menambah perubahan runtime yang belum bisa diverifikasi. Setelah lockfile/build berfungsi, migrasikan API routes dan domain logic sedikit demi sedikit dengan validasi runtime tetap dipertahankan.
11. **Tidak ada deploy yang dilakukan.** Gunakan domain Netlify saat ini untuk staging; domain khusus, OAuth callback/authorized domains, CSP, dan cookie perlu diuji lagi bila domain berubah.
12. **Pengujian browser manual masih dibutuhkan**, termasuk login Google, login admin GitHub → Google, pindah perangkat, keluar-masuk ulang, membuat order, menyetujui penawaran, unggah bukti, moderasi pembayaran, chat, cleanup listener, dan tampilan seluler.

## Target standar

Gunakan OWASP ASVS 5.0 Level 2 sebagai daftar kontrol yang dapat diuji, disesuaikan dengan risiko dan kebutuhan produk. Jangan menyebut proyek tersertifikasi atau sepenuhnya patuh standar sebelum tiap persyaratan relevan diuji dan hasilnya dicatat.

## Pemeriksaan lanjutan (15 Oktober 2026)

- Menambahkan `npm run check:security`, pemeriksaan statis tanpa dependensi tambahan untuk kontrol penting pada Rules, verifikasi token/sesi, penetapan harga server, alur bukti/penawaran, pembatasan chat, reservasi username, katalog publik, dan larangan query Firestore langsung dari panel admin.
- Hasil: `npm run check:syntax` lulus (62 modul); `npm run check:security` lulus (26 assertions); `package.json` valid JSON.
- Upaya menghasilkan lockfile melalui registry npm tidak berhasil karena proses timeout; mode offline memastikan metadata paket `@netlify/blobs` tidak tersedia di cache (`ENOTCACHED`). Karena itu tidak dibuat lockfile palsu, tidak dijalankan `npm ci`, dan build Next.js tetap belum terverifikasi.
- Pemeriksaan statis bukan pengganti emulator Firestore, unit/integration tests, build, atau browser smoke test. Jangan menafsirkan hasil ini sebagai bukti semua jalur aplikasi aman.

### Pemeriksaan akhir tambahan (15 Oktober 2026)

- Menambahkan pemeriksaan statis untuk cookie sesi `HttpOnly`/`Secure`/`SameSite=Lax`, urutan login admin GitHub → Google, rate limit order, validasi asal/lampiran chat, validasi bukti pembayaran, pembatasan operasi support, dan respons data staf `no-store`.
- Hasil terbaru: `npm run check:syntax` lulus untuk 62 file JavaScript yang dipindai; `npm run check:security` lulus untuk 33 assertions.
- Percobaan instalasi dependensi terbaru gagal karena DNS/akses registry npm tidak tersedia (`EAI_AGAIN` pada `registry.npmjs.org`). Karena itu lockfile tidak dibuat, dan `npm ci`, `npm run build`, tes emulator, tes browser, serta deployment tetap belum dapat dinyatakan selesai.
- Tidak ditemukan file `.env` atau service-account JSON dalam source yang dikemas. `public/assets/js/core/config.js` berisi Firebase Web API key yang memang dapat terlihat di browser; itu bukan pengganti pengamanan Rules, App Check, dan pembatasan API key.

### Pemeriksaan lanjutan final (15 Oktober 2026)

- Memperbaiki serialisasi data API admin: dokumen dan daftar Firestore sekarang melewati serializer eksplisit untuk `Timestamp`/`Date`, lalu direvive oleh klien admin. Ini mencegah tanggal log/akun menjadi tidak terbaca dan menjaga pengurutan berdasarkan `createdAt`/`at` tetap menggunakan field `seconds` yang konsisten.
- Hasil setelah perubahan: `npm run check:syntax` lulus untuk 62 modul JavaScript yang dicakup skrip; `npm run check:security` lulus untuk 34 assertions statis.
- Build penuh, emulator Firestore, browser smoke test, dan deployment masih belum dapat diverifikasi karena dependensi npm tidak tersedia di lingkungan ini. Paket ini siap untuk tahap pengujian di lingkungan Node/Netlify yang memiliki akses registry, tetapi belum boleh dianggap tervalidasi untuk produksi.

## Pemeriksaan lanjutan berikutnya (15 Oktober 2026)

- Memperketat pemeriksaan asal permintaan pada sembilan endpoint yang mengubah state: sesi, gerbang admin, pembacaan data staf, operasi admin, pembuatan pesanan, unggah bukti, persetujuan penawaran, chat, dan penyelesaian akun. Endpoint tersebut kini menolak permintaan tanpa header `Origin`; bila header tersedia, host origin harus sama dengan host aplikasi.
- Menambahkan satu pemeriksaan statis untuk masing-masing sembilan endpoint tersebut agar kebijakan menolak `Origin` yang hilang tetap terjaga.
- Hasil terbaru: `npm run check:syntax` lulus untuk 62 file JavaScript; `npm run check:security` lulus untuk 43 assertions.
- Batasan: penguatan `Origin` adalah pertahanan tambahan, bukan pengganti autentikasi, otorisasi, validasi input, atau rate limit. Pengujian browser di staging tetap perlu memastikan seluruh alur fetch aplikasi mengirim header `Origin` seperti yang diharapkan.
- Pemeriksaan impor relatif tambahan mencakup 86 file source JS/MJS dan menemukan 0 import relatif yang hilang.
- Tinjauan source panel admin juga memeriksa interpolasi pada `innerHTML` dan penggunaan URL gambar. Field teks dinamis yang ditampilkan pada panel yang ditinjau menggunakan helper escape; lampiran dibatasi ke bentuk data URL JPEG oleh helper klien dan divalidasi byte awalnya pada endpoint server. Ini adalah tinjauan source, bukan pengujian XSS runtime.

### Tahap pengujian unit lanjutan (15 Oktober 2026)

- Mengekstrak serializer Firestore yang digunakan API admin ke `lib/firestore-serialize.mjs` agar dapat diuji secara terisolasi tanpa menginisialisasi Firebase Admin.
- Menambahkan empat tes unit menggunakan test runner bawaan Node.js: nilai primitif/nullish, objek `Date`, bentuk `Timestamp` Firestore, dan serialisasi rekursif objek/array bersarang.
- Menambahkan perintah `npm run test:unit`.
- Hasil terbaru: `npm run check:syntax` lulus untuk 63 file JavaScript; `npm run check:security` lulus untuk 43 assertions; `npm run test:unit` lulus 4/4 tes tanpa kegagalan.
- Tes unit ini memverifikasi serializer secara terisolasi, bukan integrasi nyata dengan Firestore atau perilaku UI di browser. Build Next.js, tes emulator, browser smoke test, dan deployment tetap belum dijalankan karena akses registry npm/dependensi belum tersedia.
- Percobaan ulang `npm run build` pada tahap ini berhenti di `sh: next: not found`, yang mengonfirmasi bahwa dependensi Next.js belum terpasang. Tidak ada hasil build yang dapat dinilai sampai `npm ci` berhasil dengan lockfile yang benar.

### Tahap lanjutan — integritas backup manual (15 Oktober 2026)

- Memperbaiki `system.export` agar menyertakan koleksi `ids`, sesuai deskripsi tombol backup manual.
- Ekspor manual kini membaca maksimal 5.001 dokumen per koleksi untuk mendeteksi bila jumlahnya melewati batas 5.000. Jika melewati batas, server mengembalikan error `413` yang jelas daripada menghasilkan file backup yang tampak lengkap tetapi terpotong. Pesan pada panel admin menjelaskan batas ini.
- Hasil verifikasi setelah perubahan: `npm run check:syntax` lulus (63 file JavaScript yang dicakup skrip), `npm run check:security` lulus (45 assertions), dan `npm run test:unit` lulus (4/4).
- Percobaan `npm run build` diulang dan gagal sebelum proses build dimulai: `sh: 1: next: not found`, karena dependensi proyek belum terpasang. Tidak ada klaim build atau runtime test berhasil.
- Backup otomatis Netlify, Firebase Emulator, uji browser, dan deployment tetap belum diverifikasi. Ekspor manual masih memiliki batas 5.000 dokumen per koleksi; untuk dataset lebih besar, gunakan backup otomatis atau siapkan mekanisme ekspor tersegmentasi yang diuji di staging.

### Pemeriksaan impor dan sumber lanjutan (15 Oktober 2026)

- Menambahkan `npm run check:imports`, pemeriksaan otomatis untuk semua import relatif di source JS/JSX/TS yang dapat menemukan file lokal. Hasil: 92 file source dipindai dan tidak ada import relatif yang hilang.
- Hasil rangkaian verifikasi terakhir: `npm run check:syntax` lulus (63 file JavaScript), `npm run check:security` lulus (45 assertions), `npm run test:unit` lulus (4/4), `npm run check:imports` lulus (92 file), dan `package.json` lolos parse JSON.
- `npm run build` tetap belum dapat dimulai karena `next` tidak ditemukan. Tidak ada lockfile npm yang dibuat secara manual dan tidak ada hasil build yang diklaim lulus.

## Tahap lanjutan — audit backup dan preflight (15 Oktober 2026)

Perubahan tambahan pada tahap ini:
- Fungsi backup terjadwal membaca koleksi Firestore dengan halaman berurutan 500 dokumen (`FieldPath.documentId()` + `startAfter`) agar tidak memakai satu query tak terbatas untuk setiap koleksi.
- Retensi backup hanya menghapus blob dengan pola `backup-YYYY-MM-DD.json` dan mempertahankan 14 backup terbaru; blob lain di store tidak disentuh.
- Panel sistem admin kini menyatakan secara eksplisit bahwa bukti transfer tidak termasuk backup otomatis.
- Ditambahkan `.env.example` tanpa rahasia aktual dan pengecualian `.gitignore` agar template dapat disimpan di repo.
- Ditambahkan `npm run check:all` untuk mengulang semua pemeriksaan lokal.

Hasil yang dijalankan ulang pada salinan proyek:
- `npm run check:syntax`: lulus, 63 file JavaScript.
- `npm run check:security`: lulus, 48 assertions statis.
- `npm run test:unit`: lulus, 4/4 tes serializer.
- `npm run check:imports`: lulus, 92 file source tanpa import relatif hilang.
- `npm run build`: belum dapat berjalan; gagal dengan `next: not found` karena dependensi belum terpasang.
- `npm install --ignore-scripts --no-audit --no-fund`: timeout ketika mengakses registry npm; tidak ada lockfile yang dibuat. Jangan menganggap build sudah lulus.

Batasan yang masih terbuka sebelum siap produksi:
- Belum ada `package-lock.json`, instalasi reproduktif, build Next.js, atau browser smoke test.
- Belum ada tes Firebase Emulator / staging terhadap Firestore Rules dan transaksi.
- Backup tidak mencakup `payment_proofs`; UI sekarang menyebutkan batasan ini. Uji pemulihan backup di staging tetap wajib.
- App Check belum ditegakkan oleh API, CSP `script-src` masih memakai `unsafe-inline`, dan bukti pembayaran masih disimpan sebagai data URL JPEG di Firestore.
- Domain final, secrets, OAuth, Firebase Console, Netlify, dan deployment belum diubah. Tidak ada rilis produksi yang dilakukan.

## Tahap lanjutan — fail-closed untuk konfigurasi Firebase (15 Oktober 2026)

- `lib/admin.js` tidak lagi memakai ID proyek Firebase bawaan. `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, dan `FIREBASE_PRIVATE_KEY` wajib tersedia di environment server; private key juga diperiksa format PEM dasarnya. Konfigurasi yang tidak lengkap akan gagal dengan pesan yang jelas, bukan memilih proyek secara diam-diam.
- `.env.example` hanya berisi placeholder dan instruksi menggunakan proyek STAGING. `.gitignore` mengecualikan `.env*` tetapi mengizinkan `.env.example`.
- Pemeriksaan terakhir: `npm run check:all` lulus; sintaks 63 file, import relatif 92 file, 49 assertions keamanan, dan 4/4 tes unit.
- Build masih belum terverifikasi karena dependensi Next.js tidak terpasang dan registry npm timeout. Belum ada deployment, belum ada tes Firebase Emulator, dan belum ada konfigurasi OAuth/domain yang diterapkan.

### Tahap persiapan rilis berikutnya (15 Oktober 2026)

- Menambahkan `.nvmrc` berisi Node.js 20 agar runtime lokal konsisten dengan `netlify.toml`.
- Menambahkan `npm run check:release` untuk memeriksa konfigurasi build Netlify, versi Node, keberadaan Firestore Rules dan fungsi backup, kebijakan konfigurasi Firebase Admin fail-closed, template environment, skrip pemeriksaan, serta lockfile.
- Hasil terbaru: `npm run check:all` lulus; pemeriksaan sintaks 63 file, import relatif 93 file tanpa import hilang, pemeriksaan keamanan 49 assertions, dan tes unit 4/4 lulus.
- `npm run check:release`: 8/9 pemeriksaan lulus; satu blocker yang dilaporkan secara eksplisit adalah tidak adanya `package-lock.json`.
- Upaya `npm install --package-lock-only --ignore-scripts --no-audit --no-fund --fetch-retries=1 --fetch-timeout=20000` kembali timeout saat mengakses registry npm. `npm run build` juga dicoba ulang dan berhenti pada `next: not found` karena dependensi belum terpasang.
- Lockfile tidak dibuat manual dan tidak ada klaim build berhasil. Begitu akses registry tersedia, buat lockfile dengan npm, tinjau, jalankan `npm ci`, ulangi `npm run check:all`, `npm run check:release`, dan `npm run build`.
- Situs belum dideploy; Firebase Emulator, browser smoke tests, verifikasi konfigurasi rahasia di Netlify, OAuth, App Check, dan pemulihan backup belum dijalankan. ZIP belum boleh dianggap siap produksi.


### Tahap audit rilis lanjutan (15 Oktober 2026)

- Percobaan ulang membuat lockfile dengan `npm install --package-lock-only --ignore-scripts --no-audit --no-fund --fetch-retries=1 --fetch-timeout=45000` berakhir timeout. Cache npm lokal juga tidak menyediakan paket yang diperlukan; `node_modules` dan `.next` tidak ada. Tidak dibuat lockfile palsu atau manual.
- `npm run check:all` tetap lulus: sintaks 63 file, impor relatif 93 file, 49 pemeriksaan keamanan statis, dan 4/4 unit test. `npm run check:release` masih 8/9 karena `package-lock.json` belum tersedia. Build tidak dapat diuji: `next: not found`.
- Ditemukan satu hal konfigurasi yang wajib diperhatikan pada staging: `public/assets/js/config.js` masih menunjuk ke Firebase project `tama-studio-store`, sedangkan `.env.example` menyarankan ID proyek staging. Konfigurasi browser dan kredensial server harus menunjuk ke proyek yang sama. Untuk staging terpisah, konfigurasi web harus diganti ke proyek staging juga; mengganti `FIREBASE_PROJECT_ID` server saja akan membuat token klien tidak cocok. README diperbarui untuk mencegah konfigurasi silang ini.
- Produksi tetap terblokir sampai lockfile dibuat melalui registry npm yang tepercaya, `npm ci` dan `npm run build` berhasil, proyek Firebase web/server cocok, lalu uji Firebase Rules, alur browser, backup/restore, App Check, CSP, OAuth, dan konfigurasi Netlify selesai. Tidak ada perubahan console atau deployment yang dilakukan.


### Tahap persiapan build cloud Netlify (16 Oktober 2026)

- Mengubah `netlify.toml` agar Netlify menjalankan `npm run check:all && npm run build`, dengan Node.js 20. Ini memungkinkan pemeriksaan sintaks, import, keamanan statis, dan unit test dijalankan di cloud sebelum build Next.js; pengguna tidak perlu menjalankan npm di perangkat lokal.
- Memperbarui pemeriksaan konfigurasi agar memvalidasi bahwa build Netlify menjalankan pemeriksaan dan perintah build.
- Verifikasi yang berhasil di lingkungan audit: `npm run check:all` lulus (63 file JavaScript, 93 file sumber, 49 assertions keamanan, 4/4 unit test).
- `npm run check:release` tetap melaporkan 8/9 karena `package-lock.json` belum tersedia. Percobaan registry npm dari lingkungan audit gagal dengan `EAI_AGAIN`; tidak ada lockfile buatan/manual.
- Build Next.js masih belum dijalankan dengan dependensi terpasang. Deploy Preview Netlify diperlukan untuk mengetahui hasil build nyata di cloud. Lockfile yang mungkin dibuat sementara saat instalasi Netlify tidak otomatis menjadi file yang dikomit ke repo. Karena itu, lockfile committed dan instalasi reproduktif tetap wajib sebelum produksi.
- Tidak ada repository GitHub, konfigurasi Firebase/Netlify, atau deployment yang dibuat/diubah dari sesi ini. Tidak ada klaim situs sudah siap produksi.


### Workflow cloud untuk membuat lockfile (16 Oktober 2026)

- Ditambahkan `.github/workflows/prepare-lockfile.yml`, dipicu manual melalui GitHub Actions. Workflow memakai Node.js 20 dan `npm install --package-lock-only --ignore-scripts`, lalu mengunggah `package-lock.json` sebagai artifact selama 7 hari.
- Workflow hanya memiliki izin `contents: read`, tidak menulis/commit ke repositori, dan tidak menjalankan package lifecycle scripts saat membuat lockfile. Pengguna dapat mengunduh artifact dan mengunggah file `package-lock.json` ke root repo melalui antarmuka web GitHub; ini tidak memerlukan npm pada perangkat pengguna.
- Workflow belum pernah dijalankan karena proyek belum terhubung ke repo GitHub. Lockfile belum tersedia dan tetap menjadi blocker sampai artifact berhasil dibuat dan file-nya dikomit.
