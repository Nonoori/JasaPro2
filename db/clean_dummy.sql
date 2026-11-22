-- ============================================================================
-- BERSIHKAN DATA DUMMY SEBELUM PRODUKSI (MENYISAKAN AKUN OWNER ASLI)
-- ============================================================================
DELETE FROM chat_messages WHERE is_dummy = 1;
DELETE FROM reviews WHERE is_dummy = 1;
DELETE FROM complaints WHERE is_dummy = 1;
DELETE FROM withdraw_requests WHERE is_dummy = 1;
DELETE FROM wallet_mutations WHERE is_dummy = 1;
DELETE FROM orders WHERE is_dummy = 1;
DELETE FROM service_addons WHERE is_dummy = 1;
DELETE FROM services WHERE is_dummy = 1;
DELETE FROM mitra_profiles WHERE is_dummy = 1;
DELETE FROM users WHERE is_dummy = 1 AND role != 'owner';
