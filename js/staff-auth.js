/* ИЗГИ — доступ сотрудников. Вход и аккаунты проверяет сервер (/api), пароли в браузере не хранятся. */
(function () {
  const USERS_KEY = 'izgi.staff.users.v1';
  const SESSION_KEY = 'izgi.session.v2';
  const ROLE = { director: 'Директор', employee: 'Сотрудник' };
  const S = window.IzgiSync;
  const emit = () => window.dispatchEvent(new CustomEvent('staffchange'));
  const users = () => { try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch (e) { return []; } };
  const api = { lastError: '' };

  function login(loginValue, passwordValue) {
    api.lastError = '';
    const r = S.req('POST', '/login', { login: loginValue, password: passwordValue });
    if (r.status !== 200) { api.lastError = r.data.error || ''; return null; }
    S.setSession({ token: r.data.token, user: r.data.user, exp: Date.now() + 8 * 3600e3 });
    S.boot();
    return r.data.user;
  }
  function logout() { S.clear(); }
  function current() {
    const s = S.session();
    if (!s || !s.token || !s.exp || s.exp < Date.now()) { logout(); return null; }
    return users().find((u) => u.id === s.user.id) || s.user;
  }
  const homeFor = (user) => (user && user.role === 'director' ? 'admin.html' : 'tasks.html');
  function requireRole(role) {
    const user = current();
    if (!user) {
      const page = (location.pathname.split('/').pop() || 'index.html') + (location.hash || '');
      location.replace('staff.html?next=' + encodeURIComponent(page));
      return null;
    }
    if ((role === 'director' && user.role !== 'director') || (role === 'employee' && user.role === 'director')) {
      location.replace(homeFor(user));
      return null;
    }
    return user;
  }
  function done(r, fallback) {
    if (r.status === 200 && r.data.ok) { S.boot(); emit(); return { ok: true, user: r.data.user }; }
    return { ok: false, error: r.data.error || fallback };
  }
  const addUser = (d) => done(S.req('POST', '/users', d), 'Не удалось создать аккаунт.');
  const removeUser = (id) => done(S.req('DELETE', '/users/' + encodeURIComponent(id)), 'Не удалось удалить сотрудника.');
  const setPassword = (id, password) => done(S.req('PUT', '/users/' + encodeURIComponent(id) + '/password', { password }), 'Не удалось сохранить пароль.');
  const roleLabel = (role) => ROLE[role] || ROLE.employee;

  try { addEventListener('storage', (e) => { if (e.key === USERS_KEY) emit(); }); } catch (e) { /* noop */ }
  Object.assign(api, { USERS_KEY, SESSION_KEY, users, login, logout, current, homeFor, requireRole, addUser, removeUser, setPassword, roleLabel });
  window.StaffAuth = api;
})();
