// Diz se o último gesto do usuário foi no teclado ou no mouse. Os campos que abrem uma lista ao passar o mouse
// (calendário e seletores) usam isto para abrir também quando o foco chega por Tab, mas não quando o foco veio de um
// clique (clicar no campo não mantém a lista aberta).
let porTeclado = false;

document.addEventListener('keydown', () => { porTeclado = true; }, true);
document.addEventListener('pointerdown', () => { porTeclado = false; }, true);

export const entradaPorTeclado = () => porTeclado;
