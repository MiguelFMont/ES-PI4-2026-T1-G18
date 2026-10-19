import { clearSession, getToken } from '../session/storage.js';
import { irParaLogin } from '../session/login.js';

// O Backend entrega o Frontend e a API (/v1) no mesmo endereço (http://localhost:3001), então a URL padrão
// é relativa à origem da página. Para abrir o Frontend por outro servidor (ex.: Live Server), defina
// window.FINANCEAI_API_URL = 'http://localhost:3001/v1' (a porta 3000 é do Servidor Java de cálculos).
const API_BASE_URL = (window.FINANCEAI_API_URL || '/v1').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, data = null, code = null, details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.code = code; // ex.: 'VALIDATION_ERROR', 'UNAUTHENTICATED'
    this.details = details; // só em VALIDATION_ERROR: { campo: [mensagens] }
  }
}

/**
 * Lê o formato de erro do Backend, `{ error: { message, code, details } }`
 * (ver docs/contrato-api.md), e ainda aceita respostas simples (`{ message }` ou texto).
 */
function lerErro(data, status) {
  const padrao = `Falha na requisição (${status}).`;

  if (data && typeof data === 'object') {
    const erro = data.error;
    if (erro && typeof erro === 'object') {
      return { message: erro.message || padrao, code: erro.code || null, details: erro.details || null };
    }
    const texto = typeof data.message === 'string' ? data.message : typeof erro === 'string' ? erro : null;
    return { message: texto || padrao, code: null, details: null };
  }

  return { message: (typeof data === 'string' && data) || padrao, code: null, details: null };
}

/** Faz uma requisição REST e normaliza JSON, erros e autenticação. */
export async function apiFetch(path, options = {}) {
  const url = new URL(`${API_BASE_URL}/${String(path).replace(/^\//, '')}`, window.location.origin);
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
    irParaLogin();
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
    const { message, code, details } = lerErro(data, response.status);
    throw new ApiError(message, { status: response.status, data, code, details });
  }

  return data;
}

export const api = apiFetch;
