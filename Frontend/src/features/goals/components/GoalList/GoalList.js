import { formatarData, formatarMoeda, formatarPercentual } from '../../../../shared/utils/moeda.js';

/** Etiqueta do estado da meta. O texto sempre aparece; a cor só reforça. */
function statusDa(meta) {
  if (meta.concluida) return { rotulo: 'Concluída', situacao: 'ok' };
  if (!meta.prazo) return { rotulo: 'Em andamento', situacao: 'andamento' }; // meta sem prazo nunca vence
  if (!meta.noPrazo) return { rotulo: 'Prazo vencido', situacao: 'erro' };
  return { rotulo: 'No prazo', situacao: 'andamento' };
}

function textoDoPrazo(meta) {
  const data = formatarData(meta.prazo);
  if (meta.concluida) return data;
  if (!meta.noPrazo) return `${data} (vencido)`;
  if (meta.diasRestantes === 0) return `${data} (vence hoje)`;
  return `${data} (${meta.diasRestantes} ${meta.diasRestantes === 1 ? 'dia' : 'dias'})`;
}

/** De onde vem o valor da meta: o que já havia mais as transações vinculadas (os aportes). */
function textoDaOrigem(meta) {
  const jaTinha = meta.valorInicial > 0 ? `O que você já tinha (${formatarMoeda(meta.valorInicial)}) mais ` : '';
  if (meta.quantidadeAportes === 0) {
    return `${jaTinha}nenhuma transação vinculada ainda. Ao cadastrar uma transação, escolha "Vincular a uma meta".`;
  }
  const quantas = meta.quantidadeAportes === 1 ? '1 transação vinculada' : `${meta.quantidadeAportes} transações vinculadas`;
  return `${jaTinha}${formatarMoeda(meta.valorAportado)} em ${quantas}.`;
}

/**
 * Liga a lista de metas (HTML em GoalList.html). A tela decide o que fazer em cada ação (`aoEditar(meta)`,
 * `aoExcluir(meta)`, `tentarNovamente()`); aqui ficam só os estados e o preenchimento dos cartões, copiados do <template>.
 * Todo texto entra com textContent (vem da API). Devolve { iniciarCarga, mostrarMetas(metas), mostrarErro(mensagem) }.
 */
export function iniciarLista(raiz, { signal, aoEditar, aoExcluir, tentarNovamente }) {
  const carregando = raiz.querySelector('#goals-carregando');
  const erro = raiz.querySelector('#goals-erro');
  const erroTexto = raiz.querySelector('#goals-erro-texto');
  const vazio = raiz.querySelector('#goals-vazio');
  const itens = raiz.querySelector('#goals-itens');
  const modelo = raiz.querySelector('#modelo-meta');

  const metasPorId = new Map();

  raiz.querySelector('#goals-tentar-novamente').addEventListener('click', tentarNovamente, { signal });

  // Um só ouvinte para os botões de todos os cartões (delegação): os cartões são criados e apagados a cada carga.
  itens.addEventListener('click', (evento) => {
    const botao = evento.target.closest('button[data-acao]');
    const meta = metasPorId.get(botao?.closest('li[data-id]')?.dataset.id);
    if (!botao || !meta) return;
    if (botao.dataset.acao === 'editar') aoEditar(meta);
    else if (botao.dataset.acao === 'excluir') aoExcluir(meta);
  }, { signal });

  function mostrar(estado) {
    carregando.hidden = estado !== 'carregando';
    erro.hidden = estado !== 'erro';
    vazio.hidden = estado !== 'vazio';
    itens.hidden = estado !== 'lista';
  }

  const campo = (cartao, nome) => cartao.querySelector(`[data-campo="${nome}"]`);

  function criarCartao(meta) {
    const cartao = modelo.content.firstElementChild.cloneNode(true);
    cartao.dataset.id = meta.id;

    campo(cartao, 'titulo').textContent = meta.titulo;
    campo(cartao, 'atual').textContent = formatarMoeda(meta.valorAtual);
    campo(cartao, 'objetivo').textContent = formatarMoeda(meta.valorObjetivo);
    campo(cartao, 'percentual').textContent = formatarPercentual(meta.percentual);
    campo(cartao, 'falta').textContent = meta.concluida ? 'Nada: meta atingida!' : formatarMoeda(meta.falta);
    // meta sem prazo: os cards Prazo e Guardar por mês não aparecem (não há o que calcular)
    const temPrazo = Boolean(meta.prazo);
    campo(cartao, 'prazo').parentElement.hidden = !temPrazo;
    campo(cartao, 'aporte').parentElement.hidden = !temPrazo;
    if (temPrazo) {
      campo(cartao, 'prazo').textContent = textoDoPrazo(meta);
      campo(cartao, 'aporte').textContent = meta.concluida ? '-' : formatarMoeda(meta.aporteMensalNecessario);
    }

    const status = statusDa(meta);
    const etiqueta = campo(cartao, 'status');
    etiqueta.textContent = status.rotulo;
    etiqueta.classList.add(`goals-status--${status.situacao}`);

    // a barra é um progressbar de verdade (leitor de tela) e o preenchimento segue o percentual
    const barra = campo(cartao, 'barra');
    barra.setAttribute('aria-valuenow', String(Math.round(meta.percentual)));
    barra.setAttribute('aria-label', `Progresso da meta ${meta.titulo}`);
    barra.style.setProperty('--progresso', `${meta.percentual}%`);
    barra.classList.toggle('goals-barra--concluida', meta.concluida);

    campo(cartao, 'origem').textContent = textoDaOrigem(meta);

    // o nome da meta no rótulo diz qual meta o botão afeta (todos os cartões têm os mesmos botões)
    cartao.querySelector('[data-acao="editar"]').setAttribute('aria-label', `Editar ${meta.titulo}`);
    cartao.querySelector('[data-acao="excluir"]').setAttribute('aria-label', `Excluir ${meta.titulo}`);
    return cartao;
  }

  return {
    iniciarCarga() {
      mostrar('carregando');
    },

    mostrarMetas(metas) {
      metasPorId.clear();
      for (const meta of metas) metasPorId.set(meta.id, meta);
      itens.replaceChildren(...metas.map(criarCartao));
      mostrar(metas.length === 0 ? 'vazio' : 'lista');
    },

    mostrarErro(mensagem) {
      erroTexto.textContent = mensagem;
      mostrar('erro');
    },
  };
}
