/* ИЗГИ — вкладка «Настройки»: показывать ли гостям кнопку «Для сотрудников». Доступна директору и сотрудникам с полным доступом. */
(function () {
  const auth = window.StaffAuth, S = window.IzgiSync;
  if (!auth || !S) return;
  const me = auth.current();
  if (!me || !auth.isFull(me)) return;
  const API = window.IZGI_API || '/api', $ = (s) => document.querySelector(s);
  const box = $('#setStaffLink'), state = $('#setStaffState');
  if (!box) return;
  const hdr = () => ({ 'content-type': 'application/json', authorization: 'Bearer ' + S.token() });
  const toast = (t) => { const d = document.createElement('div'); d.className = 'ava-toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 3200); };
  const show = (on) => { box.checked = on; state.textContent = on ? 'Кнопка видна всем посетителям' : 'Кнопка скрыта от гостей'; };
  $('#setLoginUrl').textContent = new URL('staff.html', location.href).href;
  $('#setCopy').addEventListener('click', () => {
    const t = $('#setLoginUrl').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Ссылка скопирована'), () => toast('Выделите ссылку и скопируйте вручную'));
  });
  fetch(API + '/content?t=' + Date.now()).then((r) => r.json()).then((d) => show(!(d.settings && d.settings.staffLink === false))).catch(() => { state.textContent = 'Не удалось загрузить настройку'; });
  box.addEventListener('change', () => {
    const want = box.checked; box.disabled = true;
    fetch(API + '/settings', { method: 'PUT', headers: hdr(), body: JSON.stringify({ staffLink: want }) })
      .then((r) => r.json().then((d) => ({ r, d })))
      .then(({ r, d }) => { if (r.ok) { show(want); toast(want ? 'Кнопка «Для сотрудников» снова видна гостям' : 'Кнопка «Для сотрудников» скрыта от гостей'); } else { show(!want); toast(d.error || 'Не удалось сохранить'); } })
      .catch(() => { show(!want); toast('Нет связи с сервером'); })
      .finally(() => { box.disabled = false; });
  });
})();
