-- ============================================================================
-- DATA DUMMY LENGKAP 5 PERAN (USER, MITRA, KORWIL, ADMIN, OWNER) - is_dummy = 1
-- Password semua akun demo: demo1234
-- ============================================================================

INSERT OR REPLACE INTO app_settings (setting_key, setting_value) VALUES
('brand_name', 'JasaKita Pro'),
('brand_slogan', 'Ekosistem Jasa Harian & Langganan Terpercaya — Adil & Sejahtera untuk Semua Peran'),
('brand_logo', '🛡️'),
('theme_primary', '#0d9488'),
('theme_accent', '#f59e0b'),
('superadmin_wa', '6283124443888'),
('superadmin_email', 'owner@jasakita.id'),
('business_address', 'Jl. Patanangan No. 2, Gulai Bancah, Kota Bukittinggi, Sumatera Barat'),
('kop_header', 'PT JASAKITA NUSANTARA DIGITAL • NIB: 1209260088412 • NPWP: 94.881.204.5-202.000'),
('kop_sub', 'Jl. Patanangan No. 2, Gulai Bancah, Bukittinggi | WA Pusat: 0831-2444-3888 | Email: owner@jasakita.id'),
('header_disclaimer', '🔒 Keamanan Terjamin: Nomor WhatsApp & alamat pribadi Anda dilindungi enkripsi AES-256. Pembayaran ditahan aman (Escrow) hingga pekerjaan selesai.'),
('footer_copyright', '© 2026 JasaKita Pro Indonesia. Hak Cipta Dilindungi Undang-Undang.'),
('snk_text', '1. Pembayaran dilakukan melalui Midtrans Escrow dan ditahan sistem hingga layanan selesai dikerjakan.
2. Garansi pengerjaan ulang 7 hari berlaku eksklusif untuk transaksi yang tercatat di dalam aplikasi.
3. Pembatalan maksimal 2 jam sebelum jadwal kedatangan mitra.'),
('faq_json', '[{"q":"Bagaimana sistem pembagian hasil di JasaKita Pro?","a":"Mitra menerima 100% tarif jasanya. Biaya perlindungan user Rp4.000 dan token leads mitra Rp3.000 (atau langganan Pro Rp75.000/bln) otomatis dibagikan ke Korwil, Admin, dan Owner sesuai rumus yang diatur Owner."},{"q":"Apa keuntungan berlangganan Mitra Pro?","a":"Mitra Pro bebas potongan token Rp3.000 per transaksi, mendapat lencana Terpercaya, dan tampil di urutan paling atas pencarian terdekat."}]'),
-- RUMUS PEMBAGIAN SPLIT SALDO TRANSAKSI (DIATUR DINAMIS OLEH OWNER)
('split_user_platform_fee', '4000'),
('split_mitra_token_fee', '3000'),
('split_mitra_pro_price', '75000'),
('split_reguler_korwil_rp', '2500'),
('split_reguler_admin_rp', '2000'),
('split_reguler_owner_rp', '2500'),
('split_pro_order_korwil_rp', '1500'),
('split_pro_order_admin_rp', '1000'),
('split_pro_order_owner_rp', '1500'),
('split_sub_korwil_pct', '30'),
('split_sub_admin_pct', '20'),
('split_sub_owner_pct', '50'),
('umr_target_monthly', '6000000');

-- Kategori Layanan (Harian & Langganan)
INSERT OR IGNORE INTO service_categories (id, slug, name, service_type, icon, description, min_price, is_dummy) VALUES
(1, 'urut-terapi', 'Urut & Terapi Badan', 'harian', '💆‍♂️', 'Pijat urut tradisional, refleksi kaki, bekam sunnah steril panggilan ke rumah.', 75000, 1),
(2, 'tukang-bangunan', 'Tukang Bangunan & Renovasi', 'harian', '🧱', 'Perbaikan atap bocor, keramik, pengecatan, dan renovasi ringan harian.', 120000, 1),
(3, 'tukang-kebon', 'Tukang Kebon & Taman', 'harian', '🌿', 'Potong rumput, pangkas dahan, penataan taman rumah, dan pembersihan halaman.', 80000, 1),
(4, 'teknisi-listrik', 'Teknisi Listrik', 'harian', '⚡', 'Perbaikan korsleting, pasang stop kontak, instalasi lampu, dan MCB.', 65000, 1),
(5, 'tukang-ledeng', 'Tukang Ledeng & Pipa', 'harian', '🚰', 'Perbaikan pipa bocor, saluran mampet, pasang pompa air, dan kuras tandon.', 70000, 1),
(6, 'gojek-kurir', 'Ojek & Kurir Lokal', 'harian', '🛵', 'Antar jemput penumpang, belanja pasar, dan kirim paket kilat dalam kota.', 15000, 1),
(7, 'guru-ngaji', 'Guru Ngaji Privat', 'langganan', '📖', 'Belajar Iqra, Al-Qur''an, tajwid, dan tahsin untuk anak maupun dewasa di rumah.', 150000, 1),
(8, 'bimbel-privat', 'Bimbel & Les Privat', 'langganan', '🎓', 'Pendampingan belajar SD, SMP, SMA (Matematika, Bahasa Inggris, IPA) terstruktur.', 200000, 1),
(9, 'bersih-rumah', 'Bersih Rumah Rutin', 'langganan', '🧹', 'Layanan asisten kebersihan rumah mingguan/bulanan (sapu, pel, kamar mandi, dapur).', 180000, 1),
(10, 'laundry-kiloan', 'Laundry Antar-Jemput', 'langganan', '🧺', 'Paket cuci setrika wangi berlangganan bulanan dengan antar-jemput terjadwal.', 120000, 1);

-- 5 AKUN DEMO LENGKAP UNTUK SETIAP PERAN (Password: demo1234)
INSERT OR IGNORE INTO users (id, role, full_name, email, phone_encrypted, phone_hash, phone_masked, password_hash, address_encrypted, address_area, lat, lng, referral_code, referred_by_korwil_id, wallet_balance, escrow_balance, token_balance, bank_info, is_verified, is_dummy) VALUES
(1, 'owner', 'Owner Utama JasaKita', 'owner@jasakita.id', 'ENC:6283124443888', 'hash_owner_1', '0831-****-3888', 'DEMO:demo1234', 'ENC:Jl. Patanangan No. 2, Gulai Bancah', 'Gulai Bancah, Bukittinggi', -0.3021, 100.3715, 'OWNER-HQ', NULL, 2500000, 0, 0, 'BCA 8810293847 a.n. PT JasaKita Nusantara', 1, 1),
(2, 'admin', 'Admin Operasional & CS (Rina)', 'admin@jasakita.id', 'ENC:6281122334455', 'hash_admin_2', '0811-****-4455', 'DEMO:demo1234', 'ENC:Jl. Sudirman No. 10, Bukittinggi', 'Pusat Kota, Bukittinggi', -0.3040, 100.3690, NULL, NULL, 1850000, 0, 0, 'BRI 001501002938 a.n. Rina Admin', 1, 1),
(3, 'korwil', 'Korwil Bukittinggi (Bang Riko)', 'korwil@jasakita.id', 'ENC:6282233445566', 'hash_korwil_3', '0822-****-5566', 'DEMO:demo1234', 'ENC:Jl. Soekarno Hatta No. 21, Aur Birugo', 'Kota Bukittinggi & Agam Timur', -0.3100, 100.3780, 'KORWIL-BKT01', NULL, 2150000, 0, 0, 'Mandiri 111009876543 a.n. Riko Korwil', 1, 1),
(4, 'mitra', 'Terapi Sehat Alami (Pak Hendra)', 'mitra@jasakita.id', 'ENC:6281377889900', 'hash_mitra_4', '0813-****-9900', 'DEMO:demo1234', 'ENC:Jl. Patanangan No. 2, Gulai Bancah', 'Gulai Bancah, Bukittinggi', -0.3025, 100.3720, NULL, 3, 1450000, 140000, 45000, 'BSI 7182930412 a.n. Hendra Terapis', 1, 1),
(5, 'user', 'Budi Santoso (Pelanggan)', 'user@jasakita.id', 'ENC:6281234567890', 'hash_user_5', '0812-****-7890', 'DEMO:demo1234', 'ENC:Perumahan Griya Indah Blok B4, Mandiangin', 'Mandiangin Koto Selayan, Bukittinggi', -0.2985, 100.3750, NULL, 3, 0, 0, 0, '', 1, 1),
(6, 'mitra', 'Kang Dedi Teknik & Bangunan', 'dedi.mitra@jasakita.id', 'ENC:6287899001122', 'hash_mitra_6', '0878-****-1122', 'DEMO:demo1234', 'ENC:Jl. Bypass Gadut No. 8', 'Tilatang Kamang, Bukittinggi', -0.2890, 100.3890, NULL, 3, 890000, 0, 30000, 'BNI 0829102938 a.n. Dedi Teknik', 1, 1);

-- Profil Bisnis Mitra
INSERT OR IGNORE INTO mitra_profiles (id, user_id, business_name, slogan, business_photo, bio, skills_json, certifications_json, solutions_offered, service_radius_km, membership_tier, rating_avg, total_reviews, total_orders_completed, verification_status, is_dummy) VALUES
(1, 4, 'Klinik & Homecare Urut Refleksi Patanangan', 'Pegel Hilang, Badan Segar, Tidur Nyenyak Kembali', '', 'Melayani urut badan tradisional, refleksi syaraf kaki, bekam sunnah steril, dan terapi keseleo panggilan ke rumah.', '["Urut Badan Tradisional","Refleksi Kaki","Bekam Steril","Urut Anak & Keseleo"]', '[{"title":"Sertifikat Terapis Bekam & Pijat","issuer":"Perkumpulan Bekam Indonesia (PBI)","year":"2024"},{"title":"STPT Dinas Kesehatan","issuer":"Dinkes Kota Bukittinggi","year":"2025"}]', 'Mengatasi nyeri pinggang, salah urat, kelelahan kerja berat dengan alat steril sekali pakai.', 5.0, 'pro', 4.95, 67, 215, 'verified', 1),
(2, 6, 'Solusi Rumah Kang Dedi (Listrik, Ledeng & Tukang)', 'Cepat Tanggap, Rapi, Bergaransi 30 Hari', '', 'Teknisi serba bisa untuk instalasi listrik rumah, pipa ledeng bocor, pasang pompa air, dan perawatan taman.', '["Teknisi Listrik","Tukang Ledeng & Pipa","Tukang Bangunan","Tukang Kebon"]', '[{"title":"Sertifikat Kompetensi Instalasi Listrik","issuer":"BNSP / Kemnaker","year":"2022"}]', 'Menyelesaikan masalah darurat rumah tangga seperti korsleting listrik, keran patah, dan tandon meluap.', 8.0, 'reguler', 4.88, 34, 98, 'verified', 1);

-- Katalog Layanan Mitra
INSERT OR IGNORE INTO services (id, mitra_id, category_id, title, service_type, service_class, price, price_unit, duration_minutes, description, solution_detail, subscription_days, is_dummy) VALUES
(1, 4, 1, 'Urut Badan Full Body + Refleksi Kaki (Homecare)', 'harian', 'VIP / Premium', 95000, 'per sesi (90 menit)', 90, 'Pijat urut seluruh tubuh menggunakan minyak zaitun hangat dilanjutkan totok refleksi telapak kaki.', 'Meredakan ketegangan otot punggung, bahu kaku, pegal linu, dan meningkatkan kualitas tidur.', NULL, 1),
(2, 6, 4, 'Perbaikan Listrik Konslet & Tambah Instalasi', 'harian', 'Reguler', 75000, 'per kunjungan', 60, 'Pengecekan jalur MCB, perbaikan stop kontak terbakar, pemasangan lampu gantung & saklar.', 'Menghilangkan risiko kebakaran akibat arus pendek dan menormalkan daya listrik rumah.', NULL, 1),
(3, 6, 5, 'Perbaikan Pipa Ledeng Bocor & Kuras Tandon', 'harian', 'Reguler', 85000, 'per titik pengerjaan', 90, 'Mengatasi pipa PVC pecah, keran patah di dalam drat, saluran wastafel mampet, dan kuras toren air.', 'Air kembali mengalir lancar tanpa kebocoran.', NULL, 1),
(4, 4, 7, 'Paket Langganan Guru Ngaji & Tahsin Privat (8x/Bulan)', 'langganan', 'Keluarga / Paket Bulanan', 240000, 'per bulan (8x pertemuan)', 60, 'Bimbingan baca Al-Qur''an dari Iqra hingga lancar bertajwid di rumah Anda.', 'Anak didampingi sabar 2x seminggu dengan laporan perkembangan bulanan.', 'Selasa & Jumat (16.30 WIB)', 1),
(5, 6, 9, 'Langganan Bersih Rumah Mingguan (4x/Bulan)', 'langganan', 'Keluarga / Paket Bulanan', 280000, 'per bulan (4x kunjungan)', 180, 'Pembersihan menyeluruh ruang tamu, kamar tidur, dapur, dan kamar mandi setiap pekan.', 'Rumah selalu bersih higienis setiap akhir pekan tanpa Anda harus kelelahan.', 'Setiap Sabtu Pagi (08.00 WIB)', 1);

-- Jasa Add-on
INSERT OR IGNORE INTO service_addons (id, service_id, addon_name, addon_price, addon_desc, is_dummy) VALUES
(1, 1, 'Bekam Sunnah 7 Titik (Alat Steril Sekali Pakai)', 45000, 'Tambahan terapi bekam basah higienis dengan jarum & kop baru.', 1),
(2, 2, 'Material Kabel NYM + Stop Kontak Broco SNI', 35000, 'Termasuk 5 meter kabel tembaga murni & 1 unit stop kontak.', 1),
(3, 5, 'Cairan Disinfektan & Pembersih Kerak Kamar Mandi', 25000, 'Paket cairan pembersih lengkap dibawa oleh mitra.', 1);

-- Paket Top-Up Token & Langganan Mitra Pro
INSERT OR IGNORE INTO subscription_plans (id, name, plan_type, price, duration_days, token_credit, benefits_json, is_dummy) VALUES
(1, 'Top-Up Token Leads Hemat (10 Order)', 'token_topup', 30000, 365, 30000, '["Saldo Token Rp30.000 untuk terima 10 pesanan","Masa aktif selamanya","Tanpa biaya bulanan"]', 1),
(2, 'Top-Up Token Leads Juragan (25 Order)', 'token_topup', 70000, 365, 75000, '["Bonus Token Rp5.000 (Total Rp75.000)","Cukup untuk 25 pesanan masuk"]', 1),
(3, 'Langganan Mitra Pro Terverifikasi (30 Hari)', 'mitra_pro', 75000, 30, 0, '["BEBAS potongan token Rp3.000/order","Lencana Mitra Pro Terverifikasi","Posisi paling atas di hasil pencarian terdekat"]', 1);

-- Contoh Pesanan & Mutasi Ledger
INSERT OR IGNORE INTO orders (id, order_code, user_id, mitra_id, korwil_id, service_id, addons_selected_json, schedule_date, schedule_time, timing_notes, distance_km, service_address_encrypted, service_address_area, subtotal, addon_total, user_platform_fee, mitra_token_fee, total_amount, payment_method, payment_status, order_status, split_settled, split_detail_json, process_log_json, is_dummy) VALUES
(1, 'INV-20261120-2001', 5, 6, 3, 2, '[{"name":"Material Kabel NYM + Stop Kontak Broco SNI","price":35000}]', '2026-11-20', '10:00', 'Estimasi tiba 10 menit sebelum jadwal', 1.8, 'ENC:Perumahan Griya Indah Blok B4, Mandiangin', 'Mandiangin Koto Selayan, Bukittinggi', 75000, 35000, 4000, 3000, 114000, 'midtrans', 'released', 'selesai', 1, '{"mitra":110000,"korwil":2500,"admin":2000,"owner":2500}', '[{"time":"2026-11-20 09:00","status":"Pesanan Dibuat"},{"time":"2026-11-20 09:02","status":"Dana Masuk Escrow Midtrans"},{"time":"2026-11-20 11:15","status":"Selesai & Auto-Split Saldo Cair"}]', 1);

INSERT OR IGNORE INTO wallet_mutations (id, user_id, role, order_code, mutation_type, amount, balance_after, description, is_dummy) VALUES
(1, 6, 'mitra', 'INV-20261120-2001', 'credit_jasa', 110000, 890000, 'Pendapatan jasa 100% + Add-on dari INV-20261120-2001', 1),
(2, 3, 'korwil', 'INV-20261120-2001', 'credit_komisi_korwil', 2500, 2150000, 'Komisi pembinaan wilayah dari transaksi Mitra Kang Dedi', 1),
(3, 2, 'admin', 'INV-20261120-2001', 'credit_komisi_admin', 2000, 1850000, 'Insentif operasional & verifikasi dari INV-20261120-2001', 1),
(4, 1, 'owner', 'INV-20261120-2001', 'credit_profit_owner', 2500, 2500000, 'Bagi hasil platform dari INV-20261120-2001', 1);
