/* ИЗГИ — панель директора: задачи сотрудников и служебные аккаунты.
   Работает поверх staff-auth.js и tasks-store.js. */
(function () {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const auth = window.StaffAuth;
  const store = window.TasksStore;
  if (!auth || !store) return;

  const me = auth.current();
  if (!me || me.role !== 'director') return;

  let editingId = null;
  let toastTimer = null;

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

  function todayISO() {
    const date = new Date();
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function formatCompleted(value) {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  }

  function showToast(message) {
    const old = $('.toast.js-admin-toast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.className = 'toast js-admin-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.remove(), 2800);
  }

  function employees() {
    return auth.users().filter(user => user.role === 'employee');
  }

  function employeeName(id) {
    const user = auth.users().find(item => item.id === id);
    return user ? user.name : 'Сотрудник удалён';
  }

  function sortTasks(list) {
    const rank = task => task.status === 'done' ? 2 : task.status === 'review' ? 1 : 0;
    return list.slice().sort((a, b) => {
      const diff = rank(a) - rank(b);
      if (diff) return diff;
      return String(a.due || '9999').localeCompare(String(b.due || '9999'));
    });
  }

  /* ---------- выпадающие списки сотрудников ---------- */

  function renderEmployeeSelects() {
    const list = employees();
    const assignee = $('#taskAssignee');
    const filter = $('#taskFilterEmployee');
    if (!assignee || !filter) return;

    const assigneeValue = assignee.value;
    const filterValue = filter.value;

    assignee.innerHTML = '<option value="">Выберите сотрудника</option>' + list
      .map(user => `<option value="${esc(user.id)}">${esc(user.name)} — ${esc(user.position)}</option>`)
      .join('');
    filter.innerHTML = '<option value="">Все сотрудники</option>' + list
      .map(user => `<option value="${esc(user.id)}">${esc(user.name)}</option>`)
      .join('');

    assignee.value = list.some(user => user.id === assigneeValue) ? assigneeValue : '';
    filter.value = list.some(user => user.id === filterValue) ? filterValue : '';
  }

  /* ---------- сводка и доска «кто чем занят» ---------- */

  function renderStats() {
    const stats = store.stats();
    $('#dirStatActive').textContent = stats.active;
    $('#dirStatProgress').textContent = stats.progress;
    $('#dirStatReview').textContent = stats.review;
    $('#dirStatOverdue').textContent = stats.overdue;
    $('#dirStatOverdue').closest('.t-stat').classList.toggle('warn', stats.overdue > 0);
  }

  function renderBoard() {
    const board = $('#dirBoard');
    const list = employees();
    if (!list.length) {
      board.innerHTML = '<div class="t-board-empty">Сотрудников пока нет. Добавьте аккаунт во вкладке «Сотрудники» — после этого можно будет назначать задачи.</div>';
      return;
    }

    board.innerHTML = list.map(user => {
      const active = store.activeFor(user.id);
      const current = store.currentFor(user.id);
      const countLabel = String(active.length);

      let body = '';
      if (current.length) {
        body = current.slice(0, 3).map(task => {
          const due = store.dueInfo(task.due);
          return `
            <div class="t-board-task${task.status === 'review' ? ' review' : ''}">
              <b>${esc(task.title)}</b>
              <span>${esc(store.STATUS[task.status].label)} · <span class="${due.overdue ? 'overdue' : ''}">${esc(due.label)}</span></span>
            </div>`;
        }).join('');
        if (current.length > 3) {
          body += `<div class="t-board-free">Ещё ${current.length - 3} ${plural(current.length - 3, ['задача', 'задачи', 'задач'])} в работе</div>`;
        }
      } else {
        body = `<div class="t-board-free"><b>Свободен</b>${active.length ? ' · в очереди ' + active.length + ' ' + plural(active.length, ['задача', 'задачи', 'задач']) : ' — задач нет'}</div>`;
      }

      return `
        <div class="t-board-card">
          <div class="t-board-person">
            <span class="s-avatar" data-uid="${esc(user.id)}">${esc(initials(user.name))}</span>
            <div><strong>${esc(user.name)}</strong><span>${esc(user.position)}</span></div>
            <span class="t-board-count" title="Активные задачи">${esc(countLabel)}</span>
          </div>
          <div class="t-board-current">${body}</div>
        </div>`;
    }).join('');
  }

  /* ---------- список задач ---------- */

  function taskCard(task) {
    const due = store.dueInfo(task.due);
    const isEditing = editingId === task.id;
    const dueLabel = task.status === 'done'
      ? 'Выполнено' + (formatCompleted(task.completedAt) ? ' ' + formatCompleted(task.completedAt) : '')
      : due.label;
    const overdue = due.overdue && task.status !== 'done';
    const statusOptions = Object.keys(store.STATUS).map(key =>
      `<option value="${esc(key)}"${key === task.status ? ' selected' : ''}>${esc(store.STATUS[key].label)}</option>`
    ).join('');
    return `
      <div class="t-admin-task${isEditing ? ' is-editing' : ''}">
        <div class="t-admin-top">
          <h4>${esc(task.title)}</h4>
          <div class="t-admin-actions">
            <button class="btn sm ghost" type="button" data-edit-id="${esc(task.id)}">Изменить</button>
            <button class="btn sm danger" type="button" data-del-id="${esc(task.id)}">Удалить</button>
          </div>
        </div>
        ${task.description ? `<p class="t-admin-desc">${esc(task.description)}</p>` : ''}
        <div class="t-admin-meta">
          <span class="s-badge ${esc(task.status)}">${esc(store.STATUS[task.status].label)}</span>
          <span>${esc(employeeName(task.assigneeId))}</span>
          <span class="${overdue ? 'overdue' : ''}">${esc(dueLabel)}</span>
          <span class="t-priority ${esc(task.priority)}">${esc(store.PRIORITY[task.priority].label)} приоритет</span>
        </div>
        <div class="t-admin-bar">
          <select class="sel" data-status-id="${esc(task.id)}" aria-label="Статус задачи «${esc(task.title)}»">${statusOptions}</select>
          ${task.status === 'review' ? `<button class="btn sm pri" type="button" data-accept-id="${esc(task.id)}">Принять работу</button>` : ''}
        </div>
      </div>`;
  }

  function renderTaskList() {
    const listBox = $('#taskAdminList');
    const employeeFilter = $('#taskFilterEmployee').value;
    const statusFilter = $('#taskFilterStatus').value;
    const all = store.all();
    let list = all;
    if (employeeFilter) list = list.filter(task => task.assigneeId === employeeFilter);
    if (statusFilter === 'overdue') list = list.filter(task => task.status !== 'done' && window.TasksStore.dueInfo(task.due).overdue);
    else if (statusFilter) list = list.filter(task => task.status === statusFilter);
    list = sortTasks(list);

    $('#taskCount').textContent = list.length === all.length
      ? all.length + ' ' + plural(all.length, ['задача', 'задачи', 'задач'])
      : 'Показано ' + list.length + ' из ' + all.length;

    if (!list.length) {
      listBox.innerHTML = '<div class="t-empty"><b>Задач по этому фильтру нет.</b>Измените фильтр или назначьте новую задачу.</div>';
      return;
    }
    listBox.innerHTML = list.map(taskCard).join('');
  }

  /* ---------- форма задачи ---------- */

  const form = $('#taskForm');
  const titleInput = $('#taskTitle');
  const descInput = $('#taskDesc');
  const assigneeInput = $('#taskAssignee');
  const dueInput = $('#taskDue');
  const priorityInput = $('#taskPriority');
  const errorBox = $('#taskError');

  function resetForm() {
    editingId = null;
    form.reset();
    $('#taskFormTitle').textContent = 'Новая задача';
    $('#taskSubmit').textContent = 'Назначить задачу';
    $('#taskCancel').hidden = true;
    errorBox.textContent = '';
    dueInput.min = todayISO();
    dueInput.value = '';
    priorityInput.value = 'normal';
    $$('.t-admin-task.is-editing').forEach(card => card.classList.remove('is-editing'));
  }

  function startEdit(id) {
    const task = store.all().find(item => item.id === id);
    if (!task) return;
    editingId = id;
    titleInput.value = task.title;
    descInput.value = task.description || '';
    assigneeInput.value = task.assigneeId;
    dueInput.value = task.due || '';
    dueInput.min = '';
    priorityInput.value = task.priority || 'normal';
    $('#taskFormTitle').textContent = 'Редактировать задачу';
    $('#taskSubmit').textContent = 'Сохранить изменения';
    $('#taskCancel').hidden = false;
    errorBox.textContent = '';
    renderTaskList();
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    titleInput.focus({ preventScroll: true });
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    errorBox.textContent = '';
    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    const assigneeId = assigneeInput.value;
    const due = dueInput.value;
    const priority = priorityInput.value;

    if (title.length < 3) {
      errorBox.textContent = 'Название задачи — не короче 3 символов.';
      titleInput.focus();
      return;
    }
    if (!assigneeId) {
      errorBox.textContent = 'Выберите сотрудника, которому назначается задача.';
      assigneeInput.focus();
      return;
    }
    if (!due) {
      errorBox.textContent = 'Укажите дедлайн: без срока задача потеряется.';
      dueInput.focus();
      return;
    }
    if (!editingId && due < todayISO()) {
      errorBox.textContent = 'Дедлайн не может быть в прошлом.';
      dueInput.focus();
      return;
    }
    if (!auth.users().some(user => user.id === assigneeId && user.role === 'employee')) {
      errorBox.textContent = 'Сотрудник не найден. Обновите список и попробуйте снова.';
      return;
    }

    if (editingId) {
      store.update(editingId, { title, description, assigneeId, due, priority });
      showToast('Задача обновлена');
      resetForm();
      renderTaskList();
    } else {
      store.add({ title, description, assigneeId, due, priority, status: 'new', createdBy: me.id });
      showToast('Задача назначена сотруднику');
      resetForm();
      renderTaskList();
    }
  });

  $('#taskCancel').addEventListener('click', () => {
    resetForm();
    renderTaskList();
  });

  [$('#taskFilterEmployee'), $('#taskFilterStatus')].forEach(select => {
    select.addEventListener('change', renderTaskList);
  });

  $('#taskAdminList').addEventListener('click', event => {
    const edit = event.target.closest('[data-edit-id]');
    if (edit) {
      startEdit(edit.dataset.editId);
      return;
    }
    const remove = event.target.closest('[data-del-id]');
    if (remove) {
      const task = store.all().find(item => item.id === remove.dataset.delId);
      if (!task) return;
      if (!confirm('Удалить задачу «' + task.title + '»? Это действие необратимо.')) return;
      if (editingId === task.id) resetForm();
      store.remove(task.id);
      showToast('Задача удалена');
      renderTaskList();
      return;
    }
    const accept = event.target.closest('[data-accept-id]');
    if (accept) {
      store.update(accept.dataset.acceptId, { status: 'done' });
      showToast('Работа принята — задача выполнена');
    }
  });

  $('#taskAdminList').addEventListener('change', event => {
    const select = event.target.closest('[data-status-id]');
    if (!select) return;
    const task = store.update(select.dataset.statusId, { status: select.value });
    if (task) showToast('Статус задачи обновлён');
  });

  /* ---------- аккаунты сотрудников ---------- */

  function renderAccounts() {
    const box = $('#staffList');
    const list = auth.users().slice().sort((a, b) => {
      if (a.role !== b.role) return a.role === 'director' ? -1 : 1;
      return a.name.localeCompare(b.name, 'ru');
    });
    $('#staffCount').textContent = list.length + ' ' + plural(list.length, ['аккаунт', 'аккаунта', 'аккаунтов']);

    if (!list.length) {
      box.innerHTML = '<div class="t-empty"><b>Аккаунтов нет.</b>Создайте первый аккаунт в форме слева.</div>';
      return;
    }

    box.innerHTML = list.map(user => {
      const actions = user.role === 'director'
        ? '<span class="s-badge director">Полный доступ</span>'
        : `<button class="btn sm ghost" type="button" data-reset-id="${esc(user.id)}">Сбросить пароль</button>
           <button class="btn sm danger" type="button" data-remove-id="${esc(user.id)}">Удалить</button>`;
      return `
        <div class="s-account">
          <span class="s-avatar" data-uid="${esc(user.id)}" data-edit="1">${esc(initials(user.name))}</span>
          <div class="s-account-main">
            <strong>${esc(user.name)}</strong>
            <span>${esc(user.position)}</span>
            <div class="s-account-login">
              <code>${esc(user.login)}</code>
              <span class="s-badge ${user.role === 'director' ? 'director' : 'role'}">${esc(auth.roleLabel(user.role))}</span>
            </div>
          </div>
          <div class="s-account-actions">${actions}</div>
        </div>`;
    }).join('');
  }

  const staffForm = $('#staffForm');
  const staffError = $('#staffError');
  const staffCreated = $('#staffCreated');

  staffForm.addEventListener('submit', event => {
    event.preventDefault();
    staffError.textContent = '';
    staffCreated.hidden = true;
    staffCreated.innerHTML = '';
    const name = $('#staffName').value.trim();
    const position = $('#staffPosition').value.trim();
    const login = $('#staffLogin').value.trim();
    const password = $('#staffPassword').value;

    const result = auth.addUser({ name, position, login, password });
    if (!result.ok) {
      staffError.textContent = result.error;
      return;
    }

    staffForm.reset();
    staffCreated.hidden = false;
    staffCreated.innerHTML = `Аккаунт <b>${esc(result.user.name)}</b> создан. Логин: <code>${esc(login)}</code>, пароль: <code>${esc(password)}</code>. Передайте данные сотруднику лично.`;
    showToast('Аккаунт сотрудника создан');
    renderEmployeeSelects();
    renderBoard();
    renderAccounts();
    renderTaskList();
    $('#staffName').focus();
  });

  ['#staffName', '#staffPosition', '#staffLogin', '#staffPassword'].forEach(selector => {
    const input = $(selector);
    if (input) input.addEventListener('input', () => { staffError.textContent = ''; });
  });

  $('#staffList').addEventListener('click', event => {
    const reset = event.target.closest('[data-reset-id]');
    if (reset) {
      const user = auth.users().find(item => item.id === reset.dataset.resetId);
      if (!user) return;
      const password = prompt('Новый пароль для «' + user.name + '» (не короче 6 символов):');
      if (password === null) return;
      const result = auth.setPassword(user.id, password);
      if (!result.ok) {
        showToast(result.error);
        return;
      }
      showToast('Пароль изменён. Передайте его сотруднику лично.');
      return;
    }

    const remove = event.target.closest('[data-remove-id]');
    if (!remove) return;
    const user = auth.users().find(item => item.id === remove.dataset.removeId);
    if (!user) return;
    if (!confirm('Удалить аккаунт «' + user.name + '»? Задачи останутся в списке — их можно будет переназначить.')) return;
    const result = auth.removeUser(user.id);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast('Аккаунт удалён');
    renderEmployeeSelects();
    renderBoard();
    renderAccounts();
    renderTaskList();
  });

  /* ---------- общие обновления ---------- */

  function renderAll() {
    renderStats();
    renderBoard();
    renderTaskList();
  }

  window.addEventListener('taskschange', renderAll);
  window.addEventListener('staffchange', () => {
    renderEmployeeSelects();
    renderBoard();
    renderAccounts();
    renderTaskList();
  });
  window.addEventListener('admintab', event => {
    if (event.detail === 'tasks' || event.detail === 'staff') renderAll();
  });

  /* ---------- старт ---------- */

  dueInput.min = todayISO();
  renderEmployeeSelects();
  renderAccounts();
  renderAll();
})();
