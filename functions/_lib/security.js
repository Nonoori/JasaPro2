// Web Crypto Security + Real-Time Auto-Split Ledger Engine (Mitra, Korwil, Admin, Owner)

const enc = new TextEncoder();
const dec = new TextDecoder();

export function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const saltHex = [...salt].map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `PBKDF2$${saltHex}$${hashHex}`;
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  if (storedHash.startsWith("DEMO:")) return password === storedHash.slice(5);
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "PBKDF2") return false;
  const salt = new Uint8Array(parts[1].match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashHex = [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex === parts[2];
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizePhone(phone) {
  let clean = String(phone || "").replace(/[^0-9]/g, "");
  if (clean.startsWith("08")) clean = "62" + clean.slice(1);
  if (clean.startsWith("8")) clean = "62" + clean;
  return clean;
}

export function maskPhone(phone) {
  const clean = normalizePhone(phone);
  if (clean.length < 8) return "08**-****-****";
  const local = "0" + clean.slice(2);
  return `${local.slice(0, 4)}-****-${local.slice(-4)}`;
}

async function getAesKey(secret) {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(secret || "jasakita_aes_secret_2026"));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptField(plainText, secret) {
  if (!plainText) return "";
  const key = await getAesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plainText));
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(cipher)));
  return `AES:${ivB64}:${ctB64}`;
}

export async function decryptField(cipherText, secret) {
  if (!cipherText) return "";
  if (cipherText.startsWith("ENC:")) return cipherText.slice(4);
  if (!cipherText.startsWith("AES:")) return cipherText;
  try {
    const [, ivB64, ctB64] = cipherText.split(":");
    const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
    const ct = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));
    const key = await getAesKey(secret);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return dec.decode(plain);
  } catch {
    return "[Data Terenkripsi]";
  }
}

export async function signJwt(payload, secret) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=/g, "");
  const body = btoa(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 86400 * 7 })).replace(/=/g, "");
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret || "jasakita_jwt_secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return `${data}.${sigB64}`;
}

export async function verifyJwt(token, secret) {
  if (!token) return null;
  try {
    const [header, body, sig] = token.split(".");
    if (!header || !body || !sig) return null;
    const key = await crypto.subtle.importKey("raw", enc.encode(secret || "jasakita_jwt_secret"), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(`${header}.${body}`));
    if (!valid) return null;
    const payload = JSON.parse(atob(body));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getAuthCookie(request) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/jk_session=([^;]+)/);
  return match ? match[1] : null;
}

export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 1.5;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export async function sendWhatsAppMessage(env, targetPhone, message) {
  const cleanPhone = normalizePhone(targetPhone);
  if (!cleanPhone || !env.WA_GATEWAY_URL || !env.WA_GATEWAY_TOKEN) {
    return { sent: false, preview: message };
  }
  try {
    const res = await fetch(env.WA_GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: env.WA_GATEWAY_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ target: cleanPhone, message }),
    });
    return { sent: res.ok };
  } catch (err) {
    return { sent: false, error: err.message };
  }
}

// Ambil Konfigurasi Rumus Split dari app_settings
export async function getSplitConfig(db) {
  const rows = await db.prepare("SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE 'split_%' OR setting_key = 'umr_target_monthly'").all();
  const cfg = {
    split_user_platform_fee: 4000,
    split_mitra_token_fee: 3000,
    split_mitra_pro_price: 75000,
    split_reguler_korwil_rp: 2500,
    split_reguler_admin_rp: 2000,
    split_reguler_owner_rp: 2500,
    split_pro_order_korwil_rp: 1500,
    split_pro_order_admin_rp: 1000,
    split_pro_order_owner_rp: 1500,
    split_sub_korwil_pct: 30,
    split_sub_admin_pct: 20,
    split_sub_owner_pct: 50,
    umr_target_monthly: 6000000,
  };
  for (const r of rows.results || []) {
    cfg[r.setting_key] = Number(r.setting_value);
  }
  return cfg;
}

// Eksekusi Pembagian Saldo Otomatis saat Order Selesai
export async function settleOrderSplit(db, order) {
  if (order.split_settled === 1) return { alreadySettled: true };

  const cfg = await getSplitConfig(db);
  const mitraProfile = await db.prepare("SELECT membership_tier FROM mitra_profiles WHERE user_id = ?").bind(order.mitra_id).first();
  const isPro = mitraProfile?.membership_tier === "pro";

  const mitraNet = Number(order.subtotal) + Number(order.addon_total || 0);
  const korwilShare = isPro ? cfg.split_pro_order_korwil_rp : cfg.split_reguler_korwil_rp;
  const adminShare = isPro ? cfg.split_pro_order_admin_rp : cfg.split_reguler_admin_rp;
  const ownerShare = isPro ? cfg.split_pro_order_owner_rp : cfg.split_reguler_owner_rp;

  // 1. Cairkan dana jasa 100% ke dompet Mitra (dan kurangi escrow jika sebelumnya masuk escrow)
  const mitraUser = await db.prepare("SELECT wallet_balance, escrow_balance FROM users WHERE id = ?").bind(order.mitra_id).first();
  const newMitraBal = (mitraUser?.wallet_balance || 0) + mitraNet;
  const newMitraEscrow = Math.max(0, (mitraUser?.escrow_balance || 0) - mitraNet);
  await db.prepare("UPDATE users SET wallet_balance = ?, escrow_balance = ? WHERE id = ?").bind(newMitraBal, newMitraEscrow, order.mitra_id).run();
  await db.prepare(
    "INSERT INTO wallet_mutations (user_id, role, order_code, mutation_type, amount, balance_after, description) VALUES (?, 'mitra', ?, 'credit_jasa', ?, ?, ?)"
  )
    .bind(order.mitra_id, order.order_code, mitraNet, newMitraBal, `Pendapatan jasa 100% dari pesanan ${order.order_code}`)
    .run();

  // 2. Bagi hasil ke Korwil pembina (jika ada, jika tidak dialihkan ke Owner)
  let actualKorwilId = order.korwil_id;
  if (!actualKorwilId) {
    const mUser = await db.prepare("SELECT referred_by_korwil_id FROM users WHERE id = ?").bind(order.mitra_id).first();
    actualKorwilId = mUser?.referred_by_korwil_id || null;
  }

  let effectiveOwnerShare = ownerShare;
  if (actualKorwilId && korwilShare > 0) {
    const kw = await db.prepare("SELECT wallet_balance FROM users WHERE id = ?").bind(actualKorwilId).first();
    if (kw) {
      const newKwBal = (kw.wallet_balance || 0) + korwilShare;
      await db.prepare("UPDATE users SET wallet_balance = ? WHERE id = ?").bind(newKwBal, actualKorwilId).run();
      await db.prepare(
        "INSERT INTO wallet_mutations (user_id, role, order_code, mutation_type, amount, balance_after, description) VALUES (?, 'korwil', ?, 'credit_komisi_korwil', ?, ?, ?)"
      )
        .bind(actualKorwilId, order.order_code, korwilShare, newKwBal, `Komisi wilayah dari ${order.order_code} (${isPro ? "Mitra Pro" : "Mitra Reguler"})`)
        .run();
    } else {
      effectiveOwnerShare += korwilShare;
    }
  } else {
    effectiveOwnerShare += korwilShare;
  }

  // 3. Bagi hasil ke Admin Operasional aktif pertama
  const adminUser = await db.prepare("SELECT id, wallet_balance FROM users WHERE role = 'admin' AND is_active = 1 ORDER BY id ASC LIMIT 1").first();
  if (adminUser && adminShare > 0) {
    const newAdmBal = (adminUser.wallet_balance || 0) + adminShare;
    await db.prepare("UPDATE users SET wallet_balance = ? WHERE id = ?").bind(newAdmBal, adminUser.id).run();
    await db.prepare(
      "INSERT INTO wallet_mutations (user_id, role, order_code, mutation_type, amount, balance_after, description) VALUES (?, 'admin', ?, 'credit_komisi_admin', ?, ?, ?)"
    )
      .bind(adminUser.id, order.order_code, adminShare, newAdmBal, `Insentif operasional & CS dari ${order.order_code}`)
      .run();
  } else {
    effectiveOwnerShare += adminShare;
  }

  // 4. Bagi hasil ke Owner Utama
  const ownerUser = await db.prepare("SELECT id, wallet_balance FROM users WHERE role = 'owner' ORDER BY id ASC LIMIT 1").first();
  if (ownerUser && effectiveOwnerShare > 0) {
    const newOwnBal = (ownerUser.wallet_balance || 0) + effectiveOwnerShare;
    await db.prepare("UPDATE users SET wallet_balance = ? WHERE id = ?").bind(newOwnBal, ownerUser.id).run();
    await db.prepare(
      "INSERT INTO wallet_mutations (user_id, role, order_code, mutation_type, amount, balance_after, description) VALUES (?, 'owner', ?, 'credit_profit_owner', ?, ?, ?)"
    )
      .bind(ownerUser.id, order.order_code, effectiveOwnerShare, newOwnBal, `Profit ekosistem platform dari ${order.order_code}`)
      .run();
  }

  const splitDetail = JSON.stringify({
    mitra: mitraNet,
    korwil: actualKorwilId ? korwilShare : 0,
    admin: adminUser ? adminShare : 0,
    owner: effectiveOwnerShare,
    tier: isPro ? "pro" : "reguler",
  });

  await db.prepare("UPDATE orders SET split_settled = 1, payment_status = 'released', split_detail_json = ? WHERE id = ?")
    .bind(splitDetail, order.id)
    .run();

  return { settled: true, split: JSON.parse(splitDetail) };
}
