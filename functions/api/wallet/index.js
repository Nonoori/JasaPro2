import { jsonResponse, getSplitConfig } from "../../_lib/security.js";

export async function onRequestGet({ data, env }) {
  const userId = data.user.id;
  const user = await env.DB.prepare(
    "SELECT id, role, full_name, wallet_balance, escrow_balance, token_balance, bank_info, referral_code FROM users WHERE id = ?"
  )
    .bind(userId)
    .first();

  const mutations = await env.DB.prepare(
    "SELECT * FROM wallet_mutations WHERE user_id = ? ORDER BY id DESC LIMIT 50"
  )
    .bind(userId)
    .all();

  const withdrawals = await env.DB.prepare(
    "SELECT * FROM withdraw_requests WHERE user_id = ? ORDER BY id DESC LIMIT 20"
  )
    .bind(userId)
    .all();

  const cfg = await getSplitConfig(env.DB);
  const umrTarget = cfg.umr_target_monthly || 6000000;

  // Hitung pendapatan bulan berjalan untuk progress bar UMR 6 Juta
  const monthCredits = (mutations.results || [])
    .filter((m) => m.amount > 0 && m.mutation_type.startsWith("credit_"))
    .reduce((acc, m) => acc + m.amount, 0);

  return jsonResponse({
    user,
    mutations: mutations.results || [],
    withdrawals: withdrawals.results || [],
    umr_target: umrTarget,
    monthly_earned: monthCredits,
    umr_progress_pct: Math.min(100, Math.round((monthCredits / umrTarget) * 100)),
  });
}

export async function onRequestPost({ request, data, env }) {
  try {
    const body = await request.json();
    const { action } = body;
    const userId = data.user.id;
    const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
    const cfg = await getSplitConfig(env.DB);

    // 1. Update Rekening Bank / E-Wallet
    if (action === "update_bank") {
      await env.DB.prepare("UPDATE users SET bank_info = ? WHERE id = ?").bind(body.bank_info || "", userId).run();
      return jsonResponse({ ok: true, message: "Rekening pencairan berhasil diperbarui." });
    }

    // 2. Beli Top-Up Token Leads atau Langganan Mitra Pro (Otomatis Bagi Hasil Langganan ke Korwil, Admin, Owner)
    if (action === "buy_plan") {
      const plan = await env.DB.prepare("SELECT * FROM subscription_plans WHERE id = ?").bind(body.plan_id).first();
      if (!plan) return jsonResponse({ error: "Paket tidak ditemukan." }, 404);

      if (plan.plan_type === "token_topup") {
        const credit = plan.token_credit || plan.price;
        const newTok = (user.token_balance || 0) + credit;
        await env.DB.prepare("UPDATE users SET token_balance = ? WHERE id = ?").bind(newTok, userId).run();
        await env.DB.prepare(
          "INSERT INTO wallet_mutations (user_id, role, mutation_type, amount, balance_after, description) VALUES (?, 'mitra', 'topup_token', ?, ?, ?)"
        )
          .bind(userId, credit, newTok, `Top-up ${plan.name} via Midtrans`)
          .run();
        return jsonResponse({ ok: true, message: `Berhasil top-up token +Rp${credit.toLocaleString("id-ID")}!` });
      }

      if (plan.plan_type === "mitra_pro") {
        const exp = new Date(Date.now() + plan.duration_days * 86400 * 1000).toISOString();
        await env.DB.prepare("UPDATE mitra_profiles SET membership_tier = 'pro', pro_expires_at = ? WHERE user_id = ?")
          .bind(exp, userId)
          .run();

        // Bagi hasil langganan Mitra Pro sesuai rumus Owner (30% Korwil, 20% Admin, 50% Owner)
        const price = plan.price;
        const korwilAmt = Math.round((price * cfg.split_sub_korwil_pct) / 100);
        const adminAmt = Math.round((price * cfg.split_sub_admin_pct) / 100);
        let ownerAmt = price - korwilAmt - adminAmt;

        if (user.referred_by_korwil_id && korwilAmt > 0) {
          const kw = await env.DB.prepare("SELECT wallet_balance FROM users WHERE id = ?").bind(user.referred_by_korwil_id).first();
          if (kw) {
            const newKw = (kw.wallet_balance || 0) + korwilAmt;
            await env.DB.prepare("UPDATE users SET wallet_balance = ? WHERE id = ?").bind(newKw, user.referred_by_korwil_id).run();
            await env.DB.prepare(
              "INSERT INTO wallet_mutations (user_id, role, mutation_type, amount, balance_after, description) VALUES (?, 'korwil', 'credit_komisi_korwil', ?, ?, ?)"
            )
              .bind(user.referred_by_korwil_id, korwilAmt, newKw, `Komisi ${cfg.split_sub_korwil_pct}% Langganan Mitra Pro (${user.full_name})`)
              .run();
          } else {
            ownerAmt += korwilAmt;
          }
        } else {
          ownerAmt += korwilAmt;
        }

        const adm = await env.DB.prepare("SELECT id, wallet_balance FROM users WHERE role = 'admin' AND is_active = 1 LIMIT 1").first();
        if (adm && adminAmt > 0) {
          const newAdm = (adm.wallet_balance || 0) + adminAmt;
          await env.DB.prepare("UPDATE users SET wallet_balance = ? WHERE id = ?").bind(newAdm, adm.id).run();
          await env.DB.prepare(
            "INSERT INTO wallet_mutations (user_id, role, mutation_type, amount, balance_after, description) VALUES (?, 'admin', 'credit_komisi_admin', ?, ?, ?)"
          )
            .bind(adm.id, adminAmt, newAdm, `Komisi ${cfg.split_sub_admin_pct}% Langganan Mitra Pro (${user.full_name})`)
            .run();
        } else {
          ownerAmt += adminAmt;
        }

        const own = await env.DB.prepare("SELECT id, wallet_balance FROM users WHERE role = 'owner' LIMIT 1").first();
        if (own && ownerAmt > 0) {
          const newOwn = (own.wallet_balance || 0) + ownerAmt;
          await env.DB.prepare("UPDATE users SET wallet_balance = ? WHERE id = ?").bind(newOwn, own.id).run();
          await env.DB.prepare(
            "INSERT INTO wallet_mutations (user_id, role, mutation_type, amount, balance_after, description) VALUES (?, 'owner', 'credit_profit_owner', ?, ?, ?)"
          )
            .bind(own.id, ownerAmt, newOwn, `Profit Langganan Mitra Pro (${user.full_name})`)
            .run();
        }

        return jsonResponse({ ok: true, message: "Selamat! Akun Mitra Pro Terverifikasi aktif & komisi otomatis terdistribusi." });
      }
    }

    // 3. Ajukan Withdraw Pencairan Saldo
    if (action === "request_withdraw") {
      const amount = Number(body.amount || 0);
      if (amount < 50000) return jsonResponse({ error: "Minimal pencairan saldo adalah Rp50.000." }, 400);
      if ((user.wallet_balance || 0) < amount) return jsonResponse({ error: "Saldo dapat ditarik tidak mencukupi." }, 400);
      if (!user.bank_info) return jsonResponse({ error: "Lengkapi nomor rekening / e-wallet terlebih dahulu." }, 400);

      const newBal = user.wallet_balance - amount;
      const wdCode = `WD-${Date.now().toString().slice(-6)}`;

      await env.DB.prepare("UPDATE users SET wallet_balance = ? WHERE id = ?").bind(newBal, userId).run();
      await env.DB.prepare(
        "INSERT INTO withdraw_requests (withdraw_code, user_id, role, amount, bank_destination) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(wdCode, userId, user.role, amount, user.bank_info)
        .run();
      await env.DB.prepare(
        "INSERT INTO wallet_mutations (user_id, role, order_code, mutation_type, amount, balance_after, description) VALUES (?, ?, ?, 'withdraw', ?, ?, ?)"
      )
        .bind(userId, user.role, wdCode, -amount, newBal, `Pengajuan pencairan saldo ke ${user.bank_info}`)
        .run();

      return jsonResponse({ ok: true, message: `Pengajuan withdraw ${wdCode} sebesar Rp${amount.toLocaleString("id-ID")} berhasil dikirim!` });
    }

    return jsonResponse({ error: "Aksi dompet tidak dikenal." }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
