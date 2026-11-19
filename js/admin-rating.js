/* ИЗГИ — вкладка «Рейтинг»: таблица сотрудников по баллам и история изменений. Баллы считает сервер. */
(function () {
  const auth = window.StaffAuth, store = window.TasksStore;
  if (!auth || !store) return;
  const me = auth.current();
  if (!me || !auth.can(me, 'tasks')) return;
  const box = document.getElementById('rtBoard');
  if (!box) return;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = ms => new Date(ms).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bishkek' });
  let open = '';
  function render() {
    const rs = store.ratings();
    const list = auth.users().filter(u => u.role === 'employee').map(u => ({ u, r: rs[u.id] || { score: 10, log: [] } }))
      .sort((a, b) => b.r.score - a.r.score || a.u.name.localeCompare(b.u.name, 'ru'));
    if (!list.length) { box.innerHTML = '<div class="empty">Сотрудников пока нет</div>'; return; }
    box.innerHTML = list.map(({ u, r }, i) => {
      const sc = Number(r.score), c = store.ratingColor(sc);
      const log = r.log.length ? r.log.map(e => `<li class="${e.d > 0 ? 'up' : 'down'}"><b>${e.d > 0 ? '+' : '−'}${Math.abs(e.d).toFixed(1)}</b><span>${esc(e.why)}</span><em>${sc === e.s ? '' : ''}${Number(e.s).toFixed(1)}</em><time>${esc(fmt(e.t))}</time></li>`).join('') : '<li class="none">Изменений пока не было</li>';
      return `<div class="rt-row${open === u.id ? ' open' : ''}" data-id="${esc(u.id)}">
        <button type="button" class="rt-head" data-rt="${esc(u.id)}">
          <span class="rt-rank">${i + 1}</span>
          <span class="s-avatar" data-uid="${esc(u.id)}">${esc((u.name || '?').trim().charAt(0).toUpperCase())}</span>
          <span class="rt-who"><strong>${esc(u.name)}</strong><small>${esc(u.position || '')}</small></span>
          <span class="rt-pill" style="background:linear-gradient(135deg,${c.c1},${c.c2});color:${c.text}">${sc.toFixed(1)}</span>
        </button>
        <ul class="rt-hist">${log}</ul>
      </div>`;
    }).join('');
  }
  box.addEventListener('click', e => { const b = e.target.closest('[data-rt]'); if (!b) return; open = open === b.dataset.rt ? '' : b.dataset.rt; render(); });
  window.addEventListener('storage', e => { if (e.key === store.RKEY) render(); });
  window.addEventListener('staffchange', render);
  render();
})();
