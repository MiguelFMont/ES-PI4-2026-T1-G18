import { apiFetch } from './http/api.js';

export async function salvarPreferencias(preferencias) {
    return apiFetch('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ preferencias })
    });
}

export async function buscarPreferencias() {
    const usuario = await apiFetch('/auth/me');
    return usuario.preferencias;
}