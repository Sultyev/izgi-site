// @ts-nocheck
/* ИЗГИ — серверная часть (Supabase Edge Function): вход, сотрудники, задачи, фото, контент сайта.
   Данные лежат в таблице public.kv. Пароли хранятся только как хэш PBKDF2. */
const env = (k) => Deno.env.get(k) || "";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS" };
const json = (d, s = 200, extra = {}) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra } });
const DB = () => env("SUPABASE_URL").replace(/\/$/, "") + "/rest/v1/kv";
const HD = () => ({ apikey: env("SUPABASE_SERVICE_ROLE_KEY"), authorization: "Bearer " + env("SUPABASE_SERVICE_ROLE_KEY"), "content-type": "application/json" });
const get = async (k, d) => {
  const r = await fetch(DB() + "?select=value&key=eq." + encodeURIComponent(k), { headers: HD() });
  if (!r.ok) throw new Error("db " + r.status);
  const rows = await r.json();
  return rows.length ? rows[0].value : d;
};
const put = async (k, v) => {
  const r = await fetch(DB(), { method: "POST", headers: { ...HD(), prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: k, value: v }) });
  if (!r.ok) throw new Error("db " + r.status);
};

const enc = new TextEncoder();
const b64u = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
async function pbk(pw, salt) {
  const k = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 100000 }, k, 256));
}
const hash = async (pw) => { const s = hex(crypto.getRandomValues(new Uint8Array(16))); return s + ":" + (await pbk(pw, s)); };
const verify = async (pw, h) => { const [s, k] = String(h).split(":"); return same(await pbk(pw, s || ""), k || ""); };
async function mac(data) {
  const k = await crypto.subtle.importKey("raw", enc.encode(env("AUTH_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}
const sign = async (p) => { const b = b64u(enc.encode(JSON.stringify(p))); return b + "." + (await mac(b)); };
const unsign = async (t) => {
  const [b, s] = String(t || "").split(".");
  if (!b || !s || !same(s, await mac(b))) return null;
  try { const p = JSON.parse(new TextDecoder().decode(unb64u(b))); return p.exp > Date.now() ? p : null; } catch { return null; }
};
const rand = () => hex(crypto.getRandomValues(new Uint8Array(5)));
const full = (u) => u.role === "director" || u.level === "full";
const can = (u, p) => full(u) || !!(u.perms && u.perms[p]);
const canEdit = (me, u) => (me.role === "director" ? true : u.role === "director" ? false : full(u) ? full(me) : can(me, "staff"));
const pub = (u) => ({ id: u.id, name: u.name, position: u.position, role: u.role, login: u.login, color: u.color, level: full(u) ? "full" : "limited", perms: u.perms || {} });
const checkLogin = (l, list, self) => (!/^[a-z0-9._-]{3,24}$/.test(l) ? "Логин: 3–24 символа, только латиница, цифры, точка, дефис или _." : list.some((x) => x.login === l && x.id !== self) ? "Такой логин уже занят." : "");
const STATUS = ["new", "progress", "review", "done"];
const COLORS = ["#01a09c", "#113fd2", "#0d2e7b", "#7fdcd3", "#00a79d"];

/* ---------- push-уведомления ---------- */
const b64raw = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function vapid() {
  let v = await get("vapid", null);
  if (!v) {
    const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
    v = { publicKey: b64raw(new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey))), privateKey: jwk.d };
    await put("vapid", v);
  }
  return v;
}
async function notify(userId, payload) {
  try {
    const all = await get("push", {});
    const subs = all[userId] || [];
    if (!subs.length) return;
    const wp = (await import("npm:web-push@3.6.7")).default;
    const v = await vapid();
    wp.setVapidDetails(env("VAPID_SUBJECT") || "mailto:info@izgi.kg", v.publicKey, v.privateKey);
    const dead = [];
    await Promise.all(subs.map(async (sub) => {
      try { await wp.sendNotification(sub, JSON.stringify(payload), { TTL: 86400, urgency: "high", timeout: 6000 }); }
      catch (e) { if (e && (e.statusCode === 404 || e.statusCode === 410)) dead.push(sub.endpoint); }
    }));
    if (dead.length) { all[userId] = subs.filter((x) => !dead.includes(x.endpoint)); await put("push", all); }
  } catch (_) { /* уведомления не должны ломать сохранение задач */ }
}

async function loadUsers() {
  let list = await get("users", null);
  if (!list) {
    const l = env("DIRECTOR_LOGIN"), p = env("DIRECTOR_PASSWORD");
    if (!l || !p) return [];
    list = [{ id: "u-director", name: env("DIRECTOR_NAME") || "Директор школы", position: "Директор", role: "director", login: l.trim().toLowerCase(), pass: await hash(p), color: "#113fd2" }];
    await put("users", list);
  }
  return list;
}

async function handle(req) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*?\/api(?=\/|$)/, "") || "/";
  const m = req.method;
  if (path === "/content" && m === "GET") return json(await get("content", {}), 200, { "cache-control": "public, max-age=15" });
  if (path === "/push/key" && m === "GET") return json({ key: (await vapid()).publicKey }, 200, { "cache-control": "public, max-age=300" });
  if (!env("AUTH_SECRET")) return json({ error: "Сервер не настроен: задайте секрет AUTH_SECRET." }, 500);
  const body = m === "GET" ? {} : await req.json().catch(() => ({}));
  const list = await loadUsers();
  if (!list.length) return json({ error: "Сервер не настроен: задайте секреты DIRECTOR_LOGIN и DIRECTOR_PASSWORD." }, 500);

  if (path === "/login" && m === "POST") {
    const u = list.find((x) => x.login === String(body.login || "").trim().toLowerCase());
    if (!u || !(await verify(String(body.password || ""), u.pass))) { await new Promise((r) => setTimeout(r, 700)); return json({ error: "Неверный логин или пароль." }, 401); }
    return json({ token: await sign({ uid: u.id, v: u.tv || 0, exp: Date.now() + 8 * 3600e3 }), user: pub(u) });
  }
  const tok = await unsign((req.headers.get("authorization") || "").replace(/^Bearer /, ""));
  const me0 = tok && list.find((x) => x.id === tok.uid);
  const me = me0 && (tok.v || 0) === (me0.tv || 0) ? me0 : null;
  if (!me) return json({ error: "Нужно войти." }, 401);
  const dir = can(me, "tasks");
  const mine = (t) => dir || t.assigneeId === me.id;

  if (path === "/state" && m === "GET") {
    const out = { users: list.map(pub), tasks: (await get("tasks", [])).filter(mine), avatars: await get("avatars", {}) };
    if (can(me, "content")) out.content = await get("content", {});
    return json(out);
  }
  if (path === "/tasks" && m === "PUT") {
    const inc = Array.isArray(body.tasks) ? body.tasks : [];
    let all = await get("tasks", []);
    let fresh = [];
    if (dir) {
      const old = new Map(all.map((t) => [t.id, t]));
      fresh = inc.filter((t) => t.assigneeId && t.assigneeId !== me.id && t.status !== "done" && (!old.has(t.id) || old.get(t.id).assigneeId !== t.assigneeId));
      all = inc;
    }
    else {
      const byId = new Map(inc.map((t) => [t.id, t]));
      all = all.map((t) => { const n = byId.get(t.id); return n && t.assigneeId === me.id && STATUS.includes(n.status) ? { ...t, status: n.status, startedAt: n.startedAt || null, completedAt: n.completedAt || null } : t; });
    }
    await put("tasks", all);
    if (fresh.length) {
      const job = Promise.all(fresh.map((t) => notify(t.assigneeId, { title: "Новая задача", body: String(t.title || "Задача") + (t.due ? " · срок: " + t.due : ""), url: "tasks.html", tag: "task-" + t.id })));
      if (globalThis.EdgeRuntime && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(job); else await job;
    }
    return json({ tasks: all.filter(mine) });
  }
  if (path === "/push/subscribe" && m === "POST") {
    const sb = body.subscription || {};
    if (!/^https:\/\//.test(sb.endpoint || "") || !sb.keys || !sb.keys.p256dh || !sb.keys.auth) return json({ ok: false, error: "Некорректная подписка." }, 400);
    const all = await get("push", {});
    for (const id of Object.keys(all)) all[id] = all[id].filter((x) => x.endpoint !== sb.endpoint);
    all[me.id] = [...(all[me.id] || []), { endpoint: sb.endpoint, keys: { p256dh: sb.keys.p256dh, auth: sb.keys.auth } }].slice(-5);
    await put("push", all);
    return json({ ok: true });
  }
  if (path === "/push/unsubscribe" && m === "POST") {
    const all = await get("push", {});
    all[me.id] = (all[me.id] || []).filter((x) => x.endpoint !== body.endpoint);
    await put("push", all);
    return json({ ok: true });
  }
  if (path === "/avatars" && m === "PUT") {
    const id = String(body.id || "");
    const tgt = list.find((x) => x.id === id);
    if (id !== me.id && !(tgt && canEdit(me, tgt))) return json({ error: "Нет доступа." }, 403);
    const a = await get("avatars", {});
    if (body.data) {
      if (!/^data:image\/jpeg;base64,/.test(body.data) || body.data.length > 90000) return json({ error: "Фото слишком большое." }, 413);
      a[id] = body.data;
    } else delete a[id];
    await put("avatars", a);
    return json({ ok: true });
  }
  if (path === "/content" && m === "PUT") {
    if (!can(me, "content")) return json({ error: "Нет доступа." }, 403);
    await put("content", body.content || {});
    return json({ ok: true });
  }
  if (path.startsWith("/users")) {
    if (!can(me, "staff")) return json({ ok: false, error: "Нет доступа." }, 403);
    const id = path.split("/")[2];
    if (m === "POST" && !id) {
      const name = String(body.name || "").trim(), position = String(body.position || "").trim(), login = String(body.login || "").trim().toLowerCase(), pw = String(body.password || "");
      if (name.length < 2) return json({ ok: false, error: "Укажите имя сотрудника." }, 400);
      if (position.length < 2) return json({ ok: false, error: "Укажите должность." }, 400);
      const le = checkLogin(login, list, ""); if (le) return json({ ok: false, error: le }, le.startsWith("Такой") ? 409 : 400);
      if (pw.length < 6) return json({ ok: false, error: "Пароль должен быть не короче 6 символов." }, 400);
            const u = { id: "u-" + rand(), name, position, role: "employee", level: full(me) && body.level === "full" ? "full" : "limited", perms: {}, login, pass: await hash(pw), color: COLORS[list.length % COLORS.length] };
      list.push(u);
      await put("users", list);
      return json({ ok: true, user: pub(u) });
    }
    const u = list.find((x) => x.id === id);
    if (!u) return json({ ok: false, error: "Сотрудник не найден." }, 404);
    if (m === "DELETE") {
      if (u.role === "director" || u.id === me.id || !canEdit(me, u)) return json({ ok: false, error: "Этот аккаунт удалить нельзя." }, 400);
      await put("users", list.filter((x) => x.id !== id));
      return json({ ok: true });
    }
    if (m === "PUT" && !path.endsWith("/password")) {
      if (!canEdit(me, u)) return json({ ok: false, error: "Нет доступа к этому аккаунту." }, 403);
      let creds = false;
      if (body.name !== undefined) { const v = String(body.name).trim(); if (v.length < 2) return json({ ok: false, error: "Укажите имя сотрудника." }, 400); u.name = v; }
      if (body.position !== undefined) { const v = String(body.position).trim(); if (v.length < 2) return json({ ok: false, error: "Укажите должность." }, 400); u.position = v; }
      if (body.login !== undefined) { const l = String(body.login).trim().toLowerCase(); if (l !== u.login) { const le = checkLogin(l, list, u.id); if (le) return json({ ok: false, error: le }, 400); u.login = l; creds = true; } }
      if (body.password) { if (String(body.password).length < 6) return json({ ok: false, error: "Пароль должен быть не короче 6 символов." }, 400); u.pass = await hash(String(body.password)); creds = true; }
      if (body.level !== undefined || body.perms !== undefined) {
        if (!full(me) || u.role === "director" || u.id === me.id) return json({ ok: false, error: "Менять права этого аккаунта нельзя." }, 403);
        u.level = body.level === "full" ? "full" : "limited";
        const pr = body.perms || {};
        u.perms = u.level === "full" ? {} : { tasks: !!pr.tasks, staff: !!pr.staff, content: !!pr.content };
      }
      if (creds) u.tv = (u.tv || 0) + 1;
      await put("users", list);
      const extra = creds && u.id === me.id ? { token: await sign({ uid: u.id, v: u.tv || 0, exp: tok.exp }) } : {};
      return json({ ok: true, user: pub(u), ...extra });
    }
    if (m === "PUT" && path.endsWith("/password")) {
      if (!canEdit(me, u)) return json({ ok: false, error: "Нет доступа к этому аккаунту." }, 403);
      const pw = String(body.password || "");
      if (pw.length < 6) return json({ ok: false, error: "Пароль должен быть не короче 6 символов." }, 400);
      u.pass = await hash(pw);
      u.tv = (u.tv || 0) + 1;
      await put("users", list);
      return json({ ok: true });
    }
  }
  return json({ error: "Не найдено." }, 404);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (!env("SUPABASE_URL") || !env("SUPABASE_SERVICE_ROLE_KEY")) return json({ error: "Сервер не настроен." }, 500);
  try { return await handle(req); } catch (e) { return json({ error: "Ошибка сервера. Попробуйте ещё раз." }, 500); }
});
