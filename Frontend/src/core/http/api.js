import { clearSession, getToken } from '../session/storage.js';

const API_BASE_URL = (window.FINANCEAI_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, data = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/** Faz uma requisição REST e normaliza JSON, erros e autenticação. */
export async function apiFetch(path, options = {}) {
  const url = new URL(`${API_BASE_URL}/${String(path).replace(/^\//, '')}`);
  const headers = new Headers(options.headers || {});
  const token = getToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (options.body != null && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (cause) {
    throw new ApiError('Não foi possível conectar ao servidor. Verifique sua conexão.', { data: cause });
  }

  if (response.status === 401) {
    clearSession();
    if (window.location.hash !== '#login') window.location.hash = '#login';
  }

  const contentType = response.headers.get('content-type') || '';
  let data = null;
  if (response.status !== 204) {
    if (contentType.includes('application/json')) {
      try { data = await response.json(); } catch { data = null; }
    } else {
      data = await response.text();
    }
  }

  if (!response.ok) {
    const message = data && typeof data === 'object'
      ? (data.message || data.error || `Falha na requisição (${response.status}).`)
      : (typeof data === 'string' && data) || `Falha na requisição (${response.status}).`;
    throw new ApiError(message, { status: response.status, data });
  }

  return data;
}

export const api = apiFetch;
