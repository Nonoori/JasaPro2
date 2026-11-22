import { jsonResponse } from "../../_lib/security.js";

export async function onRequestGet({ data, env }) {
  const korwilId = data.user.id;
  const korwil = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(korwilId).first();

  const binaanMitra = await env.DB.prepare(
    `SELECT u.id, u.full_name, u.phone_masked, u.address_area, u.is_verified, u.token_balance,
            mp.business_name, mp.membership_tier, mp.rating_avg, mp.total_orders_completed, mp.verification_status
     FROM users u LEFT JOIN mitra_profiles mp ON mp.user_id = u.id
     WHERE u.role = 'mitra' AND u.referred_by_korwil_id = ? ORDER BY u.id DESC`
  )
    .bind(korwilId)
    .all();

  const regionOrders = await env.DB.prepare(
    `SELECT o.*, s.title AS service_title, m.full_name AS mitra_name
     FROM orders o JOIN services s ON o.service_id = s.id JOIN users m ON o.mitra_id = m.id
     WHERE o.korwil_id = ? ORDER BY o.id DESC LIMIT 50`
  )
    .bind(korwilId)
    .all();

  return jsonResponse({
    korwil: {
      id: korwil.id,
      full_name: korwil.full_name,
      address_area: korwil.address_area,
      referral_code: korwil.referral_code,
      wallet_balance: korwil.wallet_balance,
    },
    mitra_list: binaanMitra.results || [],
    orders: regionOrders.results || [],
  });
}
