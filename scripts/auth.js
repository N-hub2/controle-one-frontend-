import { API_BASE_URL, clearAuthSession, saveAuthSession } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }

  if (registerForm) {
    registerForm.addEventListener('submit', handleRegisterSubmit);
  }
});

async function handleLoginSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const message = getMessageElement(form);
  const submitButton = form.querySelector('[type="submit"]');
  const email = getFieldValue(form, 'email');
  const password = getFieldValue(form, 'password');

  clearMessage(message);

  if (!email || !password) {
    showMessage(message, 'Veuillez saisir votre email et votre mot de passe.', 'error');
    return;
  }

  if (!isEmail(email)) {
    showMessage(message, 'Veuillez saisir un email valide.', 'error');
    return;
  }

  setLoading(submitButton, true, 'Connexion...');

  try {
    const payload = await postJson('/auth/login', { email, password });
    const { token, user } = normalizeAuthResponse(payload);

    if (!token || !user) {
      throw new Error('auth_response_invalid');
    }

    const safeUser = stripSensitiveUserFields(user);
    safeUser.role = normalizeRole(safeUser.role || safeUser.user_role);
    saveAuthSession(token, safeUser);

    const redirectTarget = getRedirectForRole(safeUser.role);

    if (!redirectTarget) {
      showMessage(message, 'Espace administrateur non disponible pour le moment.', 'error');
      return;
    }

    window.location.href = redirectTarget;
  } catch (error) {
    clearAuthSession();
    showMessage(message, getErrorMessage(error), 'error');
  } finally {
    setLoading(submitButton, false);
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const message = getMessageElement(form);
  const submitButton = form.querySelector('[type="submit"]');
  const fullName = getFieldValue(form, 'fullName');
  const email = getFieldValue(form, 'email');
  const phone = getFieldValue(form, 'phone');
  const password = getFieldValue(form, 'password');
  const confirmPassword = getFieldValue(form, 'confirmPassword');

  clearMessage(message);

  if (!fullName || !email || !phone || !password || !confirmPassword) {
    showMessage(message, 'Veuillez remplir tous les champs obligatoires.', 'error');
    return;
  }

  if (!isEmail(email)) {
    showMessage(message, 'Veuillez saisir un email valide.', 'error');
    return;
  }

  if (password !== confirmPassword) {
    showMessage(message, 'Les mots de passe ne correspondent pas.', 'error');
    return;
  }

  setLoading(submitButton, true, 'Création...');

  try {
    const { firstName, lastName } = splitFullName(fullName);

    await postJson('/auth/register', {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      password,
      role: 'client'
    });

    showMessage(message, 'Compte créé avec succès. Redirection vers la connexion...', 'success');
    form.reset();

    window.setTimeout(() => {
      window.location.href = 'login.html';
    }, 900);
  } catch (error) {
    showMessage(message, getErrorMessage(error), 'error');
  } finally {
    setLoading(submitButton, false);
  }
}

async function postJson(endpoint, body) {
  let response;
  let payload = null;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new Error('network_error');
  }

  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok || !payload || payload.success === false) {
    const message = payload && payload.message ? payload.message : 'request_failed';
    throw new Error(message);
  }

  return payload;
}

function normalizeAuthResponse(payload) {
  const data = payload && payload.data ? payload.data : {};
  const token = data.token || data.accessToken || payload.token || payload.accessToken || '';
  const user = data.user || payload.user || null;

  return { token, user };
}

function stripSensitiveUserFields(user) {
  const safeUser = { ...user };
  delete safeUser.password;
  delete safeUser.password_hash;
  delete safeUser.passwordHash;
  return safeUser;
}

function getRedirectForRole(role) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === 'client') {
    return 'user-dashboard.html';
  }

  if (normalizedRole === 'garage') {
    return 'garage-dashboard.html';
  }

  if (normalizedRole === 'admin') {
    return '';
  }

  return '';
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function getErrorMessage(error) {
  const message = String(error?.message || '').toLowerCase();

  if (message === 'network_error') {
    return 'Impossible de joindre le backend pour le moment.';
  }

  if (message.includes('invalid') || message.includes('incorrect') || message.includes('unauthorized')) {
    return 'Email ou mot de passe incorrect.';
  }

  if (message.includes('already') || message.includes('existe') || message.includes('duplicate')) {
    return 'Un compte existe déjà avec cet email.';
  }

  return 'Une erreur est survenue. Veuillez réessayer.';
}

function getFieldValue(form, name) {
  return (form.elements[name]?.value || '').trim();
}

function getMessageElement(form) {
  return form.querySelector('[data-auth-message]');
}

function showMessage(message, text, type) {
  if (!message) {
    return;
  }

  message.hidden = false;
  message.textContent = text;
  message.className = `auth-message auth-message--${type}`;
}

function clearMessage(message) {
  if (!message) {
    return;
  }

  message.hidden = true;
  message.textContent = '';
  message.className = 'auth-message';
}

function setLoading(button, isLoading, loadingText) {
  if (!button) {
    return;
  }

  if (isLoading) {
    button.dataset.defaultText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
    return;
  }

  button.textContent = button.dataset.defaultText || button.textContent;
  button.disabled = false;
  delete button.dataset.defaultText;
}

function splitFullName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts.shift() || '';
  const lastName = parts.join(' ') || firstName;

  return { firstName, lastName };
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
