import { jsonResponse, hashPassword, sha256Hex, normalizePhone, maskPhone, encryptField } from "../../_lib/security.js";

export async function onRequestGet({ env }) {
  const users = await env.DB.prepare(
    `SELECT u.id, u.role, u.full_name, u.email, u.phone_masked, u.address_area,
            u.referral_code, u.referred_by_korwil_id, u.wallet_balance, u.escrow_balance, u.token_balance,
            u.is_verified, u.is_active, u.is_dummy,
            mp.business_name, mp.membership_tier, mp.verification_status, mp.rating_avg, mp.total_orders_completed
     FROM users u LEFT JOIN mitra_profiles mp ON mp.user_id = u.id ORDER BY u.id ASC`
  ).all();

  const categories = await env.DB.prepare("SELECT * FROM service_categories ORDER BY id ASC").all();
  const plans = await env.DB.prepare("SELECT * FROM subscription_plans ORDER BY id ASC").all();
  const orders = await env.DB.prepare(
    `SELECT o.*, s.title AS service_title, u.full_name AS customer_name, m.full_name AS mitra_name
     FROM orders o JOIN services s ON o.service_id = s.id JOIN users u ON o.user_id = u.id JOIN users m ON o.mitra_id = m.id
     ORDER BY o.id DESC`
  ).all();
  const withdrawals = await env.DB.prepare(
    `SELECT w.*, u.full_name FROM withdraw_requests w JOIN users u ON w.user_id = u.id ORDER BY w.id DESC`
  ).all();
  const complaints = await env.DB.prepare(
    `SELECT c.*, u.full_name FROM complaints c JOIN users u ON c.user_id = u.id ORDER BY c.id DESC`
  ).all();
  const settingsRows = await env.DB.prepare("SELECT setting_key, setting_value FROM app_settings").all();

  const settings = {};
  for (const r of settingsRows.results || []) settings[r.setting_key] = r.setting_value;

  const releasedOrders = (orders.results || []).filter((o) => o.payment_status === "released");
  const grossRevenue = releasedOrders.reduce((acc, o) => acc + (o.total_amount || 0), 0);

  return jsonResponse({
    users: users.results || [],
    categories: categories.results || [],
    plans: plans.results || [],
    orders: orders.results || [],
    withdrawals: withdrawals.results || [],
    complaints: complaints.results || [],
    settings,
    finance: {
      total_released_orders: releasedOrders.length,
      gross_revenue: grossRevenue,
    },
  });
}

export async function onRequestPost({ request, data, env }) {
  try {
    const body = await request.json();
    const { action } = body;

    // 1. Simpan Rumus Split Saldo Transaksi & Pengaturan Bisnis (Khusus Owner)
    if (action === "save_settings") {
      if (data.user.role !== "owner") return jsonResponse({ error: "Hanya Owner yang dapat mengubah rumus pembagian saldo." }, 403);
      for (const [k, v] of Object.entries(body.settings || {})) {
        await env.DB.prepare(
          "INSERT OR REPLACE INTO app_settings (setting_key, setting_value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
        ).bind(k, String(v)).run();
      }
      return jsonResponse({ ok: true, message: "Rumus Pembagian Saldo (Split) & Pengaturan Bisnis berhasil disimpan!" });
    }

    // 2. Tambah Akun Admin atau Korwil Baru oleh Owner
    if (action === "create_staff") {
      if (data.user.role !== "owner") return jsonResponse({ error: "Khusus Owner." }, 403);
      const { role, full_name, email, phone, password, address_area } = body;
      const cleanPhone = normalizePhone(phone);
      const refCode = role === "korwil" ? `KORWIL-${Math.floor(1000 + Math.random() * 9000)}` : null;
      await env.DB.prepare(
        `INSERT INTO users (role, full_name, email, phone_encrypted, phone_hash, phone_masked, password_hash, address_area, referral_code, is_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
      )
        .bind(
          role,
          full_name,
          email.trim().toLowerCase(),
          await encryptField(cleanPhone, env.ENCRYPTION_SECRET),
          await sha256Hex(cleanPhone),
          maskPhone(cleanPhone),
          await hashPassword(password || "demo1234"),
          address_area || "Nasional",
          refCode
        )
        .run();
      return jsonResponse({ ok: true, message: `Akun ${role.toUpperCase()} (${full_name}) berhasil ditambahkan!` });
    }

    // 3. Verifikasi Mitra
    if (action === "verify_mitra") {
      await env.DB.prepare("UPDATE mitra_profiles SET verification_status = ? WHERE user_id = ?").bind(body.status, body.user_id).run();
      await env.DB.prepare("UPDATE users SET is_verified = ? WHERE id = ?").bind(body.status === "verified" ? 1 : 0, body.user_id).run();
      return jsonResponse({ ok: true, message: "Status verifikasi mitra diperbarui." });
    }

    // 4. Approval Withdraw Pencairan Saldo
    if (action === "process_withdraw") {
      await env.DB.prepare("UPDATE withdraw_requests SET status = ?, processed_by = ?, admin_note = ? WHERE id = ?")
        .bind(body.status, data.user.id, body.note || "Diproses", body.id)
        .run();
      return jsonResponse({ ok: true, message: `Withdraw ${body.status.toUpperCase()}.` });
    }

    // 5. CRUD Kategori
    if (action === "save_category") {
      await env.DB.prepare(
        "INSERT INTO service_categories (name, slug, service_type, icon, min_price) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(body.name, body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), body.service_type, body.icon || "🛠️", Number(body.min_price || 50000))
        .run();
      return jsonResponse({ ok: true, message: "Kategori ditambahkan." });
    }

    // 6. Balas Keluhan
    if (action === "reply_complaint") {
      await env.DB.prepare("UPDATE complaints SET admin_reply = ?, status = 'resolved' WHERE id = ?")
        .bind(body.reply, body.id)
        .run();
      return jsonResponse({ ok: true, message: "Keluhan diselesaikan." });
    }

    // 7. Bersihkan Data Dummy
    if (action === "clean_dummy") {
      if (data.user.role !== "owner") return jsonResponse({ error: "Khusus Owner." }, 403);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM chat_messages WHERE is_dummy = 1"),
        env.DB.prepare("DELETE FROM reviews WHERE is_dummy = 1"),
        env.DB.prepare("DELETE FROM complaints WHERE is_dummy = 1"),
        env.DB.prepare("DELETE FROM withdraw_requests WHERE is_dummy = 1"),
        env.DB.prepare("DELETE FROM wallet_mutations WHERE is_dummy = 1"),
        env.DB.prepare("DELETE FROM orders WHERE is_dummy = 1"),
        env.DB.prepare("DELETE FROM service_addons WHERE is_dummy = 1"),
        env.DB.prepare("DELETE FROM services WHERE is_dummy = 1"),
        env.DB.prepare("DELETE FROM mitra_profiles WHERE is_dummy = 1"),
        env.DB.prepare("DELETE FROM users WHERE is_dummy = 1 AND role != 'owner'"),
      ]);
      return jsonResponse({ ok: true, message: "Data dummy bersih! Sistem siap operasional nyata." });
    }

    return jsonResponse({ error: "Aksi tidak valid." }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
