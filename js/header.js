/* ИЗГИ — шапка: меню на телефоне/планшете выезжает панелью справа, язык выбирается в отдельной панели
   с иконкой глобуса. На широких экранах панель языка раскрывается под иконкой. */
(function () {
  const nav = document.getElementById('nav'), burger = document.querySelector('.burger'), top = document.querySelector('.topright');
  if (!nav || !burger || !top) return;
  const langs = top.querySelector('.langs');
  const mq = window.matchMedia('(max-width:1180px)');
  const TITLE = { ru: 'Язык', kg: 'Тил', en: 'Language', tr: 'Dil' };
  const CLOSE = { ru: 'Закрыть', kg: 'Жабуу', en: 'Close', tr: 'Kapat' };
  const NAMES = { ru: 'Русский', kg: 'Кыргызча', en: 'English', tr: 'Türkçe' };
  const GLOBE = (s) => '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>';
  const lang = () => { const l = (window.I18N && window.I18N.lang) || document.documentElement.lang || 'ru'; return TITLE[l] ? l : 'ru'; };
  const el = (tag, cls) => { const e = document.createElement(tag); e.className = cls; return e; };

  /* --- выдвижное меню --- */
  const head = el('div', 'nav-head');
  const title = el('span', 'nav-title'); title.textContent = 'ИЗГИ';
  const close = el('button', 'nav-close'); close.type = 'button'; close.textContent = '×';
  head.append(title, close);
  const overlay = el('div', 'nav-overlay');

  /* --- панель «Язык» --- */
  const btn = el('button', 'lang-btn'); btn.type = 'button';
  btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'langPanel');
  btn.innerHTML = GLOBE(20) + '<span class="lang-cur"></span>';
  const panel = el('div', 'lang-panel'); panel.id = 'langPanel'; panel.setAttribute('role', 'dialog');
  const ph = el('div', 'lang-head');
  const pt = el('strong', 'lang-title');
  const pc = el('button', 'lang-close'); pc.type = 'button'; pc.textContent = '×';
  ph.insertAdjacentHTML('afterbegin', GLOBE(22)); ph.append(pt, pc);
  panel.append(ph);
  if (langs) {
    langs.classList.add('lang-list');
    langs.querySelectorAll('[data-lang]').forEach((b) => { b.dataset.name = NAMES[b.dataset.lang] || ''; });
    panel.append(langs);
  }
  top.insertBefore(btn, burger);

  function labels() {
    const l = lang();
    pt.textContent = TITLE[l]; btn.setAttribute('aria-label', TITLE[l]); panel.setAttribute('aria-label', TITLE[l]);
    btn.querySelector('.lang-cur').textContent = l.toUpperCase();
    close.setAttribute('aria-label', CLOSE[l]); pc.setAttribute('aria-label', CLOSE[l]);
  }
  const isOpen = () => panel.classList.contains('open');
  const shut = () => { panel.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); document.body.classList.remove('lang-open'); };
  const openPanel = () => {
    if (nav.classList.contains('open')) burger.click();
    panel.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
    document.body.classList.toggle('lang-open', mq.matches);
  };
  const closeNav = () => { if (nav.classList.contains('open')) burger.click(); };

  function place() {
    if (mq.matches) {
      document.body.appendChild(nav); nav.prepend(head); document.body.appendChild(panel); document.body.appendChild(overlay);
    } else {
      head.remove(); overlay.remove(); burger.after(nav); top.appendChild(panel);
      nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); document.body.classList.remove('nav-open');
    }
    shut();
  }

  btn.addEventListener('click', (e) => { e.stopPropagation(); if (isOpen()) shut(); else openPanel(); });
  pc.addEventListener('click', shut);
  close.addEventListener('click', closeNav);
  overlay.addEventListener('click', () => { shut(); closeNav(); });
  burger.addEventListener('click', shut);
  panel.addEventListener('click', (e) => { if (e.target.closest('[data-lang]')) setTimeout(shut, 200); });
  document.addEventListener('click', (e) => { if (isOpen() && !panel.contains(e.target) && !btn.contains(e.target)) shut(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { shut(); closeNav(); } });
  new MutationObserver(() => document.body.classList.toggle('nav-open', nav.classList.contains('open') && mq.matches))
    .observe(nav, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('langchange', labels);
  labels(); place();
  if (mq.addEventListener) mq.addEventListener('change', place); else mq.addListener(place);
})();
