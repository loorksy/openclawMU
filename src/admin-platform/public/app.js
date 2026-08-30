const app = document.getElementById("app");
let csrf = "";
let me = null;
let permissions = [];
let query = "";

const NAV = [
  ["dashboard", "Dashboard", "/"],
  ["tenants", "Tenants", "/tenants"],
  ["users", "Users", "/users"],
  ["sessions", "Sessions", "/sessions"],
  ["usage", "Usage", "/usage"],
  ["quotas", "Quotas", "/quotas"],
  ["logs", "Logs", "/logs"],
  ["system", "System", "/system"],
  ["staff", "Staff", "/staff"],
  ["settings", "Settings", "/settings"],
];

function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

async function api(method, path, body) {
  const res = await fetch(`/admin/api${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(method === "GET" ? {} : { "X-Admin-CSRF": csrf }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

function badge(status) {
  const cls = status === "active" || status === "ok" ? "ok" : status === "suspended" ? "danger" : "idle";
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pathOf() {
  return location.pathname.replace(/\/$/, "") || "/";
}

function can(perm) {
  return permissions.includes(perm);
}

function shell(inner) {
  return `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">OpenClawMU Admin</div>
        <nav class="nav">
          ${NAV.map(([id, label, href]) => `<a href="${href}" class="${pathOf() === href || (href !== "/" && pathOf().startsWith(href)) ? "active" : ""}" data-nav="${id}">${label}</a>`).join("")}
        </nav>
      </aside>
      <section class="main">
        <header class="topbar">
          <input id="search" placeholder="Search tenants, users, sessions…" value="${escapeHtml(query)}" />
          <span class="badge idle">${escapeHtml(me?.role ?? "")}</span>
          <strong>${escapeHtml(me?.email ?? "")}</strong>
          <button class="btn" id="logout">Logout</button>
        </header>
        <div class="content">${inner}</div>
      </section>
    </div>
  `;
}

function loginView(error = "") {
  app.innerHTML = `
    <div class="card login">
      <h1>Admin sign in</h1>
      <p class="label">Independent of tenant tokens.</p>
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
      <input id="email" type="email" placeholder="Email" />
      <input id="password" type="password" placeholder="Password" />
      <input id="totp" placeholder="2FA code (if enabled)" />
      <button class="btn primary" id="signin">Sign in</button>
    </div>
  `;
  document.getElementById("signin").onclick = async () => {
    try {
      const data = await api("POST", "/auth/login", {
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
        totp: document.getElementById("totp").value,
      });
      csrf = data.csrfToken;
      await boot();
    } catch (err) {
      loginView(err.message);
    }
  };
}

async function loadSession() {
  const data = await api("GET", "/auth/session");
  me = data.staff;
  csrf = data.csrfToken;
  permissions = data.permissions ?? [];
}

function confirmAction(message) {
  return window.confirm(message);
}

async function renderDashboard() {
  const { dashboard } = await api("GET", "/dashboard");
  const t = dashboard.totals;
  app.innerHTML = shell(`
    <div class="grid">
      ${metric("Total tenants", t.tenants)}
      ${metric("Active", t.activeTenants)}
      ${metric("Suspended", t.suspendedTenants)}
      ${metric("Active sessions", t.activeSessions)}
      ${metric("Requests", t.requests)}
      ${metric("Tokens", t.tokenUsage)}
      ${metric("Est. cost (¢)", t.estimatedCostCents)}
      ${metric("CPU %", Math.round(dashboard.system.cpu.usagePercent))}
    </div>
    <h3>Recent tenants</h3>
    ${tenantTable(dashboard.tenants)}
  `);
}

function metric(label, value) {
  return `<div class="card"><div class="label">${label}</div><div class="value">${escapeHtml(value)}</div></div>`;
}

function tenantTable(rows) {
  if (!rows.length) {
    return `<div class="empty">No tenants yet.</div>`;
  }
  const filtered = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
  return `<div class="table-wrap"><table>
    <thead><tr><th>ID</th><th>Name</th><th>Status</th><th>Tokens</th><th>Cost ¢</th><th>Updated</th><th></th></tr></thead>
    <tbody>
      ${filtered
        .map(
          (row) => `<tr>
        <td><a href="/tenants/${encodeURIComponent(row.tenantId)}">${escapeHtml(row.tenantId)}</a></td>
        <td>${escapeHtml(row.displayName)}</td>
        <td>${badge(row.status)}</td>
        <td>${escapeHtml(row.usage?.totalTokens ?? 0)}</td>
        <td>${escapeHtml(row.usage?.totalCostCents ?? 0)}</td>
        <td>${escapeHtml(row.lastActivity ?? "—")}</td>
        <td class="row">
          ${can("tenants.update") ? `<button class="btn" data-act="toggle" data-id="${escapeHtml(row.tenantId)}" data-disabled="${row.status === "active"}">${row.status === "active" ? "Suspend" : "Activate"}</button>` : ""}
        </td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table></div>`;
}

async function renderTenants() {
  const { tenants } = await api("GET", "/tenants");
  app.innerHTML = shell(`
    <div class="row" style="margin-bottom:12px">
      <h2>Tenants</h2>
      ${can("tenants.create") ? `<button class="btn primary" id="add-tenant">Add tenant</button>` : ""}
    </div>
    ${tenantTable(tenants)}
  `);
  document.getElementById("add-tenant")?.addEventListener("click", async () => {
    const tenantId = prompt("Tenant ID (lowercase, 1-32)");
    if (!tenantId) return;
    const displayName = prompt("Display name") ?? tenantId;
    try {
      const created = await api("POST", "/tenants", { tenantId, displayName });
      toast(`Created ${created.tenantId}. Copy token now: ${created.token}`);
      await renderTenants();
    } catch (err) {
      toast(err.message);
    }
  });
}

async function renderTenant(id) {
  const { tenant } = await api("GET", `/tenants/${encodeURIComponent(id)}`);
  const tab = new URLSearchParams(location.search).get("tab") ?? "overview";
  const tabs = ["overview", "sessions", "usage", "agents", "channels", "quotas", "configuration"];
  const body = {
    overview: `<pre>${escapeHtml(JSON.stringify({ status: tenant.status, createdAt: tenant.createdAt, lastActivity: tenant.lastActivity, quota: tenant.quota }, null, 2))}</pre>`,
    sessions: tenantTableFromSessions(tenant.sessions ?? []),
    usage: `<pre>${escapeHtml(JSON.stringify(tenant.usage, null, 2))}</pre>`,
    agents: `<pre>${escapeHtml(JSON.stringify(tenant.agents, null, 2))}</pre>`,
    channels: `<pre>${escapeHtml(JSON.stringify(tenant.channels, null, 2))}</pre>`,
    quotas: `<pre>${escapeHtml(JSON.stringify(tenant.quota, null, 2))}</pre>`,
    configuration: `<pre>${escapeHtml(JSON.stringify(tenant.configuration, null, 2))}</pre>`,
  }[tab];
  app.innerHTML = shell(`
    <div class="row"><h2>${escapeHtml(tenant.displayName)}</h2>${badge(tenant.status)}</div>
    <div class="tabs">
      ${tabs.map((name) => `<a class="btn ${tab === name ? "primary" : ""}" href="/tenants/${encodeURIComponent(id)}?tab=${name}">${name}</a>`).join("")}
    </div>
    <div class="card">${body}</div>
    <div class="row" style="margin-top:12px">
      ${can("tenants.update") ? `<button class="btn" id="suspend">${tenant.status === "active" ? "Suspend" : "Activate"}</button>` : ""}
      ${can("users.write") ? `<button class="btn" id="rotate">Reset credentials</button>` : ""}
      ${can("tenants.delete") ? `<button class="btn danger" id="remove">Delete</button>` : ""}
    </div>
  `);
  document.getElementById("suspend")?.addEventListener("click", async () => {
    if (!confirmAction("Change tenant status?")) return;
    await api("PATCH", `/tenants/${encodeURIComponent(id)}`, { disabled: tenant.status === "active" });
    await renderTenant(id);
  });
  document.getElementById("rotate")?.addEventListener("click", async () => {
    if (!confirmAction("Rotate tenant token? Existing token stops working.")) return;
    const rotated = await api("POST", `/tenants/${encodeURIComponent(id)}/rotate`);
    toast(`New token: ${rotated.token}`);
  });
  document.getElementById("remove")?.addEventListener("click", async () => {
    if (!confirmAction("Delete this tenant? This cannot be undone.")) return;
    await api("DELETE", `/tenants/${encodeURIComponent(id)}?deleteData=true`);
    history.pushState({}, "", "/tenants");
    await route();
  });
}

function tenantTableFromSessions(rows) {
  if (!rows.length) return `<div class="empty">No sessions.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Key</th><th>Tenant</th><th>Tokens</th><th>Updated</th></tr></thead><tbody>
    ${rows.map((row) => `<tr><td>${escapeHtml(row.key)}</td><td>${escapeHtml(row.tenantId ?? "—")}</td><td>${escapeHtml(row.totalTokens ?? 0)}</td><td>${escapeHtml(row.updatedAt ?? "—")}</td></tr>`).join("")}
  </tbody></table></div>`;
}

async function renderUsers() {
  const { users, note } = await api("GET", "/users");
  app.innerHTML = shell(`<p class="label">${escapeHtml(note)}</p>${tenantTable(users.map((u) => ({ tenantId: u.id, displayName: u.name, status: u.status, usage: {}, lastActivity: u.lastLoginAt })))}`);
}

async function renderSessions() {
  const { sessions } = await api("GET", "/sessions");
  app.innerHTML = shell(`
    <h2>Sessions</h2>
    ${tenantTableFromSessions(sessions)}
  `);
}

async function renderUsage() {
  const range = new URLSearchParams(location.search).get("range") ?? "30d";
  const { usage } = await api("GET", `/usage?range=${encodeURIComponent(range)}`);
  app.innerHTML = shell(`
    <div class="row">
      <h2>Usage</h2>
      ${["today", "7d", "30d"].map((r) => `<a class="btn ${range === r ? "primary" : ""}" href="/usage?range=${r}">${r}</a>`).join("")}
    </div>
    <div class="grid">
      ${metric("Requests", usage.totals.requests)}
      ${metric("Input tokens", usage.totals.inputTokens)}
      ${metric("Output tokens", usage.totals.outputTokens)}
      ${metric("Est. cost ¢", usage.totals.estimatedCostCents)}
    </div>
    <div class="card"><pre>${escapeHtml(JSON.stringify(usage.byTenant, null, 2))}</pre></div>
  `);
}

async function renderQuotas() {
  const { tenants } = await api("GET", "/quotas");
  app.innerHTML = shell(`<h2>Quotas</h2>${tenantTable(tenants)}`);
}

async function renderLogs() {
  const logs = await api("GET", "/logs");
  const audit = await api("GET", "/audit");
  app.innerHTML = shell(`
    <h2>Logs</h2>
    <div class="card"><h3>System</h3><pre>${escapeHtml((logs.lines ?? []).join("\n") || "No log file configured.")}</pre></div>
    <div class="card"><h3>Admin audit</h3>
      <div class="table-wrap"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Result</th></tr></thead>
      <tbody>${(audit.events ?? [])
        .map(
          (e) => `<tr><td>${escapeHtml(e.ts)}</td><td>${escapeHtml(e.actorEmail)}</td><td>${escapeHtml(e.action)}</td><td>${escapeHtml(e.targetId ?? e.targetType)}</td><td>${escapeHtml(e.result)}</td></tr>`,
        )
        .join("")}</tbody></table></div>
    </div>
  `);
}

async function renderSystem() {
  const { dashboard } = await api("GET", "/system");
  app.innerHTML = shell(`<h2>System health</h2><pre>${escapeHtml(JSON.stringify(dashboard.system, null, 2))}</pre>`);
}

async function renderStaff() {
  if (!can("staff.read")) {
    app.innerHTML = shell(`<div class="error">Missing staff.read</div>`);
    return;
  }
  const { staff } = await api("GET", "/staff");
  app.innerHTML = shell(`
    <div class="row"><h2>Staff</h2>${can("moderators.manage") || can("admins.manage") ? `<button class="btn primary" id="add-staff">Add</button>` : ""}</div>
    <div class="table-wrap"><table><thead><tr><th>Email</th><th>Role</th><th>Status</th></tr></thead>
    <tbody>${staff.map((s) => `<tr><td>${escapeHtml(s.email)}</td><td>${escapeHtml(s.role)}</td><td>${badge(s.disabled ? "disabled" : "active")}</td></tr>`).join("")}</tbody></table></div>
  `);
  document.getElementById("add-staff")?.addEventListener("click", async () => {
    const email = prompt("Email");
    const name = prompt("Name") ?? email;
    const role = prompt("Role (admin|moderator)", "moderator");
    const password = prompt("Password (12+ chars)");
    if (!email || !password) return;
    try {
      await api("POST", "/staff", { email, name, role, password });
      toast("Staff created");
      await renderStaff();
    } catch (err) {
      toast(err.message);
    }
  });
}

async function renderSettings() {
  app.innerHTML = shell(`
    <h2>Settings</h2>
    <div class="card">
      <p>Admin authentication is independent of tenant tokens.</p>
      <p>Configure <code>OPENCLAW_ADMIN_DOMAIN</code>, <code>OPENCLAW_ADMIN_SESSION_SECRET</code>, and cookie flags in the gateway environment.</p>
    </div>
  `);
}

async function route() {
  try {
    const path = pathOf();
    if (path === "/" || path === "/dashboard") await renderDashboard();
    else if (path === "/tenants") await renderTenants();
    else if (path.startsWith("/tenants/")) await renderTenant(decodeURIComponent(path.slice("/tenants/".length).split("?")[0]));
    else if (path === "/users") await renderUsers();
    else if (path === "/sessions") await renderSessions();
    else if (path === "/usage") await renderUsage();
    else if (path === "/quotas") await renderQuotas();
    else if (path === "/logs") await renderLogs();
    else if (path === "/system") await renderSystem();
    else if (path === "/staff") await renderStaff();
    else if (path === "/settings") await renderSettings();
    else await renderDashboard();
    bindChrome();
  } catch (err) {
    if (String(err.message).includes("Unauthorized")) {
      loginView();
      return;
    }
    app.innerHTML = shell(`<div class="error">${escapeHtml(err.message)}</div>`);
    bindChrome();
  }
}

function bindChrome() {
  document.getElementById("logout")?.addEventListener("click", async () => {
    await api("POST", "/auth/logout");
    me = null;
    loginView();
  });
  document.getElementById("search")?.addEventListener("input", (event) => {
    query = event.target.value;
    route();
  });
  document.querySelectorAll("[data-act=toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirmAction("Change tenant status?")) return;
      await api("PATCH", `/tenants/${btn.dataset.id}`, { disabled: btn.dataset.disabled === "true" });
      await route();
    });
  });
}

document.body.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (!link || link.target === "_blank" || link.href.startsWith("mailto:")) return;
  const url = new URL(link.href);
  if (url.origin !== location.origin) return;
  event.preventDefault();
  history.pushState({}, "", url.pathname + url.search);
  route();
});

window.addEventListener("popstate", () => route());

async function boot() {
  try {
    await loadSession();
    await route();
  } catch {
    loginView();
  }
}

boot();
