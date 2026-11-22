import {
  jsonResponse,
  calculateDistanceKm,
  decryptField,
  sendWhatsAppMessage,
  getSplitConfig,
  settleOrderSplit,
} from "../../_lib/security.js";

export async function onRequestGet({ data, env }) {
  const { id, role } = data.user;
  let sql = `
    SELECT o.*, s.title AS service_title, s.service_type, s.service_class, s.price_unit,
           u.full_name AS customer_name, u.phone_masked AS customer_phone_masked,
           m.full_name AS mitra_name, mp.business_name, mp.membership_tier,
           r.rating AS review_rating, r.comment AS review_comment
    FROM orders o
    JOIN services s ON o.service_id = s.id
    JOIN users u ON o.user_id = u.id
    JOIN users m ON o.mitra_id = m.id
    LEFT JOIN mitra_profiles mp ON mp.user_id = m.id
    LEFT JOIN reviews r ON r.order_id = o.id
  `;
  const binds = [];
  if (role === "user") {
    sql += " WHERE o.user_id = ?";
    binds.push(id);
  } else if (role === "mitra") {
    sql += " WHERE o.mitra_id = ?";
    binds.push(id);
  } else if (role === "korwil") {
    sql += " WHERE o.korwil_id = ?";
    binds.push(id);
  }
  sql += " ORDER BY o.id DESC";

  const rows = await env.DB.prepare(sql).bind(...binds).all();
  return jsonResponse({ orders: rows.results || [] });
}

export async function onRequestPost({ request, data, env }) {
  try {
    const body = await request.json();
    const {
      service_id,
      addon_ids = [],
      schedule_date,
      schedule_time,
      timing_notes = "Sesuai jadwal tertera",
      payment_method = "midtrans",
      custom_price = null,
    } = body;

    const cfg = await getSplitConfig(env.DB);
    const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(data.user.id).first();
    const service = await env.DB.prepare(
      `SELECT s.*, m.lat AS mitra_lat, m.lng AS mitra_lng, m.phone_encrypted AS mitra_phone,
              m.referred_by_korwil_id, m.token_balance, mp.membership_tier
       FROM services s
       JOIN users m ON s.mitra_id = m.id
       LEFT JOIN mitra_profiles mp ON mp.user_id = m.id
       WHERE s.id = ?`
    )
      .bind(service_id)
      .first();

    if (!service) return jsonResponse({ error: "Layanan tidak ditemukan." }, 404);

    // Cek kecukupan token mitra reguler
    const isPro = service.membership_tier === "pro";
    const requiredToken = isPro ? 0 : cfg.split_mitra_token_fee;
    if (!isPro && (service.token_balance || 0) < requiredToken) {
      return jsonResponse({ error: "Mitra sedang kehabisan kuota Token Leads. Silakan pilih mitra lain atau hubungi mitra." }, 400);
    }

    let addonTotal = 0;
    const addonsSelected = [];
    for (const aid of addon_ids || []) {
      const ad = await env.DB.prepare("SELECT * FROM service_addons WHERE id = ? AND service_id = ?").bind(aid, service_id).first();
      if (ad) {
        addonTotal += ad.addon_price;
        addonsSelected.push({ id: ad.id, name: ad.addon_name, price: ad.addon_price });
      }
    }

    const basePrice = custom_price && Number(custom_price) > 0 ? Number(custom_price) : service.price;
    const distanceKm = calculateDistanceKm(user.lat, user.lng, service.mitra_lat, service.mitra_lng);
    const userPlatformFee = cfg.split_user_platform_fee;
    const totalAmount = basePrice + addonTotal + userPlatformFee;
    const orderCode = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const initialLog = JSON.stringify([
      { time: new Date().toLocaleString("id-ID"), status: "Pesanan Dibuat" },
    ]);

    const ins = await env.DB.prepare(
      `INSERT INTO orders (
        order_code, user_id, mitra_id, korwil_id, service_id, addons_selected_json,
        schedule_date, schedule_time, timing_notes, distance_km,
        service_address_encrypted, service_address_area,
        subtotal, addon_total, user_platform_fee, mitra_token_fee, total_amount,
        payment_method, payment_status, order_status, process_log_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        orderCode,
        user.id,
        service.mitra_id,
        service.referred_by_korwil_id || null,
        service.id,
        JSON.stringify(addonsSelected),
        schedule_date,
        schedule_time,
        timing_notes,
        distanceKm,
        user.address_encrypted,
        user.address_area,
        basePrice,
        addonTotal,
        userPlatformFee,
        requiredToken,
        totalAmount,
        payment_method,
        "unpaid",
        "menunggu_pembayaran",
        initialLog
      )
      .run();

    const mitraPhone = await decryptField(service.mitra_phone, env.ENCRYPTION_SECRET);
    await sendWhatsAppMessage(
      env,
      mitraPhone,
      `🔔 *Order Baru ${orderCode}*
Layanan: ${service.title}
Jadwal: ${schedule_date} (${schedule_time})
Jarak: ${distanceKm} km
Tarif Jasa Anda: Rp${(basePrice + addonTotal).toLocaleString("id-ID")}`
    );

    return jsonResponse({
      ok: true,
      order_id: ins.meta.last_row_id,
      order_code: orderCode,
      total_amount: totalAmount,
      message: "Pesanan dibuat! Silakan selesaikan pembayaran ke Rekening Bersama (Escrow).",
    });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestPut({ request, data, env }) {
  try {
    const body = await request.json();
    const { order_id, action, new_status, rating, comment } = body;

    const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(order_id).first();
    if (!order) return jsonResponse({ error: "Pesanan tidak ditemukan." }, 404);

    // 1. Konfirmasi Bayar User -> Dana Masuk Escrow Mitra + Potong Token Leads Mitra Reguler
    if (action === "pay_confirm") {
      if (order.payment_status !== "unpaid") return jsonResponse({ ok: true, message: "Sudah dibayar." });

      const logs = JSON.parse(order.process_log_json || "[]");
      logs.push({ time: new Date().toLocaleString("id-ID"), status: "Dana Masuk Escrow Midtrans & Token Mitra Terkunci" });

      const mitraNet = Number(order.subtotal) + Number(order.addon_total || 0);
      await env.DB.prepare("UPDATE users SET escrow_balance = escrow_balance + ? WHERE id = ?")
        .bind(mitraNet, order.mitra_id)
        .run();

      // Potong Token Leads jika Mitra Reguler
      if (order.mitra_token_fee > 0) {
        const mUser = await env.DB.prepare("SELECT token_balance FROM users WHERE id = ?").bind(order.mitra_id).first();
        const newTok = Math.max(0, (mUser?.token_balance || 0) - order.mitra_token_fee);
        await env.DB.prepare("UPDATE users SET token_balance = ? WHERE id = ?").bind(newTok, order.mitra_id).run();
        await env.DB.prepare(
          "INSERT INTO wallet_mutations (user_id, role, order_code, mutation_type, amount, balance_after, description) VALUES (?, 'mitra', ?, 'debit_token', ?, ?, ?)"
        )
          .bind(order.mitra_id, order.order_code, -order.mitra_token_fee, newTok, `Potongan token leads order ${order.order_code}`)
          .run();
      }

      await env.DB.prepare(
        "UPDATE orders SET payment_status = 'escrow_paid', order_status = 'dikonfirmasi', process_log_json = ? WHERE id = ?"
      )
        .bind(JSON.stringify(logs), order_id)
        .run();

      return jsonResponse({ ok: true, message: "Pembayaran aman di Escrow! Mitra siap menuju lokasi." });
    }

    // 2. Update Status Proses -> Jika 'selesai', jalankan Auto-Split Saldo ke Mitra, Korwil, Admin, Owner!
    if (action === "update_status" && new_status) {
      const logs = JSON.parse(order.process_log_json || "[]");
      const labelMap = {
        mitra_menuju_lokasi: "Mitra Menuju Lokasi",
        sedang_dikerjakan: "Layanan Sedang Dikerjakan",
        selesai: "Pekerjaan Selesai — Dana Escrow & Bagi Hasil Dicairkan",
        dibatalkan: "Pesanan Dibatalkan",
      };
      logs.push({ time: new Date().toLocaleString("id-ID"), status: labelMap[new_status] || new_status });

      await env.DB.prepare("UPDATE orders SET order_status = ?, process_log_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(new_status, JSON.stringify(logs), order_id)
        .run();

      let splitInfo = null;
      if (new_status === "selesai") {
        await env.DB.prepare("UPDATE mitra_profiles SET total_orders_completed = total_orders_completed + 1 WHERE user_id = ?")
          .bind(order.mitra_id)
          .run();
        splitInfo = await settleOrderSplit(env.DB, order);
      }

      return jsonResponse({
        ok: true,
        split: splitInfo,
        message: new_status === "selesai" ? "Pekerjaan selesai! Saldo jasa & komisi otomatis dibagikan ke seluruh peran." : "Status diperbarui.",
      });
    }

    // 3. Review Bintang
    if (action === "review") {
      const stars = Math.min(5, Math.max(1, Number(rating || 5)));
      await env.DB.prepare("INSERT OR REPLACE INTO reviews (order_id, user_id, mitra_id, rating, comment) VALUES (?, ?, ?, ?, ?)")
        .bind(order_id, data.user.id, order.mitra_id, stars, comment || "Sangat memuaskan!")
        .run();
      const agg = await env.DB.prepare("SELECT AVG(rating) AS avg_r, COUNT(*) AS cnt FROM reviews WHERE mitra_id = ?")
        .bind(order.mitra_id)
        .first();
      await env.DB.prepare("UPDATE mitra_profiles SET rating_avg = ?, total_reviews = ? WHERE user_id = ?")
        .bind(Math.round((agg.avg_r || 5) * 100) / 100, agg.cnt || 1, order.mitra_id)
        .run();
      return jsonResponse({ ok: true, message: "Ulasan bintang tersimpan!" });
    }

    return jsonResponse({ error: "Aksi tidak valid." }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
