# JasaKita Pro V2 — Ekosistem Jasa 5 Peran & Auto-Split Saldo

WebApp Full-Stack siap deploy di **Cloudflare Pages + Cloudflare D1 (SQLite)** dengan dukungan **Login 5 Peran (User, Mitra, Korwil, Admin, Owner)**, **Auto-Split Saldo Transaksi**, **Escrow Midtrans**, **Token Leads & Langganan Mitra Pro**, serta **Kode Referral Wilayah Korwil**.

## Akun Demo 5 Peran (Password: `demo1234`)
Buka halaman `/login.html` untuk masuk 1-klik ke masing-masing peran:
1. **Owner (Pengatur Rumus Split & Ekspansi):** `owner@jasakita.id` → `/owner.html`
2. **Admin (Operasional, Verifikator & CS):** `admin@jasakita.id` → `/owner.html`
3. **Korwil (Koordinator Wilayah `KORWIL-BKT01`):** `korwil@jasakita.id` → `/korwil.html`
4. **Mitra Pro (Terapi Pak Hendra):** `mitra@jasakita.id` → `/mitra.html`
5. **Mitra Reguler (Kang Dedi Teknik):** `dedi.mitra@jasakita.id` → `/mitra.html`
6. **User (Pelanggan Budi Santoso):** `user@jasakita.id` → `/index.html`

## Langkah Update di GitHub & Cloudflare Pages
1. Ekstrak file ZIP ini dan timpa/unggah seluruh file ke repository GitHub Anda (`Nonoori/JasaKitaPro`).
2. Di **Cloudflare Dashboard → D1 SQL Database (`jasakita_db`) → Console**, jalankan ulang `db/schema.sql` lalu `db/seed_dummy.sql` (jika database lama sudah berisi tabel v1, jalankan `DROP TABLE IF EXISTS ...` atau buat database D1 baru `jasakita_db_v2` lalu hubungkan binding `DB`).
3. Seluruh string newline telah diamankan dengan `\n` / regex `/\r?\n/` sehingga build Cloudflare Pages Functions berjalan mulus tanpa error.
