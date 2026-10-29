/* ИЗГИ — кнопка «Уведомления» в кабинете сотрудника. Подписка хранится на сервере (/push/subscribe). */
(function () {
  const A = window.IZGI_API || '/api', S = window.IzgiSync, auth = window.StaffAuth;
  if (!S || !auth || !auth.current()) return;
  const EP = 'izgi.push.endpoint';
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const u8 = (b) => { const s = (b + '='.repeat((4 - (b.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };

  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'push-chip';
  const host = document.querySelector('.tasks-head') || document.querySelector('.staff-me') || document.body;
  host.appendChild(btn);

  const toast = (t) => { const d = document.createElement('div'); d.className = 'ava-toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 4200); };
  const set = (text, cls, on) => { btn.textContent = text; btn.className = 'push-chip ' + (cls || ''); btn.onclick = on || null; };

  async function current() { const r = await navigator.serviceWorker.getRegistration(); return r ? r.pushManager.getSubscription() : null; }
  async function link(sub) { const r = S.req('POST', '/push/subscribe', { subscription: sub.toJSON() }); if (r.status === 200) localStorage.setItem(EP, sub.endpoint); return r.status === 200; }

  async function enable() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return refresh();
      const reg = await navigator.serviceWorker.register('sw.js');
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const k = await (await fetch(A + '/push/key')).json();
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(k.key) });
      }
      if (!(await link(sub))) toast('Не удалось включить уведомления. Попробуйте ещё раз.');
      else toast('Уведомления включены. Теперь о новых задачах сообщим на этом устройстве.');
    } catch (e) { toast('Не получилось включить уведомления: ' + (e && e.message ? e.message : e)); }
    refresh();
  }
  async function disable() {
    const sub = await current();
    if (sub) { S.req('POST', '/push/unsubscribe', { endpoint: sub.endpoint }); await sub.unsubscribe(); }
    localStorage.removeItem(EP);
    toast('Уведомления на этом устройстве выключены.');
    refresh();
  }

  async function refresh() {
    if (!supported) {
      if (ios && !standalone) return set('Уведомления на iPhone: как включить', 'push-hint', () => alert('На iPhone уведомления работают, если добавить сайт на экран «Домой»:\n1. Откройте сайт в Safari.\n2. Нажмите «Поделиться» и выберите «На экран «Домой»».\n3. Откройте сайт с иконки на экране и войдите в кабинет.\n4. Нажмите «Включить уведомления».'));
      return set('Уведомления не поддерживаются этим браузером', 'push-off');
    }
    if (Notification.permission === 'denied') return set('Уведомления заблокированы в настройках браузера', 'push-off');
    const sub = await current();
    if (Notification.permission === 'granted' && sub) { link(sub); return set('Уведомления включены · выключить', 'push-on', () => { if (confirm('Выключить уведомления на этом устройстве?')) disable(); }); }
    set('Включить уведомления о задачах', 'push-ask', enable);
  }
  refresh();
})();
