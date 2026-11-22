import { jsonResponse, verifyPassword, sha256Hex, normalizePhone, signJwt } from "../../_lib/security.js";

export async function onRequestPost({ request, env }) {
  try {
    const { identifier, password } = await request.json();
    if (!identifier || !password) return jsonResponse({ error: "Masukkan Email/No. WA dan Password." }, 400);

    const cleanPhone = normalizePhone(identifier);
    const phoneHash = await sha256Hex(cleanPhone);

    const user = await env.DB.prepare(
      "SELECT id, role, full_name, email, phone_masked, password_hash, address_area, is_active FROM users WHERE email = ? OR phone_hash = ?"
    )
      .bind(identifier.trim().toLowerCase(), phoneHash)
      .first();

    if (!user) return jsonResponse({ error: "Akun tidak ditemukan." }, 404);
    if (!user.is_active) return jsonResponse({ error: "Akun dinonaktifkan sementara." }, 403);

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return jsonResponse({ error: "Password salah." }, 401);

    const jwt = await signJwt(
      { id: user.id, role: user.role, full_name: user.full_name, address_area: user.address_area },
      env.JWT_SECRET
    );

    return jsonResponse(
      {
        ok: true,
        user: {
          id: user.id,
          role: user.role,
          full_name: user.full_name,
          email: user.email,
          phone_masked: user.phone_masked,
          address_area: user.address_area,
        },
      },
      200,
      { "Set-Cookie": `jk_session=${jwt}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${86400 * 7}` }
    );
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
