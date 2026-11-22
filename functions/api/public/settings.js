import { jsonResponse } from "../../_lib/security.js";

export async function onRequestGet({ env }) {
  const rows = await env.DB.prepare("SELECT setting_key, setting_value FROM app_settings").all();
  const settings = {};
  for (const r of rows.results || []) settings[r.setting_key] = r.setting_value;
  return jsonResponse({ settings });
}
