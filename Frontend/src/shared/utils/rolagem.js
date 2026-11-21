/**
 * Trava a rolagem da página enquanto um painel ou uma janela está aberta (Nova transação, confirmação).
 *
 * Só esconder a barra de rolagem (overflow: hidden) faz a página inteira ganhar a largura dela de uma vez e os campos se
 * deslocam; ao fechar, voltam. Por isso, ao travar, o espaço da barra é devolvido como margem à direita do <body>: o
 * conteúdo fica exatamente onde estava. Pode ser chamada por mais de uma janela ao mesmo tempo (a confirmação abre por
 * cima do painel): a rolagem só volta quando a última libera.
 */
let travas = 0;
let anterior = null; // o overflow e o padding-right que o <body> tinha antes

export function travarRolagem() {
  travas += 1;
  if (travas > 1) return;
  const corpo = document.body;
  const largura = window.innerWidth - document.documentElement.clientWidth; // 0 se a página não rola ou a barra é flutuante
  anterior = { overflow: corpo.style.overflow, paddingRight: corpo.style.paddingRight };
  if (largura > 0) {
    const atual = parseFloat(getComputedStyle(corpo).paddingRight) || 0;
    corpo.style.paddingRight = `${atual + largura}px`;
  }
  corpo.style.overflow = 'hidden';
}

export function liberarRolagem() {
  if (travas === 0) return;
  travas -= 1;
  if (travas > 0) return;
  document.body.style.overflow = anterior?.overflow ?? '';
  document.body.style.paddingRight = anterior?.paddingRight ?? '';
  anterior = null;
}
