/* ИЗГИ — кнопка «Для сотрудников» в подвале: полный доступ может скрыть её от гостей (вкладка «Настройки»).
   Вошедшим сотрудникам её место занимает «Мой кабинет» (js/me.js). Вход по прямой ссылке staff.html остаётся. */
(function () {
  const links = () => document.querySelectorAll('.adminlink');
  function loggedIn() {
    try { const s = JSON.parse(localStorage.getItem('izgi.session.v2') || sessionStorage.getItem('izgi.session.v2') || 'null'); return !!(s && s.token && s.exp > Date.now()); } catch (e) { return false; }
  }
  function apply(d) {
    const hide = !!(d && d.settings && d.settings.staffLink === false) && !loggedIn();
    links().forEach((a) => { a.hidden = hide; a.style.display = hide ? 'none' : ''; });
  }
  apply(window.IZGI_DATA);
  window.addEventListener('izgi:content', (e) => apply(e.detail));
})();
