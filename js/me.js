/* ИЗГИ — на публичных страницах: если сотрудник вошёл, в углу шапки показываются его аватар и ник,
   а в меню — быстрый переход в кабинет/панель и выход. Сетевых запросов при открытии страницы нет. */
(function () {
  const SK = 'izgi.session.v2';
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SK) || sessionStorage.getItem(SK) || 'null'); } catch (e) { /* пусто */ }
  if (!s || !s.token || !s.exp || s.exp < Date.now() || !s.user) return;
  const top = document.querySelector('.topright');
  if (!top) return;

  const API = window.IZGI_API || '/api';
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
  const u = (read('izgi.staff.users.v1', []).find((x) => x.id === s.user.id)) || s.user;
  const full = u.role === 'director' || u.level === 'full';
  const admin = full || ['tasks', 'staff', 'content'].some((p) => u.perms && u.perms[p]);
  const home = u.role === 'director' ? 'admin.html' : 'tasks.html';
  const initials = (n) => String(n || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';

  const T = {
    ru: { tasks: 'Мои задачи', panel: 'Панель управления', out: 'Выйти', cab: 'Мой кабинет', dir: 'Директор', full: 'Полный доступ', ext: 'Расширенные права', staff: 'Сотрудник' },
    kg: { tasks: 'Менин тапшырмаларым', panel: 'Башкаруу панели', out: 'Чыгуу', cab: 'Менин кабинетим', dir: 'Директор', full: 'Толук мүмкүнчүлүк', ext: 'Кеңейтилген укуктар', staff: 'Кызматкер' },
    en: { tasks: 'My tasks', panel: 'Control panel', out: 'Sign out', cab: 'My account', dir: 'Director', full: 'Full access', ext: 'Extended rights', staff: 'Staff' },
    tr: { tasks: 'Görevlerim', panel: 'Yönetim paneli', out: 'Çıkış', cab: 'Hesabım', dir: 'Müdür', full: 'Tam erişim', ext: 'Genişletilmiş yetki', staff: 'Personel' }
  };
  const lang = () => { const l = (window.I18N && window.I18N.lang) || document.documentElement.lang || 'ru'; return T[l] ? l : 'ru'; };
  const L = (k) => T[lang()][k];

  const box = document.createElement('div');
  box.className = 'me';
  const chip = document.createElement('button');
  chip.type = 'button'; chip.className = 'me-chip'; chip.setAttribute('aria-haspopup', 'true'); chip.setAttribute('aria-expanded', 'false');
  const ava = document.createElement('span');
  ava.className = 'me-ava'; ava.textContent = initials(u.name);
  if (u.color) ava.style.background = 'linear-gradient(135deg,#01a09c,' + u.color + ')';
  const photo = read('izgi.avatars.v1', {})[u.id];
  if (photo) { ava.style.background = 'url("' + photo + '") center/cover'; ava.classList.add('has-photo'); }
  const nick = document.createElement('span');
  nick.className = 'me-nick'; nick.textContent = '@' + (u.login || u.name);
  chip.append(ava, nick);

  const menu = document.createElement('div');
  menu.className = 'me-menu'; menu.hidden = true;
  const head = document.createElement('div');
  head.className = 'me-head';
  const nm = document.createElement('strong'); nm.textContent = u.name;
  const pos = document.createElement('span'); pos.textContent = u.position || '';
  const lvl = document.createElement('em');
  head.append(nm, pos, lvl);
  const aTasks = document.createElement('a'); aTasks.href = 'tasks.html';
  const aPanel = document.createElement('a'); aPanel.href = 'admin.html';
  const out = document.createElement('button'); out.type = 'button';
  menu.append(head);
  if (u.role !== 'director') menu.append(aTasks);
  if (admin) menu.append(aPanel);
  menu.append(out);
  box.append(chip, menu);
  top.appendChild(box);

  /* на узких экранах переключатель языков переезжает в меню профиля, чтобы шапка не ломалась */
  const langs = top.querySelector('.langs');
  if (langs) {
    const mq = window.matchMedia('(max-width:520px)');
    const place = () => {
      if (mq.matches) { langs.classList.add('in-menu'); menu.insertBefore(langs, head.nextSibling); }
      else { langs.classList.remove('in-menu'); top.insertBefore(langs, top.firstChild); }
    };
    place();
    if (mq.addEventListener) mq.addEventListener('change', place); else mq.addListener(place);
  }

  function labels() {
    lvl.textContent = u.role === 'director' ? L('dir') : full ? L('full') : admin ? L('ext') : L('staff');
    aTasks.textContent = L('tasks'); aPanel.textContent = L('panel'); out.textContent = L('out');
    const f = document.querySelector('.adminlink');
    if (f) { f.removeAttribute('data-i18n'); f.href = home; f.textContent = L('cab'); }
  }
  labels();
  window.addEventListener('langchange', labels);

  const close = () => { menu.hidden = true; chip.setAttribute('aria-expanded', 'false'); };
  chip.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; chip.setAttribute('aria-expanded', String(!menu.hidden)); });
  document.addEventListener('click', (e) => { if (!box.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  out.addEventListener('click', () => {
    try {
      const ep = localStorage.getItem('izgi.push.endpoint');
      if (ep) fetch(API + '/push/unsubscribe', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + s.token }, body: JSON.stringify({ endpoint: ep }), keepalive: true });
    } catch (e) { /* noop */ }
    ['izgi.session.v2', 'izgi.staff.users.v1', 'izgi.tasks.v1', 'izgi.avatars.v1', 'izgi.content.v1', 'izgi.push.endpoint', 'izgi.staff.seen'].forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* noop */ } });
    try { sessionStorage.removeItem(SK); } catch (e) { /* noop */ }
    location.reload();
  });
})();
