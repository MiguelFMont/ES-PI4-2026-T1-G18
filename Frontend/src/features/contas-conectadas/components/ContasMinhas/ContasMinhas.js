/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
import { corDoBanco, iniciais, mostrarLogoDoBanco } from '../../../../shared/utils/avatar.js';
import { svgDoIcone } from '../../../../shared/utils/icones.js';
import { formatarSaldo } from '../../utils/format.js';

/**
 * Liga a lista das contas do usuário (HTML em ContasMinhas.html). A tela decide o que fazer em cada ação (`aoNova()`,
 * `aoEditar(conta)`, `aoExcluir(conta)`, `tentarNovamente()`); aqui ficam só os estados e o preenchimento dos cartões, copiados
 * do <template> do HTML. Todo texto entra com textContent (vem da API).
 * Devolve { iniciarCarga(), mostrarContas(contas), mostrarErro(mensagem) }.
 */
export function iniciarMinhas(raiz, { signal, aoNova, aoEditar, aoExcluir, tentarNovamente }) {
  const carregando = raiz.querySelector('#minhas-carregando');
  const erro = raiz.querySelector('#minhas-erro');
  const erroTexto = raiz.querySelector('#minhas-erro-texto');
  const vazio = raiz.querySelector('#minhas-vazio');
  const itens = raiz.querySelector('#minhas-itens');
  const modelo = raiz.querySelector('#modelo-minha-conta');
  const contasPorId = new Map();

  raiz.querySelector('#minhas-nova').addEventListener('click', () => aoNova(), { signal });
  raiz.querySelector('#minhas-tentar-novamente').addEventListener('click', () => tentarNovamente(), { signal });

  // Um só ouvinte para os botões de todos os cartões (delegação): os cartões são recriados a cada carga.
  itens.addEventListener('click', (evento) => {
    const botao = evento.target.closest('button[data-acao]');
    if (!botao || botao.disabled) return;
    const conta = contasPorId.get(botao.closest('li[data-id]')?.dataset.id);
    if (!conta) return;
    if (botao.dataset.acao === 'editar') aoEditar(conta);
    else if (botao.dataset.acao === 'excluir') aoExcluir(conta);
  }, { signal });

  function mostrar(estado) {
    carregando.hidden = estado !== 'carregando';
    erro.hidden = estado !== 'erro';
    vazio.hidden = estado !== 'vazio';
    itens.hidden = estado !== 'lista';
  }

  const campo = (cartao, nome) => cartao.querySelector(`[data-campo="${nome}"]`);

  function criarCartao(conta) {
    const cartao = modelo.content.firstElementChild.cloneNode(true);
    cartao.dataset.id = conta.id;
    campo(cartao, 'banco').textContent = conta.bancoNome;
    // o avatar: o ícone e a cor escolhidos para a conta ou, sem eles, as iniciais na cor do banco
    const avatar = campo(cartao, 'avatar');
    const doBanco = corDoBanco(conta.banco);
    const desenho = conta.icone ? svgDoIcone(conta.icone) : null;
    avatar.classList.remove('com-logo');
    if (desenho) avatar.innerHTML = desenho; // texto fixo do projeto
    else if (conta.cor || !mostrarLogoDoBanco(avatar, conta.banco, iniciais(conta.nome))) avatar.textContent = iniciais(conta.nome);
    avatar.style.setProperty('--avatar-fundo', conta.cor ? `var(--matiz-${conta.cor})` : doBanco.fundo);
    avatar.style.setProperty('--avatar-texto', conta.cor ? '#ffffff' : doBanco.texto);
    campo(cartao, 'nome').textContent = conta.nome;
    const tipo = campo(cartao, 'tipo');
    tipo.textContent = conta.tipo === 'open_finance' ? 'Open Finance' : 'Manual';
    tipo.dataset.tipo = conta.tipo;
    // Open Finance usa a mesma tag do cartão (shared/styles/campos.css); manual segue com o selo comum
    tipo.classList.toggle('tag-open-finance', conta.tipo === 'open_finance');
    tipo.classList.toggle('minha__tipo', conta.tipo !== 'open_finance');
    const saldo = campo(cartao, 'saldo');
    saldo.textContent = formatarSaldo(conta.saldoAtual);
    saldo.classList.toggle('minha__saldo--negativo', conta.saldoAtual < 0);
    // o nome da conta no rótulo diz qual conta o botão afeta (todos os cartões têm os mesmos botões)
    const botaoEditar = cartao.querySelector('[data-acao="editar"]');
    // conta Open Finance: tudo vem do banco, só o ícone e a cor mudam (se a conexão for desconectada, ela vira manual e edita tudo)
    botaoEditar.setAttribute('aria-label', conta.tipo === 'open_finance' ? `Mudar o ícone e a cor de ${conta.nome}` : `Editar ${conta.nome}`);
    cartao.querySelector('[data-acao="excluir"]').setAttribute('aria-label', `Excluir ${conta.nome}`);
    return cartao;
  }

  return {
    iniciarCarga() {
      mostrar('carregando');
    },

    mostrarContas(contas) {
      contasPorId.clear();
      for (const conta of contas) contasPorId.set(conta.id, conta);
      itens.replaceChildren(...contas.map(criarCartao));
      mostrar(contas.length === 0 ? 'vazio' : 'lista');
    },

    mostrarErro(mensagem) {
      erroTexto.textContent = mensagem;
      mostrar('erro');
    },
  };
}
