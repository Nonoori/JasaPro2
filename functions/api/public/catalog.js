import { jsonResponse, calculateDistanceKm } from "../../_lib/security.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const serviceType = url.searchParams.get("type") || "";
  const categorySlug = url.searchParams.get("category") || "";
  const keyword = (url.searchParams.get("q") || "").trim().toLowerCase();
  const userLat = parseFloat(url.searchParams.get("lat") || "-0.3021");
  const userLng = parseFloat(url.searchParams.get("lng") || "100.3715");

  const categoriesRes = await env.DB.prepare("SELECT * FROM service_categories WHERE is_active = 1 ORDER BY id ASC").all();
  const plansRes = await env.DB.prepare("SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY id ASC").all();

  let query = `
    SELECT s.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
           u.full_name AS mitra_name, u.address_area, u.lat, u.lng, u.phone_masked,
           mp.business_name, mp.slogan, mp.business_photo, mp.bio, mp.skills_json,
           mp.certifications_json, mp.solutions_offered, mp.membership_tier,
           mp.rating_avg, mp.total_reviews, mp.total_orders_completed, mp.verification_status
    FROM services s
    JOIN service_categories c ON s.category_id = c.id
    JOIN users u ON s.mitra_id = u.id
    LEFT JOIN mitra_profiles mp ON mp.user_id = u.id
    WHERE s.is_active = 1 AND u.is_active = 1
  `;
  const binds = [];
  if (serviceType) {
    query += " AND s.service_type = ?";
    binds.push(serviceType);
  }
  if (categorySlug) {
    query += " AND c.slug = ?";
    binds.push(categorySlug);
  }

  const servicesRes = await env.DB.prepare(query).bind(...binds).all();
  const addonsRes = await env.DB.prepare("SELECT * FROM service_addons").all();

  const addonsByService = {};
  for (const a of addonsRes.results || []) {
    if (!addonsByService[a.service_id]) addonsByService[a.service_id] = [];
    addonsByService[a.service_id].push(a);
  }

  let items = (servicesRes.results || []).map((row) => ({
    ...row,
    distance_km: calculateDistanceKm(userLat, userLng, row.lat, row.lng),
    skills: JSON.parse(row.skills_json || "[]"),
    certifications: JSON.parse(row.certifications_json || "[]"),
    addons: addonsByService[row.id] || [],
  }));

  if (keyword) {
    items = items.filter(
      (it) =>
        it.title.toLowerCase().includes(keyword) ||
        it.category_name.toLowerCase().includes(keyword) ||
        (it.business_name || "").toLowerCase().includes(keyword)
    );
  }

  // Mitra Pro tampil prioritas di urutan atas lalu jarak terdekat
  items.sort((a, b) => {
    if (a.membership_tier === "pro" && b.membership_tier !== "pro") return -1;
    if (a.membership_tier !== "pro" && b.membership_tier === "pro") return 1;
    return a.distance_km - b.distance_km;
  });

  return jsonResponse({
    categories: categoriesRes.results || [],
    services: items,
    plans: plansRes.results || [],
  });
}
