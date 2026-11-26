import { jsonResponse } from "../../_lib/security.js";

function maskName(name) {
  if (!name) return "Pelanggan";
  const parts = name.trim().split(" ");
  return parts
    .map((p) => (p.length <= 2 ? p[0] + "*" : p.slice(0, 2) + "***"))
    .join(" ");
}

export async function onRequestGet({ data, env }) {
  try {
    const user = data.user;

    // KONDISI 2: SUDAH LOGIN -> Hanya tampilkan semua riwayat pengajuan & pekerjaan selesai milik user ini
    if (user) {
      const myComplaints = await env.DB.prepare(
        `SELECT c.*, cat.name AS category_name, cat.icon AS category_icon,
                m.full_name AS mitra_name, mp.business_name
         FROM complaints c
         LEFT JOIN service_categories cat ON c.category_id = cat.id
         LEFT JOIN users m ON c.approved_by_mitra_id = m.id
         LEFT JOIN mitra_profiles mp ON mp.user_id = m.id
         WHERE c.user_id = ?
         ORDER BY c.id DESC`
      )
        .bind(user.id)
        .all();

      const myCompletedOrders = await env.DB.prepare(
        `SELECT o.id, o.order_code, o.schedule_date, o.schedule_time, o.total_amount,
                o.order_status, o.payment_status, s.title AS service_title,
                m.full_name AS mitra_name, mp.business_name
         FROM orders o
         JOIN services s ON o.service_id = s.id
         JOIN users m ON o.mitra_id = m.id
         LEFT JOIN mitra_profiles mp ON mp.user_id = m.id
         WHERE o.user_id = ? AND o.order_status = 'selesai'
         ORDER BY o.id DESC`
      )
        .bind(user.id)
        .all();

      return jsonResponse({
        mode: "authenticated",
        my_complaints: myComplaints.results || [],
        my_completed_orders: myCompletedOrders.results || [],
      });
    }

    // KONDISI 1: SEBELUM LOGIN -> Tampilkan 30 permintaan, keluhan, dan transaksi pekerjaan sukses di area
    const recentComplaints = await env.DB.prepare(
      `SELECT c.id, c.ticket_code, c.subject, c.skill_required, c.status, c.address_area, c.created_at,
              u.full_name AS user_name, cat.name AS category_name, cat.icon AS category_icon
       FROM complaints c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN service_categories cat ON c.category_id = cat.id
       ORDER BY c.id DESC LIMIT 15`
    ).all();

    const recentSuccessOrders = await env.DB.prepare(
      `SELECT o.id, o.order_code, o.service_address_area AS address_area, o.total_amount,
              o.order_status, o.created_at, s.title AS service_title, s.service_type,
              u.full_name AS user_name, m.full_name AS mitra_name, mp.business_name
       FROM orders o
       JOIN services s ON o.service_id = s.id
       JOIN users u ON o.user_id = u.id
       JOIN users m ON o.mitra_id = m.id
       LEFT JOIN mitra_profiles mp ON mp.user_id = m.id
       WHERE o.order_status = 'selesai'
       ORDER BY o.id DESC LIMIT 15`
    ).all();

    const feed = [];

    for (const c of recentComplaints.results || []) {
      feed.push({
        type: "keluhan_permintaan",
        badge: c.status === "approved" || c.status === "resolved" ? "Ditangani Mitra" : "Permintaan / Keluhan Baru",
        title: c.subject,
        category: `${c.category_icon || "🛠️"} ${c.category_name || c.skill_required || "Layanan Umum"}`,
        actor: maskName(c.user_name),
        area: c.address_area || "Bukittinggi",
        time: c.created_at,
      });
    }

    for (const o of recentSuccessOrders.results || []) {
      feed.push({
        type: "transaksi_sukses",
        badge: "✅ Pekerjaan Sukses",
        title: o.service_title,
        category: o.service_type === "langganan" ? "📅 Langganan" : "⚡ Harian",
        actor: `${maskName(o.user_name)} → ${o.business_name || o.mitra_name}`,
        area: o.address_area || "Bukittinggi",
        time: o.created_at,
      });
    }

    // Batasi maksimal 30 item terbaru
    return jsonResponse({
      mode: "public",
      total: feed.slice(0, 30).length,
      feed: feed.slice(0, 30),
    });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
