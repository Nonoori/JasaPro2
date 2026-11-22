import { getAuthCookie, verifyJwt, jsonResponse } from "./_lib/security.js";

export async function onRequest(context) {
  const { request, env, next } = context;
  const path = new URL(request.url).pathname;

  const token = getAuthCookie(request);
  const user = token ? await verifyJwt(token, env.JWT_SECRET) : null;
  context.data.user = user;

  if (path.startsWith("/api/owner") && (!user || user.role !== "owner")) {
    return jsonResponse({ error: "Akses ditolak. Khusus Owner." }, 403);
  }
  if (path.startsWith("/api/admin") && (!user || !["admin", "owner"].includes(user.role))) {
    return jsonResponse({ error: "Akses ditolak. Khusus Admin / Owner." }, 403);
  }
  if (path.startsWith("/api/korwil") && (!user || !["korwil", "owner"].includes(user.role))) {
    return jsonResponse({ error: "Akses ditolak. Khusus Korwil." }, 403);
  }
  if (path.startsWith("/api/mitra") && (!user || !["mitra", "owner"].includes(user.role))) {
    return jsonResponse({ error: "Akses ditolak. Khusus Mitra." }, 403);
  }
  if ((path.startsWith("/api/user") || path.startsWith("/api/chat") || path.startsWith("/api/orders") || path.startsWith("/api/wallet")) && !user) {
    return jsonResponse({ error: "Silakan login terlebih dahulu." }, 401);
  }

  return next();
}
