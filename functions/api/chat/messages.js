import { jsonResponse, calculateDistanceKm, encryptField, decryptField } from "../../_lib/security.js";

export async function onRequestGet({ request, data, env }) {
  const url = new URL(request.url);
  const partnerId = Number(url.searchParams.get("partner_id") || 0);
  const myId = data.user.id;

  if (!partnerId) {
    const rooms = await env.DB.prepare(
      "SELECT DISTINCT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS partner_id FROM chat_messages WHERE sender_id = ? OR receiver_id = ?"
    ).bind(myId, myId, myId).all();
    const list = [];
    const me = await env.DB.prepare("SELECT lat, lng FROM users WHERE id = ?").bind(myId).first();
    for (const r of rooms.results || []) {
      const p = await env.DB.prepare(
        "SELECT u.id, u.full_name, u.role, u.address_area, u.lat, u.lng, mp.business_name FROM users u LEFT JOIN mitra_profiles mp ON mp.user_id = u.id WHERE u.id = ?"
      ).bind(r.partner_id).first();
      if (p) list.push({ ...p, distance_km: calculateDistanceKm(me?.lat, me?.lng, p.lat, p.lng) });
    }
    return jsonResponse({ contacts: list });
  }

  const me = await env.DB.prepare("SELECT lat, lng FROM users WHERE id = ?").bind(myId).first();
  const partner = await env.DB.prepare(
    "SELECT u.id, u.full_name, u.role, u.address_area, u.lat, u.lng, mp.business_name FROM users u LEFT JOIN mitra_profiles mp ON mp.user_id = u.id WHERE u.id = ?"
  ).bind(partnerId).first();
  const distanceKm = calculateDistanceKm(me?.lat, me?.lng, partner?.lat, partner?.lng);

  const msgs = await env.DB.prepare(
    "SELECT * FROM chat_messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) ORDER BY id ASC LIMIT 100"
  ).bind(myId, partnerId, partnerId, myId).all();

  const out = [];
  for (const m of msgs.results || []) {
    out.push({
      id: m.id,
      sender_id: m.sender_id,
      text: await decryptField(m.message_encrypted, env.ENCRYPTION_SECRET),
      quote_price: m.quote_price,
      distance_info: m.distance_info,
      created_at: m.created_at,
    });
  }
  return jsonResponse({ partner, distance_km: distanceKm, messages: out });
}

export async function onRequestPost({ request, data, env }) {
  const { receiver_id, text, quote_price = 0 } = await request.json();
  const sanitized = String(text || "").replace(/(\+62|62|08)[0-9\s-]{8,14}/g, "[Nomor WA Disamarkan]");
  const me = await env.DB.prepare("SELECT lat, lng FROM users WHERE id = ?").bind(data.user.id).first();
  const target = await env.DB.prepare("SELECT lat, lng FROM users WHERE id = ?").bind(receiver_id).first();
  const dist = calculateDistanceKm(me?.lat, me?.lng, target?.lat, target?.lng);

  const roomId = `room_${Math.min(data.user.id, receiver_id)}_${Math.max(data.user.id, receiver_id)}`;
  const encrypted = await encryptField(sanitized, env.ENCRYPTION_SECRET);

  await env.DB.prepare(
    "INSERT INTO chat_messages (room_id, sender_id, receiver_id, message_encrypted, quote_price, distance_info) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(roomId, data.user.id, receiver_id, encrypted, Number(quote_price || 0), `${dist} km`).run();

  return jsonResponse({ ok: true, distance_km: dist });
}
