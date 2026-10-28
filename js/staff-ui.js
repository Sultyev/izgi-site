/* Крупные цифры-плитки: переход к нужному списку задач. */
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-go]');
  if (!t) return;
  const v = t.dataset.go;
  const f = document.querySelector('#taskFilters [data-filter="' + v + '"]');
  if (f) { f.click(); document.getElementById('taskFilters').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  const s = document.getElementById('taskFilterStatus');
  if (s) { s.value = v === 'all' ? '' : v; s.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('.t-list-wrap').scrollIntoView({ behavior: 'smooth' }); }
});

(function () {
  const nav = document.querySelector('.staff-top-nav'), auth = window.StaffAuth;
  if (!nav || !auth) return;
  const u = auth.current();
  if (u && auth.isAdmin(u)) { const a = document.createElement('a'); a.className = 'staff-top-link'; a.href = 'admin.html'; a.textContent = 'Панель управления'; nav.insertBefore(a, nav.firstChild); }
})();
