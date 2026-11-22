const JK = {
  settings: {},
  user: null,

  rupiah(num) {
    return "Rp" + Number(num || 0).toLocaleString("id-ID");
  },

  async api(url, options = {}) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Terjadi kesalahan server");
    return data;
  },

  roleRedirect(role) {
    const map = {
      owner: "/owner.html",
      admin: "/owner.html",
      korwil: "/korwil.html",
      mitra: "/mitra.html",
      user: "/index.html",
    };
    return map[role] || "/index.html";
  },

  async initGlobal() {
    try {
      const [setRes, meRes] = await Promise.all([
        this.api("/api/public/settings"),
        this.api("/api/auth/me"),
      ]);
      this.settings = setRes.settings || {};
      this.user = meRes.authenticated ? meRes.user : null;

      if (this.settings.theme_primary) document.documentElement.style.setProperty("--primary", this.settings.theme_primary);
      if (this.settings.theme_accent) document.documentElement.style.setProperty("--accent", this.settings.theme_accent);

      document.querySelectorAll("[data-brand-name]").forEach((el) => (el.textContent = this.settings.brand_name || "JasaKita Pro"));
      document.querySelectorAll("[data-brand-slogan]").forEach((el) => (el.textContent = this.settings.brand_slogan || ""));
      document.querySelectorAll("[data-brand-logo]").forEach((el) => (el.textContent = this.settings.brand_logo || "🛡️"));
      document.querySelectorAll("[data-disclaimer]").forEach((el) => (el.textContent = this.settings.header_disclaimer || ""));
      document.querySelectorAll("[data-copyright]").forEach((el) => (el.textContent = this.settings.footer_copyright || ""));
      document.querySelectorAll("[data-admin-wa]").forEach((el) => {
        const wa = this.settings.superadmin_wa || "6283124443888";
        el.href = `https://wa.me/${wa}?text=${encodeURIComponent("Halo Pusat Bantuan JasaKita Pro.")}`;
      });
    } catch (e) {
      console.warn(e.message);
    }
  },

  async logout() {
    await this.api("/api/auth/logout", { method: "POST" });
    window.location.href = "/login.html";
  },
};
