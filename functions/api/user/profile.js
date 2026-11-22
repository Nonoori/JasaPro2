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
  const { subject, description } = await request.json();
  const ticketCode = `TKT-${Date.now().toString().slice(-6)}`;
  await env.DB.prepare("INSERT INTO complaints (ticket_code, user_id, subject, description) VALUES (?, ?, ?, ?)")
    .bind(ticketCode, data.user.id, subject, description)
    .run();
  return jsonResponse({ ok: true, ticket_code: ticketCode, message: "Keluhan diteruskan ke Admin & Owner." });
}
