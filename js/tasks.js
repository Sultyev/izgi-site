/* ИЗГИ — личные задачи сотрудника.
   Страница доступна только после входа; директор перенаправляется в админ-панель. */
(function () {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const auth = window.StaffAuth;
  const store = window.TasksStore;
  if (!auth || !store) {
    document.body.hidden = false;
    return;
  }

  const me = auth.requireRole('employee');
  if (!me) return;
  document.body.hidden = false;

  const state = { filter: 'all' };

  const initials = name => String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase() || 'И';

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  function plural(number, forms) {
    const abs = Math.abs(number) % 100;
    const tail = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (tail > 1 && tail < 5) return forms[1];
    if (tail === 1) return forms[0];
    return forms[2];
  }

  function formatCompleted(value) {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  }

  function employeeName(id) {
    const user = auth.users().find(item => item.id === id);
    return user ? user.name : 'Администрация школы';
  }

  /* ---------- шапка и приветствие ---------- */

  $('#meAvatar').textContent = initials(me.name); $('#meAvatar').dataset.uid = me.id; $('#meAvatar').dataset.edit = '1';
  $('#meName').textContent = me.name;
  $('#mePosition').textContent = me.position;
  const firstName = me.name.trim().split(/\s+/)[0] || 'коллега';
  $('#greetName').textContent = firstName;
  const now = new Date();
  $('#todayChip').textContent = now.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  /* ---------- уведомление ---------- */

  let toastTimer = null;
  function showToast(message) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  /* ---------- сводка ---------- */

  function renderStats(tasks) {
    const active = tasks.filter(task => task.status !== 'done');
    const progress = tasks.filter(task => task.status === 'progress');
    const review = tasks.filter(task => task.status === 'review');
    const overdue = active.filter(task => store.dueInfo(task.due).overdue);

    $('#statActive').textContent = active.length;
    $('#statProgress').textContent = progress.length;
    $('#statReview').textContent = review.length;
    $('#statOverdue').textContent = overdue.length;
    $('#statOverdue').closest('.t-stat').classList.toggle('warn', overdue.length > 0);
  }

  function renderFilterCounts(tasks) {
    const counts = {
      all: tasks.length,
      new: tasks.filter(task => task.status === 'new').length,
      progress: tasks.filter(task => task.status === 'progress').length,
      review: tasks.filter(task => task.status === 'review').length,
      done: tasks.filter(task => task.status === 'done').length,
      overdue: tasks.filter(task => task.status !== 'done' && window.TasksStore.dueInfo(task.due).overdue).length
    };
    $$('#taskFilters .t-filter').forEach(button => {
      const count = counts[button.dataset.filter] || 0;
      const badge = $('.n', button);
      if (badge) badge.textContent = count;
    });
  }

  /* ---------- «сейчас в работе» ---------- */

  function renderCurrent() {
    const current = store.currentFor(me.id);
    const count = $('#nowCount');
    const title = $('#nowTitle');
    const meta = $('#nowMeta');
    const list = $('#nowList');
    const empty = $('#nowEmpty');

    count.textContent = current.length;
    if (!current.length) {
      title.textContent = 'Свободно для новых задач';
      meta.innerHTML = '';
      list.innerHTML = '';
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    if (current.length === 1) {
      const task = current[0];
      const due = store.dueInfo(task.due);
      title.textContent = task.title;
      meta.innerHTML = [
        `<span class="s-badge ${esc(task.status)}">${esc(store.STATUS[task.status].label)}</span>`,
        `<span class="s-badge">${esc(store.PRIORITY[task.priority].label)} приоритет</span>`,
        `<span>${esc(due.label)}</span>`
      ].join('');
      list.innerHTML = '';
      return;
    }

    title.textContent = `${current.length} ${plural(current.length, ['задача', 'задачи', 'задач'])} в работе`;
    meta.innerHTML = '<span>Отмечено как «в работе» или «на проверке»</span>';
    list.innerHTML = current.map(task => {
      const due = store.dueInfo(task.due);
      return `
        <div class="t-now-item">
          <div>
            <b>${esc(task.title)}</b>
            <span>${esc(store.STATUS[task.status].label)} · ${esc(store.PRIORITY[task.priority].label)} приоритет</span>
          </div>
          <span class="due">${esc(due.label)}</span>
        </div>`;
    }).join('');
  }

  /* ---------- список задач ---------- */

  function actionFor(task) {
    if (task.status === 'new') return { label: 'Взять в работу', next: 'progress' };
    if (task.status === 'progress') return { label: 'Отправить на проверку', next: 'review' };
    if (task.status === 'review') return { label: 'Вернуть в работу', next: 'progress' };
    return null;
  }

  function taskCard(task) {
    const due = store.dueInfo(task.due);
    const action = actionFor(task);
    const completedDate = formatCompleted(task.completedAt);
    const dueLabel = task.status === 'done'
      ? 'Выполнено' + (completedDate ? ' ' + completedDate : '')
      : due.label;
    const dueTone = task.status === 'done'
      ? ''
      : due.tone === 'overdue' ? ' overdue' : (due.tone === 'soon' || due.tone === 'today') ? ' soon' : '';
    const description = task.description ? `<p>${esc(task.description)}</p>` : '';

    return `
      <article class="t-task ${esc(task.status)}">
        <div class="t-task-top">
          <span class="s-badge ${esc(task.status)}">${esc(store.STATUS[task.status].label)}</span>
          <span class="t-priority ${esc(task.priority)}" title="Приоритет">${esc(store.PRIORITY[task.priority].label)}</span>
          <span class="due${dueTone}">${esc(dueLabel)}</span>
        </div>
        <h3>${esc(task.title)}</h3>
        ${description}
        <div class="t-task-foot">
          <span class="t-task-autor">От: ${esc(employeeName(task.createdBy))}</span>
          <div class="t-task-actions">
            ${action ? `<button class="s-btn sm soft" type="button" data-task-id="${esc(task.id)}" data-task-next="${esc(action.next)}">${esc(action.label)}</button>` : ''}
            
          </div>
        </div>
      </article>`;
  }

  function renderList(tasks) {
    const list = state.filter === 'all' ? tasks : state.filter === 'overdue' ? tasks.filter(task => task.status !== 'done' && window.TasksStore.dueInfo(task.due).overdue) : tasks.filter(task => task.status === state.filter);
    const box = $('#taskList');
    if (!list.length) {
      const messages = {
        all: 'Пока задач нет. Директор добавит их — и они появятся здесь.',
        new: 'Новых задач нет.',
        progress: 'Нет задач в работе. Возьмите новую задачу из списка «Все».',
        review: 'Нет задач на проверке.',
        done: 'Выполненных задач пока нет.',
        overdue: 'Просроченных задач нет.'
      };
      box.innerHTML = `<div class="t-empty"><b>${esc(messages[state.filter] || messages.all)}</b>${state.filter === 'all' ? 'Когда задача появится, здесь будут сроки и кнопки для смены статуса.' : ''}</div>`;
      return;
    }
    box.innerHTML = list.map(taskCard).join('');
  }

  /* ---------- сборка страницы ---------- */

  function renderAll() {
    const tasks = store.byAssignee(me.id);
    renderStats(tasks);
    renderFilterCounts(tasks);
    renderCurrent();
    renderList(tasks);
  }

  $$('#taskFilters .t-filter').forEach(button => {
    button.addEventListener('click', () => {
      state.filter = button.dataset.filter || 'all';
      $$('#taskFilters .t-filter').forEach(item => item.classList.toggle('on', item === button));
      renderAll();
    });
  });

  $('#taskList').addEventListener('click', event => {
    const button = event.target.closest('[data-task-id]');
    if (!button) return;
    const task = store.all().find(item => item.id === button.dataset.taskId);
    if (!task || task.assigneeId !== me.id) return;
    const next = button.dataset.taskNext;
    if (!store.STATUS[next]) return;
    const wasReview = task.status === 'review';
    store.update(task.id, { status: next });
    showToast(next === 'review'
      ? 'Задача отправлена директору на проверку'
      : (wasReview ? 'Задача возвращена в работу' : 'Задача взята в работу'));
  });

  $('#btnLogout').addEventListener('click', () => {
    auth.logout();
    location.replace('staff.html');
  });

  window.addEventListener('taskschange', renderAll);
  window.addEventListener('staffchange', () => {
    if (!auth.current()) {
      location.replace('staff.html');
      return;
    }
    renderAll();
  });

  renderAll();
})();
