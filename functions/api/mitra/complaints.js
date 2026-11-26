import { jsonResponse } from "../../_lib/security.js";

export async function onRequestGet({ data, env }) {
  const mitraId = data.user.id;

  // Ambil daftar keahlian & kategori layanan milik Mitra ini
  const profile = await env.DB.prepare("SELECT skills_json FROM mitra_profiles WHERE user_id = ?").bind(mitraId).first();
  const myServices = await env.DB.prepare("SELECT DISTINCT category_id FROM services WHERE mitra_id = ?").bind(mitraId).all();

  const mySkills = JSON.parse(profile?.skills_json || "[]").map((s) => s.toLowerCase());
  const myCategoryIds = (myServices.results || []).map((r) => Number(r.category_id));

  // Ambil keluhan/permintaan yang statusnya 'open' atau sudah di-approve oleh Mitra ini sendiri
  const rows = await env.DB.prepare(
    `SELECT c.*, u.full_name AS customer_name, u.address_area AS user_area,
            cat.name AS category_name, cat.icon AS category_icon
     FROM complaints c
     JOIN users u ON c.user_id = u.id
     LEFT JOIN service_categories cat ON c.category_id = cat.id
     WHERE c.status = 'open' OR c.approved_by_mitra_id = ?
     ORDER BY c.id DESC`
  )
    .bind(mitraId)
    .all();

  // Filter ketat: Hanya tampilkan jika keahlian atau kategori Mitra cocok!
  const matched = (rows.results || []).filter((c) => {
    if (Number(c.approved_by_mitra_id) === Number(mitraId)) return true;

    const reqSkill = (c.skill_required || c.category_name || c.subject || "").toLowerCase();
    const catMatch = c.category_id && myCategoryIds.includes(Number(c.category_id));
    const skillMatch = mySkills.some((sk) => reqSkill.includes(sk) || sk.includes(reqSkill));

    return catMatch || skillMatch;
  });

  return jsonResponse({
    my_skills: mySkills,
    matched_complaints: matched,
  });
}

export async function onRequestPost({ request, data, env }) {
  try {
    const mitraId = data.user.id;
    const { complaint_id, offered_price = 0, admin_reply = "" } = await request.json();

    const comp = await env.DB.prepare("SELECT * FROM complaints WHERE id = ?").bind(complaint_id).first();
    if (!comp) return jsonResponse({ error: "Keluhan/permintaan tidak ditemukan." }, 404);
    if (comp.status !== "open") {
      return jsonResponse({ error: "Keluhan ini sudah di-approve oleh mitra lain." }, 409);
    }

    // Validasi ulang kecocokan skill Mitra sebelum boleh approve
    const profile = await env.DB.prepare("SELECT business_name, skills_json FROM mitra_profiles WHERE user_id = ?").bind(mitraId).first();
    const myServices = await env.DB.prepare("SELECT DISTINCT category_id FROM services WHERE mitra_id = ?").bind(mitraId).all();
    const mySkills = JSON.parse(profile?.skills_json || "[]").map((s) => s.toLowerCase());
    const myCategoryIds = (myServices.results || []).map((r) => Number(r.category_id));

    const reqSkill = (comp.skill_required || comp.subject || "").toLowerCase();
    const isMatched =
      (comp.category_id && myCategoryIds.includes(Number(comp.category_id))) ||
      mySkills.some((sk) => reqSkill.includes(sk) || sk.includes(reqSkill));

    if (!isMatched) {
      return jsonResponse({ error: "Maaf, keahlian Anda tidak cocok dengan keluhan ini sehingga tidak dapat approve." }, 403);
    }

    const replyText =
      admin_reply ||
      `Disetujui oleh ${profile?.business_name || data.user.full_name} (Keahlian Cocok). Estimasi biaya: Rp${Number(offered_price).toLocaleString("id-ID")}. Silakan lanjutkan di Chat Aman.`;

    await env.DB.prepare(
      `UPDATE complaints
       SET status = 'approved', approved_by_mitra_id = ?, offered_price = ?, admin_reply = ?
       WHERE id = ?`
    )
      .bind(mitraId, Number(offered_price), replyText, complaint_id)
      .run();

    return jsonResponse({
      ok: true,
      message: "Berhasil Approve Kerja! Pelanggan akan menerima notifikasi persetujuan Anda.",
    });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
