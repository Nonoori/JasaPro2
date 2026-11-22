-- ============================================================================
-- SKEMA DATABASE CLOUDFLARE D1 (SQLITE) - JASAKITA PRO V2 (5 PERAN & AUTO-SPLIT)
-- Peran: 'user', 'mitra', 'korwil', 'admin', 'owner'
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Tabel Pengguna (5 Peran: user, mitra, korwil, admin, owner)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL DEFAULT 'user', -- 'user', 'mitra', 'korwil', 'admin', 'owner'
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone_encrypted TEXT,
  phone_hash TEXT UNIQUE,
  phone_masked TEXT,
  password_hash TEXT NOT NULL,
  address_encrypted TEXT,
  address_area TEXT, -- Kecamatan / Kota
  lat REAL DEFAULT -0.3025,
  lng REAL DEFAULT 100.3720,
  avatar_url TEXT,
  referral_code TEXT UNIQUE, -- Kode khusus Korwil (misal: KORWIL-BKT01)
  referred_by_korwil_id INTEGER, -- ID Korwil pembina permanen untuk Mitra
  wallet_balance INTEGER DEFAULT 0, -- Saldo dapat ditarik (Rupiah)
  escrow_balance INTEGER DEFAULT 0, -- Saldo tertahan sebelum order selesai
  token_balance INTEGER DEFAULT 0, -- Saldo token leads Mitra Reguler
  bank_info TEXT DEFAULT '', -- Rekening Bank / E-Wallet untuk Withdraw
  is_verified INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  complaint_note TEXT,
  is_dummy INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Profil Bisnis Mitra
CREATE TABLE IF NOT EXISTS mitra_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  business_name TEXT NOT NULL,
  slogan TEXT,
  business_photo TEXT,
  bio TEXT,
  skills_json TEXT DEFAULT '[]',
  certifications_json TEXT DEFAULT '[]',
  solutions_offered TEXT,
  service_radius_km REAL DEFAULT 5.0,
  membership_tier TEXT DEFAULT 'reguler', -- 'reguler' (potong token) | 'pro' (langganan bebas token)
  pro_expires_at DATETIME,
  rating_avg REAL DEFAULT 5.0,
  total_reviews INTEGER DEFAULT 0,
  total_orders_completed INTEGER DEFAULT 0,
  verification_status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
  verification_doc_url TEXT,
  is_online INTEGER DEFAULT 1,
  is_dummy INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Kategori Layanan
CREATE TABLE IF NOT EXISTS service_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  service_type TEXT NOT NULL, -- 'harian' | 'langganan'
  icon TEXT DEFAULT '🛠️',
  description TEXT,
  min_price INTEGER DEFAULT 25000,
  is_active INTEGER DEFAULT 1,
  is_dummy INTEGER DEFAULT 0
);

-- 4. Katalog Jasa Mitra
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mitra_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  service_type TEXT NOT NULL, -- 'harian' | 'langganan'
  service_class TEXT DEFAULT 'Reguler',
  price INTEGER NOT NULL,
  price_unit TEXT DEFAULT 'per sesi',
  duration_minutes INTEGER DEFAULT 60,
  description TEXT NOT NULL,
  solution_detail TEXT,
  subscription_days TEXT,
  is_active INTEGER DEFAULT 1,
  is_dummy INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mitra_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES service_categories(id)
);

-- 5. Jasa Add-on
CREATE TABLE IF NOT EXISTS service_addons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER NOT NULL,
  addon_name TEXT NOT NULL,
  addon_price INTEGER NOT NULL,
  addon_desc TEXT,
  is_dummy INTEGER DEFAULT 0,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- 6. Paket Langganan & Top-Up Token Mitra
CREATE TABLE IF NOT EXISTS subscription_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  plan_type TEXT DEFAULT 'mitra_pro', -- 'mitra_pro' | 'token_topup'
  price INTEGER NOT NULL,
  duration_days INTEGER NOT NULL,
  token_credit INTEGER DEFAULT 0,
  benefits_json TEXT DEFAULT '[]',
  is_active INTEGER DEFAULT 1,
  is_dummy INTEGER DEFAULT 0
);

-- 7. Pesanan & Riwayat Transaksi (Escrow + Auto Split)
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_code TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  mitra_id INTEGER NOT NULL,
  korwil_id INTEGER, -- Korwil pembina mitra saat transaksi terjadi
  service_id INTEGER NOT NULL,
  addons_selected_json TEXT DEFAULT '[]',
  schedule_date TEXT NOT NULL,
  schedule_time TEXT NOT NULL,
  timing_notes TEXT,
  distance_km REAL DEFAULT 0.0,
  service_address_encrypted TEXT,
  service_address_area TEXT,
  subtotal INTEGER NOT NULL,
  addon_total INTEGER DEFAULT 0,
  user_platform_fee INTEGER DEFAULT 4000,
  mitra_token_fee INTEGER DEFAULT 0,
  total_amount INTEGER NOT NULL,
  payment_method TEXT DEFAULT 'midtrans',
  payment_status TEXT DEFAULT 'unpaid', -- 'unpaid', 'escrow_paid', 'released', 'expired'
  midtrans_token TEXT,
  midtrans_redirect_url TEXT,
  order_status TEXT DEFAULT 'menunggu_pembayaran', -- 'menunggu_pembayaran', 'dikonfirmasi', 'mitra_menuju_lokasi', 'sedang_dikerjakan', 'selesai', 'dibatalkan'
  split_settled INTEGER DEFAULT 0, -- 1 = Komisi sudah dibagikan ke Mitra, Korwil, Admin, Owner
  split_detail_json TEXT DEFAULT '{}',
  process_log_json TEXT DEFAULT '[]',
  is_dummy INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (mitra_id) REFERENCES users(id),
  FOREIGN KEY (service_id) REFERENCES services(id)
);

-- 8. Mutasi Dompet & Ledger Bagi Hasil (Mitra, Korwil, Admin, Owner)
CREATE TABLE IF NOT EXISTS wallet_mutations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  order_code TEXT,
  mutation_type TEXT NOT NULL, -- 'credit_jasa', 'credit_komisi_korwil', 'credit_komisi_admin', 'credit_profit_owner', 'debit_token', 'topup_token', 'upgrade_pro', 'withdraw'
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT NOT NULL,
  is_dummy INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 9. Pengajuan Pencairan Saldo (Withdraw)
CREATE TABLE IF NOT EXISTS withdraw_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  withdraw_code TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  amount INTEGER NOT NULL,
  bank_destination TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  processed_by INTEGER,
  admin_note TEXT,
  is_dummy INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. Ulasan & Bintang
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  mitra_id INTEGER NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_dummy INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. Chat Aman Privat + Penawaran Harga Kesepakatan (Custom Quote)
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  order_id INTEGER,
  sender_id INTEGER NOT NULL,
  receiver_id INTEGER NOT NULL,
  message_encrypted TEXT NOT NULL,
  quote_price INTEGER DEFAULT 0, -- Jika > 0 maka ini Kartu Kesepakatan Harga
  quote_service_id INTEGER,
  distance_info TEXT,
  is_dummy INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. Pengaduan & Masalah
CREATE TABLE IF NOT EXISTS complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_code TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  order_id INTEGER,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  admin_reply TEXT,
  is_dummy INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 13. Pengaturan Global Owner (Termasuk Rumus Split Dinamis, Tema, Kop Bisnis, SNK, FAQ)
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
