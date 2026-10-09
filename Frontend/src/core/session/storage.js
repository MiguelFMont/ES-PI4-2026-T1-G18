const TOKEN_KEY = '@FinanceAI:token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function hasToken() {
  return Boolean(getToken());
}

export function saveToken(token) {
  if (typeof token !== 'string' || token.trim() === '') {
    throw new TypeError('O token de sessão deve ser uma string não vazia.');
  }
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
}
