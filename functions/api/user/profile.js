import {
  jsonResponse,
  encryptField,
  decryptField,
  normalizePhone,
  maskPhone,
  sha256Hex,
  hashPassword,
  verifyPassword,
} from "../../_lib/security.js";

export async function onRequestGet({ data, env }) {
  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(data.user.id).first();
  if (!user) return jsonResponse({ error: "User tidak ditemukan" }, 404);
  const complaints = await env.DB.prepare("SELECT * FROM complaints WHERE user_id = ? ORDER BY id DESC").bind(user.id).all();
  return jsonResponse({
    profile: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: await decryptField(user.phone_encrypted, env.ENCRYPTION_SECRET),
      address: await decryptField(user.address_encrypted, env.ENCRYPTION_SECRET),
      address_area: user.address_area,
      complaint_note: user.complaint_note || "",
    },
    complaints: complaints.results || [],
  });
}

export async function onRequestPut({ request, data, env }) {
  try {
    const body = await request.json();
    const current = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(data.user.id).first();
    let passwordHash = current.password_hash;
    if (body.new_password) {
      if (!body.old_password || !(await verifyPassword(body.old_password, current.password_hash))) {
        return jsonResponse({ error: "Sandi lama tidak cocok." }, 401);
      }
      passwordHash = await hashPassword(body.new_password);
    }
    const cleanPhone = body.phone ? normalizePhone(body.phone) : null;
    await env.DB.prepare(
      `UPDATE users SET full_name=?, email=?, phone_encrypted=?, phone_hash=?, phone_masked=?,
       address_encrypted=?, address_area=?, complaint_note=?, password_hash=? WHERE id=?`
    )
      .bind(
        body.full_name || current.full_name,
        body.email ?? current.email,
        cleanPhone ? await encryptField(cleanPhone, env.ENCRYPTION_SECRET) : current.phone_encrypted,
        cleanPhone ? await sha256Hex(cleanPhone) : current.phone_hash,
        cleanPhone ? maskPhone(cleanPhone) : current.phone_masked,
        body.address !== undefined ? await encryptField(body.address, env.ENCRYPTION_SECRET) : current.address_encrypted,
        body.address_area || current.address_area,
        body.complaint_note ?? current.complaint_note,
        passwordHash,
        data.user.id
      )
      .run();
    return jsonResponse({ ok: true, message: "Profil berhasil diamankan & diperbarui." });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestPost({ request, data, env }) {
  const { subject, description, category_id = null, skill_required = "" } = await request.json();
  if (!subject || !description) {
    return jsonResponse({ error: "Judul keluhan/permintaan dan deskripsi wajib diisi." }, 400);
  }

  const user = await env.DB.prepare("SELECT address_area FROM users WHERE id = ?").bind(data.user.id).first();
  const cat = category_id
    ? await env.DB.prepare("SELECT name FROM service_categories WHERE id = ?").bind(category_id).first()
    : null;

  const finalSkill = skill_required || cat?.name || "";
  const ticketCode = `TKT-${Date.now().toString().slice(-6)}`;

  await env.DB.prepare(
    `INSERT INTO complaints (ticket_code, user_id, category_id, skill_required, subject, description, address_area, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`
  )
    .bind(ticketCode, data.user.id, category_id, finalSkill, subject, description, user?.address_area || "Bukittinggi")
    .run();

  // Hitung berapa mitra dengan skill cocok yang aktif di sistem
  const allMitra = await env.DB.prepare(
    `SELECT mp.user_id, mp.skills_json, s.category_id
     FROM mitra_profiles mp
     LEFT JOIN services s ON s.mitra_id = mp.user_id
     WHERE mp.verification_status = 'verified'`
  ).all();

  const matchedMitraIds = new Set();
  for (const m of allMitra.results || []) {
    const skills = JSON.parse(m.skills_json || "[]").map((x) => x.toLowerCase());
    const skillMatch = finalSkill && skills.some((sk) => sk.includes(finalSkill.toLowerCase()) || finalSkill.toLowerCase().includes(sk));
    const catMatch = category_id && Number(m.category_id) === Number(category_id);
    if (skillMatch || catMatch) {
      matchedMitraIds.add(m.user_id);
    }
  }

  return jsonResponse({
    ok: true,
    ticket_code: ticketCode,
    matched_mitra_count: matchedMitraIds.size,
    message: `Pengajuan berhasil! Diteruskan khusus ke ${matchedMitraIds.size} Mitra dengan keahlian cocok untuk di-approve.`,
  });
}
