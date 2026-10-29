/* ИЗГИ — связь с сервером. Держит локальную копию данных (задачи, сотрудники, фото, контент)
   и синхронизирует её с /api. Должен подключаться раньше staff-auth.js. */
(function () {
  const API = window.IZGI_API || '/api';
  const SK = 'izgi.session.v2';
  const K = { users: 'izgi.staff.users.v1', tasks: 'izgi.tasks.v1', av: 'izgi.avatars.v1', content: 'izgi.content.v1' };
  const raw = Storage.prototype.setItem;
  const sess = () => { try { return JSON.parse(localStorage.getItem(SK) || sessionStorage.getItem(SK) || 'null'); } catch (e) { return null; } };
  const keep = (o) => { try { localStorage.removeItem(SK); sessionStorage.removeItem(SK); (o.persist ? localStorage : sessionStorage).setItem(SK, JSON.stringify(o)); } catch (e) { /* noop */ } };
  const token = () => (sess() || {}).token || '';
  const meNow = () => { const s = sess(); if (!s) return null; try { return JSON.parse(localStorage.getItem(K.users) || '[]').find((u) => u.id === s.user.id) || s.user; } catch (e) { return s.user; } };
  const canContent = () => { const u = meNow(); return !!u && (u.role === 'director' || u.level === 'full' || !!(u.perms && u.perms.content)); };
  let lastAv = {}, pending = 0;
  const timers = {};

  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99;max-width:90vw;padding:12px 20px;border-radius:14px;background:#b42318;color:#fff;font:600 .9rem Montserrat,sans-serif';
    document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
  }
  function req(method, path, body) {
    const x = new XMLHttpRequest();
    try {
      x.open(method, API + path, false);
      x.setRequestHeader('content-type', 'application/json');
      if (token()) x.setRequestHeader('authorization', 'Bearer ' + token());
      x.send(body ? JSON.stringify(body) : null);
    } catch (e) { return { status: 0, data: { error: 'Нет связи с сервером.' } }; }
    let data = {}; try { data = JSON.parse(x.responseText); } catch (e) { /* не JSON */ }
    if (!x.status || (x.status === 404 && !data.error)) data = { error: 'Сервер недоступен. Откройте сайт на Netlify или через «netlify dev».' };
    return { status: x.status, data };
  }
  function clear() {
    try { sessionStorage.removeItem(SK); localStorage.removeItem(SK); Object.values(K).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* noop */ }
  }
  function apply(st, notify) {
    const set = (k, v) => {
      const s = JSON.stringify(v);
      if (localStorage.getItem(k) === s) return;
      raw.call(localStorage, k, s);
      if (notify) dispatchEvent(new StorageEvent('storage', { key: k, newValue: s }));
    };
    set(K.users, st.users || []); set(K.tasks, st.tasks || []); set(K.av, st.avatars || {});
    if (st.content) set(K.content, st.content);
    lastAv = st.avatars || {};
  }
  function boot() {
    if (!token()) return false;
    const r = req('GET', '/state');
    if (r.status === 401) { clear(); return false; }
    if (r.status !== 200) return false;
    apply(r.data); return true;
  }
  function send(method, path, body) {
    pending++;
    return fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token() }, body: JSON.stringify(body) })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (r.status === 401) { clear(); location.replace('staff.html'); return; }
        if (!r.ok) { toast(d.error || 'Не удалось сохранить изменения.'); boot(); }
        else if (path === '/tasks' && d.tasks) apply({ users: JSON.parse(localStorage.getItem(K.users) || '[]'), tasks: d.tasks, avatars: JSON.parse(localStorage.getItem(K.av) || '{}') }, true);
      })
      .catch(() => toast('Нет связи с сервером — изменения не сохранены.'))
      .finally(() => { pending--; });
  }
  const later = (n, fn) => { clearTimeout(timers[n]); timers[n] = setTimeout(fn, 350); };

  Storage.prototype.setItem = function (k, v) {
    raw.call(this, k, v);
    if (this !== localStorage || !token()) return;
    if (k === K.tasks) later('t', () => send('PUT', '/tasks', { tasks: JSON.parse(v) }));
    else if (k === K.content && canContent()) later('c', () => send('PUT', '/content', { content: JSON.parse(v) }));
    else if (k === K.av) {
      const n = JSON.parse(v);
      Object.keys(Object.assign({}, lastAv, n)).forEach((id) => { if (n[id] !== lastAv[id]) send('PUT', '/avatars', { id, data: n[id] || null }); });
      lastAv = n;
    }
  };

  setInterval(() => {
    if (document.hidden || !token() || pending) return;
    fetch(API + '/state', { headers: { authorization: 'Bearer ' + token() } })
      .then((r) => (r.status === 401 ? (clear(), location.replace('staff.html'), null) : r.ok ? r.json() : null))
      .then((st) => { if (st && st.tasks && !pending) apply(st, true); }).catch(() => {});
  }, 15000);

  window.IzgiSync = { req, boot, clear, token, SK, session: sess, setSession: keep };
  function renew() {
    const s = sess();
    if (!s || !s.persist || s.exp - Date.now() > 15 * 864e5) return;
    const r = req('POST', '/refresh');
    if (r.status === 200) { s.token = r.data.token; s.exp = Date.now() + 30 * 864e5; keep(s); }
  }
  renew();
  boot();
})();
