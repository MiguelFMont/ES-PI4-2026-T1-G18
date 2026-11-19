import { aplicarMascaraMoeda, ligarCampo } from '../../../../shared/components/campos.js';
import { ligarCalendario } from '../../../../shared/components/Calendario.js';
import { isoDeData } from '../../../../shared/utils/dateRange.js';
import { lerValor, valorParaCampo } from '../../../../shared/utils/moeda.js';

const LIMITE_TITULO = 100;

// Mensagem curta de cada campo (também usada para traduzir os erros da API, que vêm em inglês).
const MENSAGENS = {
  titulo: `Informe o nome da meta (até ${LIMITE_TITULO} caracteres).`,
  objetivo: 'Informe um valor maior que zero.',
  inicial: 'Informe um valor válido (ou deixe em branco).',
  prazo: 'Informe um prazo válido.',
};

// campo do formulário -> campo da API (para mostrar o erro da API junto do campo certo)
const CAMPO_DA_API = { titulo: 'titulo', valorObjetivo: 'objetivo', valorInicial: 'inicial', prazo: 'prazo' };

/**
 * Liga o formulário de meta (HTML em GoalForm.html). `enviar(dados, id)` cria (id undefined) ou edita (id da meta) e devolve
 * uma Promise com a meta; se ela falhar com erros de campo da API (`erro.details`), eles aparecem junto dos campos.
 * `aoFechar(meta)` roda quando o formulário fecha: com a meta criada ou editada se foi salvo, sem nada se foi cancelado.
 * O botão #goals-nova (que abre o formulário) é opcional: fora da tela de Metas, quem usa o formulário chama abrirNovo().
 * Devolve { abrirNovo(), abrirEdicao(meta), fechar(), estaAberto() }.
 */
export function iniciarFormulario(raiz, { signal, enviar, aoFechar }) {
  const area = raiz.querySelector('#goals-form-area');
  const titulo = raiz.querySelector('#goals-form-titulo');
  const formulario = raiz.querySelector('#goals-form');
  const botaoSalvar = raiz.querySelector('#goals-salvar');
  const botaoAbrir = raiz.querySelector('#goals-nova'); // só existe na tela de Metas

  const campos = {
    titulo: ligarCampo(formulario, 'goals-campo-titulo'),
    objetivo: ligarCampo(formulario, 'goals-campo-objetivo'),
    inicial: ligarCampo(formulario, 'goals-campo-inicial'),
    prazo: ligarCalendario(formulario.querySelector('#goals-campo-prazo').closest('[data-calendario]'), { signal }),
  };
  aplicarMascaraMoeda(campos.objetivo.controle);
  aplicarMascaraMoeda(campos.inicial.controle);

  let idEmEdicao = null; // null = criando uma meta nova
  let prazoOriginal = null; // ao editar, o prazo que a meta já tinha (uma meta vencida pode ser editada sem mudar o prazo)

  function limparErros() {
    for (const campo of Object.values(campos)) campo.definirErro(null);
  }

  /** Lê e valida os campos. Devolve { erros, dados }: `dados` é null se houver erro. */
  function lerFormulario() {
    const erros = {};
    const nome = campos.titulo.ler().trim();
    if (!nome || nome.length > LIMITE_TITULO) erros.titulo = MENSAGENS.titulo;

    const objetivo = lerValor(campos.objetivo.ler());
    if (!(objetivo > 0)) erros.objetivo = MENSAGENS.objetivo;

    const textoInicial = campos.inicial.ler().trim();
    const inicial = textoInicial === '' ? 0 : lerValor(textoInicial);
    if (Number.isNaN(inicial)) erros.inicial = MENSAGENS.inicial;

    const prazo = campos.prazo.ler(); // "AAAA-MM-DD", ou "" se estiver em branco ou inválido
    if (!prazo) erros.prazo = MENSAGENS.prazo;
    // o prazo novo não pode estar no passado (o prazo que a meta já tinha, ao editar, não é conferido)
    else if (prazo !== prazoOriginal && prazo < isoDeData(new Date())) erros.prazo = 'O prazo não pode ser no passado.';

    if (Object.keys(erros).length > 0) return { erros, dados: null };
    return {
      erros,
      // ao editar sem mudar o prazo, ele nem vai para a API
      dados: { titulo: nome, valorObjetivo: objetivo, valorInicial: inicial, ...(prazo !== prazoOriginal && { prazo }) },
    };
  }

  function abrir(modo) {
    limparErros();
    titulo.textContent = modo;
    area.hidden = false;
    botaoAbrir?.setAttribute('aria-expanded', 'true');
    campos.titulo.focar();
  }

  function fechar(metaSalva) {
    area.hidden = true;
    botaoAbrir?.setAttribute('aria-expanded', 'false');
    idEmEdicao = null;
    prazoOriginal = null;
    formulario.reset();
    limparErros();
    aoFechar?.(metaSalva);
  }

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limparErros();

    const { erros, dados } = lerFormulario();
    if (!dados) {
      for (const [campo, mensagem] of Object.entries(erros)) campos[campo].definirErro(mensagem);
      campos[Object.keys(erros)[0]].focar?.();
      return;
    }

    botaoSalvar.disabled = true;
    try {
      const meta = await enviar(dados, idEmEdicao ?? undefined);
      fechar(meta);
    } catch (erro) {
      // erros de campo da API ({ campo: [mensagens] }) aparecem junto do campo; o resto o chamador já avisou
      for (const campoApi of Object.keys(erro?.details ?? {})) {
        const campo = CAMPO_DA_API[campoApi];
        if (campo) campos[campo].definirErro(MENSAGENS[campo]);
      }
    } finally {
      botaoSalvar.disabled = false;
    }
  }, { signal });

  botaoAbrir?.addEventListener('click', () => (area.hidden ? iniciarNovo() : fechar()), { signal });
  raiz.querySelector('#goals-cancelar').addEventListener('click', () => fechar(), { signal });

  function iniciarNovo() {
    idEmEdicao = null;
    prazoOriginal = null;
    formulario.reset();
    abrir('Nova meta');
  }

  return {
    abrirNovo: iniciarNovo,
    fechar,
    estaAberto: () => !area.hidden,

    /** Abre o formulário com os dados de uma meta (Goal da API) para editar. */
    abrirEdicao(meta) {
      idEmEdicao = meta.id;
      prazoOriginal = meta.prazo.slice(0, 10);
      formulario.reset();
      campos.titulo.definir(meta.titulo);
      campos.objetivo.definir(valorParaCampo(meta.valorObjetivo));
      campos.inicial.definir(meta.valorInicial > 0 ? valorParaCampo(meta.valorInicial) : '');
      campos.prazo.definir(prazoOriginal);
      abrir('Editar meta');
    },
  };
}
