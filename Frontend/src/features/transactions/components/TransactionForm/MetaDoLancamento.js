import { criarMeta, listarMetas } from '../../../goals/services/goalsService.js';
import { iniciarFormulario as iniciarFormularioDeMeta } from '../../../goals/components/GoalForm/GoalForm.js';
import { notificar } from '../../../../shared/components/notificacao.js';
import { formatarMoeda, formatarPercentual } from '../../../../shared/utils/moeda.js';

const MENSAGEM_ESCOLHA = 'Escolha a meta.';

/**
 * Liga o trecho "Vincular a uma meta" do formulário de transação (HTML em TransactionForm.html). Quem separa um dinheiro
 * para um objetivo pode vincular a transação a uma meta: o valor dela passa a contar no progresso da meta.
 *
 * - Marcar "Vincular a uma meta" busca as metas do usuário. Se ele tem metas, elas aparecem para escolher uma; se não tem
 *   nenhuma, abre a janela "Nova meta" (o mesmo formulário da tela de Metas) e a meta criada já fica escolhida.
 * - Fechar a janela sem criar a meta, sem ter outras, desmarca a opção.
 *
 * Devolve { ler(), lerMeta(), validar(), reiniciar(), definirErro(mensagem), focar() }, a interface dos outros campos do
 * formulário: `lerMeta()` devolve a meta escolhida (ou null) e `validar()` a mensagem de erro (ou null).
 */
export function ligarMeta(raiz, { signal }) {
  const caixa = raiz.querySelector('#campo-vincular-meta');
  const carregando = raiz.querySelector('#campo-meta-carregando');
  const lista = raiz.querySelector('#campo-meta-lista');
  const botaoOutra = raiz.querySelector('#campo-meta-nova');
  const erro = raiz.querySelector('#campo-meta-erro');
  const modelo = raiz.querySelector('#modelo-meta-opcao');
  const janela = raiz.querySelector('#transactions-meta-modal');

  let metas = [];
  let metaCriada = null; // a meta que o formulário da janela acabou de criar

  // ---------------------------------------------------------------- a lista de metas

  function criarOpcao(meta) {
    const opcao = modelo.content.firstElementChild.cloneNode(true);
    opcao.querySelector('input').value = meta.id;
    opcao.querySelector('[data-campo="titulo"]').textContent = meta.titulo;
    opcao.querySelector('[data-campo="resumo"]').textContent =
      `${formatarMoeda(meta.valorAtual)} de ${formatarMoeda(meta.valorObjetivo)} (${formatarPercentual(meta.percentual)})`;
    return opcao;
  }

  function mostrarLista() {
    lista.replaceChildren(...metas.map(criarOpcao));
    lista.hidden = false;
    botaoOutra.hidden = false;
  }

  function esconderLista() {
    lista.replaceChildren();
    lista.hidden = true;
    botaoOutra.hidden = true;
    carregando.hidden = true;
  }

  const escolhida = () => lista.querySelector('input[name="metaId"]:checked');

  function escolher(id) {
    const opcao = [...lista.querySelectorAll('input[name="metaId"]')].find((radio) => radio.value === id);
    if (opcao) opcao.checked = true;
  }

  /** Busca as metas do usuário (com o progresso de hoje). Devolve false, e desmarca a opção, se a busca falhar. */
  async function carregarMetas() {
    carregando.hidden = false;
    try {
      metas = await listarMetas();
    } catch (falha) {
      notificar(falha?.status ? 'Não foi possível carregar suas metas.' : (falha?.message ?? 'Erro inesperado.'), 'erro');
      caixa.checked = false;
      esconderLista();
      return false;
    } finally {
      carregando.hidden = true;
    }
    return true;
  }

  // ---------------------------------------------------------------- a janela "Nova meta"

  const formularioDeMeta = iniciarFormularioDeMeta(janela, {
    signal,
    enviar: async (dados) => {
      try {
        metaCriada = await criarMeta(dados);
      } catch (falha) {
        notificar(falha?.status ? 'Não foi possível criar a meta.' : (falha?.message ?? 'Erro inesperado.'), 'erro');
        throw falha; // o formulário continua aberto e mostra os erros de campo
      }
      notificar('Meta criada.', 'sucesso');
      return metaCriada;
    },
    aoFechar: async () => {
      janela.hidden = true;
      if (metaCriada) {
        const nova = metaCriada;
        metaCriada = null;
        if (await carregarMetas()) {
          mostrarLista();
          escolher(nova.id); // a meta que acabou de ser criada já fica escolhida
        }
      } else if (metas.length === 0) {
        caixa.checked = false; // fechou sem criar e não há outra meta: não há o que vincular
        esconderLista();
      }
      caixa.focus();
    },
  });

  function abrirJanela() {
    metaCriada = null;
    janela.hidden = false;
    formularioDeMeta.abrirNovo();
  }

  // Esc fecha só a janela (e não o painel de trás); o Tab circula só dentro dela.
  document.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape' || janela.hidden) return;
    evento.preventDefault();
    evento.stopPropagation(); // o painel da transação não vê este Esc
    formularioDeMeta.fechar();
  }, { capture: true, signal });

  janela.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Tab') return;
    const focaveis = [...janela.querySelectorAll('input, select, textarea, button')].filter((el) => !el.disabled && el.offsetParent !== null);
    if (focaveis.length === 0) return;
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  }, { signal });

  janela.addEventListener('click', (evento) => {
    if (evento.target === janela) formularioDeMeta.fechar(); // clicar no fundo escuro fecha
  }, { signal });

  // ---------------------------------------------------------------- a opção "Vincular a uma meta"

  caixa.addEventListener('change', async () => {
    definirErro(null);
    if (!caixa.checked) {
      esconderLista();
      return;
    }
    if (!(await carregarMetas())) return;
    if (metas.length === 0) abrirJanela();
    else mostrarLista();
  }, { signal });

  botaoOutra.addEventListener('click', abrirJanela, { signal });
  lista.addEventListener('change', () => definirErro(null), { signal });

  function definirErro(mensagem) {
    erro.hidden = !mensagem;
    erro.textContent = mensagem ?? '';
  }

  return {
    ler: () => escolhida()?.value ?? '',
    lerMeta: () => (caixa.checked ? metas.find((meta) => meta.id === escolhida()?.value) ?? null : null),
    // marcou "Vincular" mas não escolheu a meta
    validar: () => (caixa.checked && !escolhida() ? MENSAGEM_ESCOLHA : null),
    definirErro,
    focar: () => (lista.hidden ? caixa : lista.querySelector('input')).focus(),

    /** Volta ao estado inicial (depois de salvar a transação): desmarcada e sem as metas na tela. */
    reiniciar() {
      caixa.checked = false;
      esconderLista();
      definirErro(null);
      metas = [];
    },

    /** Busca as metas de novo e mostra a lista (a meta escolhida deixou de existir, por exemplo). */
    async recarregar() {
      if (caixa.checked && (await carregarMetas())) {
        if (metas.length === 0) abrirJanela();
        else mostrarLista();
      }
    },
  };
}
