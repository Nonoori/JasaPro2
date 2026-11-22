import { jsonResponse } from "../../_lib/security.js";

export async function onRequestPost() {
  return jsonResponse({ ok: true }, 200, { "Set-Cookie": "jk_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" });
}
