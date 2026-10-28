/* Контент сайта (новости, команда, тексты, расписание) приходит с сервера.
   Копия сохраняется в браузере, поэтому повторные визиты открываются мгновенно. */
(function () {
  var K = 'izgi.pubcontent.v1', A = window.IZGI_API || '/api', cached = null;
  try { cached = JSON.parse(localStorage.getItem(K) || 'null'); } catch (e) { /* пусто */ }
  function pull(sync) {
    try {
      var x = new XMLHttpRequest();
      x.open('GET', A + '/content', !sync);
      x.onload = function () {
        if (x.status !== 200) return;
        try { var d = JSON.parse(x.responseText); localStorage.setItem(K, JSON.stringify(d)); if (sync) window.IZGI_DATA = d; } catch (e) { /* не JSON */ }
      };
      x.send();
    } catch (e) { /* нет связи */ }
  }
  if (cached) { window.IZGI_DATA = cached; pull(false); } else { window.IZGI_DATA = {}; pull(true); }
})();
