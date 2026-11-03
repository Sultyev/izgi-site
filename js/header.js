/* ИЗГИ — на телефонах и планшетах меню превращается в выдвижную панель справа: ссылки + выбор языка.
   В шапке остаются логотип, (аватар) и кнопка меню. На широких экранах всё как раньше. */
(function () {
  const nav = document.getElementById('nav'), burger = document.querySelector('.burger'), top = document.querySelector('.topright');
  if (!nav || !burger || !top) return;
  const langs = top.querySelector('.langs');
  const mq = window.matchMedia('(max-width:1180px)');
  const LABEL = { ru: 'Язык', kg: 'Тил', en: 'Language', tr: 'Dil' };
  const CLOSE = { ru: 'Закрыть', kg: 'Жабуу', en: 'Close', tr: 'Kapat' };
  const lang = () => { const l = (window.I18N && window.I18N.lang) || document.documentElement.lang || 'ru'; return LABEL[l] ? l : 'ru'; };

  const head = document.createElement('div'); head.className = 'nav-head';
  const title = document.createElement('span'); title.className = 'nav-title'; title.textContent = 'ИЗГИ';
  const close = document.createElement('button'); close.type = 'button'; close.className = 'nav-close'; close.textContent = '×';
  head.append(title, close);
  const wrap = document.createElement('div'); wrap.className = 'nav-langs';
  const overlay = document.createElement('div'); overlay.className = 'nav-overlay';

  function labels() { wrap.dataset.label = LABEL[lang()]; close.setAttribute('aria-label', CLOSE[lang()]); }
  function place() {
    if (mq.matches) {
      document.body.appendChild(nav); nav.prepend(head);
      if (langs) { wrap.appendChild(langs); nav.appendChild(wrap); }
      document.body.appendChild(overlay);
    } else {
      head.remove(); wrap.remove(); overlay.remove();
      burger.after(nav);
      if (langs) top.insertBefore(langs, top.firstChild);
      nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); document.body.classList.remove('nav-open');
    }
  }
  const toggleShut = () => { if (nav.classList.contains('open')) burger.click(); };
  close.addEventListener('click', toggleShut);
  overlay.addEventListener('click', toggleShut);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleShut(); });
  new MutationObserver(() => document.body.classList.toggle('nav-open', nav.classList.contains('open') && mq.matches))
    .observe(nav, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('langchange', labels);
  labels(); place();
  if (mq.addEventListener) mq.addEventListener('change', place); else mq.addListener(place);
})();
