const API_BASE_URL = 'http://localhost:5000/api';
const AUTH_TOKEN_KEY = 'controleOneToken';
const AUTH_USER_KEY = 'controleOneUser';
const AUTH_ROLE_KEY = 'controleOneRole';

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  if (!response.ok) {
    throw new Error('Erreur réseau');
  }
  return response.json();
}

function saveAuthSession(token, user) {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  }

  if (user) {
    const safeUser = sanitizeUser(user);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(safeUser));

    if (safeUser.role) {
      localStorage.setItem(AUTH_ROLE_KEY, safeUser.role);
    }
  }
}

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function getAuthUser() {
  const storedUser = localStorage.getItem(AUTH_USER_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser);
  } catch (error) {
    localStorage.removeItem(AUTH_USER_KEY);
    return null;
  }
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_ROLE_KEY);
}

function sanitizeUser(user) {
  const safeUser = { ...user };
  delete safeUser.password;
  delete safeUser.password_hash;
  delete safeUser.passwordHash;
  return safeUser;
}

export {
  API_BASE_URL,
  AUTH_ROLE_KEY,
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  clearAuthSession,
  getAuthToken,
  getAuthUser,
  request,
  saveAuthSession
};
