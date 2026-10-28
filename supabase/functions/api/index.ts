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
const pub = (u) => ({ id: u.id, name: u.name, position: u.position, role: u.role, login: u.login, color: u.color });
const STATUS = ["new", "progress", "review", "done"];
const COLORS = ["#01a09c", "#113fd2", "#0d2e7b", "#7fdcd3", "#00a79d"];

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
  if (!env("AUTH_SECRET")) return json({ error: "Сервер не настроен: задайте секрет AUTH_SECRET." }, 500);
  const body = m === "GET" ? {} : await req.json().catch(() => ({}));
  const list = await loadUsers();
  if (!list.length) return json({ error: "Сервер не настроен: задайте секреты DIRECTOR_LOGIN и DIRECTOR_PASSWORD." }, 500);

  if (path === "/login" && m === "POST") {
    const u = list.find((x) => x.login === String(body.login || "").trim().toLowerCase());
    if (!u || !(await verify(String(body.password || ""), u.pass))) { await new Promise((r) => setTimeout(r, 700)); return json({ error: "Неверный логин или пароль." }, 401); }
    return json({ token: await sign({ uid: u.id, exp: Date.now() + 8 * 3600e3 }), user: pub(u) });
  }
  const tok = await unsign((req.headers.get("authorization") || "").replace(/^Bearer /, ""));
  const me = tok && list.find((x) => x.id === tok.uid);
  if (!me) return json({ error: "Нужно войти." }, 401);
  const dir = me.role === "director";
  const mine = (t) => dir || t.assigneeId === me.id;

  if (path === "/state" && m === "GET") {
    const out = { users: list.map(pub), tasks: (await get("tasks", [])).filter(mine), avatars: await get("avatars", {}) };
    if (dir) out.content = await get("content", {});
    return json(out);
  }
  if (path === "/tasks" && m === "PUT") {
    const inc = Array.isArray(body.tasks) ? body.tasks : [];
    let all = await get("tasks", []);
    if (dir) all = inc;
    else {
      const byId = new Map(inc.map((t) => [t.id, t]));
      all = all.map((t) => { const n = byId.get(t.id); return n && t.assigneeId === me.id && STATUS.includes(n.status) ? { ...t, status: n.status, startedAt: n.startedAt || null, completedAt: n.completedAt || null } : t; });
    }
    await put("tasks", all);
    return json({ tasks: all.filter(mine) });
  }
  if (path === "/avatars" && m === "PUT") {
    const id = String(body.id || "");
    if (!dir && id !== me.id) return json({ error: "Нет доступа." }, 403);
    const a = await get("avatars", {});
    if (body.data) {
      if (!/^data:image\/jpeg;base64,/.test(body.data) || body.data.length > 90000) return json({ error: "Фото слишком большое." }, 413);
      a[id] = body.data;
    } else delete a[id];
    await put("avatars", a);
    return json({ ok: true });
  }
  if (path === "/content" && m === "PUT") {
    if (!dir) return json({ error: "Нет доступа." }, 403);
    await put("content", body.content || {});
    return json({ ok: true });
  }
  if (path.startsWith("/users")) {
    if (!dir) return json({ ok: false, error: "Нет доступа." }, 403);
    const id = path.split("/")[2];
    if (m === "POST" && !id) {
      const name = String(body.name || "").trim(), position = String(body.position || "").trim(), login = String(body.login || "").trim().toLowerCase(), pw = String(body.password || "");
      if (name.length < 2) return json({ ok: false, error: "Укажите имя сотрудника." }, 400);
      if (position.length < 2) return json({ ok: false, error: "Укажите должность." }, 400);
      if (!/^[a-z0-9._-]{3,24}$/.test(login)) return json({ ok: false, error: "Логин: 3–24 символа, только латиница, цифры, точка, дефис или _." }, 400);
      if (pw.length < 6) return json({ ok: false, error: "Пароль должен быть не короче 6 символов." }, 400);
      if (list.some((x) => x.login === login)) return json({ ok: false, error: "Такой логин уже занят." }, 409);
      const u = { id: "u-" + rand(), name, position, role: "employee", login, pass: await hash(pw), color: COLORS[list.length % COLORS.length] };
      list.push(u);
      await put("users", list);
      return json({ ok: true, user: pub(u) });
    }
    const u = list.find((x) => x.id === id);
    if (!u) return json({ ok: false, error: "Сотрудник не найден." }, 404);
    if (m === "DELETE") {
      if (u.role === "director" || u.id === me.id) return json({ ok: false, error: "Этот аккаунт удалить нельзя." }, 400);
      await put("users", list.filter((x) => x.id !== id));
      return json({ ok: true });
    }
    if (m === "PUT" && path.endsWith("/password")) {
      const pw = String(body.password || "");
      if (pw.length < 6) return json({ ok: false, error: "Пароль должен быть не короче 6 символов." }, 400);
      u.pass = await hash(pw);
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
