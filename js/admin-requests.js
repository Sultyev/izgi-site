/* ИЗГИ — вкладка «Заявки» в панели: список заявок с сайта и отметки «Принято / Отклонено / На рассмотрении». */
(function () {
  const auth = window.StaffAuth, S = window.IzgiSync;
  if (!auth || !S) return;
  const me = auth.current();
  if (!me || !auth.can(me, 'requests')) return;
  const API = window.IZGI_API || '/api';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LABEL = { pending: 'На рассмотрении', accepted: 'Принято', rejected: 'Отклонено' };
  const hdr = () => ({ 'content-type': 'application/json', authorization: 'Bearer ' + S.token() });
  const fmt = (t) => new Date(t).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  let items = [], filter = 'all';

  function toast(msg) { const d = document.createElement('div'); d.className = 'ava-toast'; d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 3200); }
  const count = (st) => items.filter((x) => st === 'all' || (x.status || 'pending') === st).length;

  function render() {
    const pending = count('pending'), badge = $('#reqBadge');
    if (badge) { badge.textContent = pending; badge.hidden = !pending; }
    $('#reqFilters').innerHTML = [['all', 'Все'], ['pending', 'На рассмотрении'], ['accepted', 'Принято'], ['rejected', 'Отклонено']]
      .map(([k, t]) => `<button type="button" class="chip${filter === k ? ' on' : ''}" data-rf="${k}">${t} <span class="n">${count(k)}</span></button>`).join('');
    const list = items.filter((x) => filter === 'all' || (x.status || 'pending') === filter);
    $('#reqList').innerHTML = list.length ? list.map((r) => {
      const st = r.status || 'pending';
      const tel = String(r.phone).replace(/[^\d+]/g, '');
      return `<article class="req req-${st}" data-id="${esc(r.id)}">
        <div class="req-top"><strong>${esc(r.name)}</strong><span class="req-badge ${st}">${LABEL[st]}</span></div>
        <div class="req-meta"><a href="tel:${esc(tel)}">${esc(r.phone)}</a>${r.grade ? `<span>Класс: ${esc(r.grade)}</span>` : ''}<time>${fmt(r.createdAt)}</time></div>
        ${st !== 'pending' && r.handledBy ? `<div class="req-by">${LABEL[st]}: ${esc(r.handledBy)}, ${fmt(r.handledAt)}</div>` : ''}
        <textarea class="req-note" rows="2" maxlength="500" placeholder="Заметка (необязательно)" data-note>${esc(r.note || '')}</textarea>
        <div class="req-actions">
          <button type="button" class="btn sm req-ok${st === 'accepted' ? ' on' : ''}" data-act="accepted">Принято</button>
          <button type="button" class="btn sm req-no${st === 'rejected' ? ' on' : ''}" data-act="rejected">Отклонено</button>
          <button type="button" class="btn sm ghost${st === 'pending' ? ' on' : ''}" data-act="pending">На рассмотрении</button>
          ${auth.isFull(me) ? '<button type="button" class="btn sm ghost danger" data-act="delete">Удалить</button>' : ''}
        </div></article>`;
    }).join('') : '<p class="empty">Заявок в этом списке пока нет.</p>';
  }

  async function load(quiet) {
    try {
      const r = await fetch(API + '/requests', { headers: hdr() });
      if (r.status === 401) { location.replace('staff.html'); return; }
      const d = await r.json();
      if (r.ok) { items = d.requests || []; if (!document.activeElement || !document.activeElement.matches('[data-note]')) render(); }
    } catch (e) { if (!quiet) toast('Нет связи с сервером.'); }
  }
  async function send(id, body, method) {
    try {
      const r = await fetch(API + '/requests/' + encodeURIComponent(id), { method: method || 'PUT', headers: hdr(), body: method === 'DELETE' ? undefined : JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Не удалось сохранить.'); return false; }
      if (method === 'DELETE') items = items.filter((x) => x.id !== id);
      else { const i = items.findIndex((x) => x.id === id); if (i >= 0) items[i] = d.request; }
      render(); return true;
    } catch (e) { toast('Нет связи с сервером.'); return false; }
  }

  $('#reqFilters').addEventListener('click', (e) => { const b = e.target.closest('[data-rf]'); if (b) { filter = b.dataset.rf; render(); } });
  $('#reqList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.closest('.req').dataset.id;
    if (b.dataset.act === 'delete') { if (confirm('Удалить заявку насовсем?')) send(id, null, 'DELETE'); return; }
    send(id, { status: b.dataset.act }).then((ok) => ok && toast('Отмечено: ' + LABEL[b.dataset.act]));
  });
  $('#reqList').addEventListener('focusout', (e) => {
    const t = e.target.closest('[data-note]'); if (!t) return;
    const id = t.closest('.req').dataset.id, r = items.find((x) => x.id === id);
    if (r && (r.note || '') !== t.value) send(id, { note: t.value });
  });
  setInterval(() => { if (!document.hidden) load(true); }, 20000);
  load();
  if (location.hash === '#requests') setTimeout(() => { const t = document.querySelector('#tabs [data-tab="requests"]'); if (t && !t.hidden) t.click(); }, 0);
})();
