// O "logo" de um cartão: um quadrado arredondado com o logo do banco da conta vinculada (ou, sem logo, as iniciais do nome do cartão na cor do banco).
// Se o usuário escolheu um ícone ou uma cor para o cartão, o quadrado mostra o desenho (ou as iniciais) na cor escolhida. As cores, as iniciais e os
// logos são os mesmos das listas que sobem do rodapé das janelas (shared/utils/avatar.js).
import { corDoBanco, iniciais, mostrarLogoDoBanco } from '../../../shared/utils/avatar.js';
import { svgDoIcone } from '../../../shared/utils/icones.js';

/** Pinta o elemento como o logo do cartão (cartao = um item de GET /investments/cards). */
export function aplicarLogo(elemento, cartao) {
  const doBanco = corDoBanco(cartao.conta?.banco);
  const fundo = cartao.cor ? `var(--matiz-${cartao.cor})` : doBanco.fundo;
  const texto = cartao.cor ? '#ffffff' : doBanco.texto;
  const desenho = cartao.icone ? svgDoIcone(cartao.icone) : null;
  elemento.classList.remove('com-logo');
  if (desenho) {
    elemento.innerHTML = desenho; // texto fixo do projeto
  } else if (cartao.cor || !mostrarLogoDoBanco(elemento, cartao.conta?.banco, iniciais(cartao.nome))) {
    elemento.textContent = iniciais(cartao.nome);
  }
  elemento.style.setProperty('--logo-fundo', fundo);
  elemento.style.setProperty('--logo-texto', texto);
}
