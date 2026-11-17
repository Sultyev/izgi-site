/* ИЗГИ — общее хранилище задач сотрудников.
   Данные приходят с сервера (js/sync.js) и сохраняются обратно при изменениях. */
(function () {
  const KEY = 'izgi.tasks.v1';
  const STATUS = {
    new: { label: 'Новая', order: 0 },
    progress: { label: 'В работе', order: 1 },
    review: { label: 'На проверке', order: 2 },
    done: { label: 'Выполнена', order: 3 },
    cancelled: { label: 'Отменена', order: 4 }
  };
  const PRIORITY = {
    low: { label: 'Низкий', order: 0 },
    normal: { label: 'Обычный', order: 1 },
    high: { label: 'Высокий', order: 2 }
  };

  function isoDate(offsetDays) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offsetDays);
    return date.toISOString().slice(0, 10);
  }

  function nowISO() {
    return new Date().toISOString();
  }

  const DEFAULT_TASKS = [
    {
      id: 't-open-lesson',
      title: 'Подготовить план открытого урока',
      description: 'Собрать материалы, продумать задания и согласовать сценарий с завучем.',
      assigneeId: 'u-teacher',
      createdBy: 'u-director',
      createdAt: '2026-10-20T09:00:00.000Z',
      due: isoDate(3),
      priority: 'high',
      status: 'progress',
      startedAt: '2026-10-22T08:30:00.000Z',
      completedAt: null
    },
    {
      id: 't-diagnostics',
      title: 'Проверить диагностические работы 1-х классов',
      description: 'Внести результаты в таблицу и выделить учеников, которым нужна поддержка.',
      assigneeId: 'u-teacher',
      createdBy: 'u-director',
      createdAt: '2026-10-21T10:10:00.000Z',
      due: isoDate(6),
      priority: 'normal',
      status: 'new',
      startedAt: null,
      completedAt: null
    },
    {
      id: 't-parents',
      title: 'Провести встречу с родителями первоклассников',
      description: 'Обсудить адаптацию, ответить на вопросы и собрать обратную связь.',
      assigneeId: 'u-psych',
      createdBy: 'u-director',
      createdAt: '2026-10-19T12:00:00.000Z',
      due: isoDate(1),
      priority: 'high',
      status: 'progress',
      startedAt: '2026-10-23T14:00:00.000Z',
      completedAt: null
    },
    {
      id: 't-clubs',
      title: 'Обновить расписание кружков',
      description: 'Проверить нагрузку педагогов и перенести изменения на страницу расписания.',
      assigneeId: 'u-manager',
      createdBy: 'u-director',
      createdAt: '2026-10-18T08:00:00.000Z',
      due: isoDate(2),
      priority: 'normal',
      status: 'review',
      startedAt: '2026-10-20T09:15:00.000Z',
      completedAt: null
    },
    {
      id: 't-adaptation',
      title: 'Подготовить памятку по адаптации',
      description: 'Короткий гид для родителей: режим дня, тревожные сигналы и контакты психолога.',
      assigneeId: 'u-psych',
      createdBy: 'u-director',
      createdAt: '2026-10-14T11:00:00.000Z',
      due: isoDate(-1),
      priority: 'high',
      status: 'progress',
      startedAt: '2026-10-17T09:00:00.000Z',
      completedAt: null
    },
    {
      id: 't-supplies',
      title: 'Согласовать закупку учебных материалов',
      description: 'Сверить смету с директором и передать заявку поставщику.',
      assigneeId: 'u-manager',
      createdBy: 'u-director',
      createdAt: '2026-10-10T13:00:00.000Z',
      due: isoDate(-2),
      priority: 'normal',
      status: 'done',
      startedAt: '2026-10-12T09:00:00.000Z',
      completedAt: '2026-10-16T16:20:00.000Z'
    },
    {
      id: 't-tour',
      title: 'Собрать заявки на экскурсию',
      description: 'Связаться с родителями, уточнить количество детей и передать список администрации.',
      assigneeId: 'u-teacher',
      createdBy: 'u-director',
      createdAt: '2026-10-22T09:40:00.000Z',
      due: isoDate(9),
      priority: 'low',
      status: 'new',
      startedAt: null,
      completedAt: null
    }
  ];

  function notify() {
    window.dispatchEvent(new CustomEvent('taskschange'));
  }

  function save(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      notify();
      return true;
    } catch (e) {
      return false;
    }
  }

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) { /* список пуст */ }
    return [];
  }

  function all() {
    return read();
  }

  function uid() {
    return 't-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function add(data) {
    const list = read();
    const task = {
      id: uid(),
      title: String(data.title || '').trim(),
      description: String(data.description || '').trim(),
      assigneeId: String(data.assigneeId || ''),
      createdBy: data.createdBy || '',
      createdAt: nowISO(),
      due: data.due || '',
      priority: PRIORITY[data.priority] ? data.priority : 'normal',
      status: STATUS[data.status] ? data.status : 'new',
      startedAt: data.status === 'progress' ? nowISO() : null,
      completedAt: data.status === 'done' ? nowISO() : null
    };
    list.unshift(task);
    save(list);
    return task;
  }

  function update(id, patch) {
    const list = read();
    const task = list.find(item => item.id === id);
    if (!task) return null;
    const before = task.status;
    if (Object.prototype.hasOwnProperty.call(patch, 'title')) task.title = String(patch.title || '').trim();
    if (Object.prototype.hasOwnProperty.call(patch, 'description')) task.description = String(patch.description || '').trim();
    if (Object.prototype.hasOwnProperty.call(patch, 'assigneeId')) task.assigneeId = String(patch.assigneeId || '');
    if (Object.prototype.hasOwnProperty.call(patch, 'due')) task.due = String(patch.due || '');
    if (PRIORITY[patch.priority]) task.priority = patch.priority;
    if (STATUS[patch.status]) task.status = patch.status;
    if (patch.reopen) task.reopen = true;
    if (task.status === 'progress' && before !== 'progress' && !task.startedAt) task.startedAt = nowISO();
    if (task.status === 'done') {
      if (!task.completedAt) task.completedAt = nowISO();
    } else {
      task.completedAt = null;
    }
    save(list);
    return task;
  }

  function remove(id) {
    const list = read();
    const next = list.filter(item => item.id !== id);
    if (next.length === list.length) return false;
    save(next);
    return true;
  }

  function employees() {
    if (!window.StaffAuth) return [];
    return window.StaffAuth.users().filter(user => user.role === 'employee');
  }

  function byAssignee(id) {
    return read()
      .filter(task => task.assigneeId === id)
      .sort((a, b) => {
        if (isClosed(a) && !isClosed(b)) return 1;
        if (isClosed(b) && !isClosed(a)) return -1;
        const x = dueMs(a.due), y = dueMs(b.due);
        return (isNaN(x) ? 9e15 : x) - (isNaN(y) ? 9e15 : y);
      });
  }

  function currentFor(id) {
    return byAssignee(id).filter(task => task.status === 'progress' || task.status === 'review');
  }

  function activeFor(id) {
    return byAssignee(id).filter(task => !isClosed(task));
  }

  function plural(number, forms) {
    const abs = Math.abs(number) % 100;
    const tail = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (tail > 1 && tail < 5) return forms[1];
    if (tail === 1) return forms[0];
    return forms[2];
  }

  /* Срок хранится как «ГГГГ-ММ-ДДTЧЧ:ММ» по времени Бишкека (UTC+6); старые задачи с одной датой считаются до 23:59. */
  const TZ = '+06:00', ZONE = 'Asia/Bishkek';
  const GRACE_H = { low: 5, normal: 3, high: 2 };
  function dueMs(value) {
    if (!value) return NaN;
    const v = String(value);
    return Date.parse(v.length > 10 ? v.slice(0, 16) + ':00' + TZ : v + 'T23:59:00' + TZ);
  }
  function dur(ms) {
    const m = Math.max(1, Math.round(ms / 60000));
    if (m < 60) return m + ' мин';
    const h = Math.floor(m / 60), r = m % 60;
    if (h < 24) return h + ' ч' + (r ? ' ' + r + ' мин' : '');
    const d = Math.floor(h / 24);
    return d + ' ' + plural(d, ['день', 'дня', 'дней']) + (h % 24 ? ' ' + (h % 24) + ' ч' : '');
  }
  const dayKey = ms => new Date(ms + 6 * 3600e3).toISOString().slice(0, 10);
  function dueInfo(value, priority) {
    const none = { label: 'Без дедлайна', short: '—', days: null, overdue: false, soon: false, tone: 'none' };
    const t = dueMs(value);
    if (!value || isNaN(t)) return none;
    const hasTime = String(value).length > 10;
    const now = Date.now(), diff = t - now;
    const dateLabel = new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: ZONE });
    const timeLabel = new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: ZONE });
    const when = hasTime ? dateLabel + ', ' + timeLabel : dateLabel;
    const days = Math.round((Date.parse(dayKey(t) + 'T00:00:00Z') - Date.parse(dayKey(now) + 'T00:00:00Z')) / 86400000);
    let label = 'До ' + when, tone = 'later';
    if (diff < 0) {
      const over = -diff;
      const left = (GRACE_H[priority] || 0) * 3600e3 - over;
      label = 'Просрочено на ' + dur(over) + (priority ? (left > 0 ? ' · до отмены ' + dur(left) : ' · будет отменена') : '');
      tone = 'overdue';
    } else if (hasTime && diff < 24 * 3600e3) {
      label = 'Через ' + dur(diff) + ' · ' + timeLabel;
      tone = diff < 3 * 3600e3 ? 'today' : 'soon';
    } else if (days === 0) { label = 'Сегодня, ' + when; tone = 'today'; }
    else if (days === 1) { label = 'Завтра, ' + when; tone = 'soon'; }
    else if (days <= 3) { label = 'Через ' + days + ' ' + plural(days, ['день', 'дня', 'дней']) + ' · ' + when; tone = 'soon'; }
    return { label, short: when, days, overdue: diff < 0, soon: diff >= 0 && days <= 3, tone, ms: t };
  }
  const isClosed = task => task.status === 'done' || task.status === 'cancelled';

  /* Рейтинг считает сервер; здесь только чтение того, что пришло. */
  const RKEY = 'izgi.ratings.v1';
  function ratings() { try { return JSON.parse(localStorage.getItem(RKEY) || '{}'); } catch (e) { return {}; } }
  function ratingFor(id) { return ratings()[id] || { score: 10, log: [] }; }

  function stats() {
    const list = read();
    return {
      total: list.length,
      active: list.filter(task => !isClosed(task)).length,
      progress: list.filter(task => task.status === 'progress').length,
      review: list.filter(task => task.status === 'review').length,
      done: list.filter(task => task.status === 'done').length,
      overdue: list.filter(task => !isClosed(task) && dueInfo(task.due).overdue).length
    };
  }


  try {
    addEventListener('storage', event => {
      if (event.key === KEY) notify();
    });
  } catch (e) { /* noop */ }

  window.TasksStore = {
    KEY,
    STATUS,
    PRIORITY,
    all,
    add,
    update,
    remove,
    employees,
    byAssignee,
    currentFor,
    activeFor,
    dueInfo,
    isClosed,
    ratings,
    ratingFor,
    RKEY,
    GRACE_H,
    stats
  };
})();
