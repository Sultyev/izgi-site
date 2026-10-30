/* ============================================================
   ИЗГИ — интерактивный слой
   Конфетти, квиз, живой режим дня, прогресс чтения,
   doodles, счётчики и мелкие улучшения. Работает поверх main.js.
   ============================================================ */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tr = k => {
    try { return (window.I18N && window.I18N.t(k)) || k; } catch (e) { return k; }
  };

  /* ---------- прогресс чтения и кнопка «наверх» ---------- */
  const progress = document.createElement('div');
  progress.className = 'scroll-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.prepend(progress);

  const toTop = document.createElement('button');
  toTop.type = 'button';
  toTop.className = 'to-top';
  toTop.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>';
  document.body.append(toTop);

  const onScroll = () => {
    const h = document.documentElement;
    const max = h.scrollHeight - innerHeight;
    progress.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + '%';
    toTop.classList.toggle('show', scrollY > 520);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const syncTop = () => {
    const label = tr('a11y.top');
    toTop.setAttribute('aria-label', label);
    toTop.title = label;
  };
  syncTop();
  toTop.addEventListener('click', () => scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' }));

  /* ---------- школьные doodles на фоне ---------- */
  const doodles = [
    '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m14 50 4-14L42 12l10 10-24 24-14 4Z"/><path d="m38 16 10 10"/><path d="m18 36 10 10"/></svg>',
    '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="m32 8 7 16 17 2-13 12 3 17-14-8-14 8 3-17L8 26l17-2 7-16Z"/></svg>',
    '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="20" width="44" height="24" rx="4"/><path d="M20 20v8M30 20v6M40 20v8M50 20v6"/></svg>',
    '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 30 58 8 38 56l-9-18-23-8Z"/><path d="m29 38 29-30"/></svg>',
    '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14h16a6 6 0 0 1 6 6v30a6 6 0 0 0-6-6H12V14Z"/><path d="M52 14H36a6 6 0 0 0-6 6v30a6 6 0 0 1 6-6h16V14Z"/></svg>'
  ];
  const dWrap = document.createElement('div');
  dWrap.className = 'doodles';
  dWrap.setAttribute('aria-hidden', 'true');
  dWrap.innerHTML = doodles.map(s => `<span>${s}</span>`).join('');
  document.body.append(dWrap);

  /* ---------- конфетти ---------- */
  function confettiAt(x, y, count = 40) {
    if (calm) return;
    const colors = ['#01a09c', '#113fd2', '#ff7a59', '#7fdcd3', '#ffffff'];
    const wrap = document.createElement('div');
    wrap.className = 'confetti';
    wrap.style.left = x + 'px';
    wrap.style.top = y + 'px';
    for (let i = 0; i < count; i++) {
      const p = document.createElement('i');
      const angle = Math.random() * Math.PI * 2;
      const dist = 55 + Math.random() * 180;
      p.style.setProperty('--x', (Math.cos(angle) * dist).toFixed(1) + 'px');
      p.style.setProperty('--y', (Math.sin(angle) * dist - 55).toFixed(1) + 'px');
      p.style.setProperty('--r', (Math.random() * 720 - 360).toFixed(0) + 'deg');
      p.style.setProperty('--t', (0.85 + Math.random() * 0.9).toFixed(2) + 's');
      p.style.setProperty('--delay', (Math.random() * 0.12).toFixed(2) + 's');
      p.style.background = colors[i % colors.length];
      p.style.width = (6 + Math.random() * 8).toFixed(0) + 'px';
      p.style.height = (8 + Math.random() * 10).toFixed(0) + 'px';
      wrap.append(p);
    }
    document.body.append(wrap);
    setTimeout(() => wrap.remove(), 2300);
  }

  /* ---------- телефоны и почта из данных сайта ---------- */
  function updateContactLinks() {
    const phone = tr('school.phone') || '';
    const digits = (phone.match(/\d/g) || []).length;
    const tel = phone.replace(/[^\d+]/g, '');
    $$('[data-call]').forEach(a => {
      if (digits >= 7) {
        a.setAttribute('href', 'tel:' + tel);
        a.removeAttribute('aria-disabled');
      } else {
        a.removeAttribute('href');
        a.setAttribute('aria-disabled', 'true');
      }
    });
    const mail = (tr('school.mail') || '').trim();
    $$('[data-mail]').forEach(a => {
      if (mail.includes('@')) a.setAttribute('href', 'mailto:' + mail);
      else a.removeAttribute('href');
    });
    const year = $('#year');
    if (year) year.textContent = new Date().getFullYear();
  }
  updateContactLinks();

  /* ---------- появление секций ---------- */
  const sections = $$('main > section').filter(el => !el.classList.contains('hero'));
  if (!calm && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('anim-on');
    sections.forEach(el => el.classList.add('reveal'));
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -7% 0px', threshold: 0.06 });
    sections.forEach(el => io.observe(el));
  }

  /* ---------- счётчики ---------- */
  $$('[data-count]').forEach(el => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    if (!isFinite(target)) return;
    const run = () => {
      if (calm) { el.textContent = target + suffix; return; }
      const t0 = performance.now();
      el.textContent = '0' + suffix;
      const step = now => {
        const p = Math.min(1, (now - t0) / 1200);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if ('IntersectionObserver' in window && !calm) {
      let started = false;
      const io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting) && !started) {
          started = true;
          run();
          io.disconnect();
        }
      }, { threshold: 0.5 });
      io.observe(el);
    } else {
      el.textContent = target + suffix;
    }
  });

  /* ---------- режим дня на главной ---------- */
  const dayItems = $$('[data-day-item]');
  const toMin = s => {
    const [h, m] = (s || '0:0').split(':');
    return +h * 60 + +m;
  };
  function updateDay() {
    if (!dayItems.length) return;
    const now = new Date();
    const n = now.getHours() * 60 + now.getMinutes();
    const weekday = now.getDay() % 6 !== 0;
    dayItems.forEach(li => {
      const on = weekday && n >= toMin(li.dataset.s) && n < toMin(li.dataset.e);
      li.classList.toggle('is-now', on);
    });
  }
  updateDay();
  setInterval(updateDay, 30000);

  /* ---------- квиз «Разминка для ума» ---------- */
  /* Банк вопросов: [вопрос, верный ответ, неверный, неверный]. Варианты перемешиваются при каждом запуске. */
  const BANK = [["Сколько будет 7 + 8?","15","14","16"],["12 − 5 = ?","7","6","8"],["6 × 4 = ?","24","20","28"],["36 : 6 = ?","6","5","7"],["Сколько углов у треугольника?","3","4","5"],["Сколько сторон у квадрата?","4","3","6"],["Сколько минут в одном часе?","60","50","100"],["Сколько дней в неделе?","7","5","6"],["Сколько месяцев в году?","12","10","11"],["Какое число больше: 49 или 94?","94","49","Они равны"],["9 × 9 = ?","81","72","90"],["100 − 1 = ?","99","90","101"],["Сколько сантиметров в одном метре?","100","10","1000"],["Какое число следующее: 2, 4, 6, 8, …?","10","9","12"],["Сколько будет 5 × 0?","0","5","1"],["Половина от 20 — это…","10","5","40"],["Сколько граней у куба?","6","4","8"],["Сколько секунд в одной минуте?","60","30","100"],["15 + 15 = ?","30","25","35"],["Какое из чисел чётное?","18","15","21"],["Сколько будет 3 × 3 × 3?","27","9","18"],["Сколько ног у трёх пауков?","24","18","21"],["Сколько часов в сутках?","24","12","60"],["Сколько лет в одном веке?","100","10","1000"],["Сколько граммов в одном килограмме?","1000","100","10"],["Что тяжелее: килограмм ваты или килограмм железа?","Одинаково","Железо","Вата"],["У Алии было 5 яблок, 2 она съела. Сколько яблок осталось?","3","2","7"],["Продолжи ряд: понедельник, вторник, среда, …","четверг","пятница","суббота"],["Сколько месяцев в году имеют 28 дней?","Все 12","Один","Два"],["Сколько концов у двух палок?","4","2","8"],["Какой предмет лишний: яблоко, груша, карандаш, банан?","Карандаш","Яблоко","Банан"],["Какое слово лишнее: стол, стул, шкаф, кошка?","Кошка","Стул","Шкаф"],["Что больше: тонна пуха или килограмм камней?","Тонна пуха","Килограмм камней","Одинаково"],["Если вчера было воскресенье, то какой день завтра?","Вторник","Понедельник","Среда"],["Что можно увидеть с закрытыми глазами?","Сон","Школу","Цветок"],["Какое животное самое высокое на Земле?","Жираф","Слон","Верблюд"],["Сколько лап у собаки?","4","2","6"],["Какая птица не умеет летать?","Страус","Орёл","Ласточка"],["Кто даёт нам мёд?","Пчёлы","Муравьи","Бабочки"],["Какое животное называют «кораблём пустыни»?","Верблюд","Лошадь","Осёл"],["Что выделяют растения на свету, помогая нам дышать?","Кислород","Углекислый газ","Азот"],["Какое время года наступает после зимы?","Весна","Осень","Лето"],["Какого цвета спелый помидор?","Красного","Синего","Фиолетового"],["Какое животное самое большое в океане?","Синий кит","Акула","Дельфин"],["Сколько ног у насекомого?","6","4","8"],["Кто такой головастик?","Детёныш лягушки","Детёныш рыбы","Детёныш змеи"],["Из чего пчёлы делают мёд?","Из нектара цветов","Из сахара","Из листьев"],["Какое дерево даёт жёлуди?","Дуб","Берёза","Ель"],["Что необходимо растениям для роста?","Свет и вода","Только тень","Только камни"],["Сколько лап у паука?","8","6","10"],["Какое животное умеет менять цвет, прячась от врагов?","Хамелеон","Волк","Медведь"],["Какое животное спит всю зиму в берлоге?","Медведь","Волк","Лиса"],["Какой орган качает кровь?","Сердце","Лёгкие","Желудок"],["Сколько зубов у взрослого человека?","32","20","40"],["Каким газом мы дышим, чтобы жить?","Кислородом","Гелием","Водородом"],["Какая звезда освещает Землю днём?","Солнце","Луна","Полярная звезда"],["Сколько планет в Солнечной системе?","8","7","9"],["Какой океан самый большой?","Тихий","Атлантический","Индийский"],["Какой материк самый холодный?","Антарктида","Африка","Австралия"],["Какая планета ближе всех к Солнцу?","Меркурий","Венера","Земля"],["Как называется естественный спутник Земли?","Луна","Марс","Солнце"],["Какая планета известна своими кольцами?","Сатурн","Марс","Меркурий"],["Как называется самая высокая гора мира?","Эверест","Эльбрус","Монблан"],["Какую планету называют «красной»?","Марс","Юпитер","Нептун"],["В какой стране находится Эйфелева башня?","Во Франции","В Италии","В Испании"],["Какая страна самая большая по площади?","Россия","Китай","Канада"],["Как называется самая большая жаркая пустыня мира?","Сахара","Гоби","Каракумы"],["Сколько цветов у радуги?","7","5","9"],["Какая планета самая большая в Солнечной системе?","Юпитер","Земля","Сатурн"],["Как называется столица Кыргызстана?","Бишкек","Ош","Каракол"],["Как называется знаменитое высокогорное озеро Кыргызстана?","Иссык-Куль","Байкал","Балхаш"],["Какой музыкальный инструмент считается символом кыргызского народа?","Комуз","Баян","Скрипка"],["Сколько лучей у солнца на флаге Кыргызстана?","40","12","24"],["Как называется кыргызский народный эпос?","«Манас»","«Илиада»","«Калевала»"],["Как называется круглая верхняя часть юрты?","Тундук","Кереге","Уук"],["Как называется один из древнейших городов юга Кыргызстана?","Ош","Нарын","Талас"],["Как называется древняя кыргызская конная игра с тушей козла?","Кок-бору","Поло","Регби"],["Какой напиток делают из кобыльего молока?","Кымыз","Компот","Сок"],["Как называется самая высокая вершина Кыргызстана?","Пик Победы","Эльбрус","Белуха"],["Как называется горная система, проходящая через Кыргызстан?","Тянь-Шань","Кавказ","Альпы"],["Как называется традиционное жилище кыргызов?","Юрта","Изба","Чум"],["Какой город — центр Иссык-Кульской области?","Каракол","Бишкек","Ош"],["Сколько букв в русском алфавите?","33","30","35"],["Какая из этих букв обозначает гласный звук?","А","Б","В"],["Какую букву пишем в сочетании «жи–ши»?","И","Ы","Я"],["Какое слово написано правильно?","Корова","Карова","Курова"],["Сколько слогов в слове «школа»?","2","1","3"],["На какой вопрос отвечает глагол?","Что делать?","Кто это?","Какой?"],["Какое слово противоположно по смыслу слову «большой»?","Маленький","Огромный","Высокий"],["Какое слово близко по смыслу к слову «весёлый»?","Радостный","Грустный","Хмурый"],["Как часто нужно чистить зубы?","Утром и вечером","Раз в месяц","Только когда болят"],["На какой сигнал светофора можно переходить дорогу?","На зелёный","На красный","На жёлтый"],["Что нужно сделать перед едой?","Помыть руки","Включить телевизор","Сделать уроки"],["Какое из слов вежливое?","Пожалуйста","Отстань","Ну и что"],["Что сказать, если вам помогли?","Спасибо","Ничего","Мне всё равно"],["Сколько часов сна в сутки нужно школьнику?","9–11 часов","3–4 часа","15 часов"],["Что полезнее для зубов?","Яблоко","Карамель","Шоколадная конфета"],["Какое число идёт сразу после 99?","100","101","98"],["Какая птица кукарекает по утрам?","Петух","Курица","Гусь"],["Какое животное умеет мяукать?","Кошка","Собака","Корова"]];
  const BASE = [
    { q: 'home.quiz.q1', a: ['home.quiz.q1.o1', 'home.quiz.q1.o2', 'home.quiz.q1.o3'], c: 1 },
    { q: 'home.quiz.q2', a: ['home.quiz.q2.o1', 'home.quiz.q2.o2', 'home.quiz.q2.o3'], c: 1 },
    { q: 'home.quiz.q3', a: ['home.quiz.q3.o1', 'home.quiz.q3.o2', 'home.quiz.q3.o3'], c: 0 }
  ];
  let QUIZ = [];
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const quizLang = () => (window.I18N && window.I18N.lang) || 'ru';
  function newSession() {
    if (quizLang() !== 'ru') { QUIZ = BASE.slice(); return; }
    QUIZ = shuffle(BANK).slice(0, 5).map(r => {
      const opts = shuffle([r[1], r[2], r[3]]);
      return { raw: true, q: r[0], a: opts, c: opts.indexOf(r[1]) };
    });
  }
  const label = (item, key) => (item.raw ? key : tr(key));
  const quizTotal = s => s.replace(/3/g, String(QUIZ.length));
  newSession();
  const quizBody = $('#quiz-body');
  const quizProgress = $('#quiz-progress');
  const quizDots = $('#quiz-dots');
  let qIndex = 0;
  let qScore = 0;
  let qPicked = -1;
  let qAnswered = false;
  let qCelebrated = false;

  function renderQuizDots() {
    if (!quizDots) return;
    quizDots.textContent = '';
    QUIZ.forEach((_, i) => {
      const dot = document.createElement('i');
      dot.className = i < qIndex || (i === qIndex && qAnswered) ? 'done' : i === qIndex ? 'current' : '';
      quizDots.append(dot);
    });
  }

  function renderQuiz() {
    if (!quizBody) return;
    if (qIndex >= QUIZ.length) { renderQuizResult(); return; }
    const item = QUIZ[qIndex];
    if (quizProgress) quizProgress.textContent = quizTotal(tr('home.quiz.progress')).replace('{n}', String(qIndex + 1));
    renderQuizDots();
    quizBody.textContent = '';

    const q = document.createElement('h3');
    q.className = 'quiz-q';
    q.textContent = label(item, item.q);
    quizBody.append(q);

    const opts = document.createElement('div');
    opts.className = 'quiz-options';
    item.a.forEach((key, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'quiz-option';
      const k = document.createElement('span');
      k.className = 'opt-key';
      k.textContent = String.fromCharCode(65 + i);
      const txt = document.createElement('span');
      txt.textContent = label(item, key);
      b.append(k, txt);
      if (qAnswered) {
        b.disabled = true;
        if (i === item.c) b.classList.add('correct');
        if (i === qPicked && qPicked !== item.c) b.classList.add('wrong');
      } else {
        b.addEventListener('click', () => answerQuiz(i));
      }
      opts.append(b);
    });
    quizBody.append(opts);

    const feedback = document.createElement('p');
    feedback.className = 'quiz-feedback';
    feedback.setAttribute('aria-live', 'polite');
    if (qAnswered) {
      const good = qPicked === item.c;
      feedback.textContent = tr(good ? 'home.quiz.correct' : 'home.quiz.wrong');
      if (!good) feedback.classList.add('bad');
    }
    quizBody.append(feedback);

    const actions = document.createElement('div');
    actions.className = 'quiz-actions';
    if (qAnswered) {
      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'btn pri sm';
      next.textContent = tr('home.quiz.next');
      next.addEventListener('click', () => {
        qIndex++;
        qPicked = -1;
        qAnswered = false;
        renderQuiz();
      });
      actions.append(next);
    }
    quizBody.append(actions);
  }

  function answerQuiz(i) {
    if (qAnswered) return;
    const item = QUIZ[qIndex];
    qAnswered = true;
    qPicked = i;
    if (i === item.c) qScore++;
    renderQuiz();
  }

  function renderQuizResult() {
    if (!quizBody) return;
    if (quizProgress) quizProgress.textContent = '';
    if (quizDots) {
      quizDots.textContent = '';
      QUIZ.forEach(() => {
        const dot = document.createElement('i');
        dot.className = 'done';
        quizDots.append(dot);
      });
    }
    quizBody.textContent = '';
    const box = document.createElement('div');
    box.className = 'quiz-result';
    const ico = document.createElement('span');
    ico.className = 'result-icon';
    ico.setAttribute('aria-hidden', 'true');
    ico.textContent = qScore === QUIZ.length ? '🏆' : '✏️';
    const h = document.createElement('h3');
    h.textContent = qScore === QUIZ.length ? quizTotal(tr('home.quiz.perfect')) : quizTotal(tr('home.quiz.result')).replace('{n}', String(qScore));
    const p = document.createElement('p');
    p.textContent = tr('home.quiz.p');
    const actions = document.createElement('div');
    actions.className = 'quiz-actions';
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'btn pri sm';
    again.textContent = tr('home.quiz.restart');
    again.addEventListener('click', () => {
      newSession();
      qIndex = 0;
      qScore = 0;
      qPicked = -1;
      qAnswered = false;
      qCelebrated = false;
      renderQuiz();
    });
    actions.append(again);
    box.append(ico, h, p, actions);
    quizBody.append(box);
    if (qScore === QUIZ.length && !qCelebrated) {
      qCelebrated = true;
      const card = $('.quiz-card');
      if (card) {
        const r = card.getBoundingClientRect();
        confettiAt(r.left + r.width / 2, r.top + r.height / 2, 54);
      }
    }
  }
  renderQuiz();
  window.addEventListener('langchange', () => { newSession(); qIndex = 0; qScore = 0; qPicked = -1; qAnswered = false; qCelebrated = false; renderQuiz(); });

  /* ---------- живая полоска расписания ---------- */
  function updateLive() {
    const fill = $('#live-bar-fill');
    const day = $('#live-day');
    const now = new Date();
    if (fill) {
      const on = $('.bells li.on');
      if (on) {
        const start = toMin(on.dataset.s);
        const end = toMin(on.dataset.e);
        const n = now.getHours() * 60 + now.getMinutes();
        const p = Math.max(0, Math.min(100, ((n - start) / Math.max(1, end - start)) * 100));
        fill.style.width = p.toFixed(1) + '%';
      } else {
        fill.style.width = '0%';
      }
    }
    if (day) {
      const lang = document.documentElement.lang;
      if (lang === 'kg') {
        const days = ['Жекшемби', 'Дүйшөмбү', 'Шейшемби', 'Шаршемби', 'Бейшемби', 'Жума', 'Ишемби'];
        const months = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
        day.textContent = days[now.getDay()] + ', ' + now.getDate() + ' ' + months[now.getMonth()];
      } else {
        const locale = { ru: 'ru-RU', en: 'en-US', tr: 'tr-TR' }[lang] || 'ru-RU';
        try {
          const str = now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
          day.textContent = str.charAt(0).toUpperCase() + str.slice(1);
        } catch (e) {
          day.textContent = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
        }
      }
    }
  }
  updateLive();
  setInterval(updateLive, 30000);

  /* ---------- ярлыки новостей ---------- */
  function decorateNews() {
    $$('.grid.news article[data-cat]').forEach(art => {
      let badge = $('.news-badge', art);
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'news-badge';
        art.prepend(badge);
      }
      badge.dataset.cat = art.dataset.cat;
      badge.textContent = tr(art.dataset.cat === 'notice' ? 'filter.notice' : 'filter.event');
    });
  }
  decorateNews();

  /* ---------- печать ---------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-print]');
    if (!b) return;
    e.preventDefault();
    print();
  });

  /* ---------- переключение языка ---------- */
  window.addEventListener('langchange', () => {
    syncTop();
    updateContactLinks();
    updateLive();
    renderQuiz();
    decorateNews();
  });
})();
