import {
  jsonResponse,
  hashPassword,
  sha256Hex,
  normalizePhone,
  maskPhone,
  encryptField,
  signJwt,
  sendWhatsAppMessage,
} from "../../_lib/security.js";

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const {
      role = "user",
      full_name,
      email,
      phone,
      password,
      address_detail,
      address_area,
      referral_code_input = "",
      business_name,
      slogan,
    } = body;

    if (!full_name || !phone || !password) {
      return jsonResponse({ error: "Nama lengkap, nomor WhatsApp, dan password wajib diisi." }, 400);
    }
    if (!["user", "mitra", "korwil"].includes(role)) {
      return jsonResponse({ error: "Registrasi mandiri hanya untuk User, Mitra, atau Calon Korwil." }, 400);
    }

    const cleanPhone = normalizePhone(phone);
    const phoneHash = await sha256Hex(cleanPhone);
    const phoneMasked = maskPhone(cleanPhone);
    const phoneEncrypted = await encryptField(cleanPhone, env.ENCRYPTION_SECRET);
    const addressEncrypted = await encryptField(address_detail || "", env.ENCRYPTION_SECRET);
    const passwordHash = await hashPassword(password);

    const existing = await env.DB.prepare("SELECT id FROM users WHERE phone_hash = ? OR (email IS NOT NULL AND email = ?)")
      .bind(phoneHash, (email || "").trim().toLowerCase())
      .first();
    if (existing) return jsonResponse({ error: "Nomor WhatsApp atau Email sudah terdaftar." }, 409);

    // Cek Kode Referral Korwil jika diisi
    let korwilId = null;
    if (referral_code_input.trim()) {
      const kw = await env.DB.prepare("SELECT id FROM users WHERE role = 'korwil' AND referral_code = ?")
        .bind(referral_code_input.trim().toUpperCase())
        .first();
      if (kw) korwilId = kw.id;
    }

    // Generate kode referral unik jika mendaftar sebagai Korwil
    const myRefCode = role === "korwil" ? `KORWIL-${Math.floor(1000 + Math.random() * 9000)}` : null;

    // Mitra baru langsung diberi bonus token percobaan Rp6.000 (untuk 2 order perdana)
    const initialToken = role === "mitra" ? 6000 : 0;

    const res = await env.DB.prepare(
      `INSERT INTO users (role, full_name, email, phone_encrypted, phone_hash, phone_masked, password_hash, address_encrypted, address_area, referral_code, referred_by_korwil_id, token_balance, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        role,
        full_name,
        email ? email.trim().toLowerCase() : null,
        phoneEncrypted,
        phoneHash,
        phoneMasked,
        passwordHash,
        addressEncrypted,
        address_area || "Bukittinggi",
        myRefCode,
        korwilId,
        initialToken,
        role === "user" ? 1 : 0
      )
      .run();

    const userId = res.meta.last_row_id;

    if (role === "mitra") {
      await env.DB.prepare(
        "INSERT INTO mitra_profiles (user_id, business_name, slogan, verification_status) VALUES (?, ?, ?, 'pending')"
      )
        .bind(userId, business_name || `Jasa ${full_name}`, slogan || "Siap Melayani dengan Amanah & Profesional")
        .run();
    }

    await sendWhatsAppMessage(
      env,
      cleanPhone,
      `Selamat datang di *JasaKita Pro*, *${full_name}*! Akun peran *${role.toUpperCase()}* Anda berhasil dibuat.`
    );

    const jwt = await signJwt({ id: userId, role, full_name, address_area: address_area || "Bukittinggi" }, env.JWT_SECRET);

    return jsonResponse(
      { ok: true, user: { id: userId, role, full_name, referral_code: myRefCode } },
      201,
      { "Set-Cookie": `jk_session=${jwt}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${86400 * 7}` }
    );
  } catch (err) {
    return jsonResponse({ error: "Gagal mendaftar: " + err.message }, 500);
  }
}
