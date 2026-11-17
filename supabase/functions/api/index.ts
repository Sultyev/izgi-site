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

/* ---------- рейтинг сотрудников ---------- */
const TZ = "+06:00";
const GRACE = { low: 5, normal: 3, high: 2 };
const REMIND = [300, 120, 60, 30];
const STATUS_ALL = [...STATUS, "cancelled"];
const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const dueMs = (v) => { if (!v) return NaN; const s = String(v); return Date.parse(s.length > 10 ? s.slice(0, 16) + ":00" + TZ : s + "T23:59:00" + TZ); };
const graceMs = (p) => (GRACE[p] || 3) * 3600e3;
const r1 = (x) => Math.round(x * 10) / 10;
const monthOf = (ms) => new Date(ms + 6 * 3600e3).toISOString().slice(0, 7);
const addMonth = (k, n) => { let [y, m] = k.split("-").map(Number); m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return y + "-" + String(m).padStart(2, "0"); };
const isClosed = (t) => t.status === "done" || t.status === "cancelled";
const pts = (x) => { const a = Math.abs(x), i = Number.isInteger(a), t = a % 100, o = a % 10; return (i ? a : a.toFixed(1)) + " " + (!i ? "балла" : t > 10 && t < 20 ? "баллов" : o === 1 ? "балл" : o > 1 && o < 5 ? "балла" : "баллов"); };
const fmtLeft = (min) => { const m = Math.max(1, Math.round(min)); return m >= 60 ? Math.floor(m / 60) + " ч" + (m % 60 ? " " + (m % 60) + " мин" : "") : m + " мин"; };
const fmtDue = (v) => { const s = String(v || ""); const d = s.slice(8, 10) + "." + s.slice(5, 7); return s.length > 10 ? d + " " + s.slice(11, 16) : d; };
const quote = (t) => "«" + String(t.title || "Задача").slice(0, 60) + "»";
function rate(R, uid, delta, cap, why, taskId, notes) {
  const e = (R.users[uid] = R.users[uid] || { score: 10, log: [] });
  const before = e.score;
  let next = r1(before + delta);
  if (delta > 0 && cap != null) next = Math.min(next, Math.max(cap, before));
  next = Math.max(0, next);
  const diff = r1(next - before);
  if (!diff) return;
  e.score = next;
  e.log.unshift({ t: Date.now(), d: diff, s: next, why, task: taskId || "" });
  e.log = e.log.slice(0, 100);
  notes.push({ uid, title: diff > 0 ? "Начислено " + pts(diff) : "Списано " + pts(diff), body: why + ". Рейтинг: " + next.toFixed(1) });
}
function scoreSubmit(t, R, notes, now) {
  if (t.scored || !t.assigneeId) return;
  t.submittedAt = t.submittedAt || now;
  const due = dueMs(t.due);
  if (isNaN(due)) { t.scored = "none"; return; }
  if (now <= due) { t.scored = "ontime"; rate(R, t.assigneeId, 0.1, 10, "Выполнено вовремя: " + quote(t), t.id, notes); }
  else { t.scored = "late"; rate(R, t.assigneeId, -0.5, null, "Просрочка: " + quote(t), t.id, notes); }
}
let lastTick = 0;
async function tick(force) {
  const now = Date.now(), notes = [];
  if (!force && now - lastTick < 20000) return notes;
  lastTick = now;
  const tasks = await get("tasks", []);
  const R = await get("ratings", { users: {}, meta: {} });
  R.users = R.users || {}; R.meta = R.meta || {};
  const rbefore = JSON.stringify(R);
  let dt = false;
  const cur = monthOf(now);
  if (!R.meta.closed) R.meta.closed = addMonth(cur, -1);
  for (let i = 0; i < 24 && addMonth(R.meta.closed, 1) < cur; i++) {
    const mk = addMonth(R.meta.closed, 1), by = {};
    for (const t of tasks) { const d = dueMs(t.due); if (t.assigneeId && !isNaN(d) && monthOf(d) === mk) (by[t.assigneeId] = by[t.assigneeId] || []).push(t); }
    for (const uid of Object.keys(by)) if (by[uid].every((t) => t.scored === "ontime")) rate(R, uid, 1, 11, "Месяц без нарушений (" + MONTHS[Number(mk.slice(5)) - 1] + " " + mk.slice(0, 4) + ")", "", notes);
    R.meta.closed = mk;
  }
  for (const t of tasks) {
    if (!t.assigneeId || isClosed(t)) continue;
    const due = dueMs(t.due);
    if (isNaN(due)) continue;
    if (t.remindDue !== due) { const win = due - (Date.parse(t.createdAt) || now); t.reminded = REMIND.filter((m) => m * 60000 >= win); t.remindDue = due; dt = true; }
    if ((t.status === "new" || t.status === "progress") && !t.scored) {
      if (now > due + graceMs(t.priority)) {
        t.status = "cancelled"; t.cancelledAt = now; t.scored = "cancelled"; dt = true;
        rate(R, t.assigneeId, -1, null, "Задача отменена: не выполнена в срок " + quote(t), t.id, notes);
        continue;
      }
      const leftMin = (due - now) / 60000;
      if (leftMin > 0) {
        const fresh = REMIND.filter((m) => leftMin <= m && !(t.reminded || []).includes(m));
        if (fresh.length) {
          t.reminded = [...(t.reminded || []), ...fresh]; dt = true;
          notes.push({ uid: t.assigneeId, title: "Дедлайн через " + fmtLeft(leftMin), body: quote(t) + " · до " + fmtDue(t.due), url: "tasks.html", tag: "dl-" + t.id + "-" + Math.min(...fresh) });
        }
      }
    }
  }
  if (dt) await put("tasks", tasks);
  if (JSON.stringify(R) !== rbefore) await put("ratings", R);
  return notes;
}
function flush(notes) {
  if (!notes.length) return null;
  const job = Promise.all(notes.map((n) => notify(n.uid, { title: n.title, body: n.body, url: n.url || "tasks.html#rating", tag: n.tag || "rt-" + Math.random().toString(36).slice(2, 8) })));
  if (globalThis.EdgeRuntime && EdgeRuntime.waitUntil) { EdgeRuntime.waitUntil(job); return null; }
  return job;
}
function ratingView(R, me, mgr, list) {
  const out = {};
  for (const [id, e] of Object.entries(R.users || {})) if (mgr || id === me.id) out[id] = { score: e.score, log: e.log.slice(0, 30) };
  for (const u of list) if (u.role === "employee" && (mgr || u.id === me.id) && !out[u.id]) out[u.id] = { score: 10, log: [] };
  return out;
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
  if (path === "/content" && m === "GET") return json({ ...(await get("content", {})), settings: await get("settings", { staffLink: true }) }, 200, { "cache-control": "public, max-age=15" });
  if (path === "/push/key" && m === "GET") return json({ key: (await vapid()).publicKey }, 200, { "cache-control": "public, max-age=300" });
  if (!env("AUTH_SECRET")) return json({ error: "Сервер не настроен: задайте секрет AUTH_SECRET." }, 500);
  const body = m === "GET" ? {} : await req.json().catch(() => ({}));
  const list = await loadUsers();
  if (!list.length) return json({ error: "Сервер не настроен: задайте секреты DIRECTOR_LOGIN и DIRECTOR_PASSWORD." }, 500);

  if ((path === "/cron" || path === "/") && (m === "GET" || m === "POST")) {
    const key = env("CRON_SECRET");
    if (key && req.headers.get("x-cron-secret") !== key && url.searchParams.get("key") !== key) return json({ error: "Нет доступа." }, 403);
    const notes = await tick(true);
    const job = flush(notes);
    if (job) await job;
    return json({ ok: true, notes: notes.length });
  }
  if (path === "/requests" && m === "POST") {
    if (body.website) return json({ ok: true });
    const name = String(body.name || "").trim().slice(0, 80), phone = String(body.phone || "").trim().slice(0, 30);
    const grade = String(body.grade || "").trim().slice(0, 20), lang = String(body.lang || "").slice(0, 5);
    if (name.length < 2) return json({ ok: false, error: "Укажите имя." }, 400);
    if (!/^[+\d][\d\s()\-]{6,24}$/.test(phone) || phone.replace(/\D/g, "").length < 9) return json({ ok: false, error: "Проверьте номер телефона." }, 400);
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "?", now = Date.now();
    const rl = await get("rl", {});
    for (const k of Object.keys(rl)) { rl[k] = rl[k].filter((t) => now - t < 3600e3); if (!rl[k].length) delete rl[k]; }
    if ((rl[ip] || []).length >= 5) return json({ ok: false, error: "Слишком много заявок с вашего адреса. Позвоните нам или попробуйте позже." }, 429);
    rl[ip] = [...(rl[ip] || []), now];
    await put("rl", rl);
    const reqs = await get("requests", []);
    const item = { id: "r-" + now.toString(36) + rand(), createdAt: now, name, phone, grade, lang, status: "pending", note: "", handledBy: "", handledAt: 0 };
    reqs.unshift(item);
    await put("requests", reqs.slice(0, 2000));
    const job = Promise.all(list.filter((u) => can(u, "requests")).map((u) => notify(u.id, { title: "Новая заявка", body: name + (grade ? " · " + grade + " класс" : ""), url: "admin.html#requests", tag: "req-" + item.id })));
    if (globalThis.EdgeRuntime && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(job); else await job;
    return json({ ok: true });
  }
  if (path === "/login" && m === "POST") {
    const u = list.find((x) => x.login === String(body.login || "").trim().toLowerCase());
    if (!u || !(await verify(String(body.password || ""), u.pass))) { await new Promise((r) => setTimeout(r, 700)); return json({ error: "Неверный логин или пароль." }, 401); }
    const rm = body.remember !== false;
    const exp = Date.now() + (rm ? 30 * 864e5 : 12 * 3600e3);
    return json({ token: await sign({ uid: u.id, v: u.tv || 0, rm: rm ? 1 : 0, exp }), exp, user: pub(u) });
  }
  const tok = await unsign((req.headers.get("authorization") || "").replace(/^Bearer /, ""));
  const me0 = tok && list.find((x) => x.id === tok.uid);
  const me = me0 && (tok.v || 0) === (me0.tv || 0) ? me0 : null;
  if (!me) return json({ error: "Нужно войти." }, 401);
  if (path === "/refresh" && m === "POST") {
    const exp = Date.now() + (tok.rm ? 30 * 864e5 : 12 * 3600e3);
    return json({ token: await sign({ uid: me.id, v: me.tv || 0, rm: tok.rm || 0, exp }), exp });
  }
  const dir = can(me, "tasks");
  const mine = (t) => dir || t.assigneeId === me.id;

  if (path === "/state" && m === "GET") {
    const pre = flush(await tick(false));
    if (pre) await pre;
    const out = { users: list.map(pub), tasks: (await get("tasks", [])).filter(mine), avatars: await get("avatars", {}), ratings: ratingView(await get("ratings", { users: {}, meta: {} }), me, dir, list) };
    if (can(me, "content")) out.content = await get("content", {});
    return json(out);
  }
  if (path === "/tasks" && m === "PUT") {
    const notes = [...(await tick(true))];
    const inc = Array.isArray(body.tasks) ? body.tasks : [];
    let all = await get("tasks", []);
    const R = await get("ratings", { users: {}, meta: {} });
    R.users = R.users || {}; R.meta = R.meta || {};
    const rbefore = JSON.stringify(R);
    const old = new Map(all.map((t) => [t.id, t]));
    const SRV = ["scored", "submittedAt", "cancelledAt", "reminded", "remindDue"];
    const now = Date.now();
    let fresh = [];
    if (dir) {
      all = inc.map((t) => {
        const o = old.get(t.id), out = { ...t };
        for (const k of SRV) delete out[k];
        if (o) {
          for (const k of SRV) if (o[k] !== undefined) out[k] = o[k];
          if (o.status === "cancelled" && out.status !== "cancelled" && !t.reopen) out.status = "cancelled";
        }
        if (!STATUS_ALL.includes(out.status)) out.status = o ? o.status : "new";
        if (out.status === "cancelled" && (!o || o.status !== "cancelled")) { out.cancelledAt = out.cancelledAt || now; out.scored = out.scored || "manual"; }
        delete out.reopen;
        return out;
      });
      fresh = all.filter((t) => t.assigneeId && t.assigneeId !== me.id && !isClosed(t) && (!old.has(t.id) || old.get(t.id).assigneeId !== t.assigneeId));
    } else {
      const byId = new Map(inc.map((t) => [t.id, t]));
      all = all.map((t) => { const n = byId.get(t.id); if (!n || t.assigneeId !== me.id || t.status === "cancelled" || !STATUS.includes(n.status)) return t; return { ...t, status: n.status, startedAt: n.startedAt || null, completedAt: n.completedAt || null }; });
    }
    for (const t of all) {
      const o = old.get(t.id);
      if (o && (o.status === "new" || o.status === "progress") && (t.status === "review" || t.status === "done")) scoreSubmit(t, R, notes, now);
    }
    await put("tasks", all);
    if (JSON.stringify(R) !== rbefore) await put("ratings", R);
    const job = Promise.all([
      ...fresh.map((t) => notify(t.assigneeId, { title: "Новая задача", body: String(t.title || "Задача") + (t.due ? " · срок: " + fmtDue(t.due) : ""), url: "tasks.html", tag: "task-" + t.id })),
      flush(notes) || Promise.resolve()
    ]);
    if (globalThis.EdgeRuntime && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(job); else await job;
    return json({ tasks: all.filter(mine), ratings: ratingView(R, me, dir, list) });
  }
  if (path === "/settings" && m === "PUT") {
    if (!full(me)) return json({ error: "Менять настройки сайта могут директор и сотрудники с полным доступом." }, 403);
    const next = { ...(await get("settings", { staffLink: true })) };
    if (typeof body.staffLink === "boolean") next.staffLink = body.staffLink;
    await put("settings", next);
    return json({ ok: true, settings: next });
  }
  if (path === "/requests" && m === "GET") {
    if (!can(me, "requests")) return json({ error: "Нет доступа." }, 403);
    return json({ requests: await get("requests", []) });
  }
  if (path.startsWith("/requests/") && (m === "PUT" || m === "DELETE")) {
    if (!can(me, "requests")) return json({ error: "Нет доступа." }, 403);
    const rid = path.split("/")[2];
    const reqs = await get("requests", []);
    const r = reqs.find((x) => x.id === rid);
    if (!r) return json({ error: "Заявка не найдена." }, 404);
    if (m === "DELETE") {
      if (!full(me)) return json({ error: "Удалять заявки может только директор или сотрудник с полным доступом." }, 403);
      await put("requests", reqs.filter((x) => x.id !== rid));
      return json({ ok: true });
    }
    if (body.status !== undefined) {
      if (!["pending", "accepted", "rejected"].includes(body.status)) return json({ error: "Неверный статус." }, 400);
      r.status = body.status;
      r.handledBy = body.status === "pending" ? "" : me.name;
      r.handledAt = body.status === "pending" ? 0 : Date.now();
    }
    if (body.note !== undefined) r.note = String(body.note).slice(0, 500);
    await put("requests", reqs);
    return json({ ok: true, request: r });
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
  if (path === "/push/status" && m === "POST") {
    const mySubs = (await get("push", {}))[me.id] || [];
    return json({ registered: mySubs.some((x) => x.endpoint === body.endpoint), count: mySubs.length });
  }
  if (path === "/push/test" && m === "POST") {
    const all = await get("push", {});
    const subs = all[me.id] || [];
    if (!subs.length) return json({ ok: false, count: 0, error: "На сервере нет подписанных устройств. Нажмите «Включить уведомления»." });
    let wp;
    try { wp = (await import("npm:web-push@3.6.7")).default; } catch (e) { return json({ ok: false, count: subs.length, error: "Не удалось загрузить библиотеку отправки: " + String(e).slice(0, 120) }); }
    const v = await vapid();
    wp.setVapidDetails(env("VAPID_SUBJECT") || "mailto:info@izgi.kg", v.publicKey, v.privateKey);
    const res = [], dead = [];
    await Promise.all(subs.map(async (sub) => {
      try { await wp.sendNotification(sub, JSON.stringify({ title: "Проверка уведомлений", body: "Если вы видите это сообщение, уведомления работают.", url: "tasks.html", tag: "test" }), { TTL: 600, urgency: "high", timeout: 6000 }); res.push({ ok: true }); }
      catch (e) { const code = (e && e.statusCode) || 0; if (code === 404 || code === 410) dead.push(sub.endpoint); res.push({ ok: false, status: code, msg: String((e && (e.body || e.message)) || e).slice(0, 160) }); }
    }));
    if (dead.length) { all[me.id] = subs.filter((x) => !dead.includes(x.endpoint)); await put("push", all); }
    return json({ ok: res.some((r) => r.ok), count: subs.length, sent: res.filter((r) => r.ok).length, dead: dead.length, failed: res.filter((r) => !r.ok) });
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
        u.perms = u.level === "full" ? {} : { tasks: !!pr.tasks, staff: !!pr.staff, content: !!pr.content, requests: !!pr.requests };
      }
      if (creds) u.tv = (u.tv || 0) + 1;
      await put("users", list);
      const extra = creds && u.id === me.id ? { token: await sign({ uid: u.id, v: u.tv || 0, rm: tok.rm || 0, exp: tok.exp }) } : {};
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
