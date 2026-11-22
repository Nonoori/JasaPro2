import { jsonResponse, decryptField } from "../../_lib/security.js";

export async function onRequestGet({ data, env }) {
  if (!data.user) return jsonResponse({ authenticated: false }, 200);
  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(data.user.id).first();
  if (!user) return jsonResponse({ authenticated: false }, 200);

  return jsonResponse({
    authenticated: true,
    user: {
      id: user.id,
      role: user.role,
      full_name: user.full_name,
      email: user.email,
      phone_plain: await decryptField(user.phone_encrypted, env.ENCRYPTION_SECRET),
      phone_masked: user.phone_masked,
      address_plain: await decryptField(user.address_encrypted, env.ENCRYPTION_SECRET),
      address_area: user.address_area,
      lat: user.lat,
      lng: user.lng,
      referral_code: user.referral_code,
      wallet_balance: user.wallet_balance,
      escrow_balance: user.escrow_balance,
      token_balance: user.token_balance,
      bank_info: user.bank_info,
      is_verified: user.is_verified,
    },
  });
}
