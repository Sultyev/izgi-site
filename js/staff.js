/* ИЗГИ — страница входа сотрудников.
   Демо-режим: сессия хранится в sessionStorage, аккаунты — в localStorage. */
(function () {
  const $ = (selector, root = document) => root.querySelector(selector);
  const auth = window.StaffAuth;
  if (!auth) return;

  const params = new URLSearchParams(location.search);
  const formBox = $('#formBox');
  const sessionBox = $('#sessionBox');
  const form = $('#loginForm');
  const loginInput = $('#loginInput');
  const passwordInput = $('#passwordInput');
  const passToggle = $('#passToggle');
  const errorBox = $('#loginError');
  const submit = $('#loginSubmit');

  const initials = name => String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase() || 'И';

  /* Разрешаем возврат только на служебные страницы этого сайта. */
  function readNext() {
    const raw = params.get('next');
    if (!raw) return null;
    const match = String(raw).match(/^(admin\.html|tasks\.html)(?:[?#].*)?$/);
    return match ? { page: match[1], raw } : null;
  }

  function destinationFor(user) {
    const home = auth.homeFor(user);
    const next = readNext();
    if (!next) return home;
    const allowed = auth.isAdmin(user) ? 'admin.html' : 'tasks.html';
    return next.page === allowed ? next.raw : home;
  }

  function showForm() {
    formBox.hidden = false;
    sessionBox.hidden = true;
    errorBox.textContent = '';
    requestAnimationFrame(() => {
      if (!loginInput.value) loginInput.focus();
    });
  }

  function showSession(user) {
    formBox.hidden = true;
    sessionBox.hidden = false;
    $('#sessAvatar').textContent = initials(user.name); $('#sessAvatar').dataset.uid = user.id;
    $('#sessName').textContent = user.name;
    $('#sessPosition').textContent = user.position;
    const continueLink = $('#sessContinue');
    const target = destinationFor(user);
    continueLink.href = target;
    continueLink.textContent = auth.isAdmin(user)
      ? 'Открыть панель директора'
      : 'Перейти к моим задачам';
    $('#sessHint').textContent = auth.isAdmin(user)
      ? 'Вы вошли как директор: доступны задачи всей команды и управление сотрудниками.'
      : 'Вы вошли как сотрудник: здесь только ваши задачи и сроки.';
    $('#sessLogout').onclick = () => {
      auth.logout(true);
      loginInput.value = '';
      passwordInput.value = '';
      showForm();
    };
  }

  const current = auth.current();
  if (current) {
    showSession(current);
  } else {
    showForm();
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    errorBox.textContent = '';
    loginInput.removeAttribute('aria-invalid');
    passwordInput.removeAttribute('aria-invalid');

    const loginValue = loginInput.value.trim();
    const passwordValue = passwordInput.value;
    if (!loginValue) {
      errorBox.textContent = 'Введите логин.';
      loginInput.setAttribute('aria-invalid', 'true');
      loginInput.focus();
      return;
    }
    if (!passwordValue) {
      errorBox.textContent = 'Введите пароль.';
      passwordInput.setAttribute('aria-invalid', 'true');
      passwordInput.focus();
      return;
    }

    const user = auth.login(loginValue, passwordValue, !$('#rememberMe') || $('#rememberMe').checked);
    if (!user) {
      errorBox.textContent = auth.lastError || 'Неверный логин или пароль. Проверьте раскладку и попробуйте снова.';
      loginInput.setAttribute('aria-invalid', 'true');
      passwordInput.setAttribute('aria-invalid', 'true');
      passwordInput.select();
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Входим…';
    location.href = destinationFor(user);
  });

  [loginInput, passwordInput].forEach(input => {
    input.addEventListener('input', () => {
      input.removeAttribute('aria-invalid');
      errorBox.textContent = '';
    });
  });

  passToggle.addEventListener('click', () => {
    const hidden = passwordInput.type === 'password';
    passwordInput.type = hidden ? 'text' : 'password';
    passToggle.textContent = hidden ? 'Скрыть' : 'Показать';
    passToggle.setAttribute('aria-pressed', String(hidden));
    passwordInput.focus();
  });

})();
