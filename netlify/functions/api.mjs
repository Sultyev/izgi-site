/* ИЗГИ — серверная часть: вход, сотрудники, задачи, фото и контент сайта.
   Данные лежат в базе Supabase (таблица kv). Пароли хранятся только как scrypt-хэш. */
import { createHmac, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

export const config = { path: ["/api/*", "/js/content-data.js"] };

const BASE = () => String(process.env.SUPABASE_URL || "").replace(/\/$/, "") + "/rest/v1/kv";
const HEAD = () => {
  const k = String(process.env.SUPABASE_SERVICE_KEY || "").trim();
  return { apikey: k, ...(k.startsWith("eyJ") ? { authorization: "Bearer " + k } : {}), "content-type": "application/json" };
};
const get = async (k, d) => {
  const r = await fetch(BASE() + "?select=value&key=eq." + encodeURIComponent(k), { headers: HEAD() });
  if (!r.ok) throw new Error("db " + r.status);
  const rows = await r.json();
  return rows.length ? rows[0].value : d;
};
const put = async (k, v) => {
  const r = await fetch(BASE(), { method: "POST", headers: { ...HEAD(), prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: k, value: v }) });
  if (!r.ok) throw new Error("db " + r.status);
};
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const hash = (pw, salt = randomBytes(16).toString("hex")) => salt + ":" + scryptSync(pw, salt, 32).toString("hex");
const verify = (pw, h) => { const [salt, key] = String(h).split(":"); const a = Buffer.from(key || "", "hex"), b = scryptSync(pw, salt || "", 32); return a.length === b.length && timingSafeEqual(a, b); };
const mac = (b) => createHmac("sha256", process.env.AUTH_SECRET).update(b).digest("base64url");
const sign = (p) => { const b = Buffer.from(JSON.stringify(p)).toString("base64url"); return b + "." + mac(b); };
const unsign = (t) => { const [b, s] = String(t || "").split("."); if (!b || !s || s.length !== mac(b).length || !timingSafeEqual(Buffer.from(s), Buffer.from(mac(b)))) return null; try { const p = JSON.parse(Buffer.from(b, "base64url").toString()); return p.exp > Date.now() ? p : null; } catch { return null; } };
const pub = (u) => ({ id: u.id, name: u.name, position: u.position, role: u.role, login: u.login, color: u.color });
const STATUS = ["new", "progress", "review", "done"];
const COLORS = ["#01a09c", "#113fd2", "#0d2e7b", "#7fdcd3", "#00a79d"];

async function loadUsers() {
  let list = await get("users", null);
  if (!list) {
    const l = process.env.DIRECTOR_LOGIN, p = process.env.DIRECTOR_PASSWORD;
    if (!l || !p) return [];
    list = [{ id: "u-director", name: process.env.DIRECTOR_NAME || "Директор школы", position: "Директор", role: "director", login: l.trim().toLowerCase(), pass: hash(p), color: "#113fd2" }];
    await put("users", list);
  }
  return list;
}

async function handle(req) {
  const url = new URL(req.url);
  if (url.pathname.endsWith("/content-data.js")) {
    const c = await get("content", {});
    return new Response("window.IZGI_DATA=" + JSON.stringify(c).replace(/</g, "\\u003c") + ";", { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=15" } });
  }
  if (!process.env.AUTH_SECRET) return json({ error: "Сервер не настроен: задайте переменную AUTH_SECRET." }, 500);
  const path = url.pathname.replace(/^.*?\/api(?=\/|$)/, "") || "/";
  const m = req.method;
  const body = m === "GET" ? {} : await req.json().catch(() => ({}));
  const list = await loadUsers();
  if (!list.length) return json({ error: "Сервер не настроен: задайте DIRECTOR_LOGIN и DIRECTOR_PASSWORD." }, 500);

  if (path === "/login" && m === "POST") {
    const u = list.find((x) => x.login === String(body.login || "").trim().toLowerCase());
    if (!u || !verify(String(body.password || ""), u.pass)) { await new Promise((r) => setTimeout(r, 700)); return json({ error: "Неверный логин или пароль." }, 401); }
    return json({ token: sign({ uid: u.id, exp: Date.now() + 8 * 3600e3 }), user: pub(u) });
  }

  const tok = unsign((req.headers.get("authorization") || "").replace(/^Bearer /, ""));
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
      const u = { id: "u-" + randomBytes(5).toString("hex"), name, position, role: "employee", login, pass: hash(pw), color: COLORS[list.length % COLORS.length] };
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
      u.pass = hash(pw);
      await put("users", list);
      return json({ ok: true });
    }
  }
  return json({ error: "Не найдено." }, 404);
}

export default async (req) => {
  const isJs = new URL(req.url).pathname.endsWith("/content-data.js");
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return isJs ? new Response("window.IZGI_DATA={};", { headers: { "content-type": "application/javascript" } }) : json({ error: "Сервер не настроен: задайте SUPABASE_URL и SUPABASE_SERVICE_KEY." }, 500);
  }
  try { return await handle(req); } catch (e) {
    return isJs ? new Response("window.IZGI_DATA={};", { headers: { "content-type": "application/javascript" } }) : json({ error: "Ошибка базы данных. Попробуйте ещё раз." }, 500);
  }
};
