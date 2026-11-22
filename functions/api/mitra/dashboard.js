import { jsonResponse, decryptField, encryptField, normalizePhone, maskPhone, sha256Hex } from "../../_lib/security.js";

export async function onRequestGet({ data, env }) {
  const userId = data.user.id;
  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
  let profile = await env.DB.prepare("SELECT * FROM mitra_profiles WHERE user_id = ?").bind(userId).first();
  if (!profile) {
    await env.DB.prepare("INSERT INTO mitra_profiles (user_id, business_name) VALUES (?, ?)").bind(userId, `Jasa ${user.full_name}`).run();
    profile = await env.DB.prepare("SELECT * FROM mitra_profiles WHERE user_id = ?").bind(userId).first();
  }
  const services = await env.DB.prepare(
    "SELECT s.*, c.name AS category_name FROM services s JOIN service_categories c ON s.category_id = c.id WHERE s.mitra_id = ? ORDER BY s.id DESC"
  ).bind(userId).all();
  const addons = await env.DB.prepare("SELECT a.* FROM service_addons a JOIN services s ON a.service_id = s.id WHERE s.mitra_id = ?").bind(userId).all();
  const categories = await env.DB.prepare("SELECT * FROM service_categories WHERE is_active = 1").all();
  const plans = await env.DB.prepare("SELECT * FROM subscription_plans WHERE is_active = 1").all();

  return jsonResponse({
    user: {
      id: user.id,
      full_name: user.full_name,
      phone: await decryptField(user.phone_encrypted, env.ENCRYPTION_SECRET),
      address: await decryptField(user.address_encrypted, env.ENCRYPTION_SECRET),
      address_area: user.address_area,
      wallet_balance: user.wallet_balance,
      escrow_balance: user.escrow_balance,
      token_balance: user.token_balance,
    },
    profile: {
      ...profile,
      skills: JSON.parse(profile.skills_json || "[]"),
      certifications: JSON.parse(profile.certifications_json || "[]"),
    },
    services: services.results || [],
    addons: addons.results || [],
    categories: categories.results || [],
    plans: plans.results || [],
  });
}

export async function onRequestPost({ request, data, env }) {
  const body = await request.json();
  const userId = data.user.id;

  if (body.action === "update_profile") {
    if (body.phone) {
      const clean = normalizePhone(body.phone);
      await env.DB.prepare("UPDATE users SET phone_encrypted=?, phone_hash=?, phone_masked=? WHERE id=?")
        .bind(await encryptField(clean, env.ENCRYPTION_SECRET), await sha256Hex(clean), maskPhone(clean), userId).run();
    }
    await env.DB.prepare("UPDATE users SET address_encrypted=?, address_area=? WHERE id=?")
      .bind(await encryptField(body.address || "", env.ENCRYPTION_SECRET), body.address_area || "Bukittinggi", userId).run();

    await env.DB.prepare(
      `UPDATE mitra_profiles SET business_name=?, slogan=?, business_photo=?, skills_json=?, certifications_json=?, solutions_offered=?, service_radius_km=?, verification_doc_url=COALESCE(?, verification_doc_url) WHERE user_id=?`
    )
      .bind(
        body.business_name,
        body.slogan,
        body.business_photo || "",
        JSON.stringify(body.skills || []),
        JSON.stringify(body.certifications || []),
        body.solutions_offered || "",
        Number(body.service_radius_km || 5),
        body.verification_doc_url || null,
        userId
      )
      .run();
    return jsonResponse({ ok: true, message: "Profil bisnis & keahlian mitra tersimpan." });
  }

  if (body.action === "save_service") {
    await env.DB.prepare(
      `INSERT INTO services (mitra_id, category_id, title, service_type, service_class, price, price_unit, description, solution_detail, subscription_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        userId,
        body.category_id,
        body.title,
        body.service_type,
        body.service_class || "Reguler",
        Number(body.price),
        body.price_unit || "per sesi",
        body.description,
        body.solution_detail || "",
        body.subscription_days || null
      )
      .run();
    return jsonResponse({ ok: true, message: "Layanan jasa baru berhasil diterbitkan." });
  }

  if (body.action === "delete_service") {
    await env.DB.prepare("DELETE FROM services WHERE id=? AND mitra_id=?").bind(body.id, userId).run();
    return jsonResponse({ ok: true, message: "Jasa dihapus." });
  }

  if (body.action === "save_addon") {
    await env.DB.prepare("INSERT INTO service_addons (service_id, addon_name, addon_price, addon_desc) VALUES (?, ?, ?, ?)")
      .bind(body.service_id, body.addon_name, Number(body.addon_price), body.addon_desc || "").run();
    return jsonResponse({ ok: true, message: "Jasa Add-on ditambahkan." });
  }

  return jsonResponse({ error: "Aksi tidak valid" }, 400);
}
