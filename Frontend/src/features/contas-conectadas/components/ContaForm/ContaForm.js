import { aplicarMascaraMoeda, ligarCampo } from '../../../../shared/components/campos.js';
import { ligarEscolhaIcone } from '../../../../shared/components/escolhaIcone.js';
import { definirAvatar, iniciais } from '../../../../shared/utils/avatar.js';
import { comCarregamento, notificar } from '../../../../shared/components/notificacao.js';
import { lerTaxa, valorParaCampo } from '../../../../shared/utils/moeda.js';
import { liberarRolagem, travarRolagem } from '../../../../shared/utils/rolagem.js';
import { atualizarConta, criarConta } from '../../services/contasService.js';
import { mensagemDeErro } from '../../utils/erros.js';

const LIMITE_NOME = 40;

/**
 * Liga a janela "Nova conta" / "Editar conta" (HTML em ContaForm.html). A tela chama `abrir({ conta?, plano, conexoes })`:
 * sem `conta` é uma conta nova (o tipo se escolhe: manual ou Open Finance, esta só no plano Pro); com `conta`, é a edição
 * (nome, banco e, nas manuais, o saldo inicial). `conexoes` são as conexões Open Finance que ainda não têm conta. Depois que o Backend
 * confirma a gravação, a janela fecha e `aoSalvar(conta)` é chamado (e aguardado). Fecha com o X, com Esc ou clicando no fundo.
 * Devolve { abrir, fechar, definirBancos(bancos) }.
 */
export function iniciarContaForm(raiz, { signal, aoSalvar }) {
  const painel = raiz.querySelector('#conta-painel');
  const fundo = raiz.querySelector('#conta-fundo');
  const formulario = raiz.querySelector('#conta-form');
  const titulo = raiz.querySelector('#conta-titulo');
  const botaoSalvar = raiz.querySelector('#conta-salvar');
  const areaTipo = raiz.querySelector('#conta-tipo-area');
  const opcaoOpen = raiz.querySelector('#conta-opcao-open');
  const avisoPro = raiz.querySelector('#conta-pro-aviso');
  const areaSaldo = raiz.querySelector('#conta-saldo-area');
  const rotuloSaldo = raiz.querySelector('#conta-saldo-rotulo');
  const areaConexao = raiz.querySelector('#conta-conexao-area');
  const areaConectar = raiz.querySelector('#conta-conectar-area');
  const areaNome = raiz.querySelector('#conta-nome-area');
  const areaBanco = raiz.querySelector('#conta-banco-area');

  const campos = {
    nome: ligarCampo(raiz, 'conta-nome'),
    banco: ligarCampo(raiz, 'conta-banco'),
    saldo: ligarCampo(raiz, 'conta-saldo'),
    conexao: ligarCampo(raiz, 'conta-conexao'),
  };
  aplicarMascaraMoeda(campos.saldo.controle);
  const aparencia = ligarEscolhaIcone(raiz.querySelector('#conta-aparencia'), { signal });

  let editando = null; // a conta em edição (null = conta nova)
  let temConexaoLivre = false; // há conexão Open Finance que ainda não virou conta
  let rolagemTravada = false;
  const travar = () => { if (!rolagemTravada) { travarRolagem(); rolagemTravada = true; } };
  const liberar = () => { if (rolagemTravada) { liberarRolagem(); rolagemTravada = false; } };

  const tipoEscolhido = () => raiz.querySelector('input[name="conta-tipo"]:checked')?.value ?? 'manual';
  const aberta = () => painel.classList.contains('conta-painel--aberto');

  /** Troca só as <option>: o <select> tem dentro o <button><selectedcontent> que mostra o texto (replaceChildren o apagaria). */
  function preencher(select, opcoes) {
    for (const antiga of select.querySelectorAll('option')) antiga.remove();
    for (const { valor, rotulo } of opcoes) select.add(new Option(rotulo, valor));
  }

  // Open Finance: o saldo vem do banco (sem campo de saldo) e a conta nasce da conexão. Com conexão livre, escolhe-se qual (e o nome);
  // sem nenhuma, só resta conectar uma (o conectar fica aqui dentro) e a conta aparece sozinha quando a conexão termina.
  function atualizarTipo() {
    const open = !editando && tipoEscolhido() === 'open_finance';
    areaSaldo.hidden = open;
    areaConexao.hidden = !open || !temConexaoLivre;
    areaConectar.hidden = !open;
    areaNome.hidden = open && !temConexaoLivre;
    areaBanco.hidden = open && !temConexaoLivre;
    botaoSalvar.hidden = open && !temConexaoLivre;
  }

  for (const opcao of raiz.querySelectorAll('input[name="conta-tipo"]')) opcao.addEventListener('change', atualizarTipo, { signal });

  function limparErros() {
    for (const campo of Object.values(campos)) campo.definirErro(null);
  }

  function fechar() {
    painel.classList.remove('conta-painel--aberto');
    fundo.classList.remove('conta-fundo--aberto');
    liberar();
  }

  /**
   * Abre a janela. `plano` ('free' ou 'pro') decide se a opção Open Finance vale; `conexoes` é a lista de conexões (do GET
   * /connected-accounts) que ainda não viraram conta.
   */
  function abrir({ conta = null, plano = 'free', conexoes = [] } = {}) {
    editando = conta;
    limparErros();
    titulo.textContent = conta?.tipo === 'open_finance' ? 'Ícone e cor da conta' : conta ? 'Editar conta' : 'Nova conta';
    botaoSalvar.textContent = conta ? 'Salvar alterações' : 'Salvar conta';

    // o tipo só se escolhe ao criar
    areaTipo.hidden = Boolean(conta);
    const pro = plano === 'pro';
    const inputOpen = opcaoOpen.querySelector('input');
    inputOpen.disabled = !pro;
    opcaoOpen.classList.toggle('conta-opcao--bloqueada', !pro);
    avisoPro.hidden = pro;
    raiz.querySelector('input[name="conta-tipo"][value="manual"]').checked = true;

    preencher(campos.conexao.controle, conexoes.map((c) => ({ valor: c.id, rotulo: c.instituicao })));
    temConexaoLivre = conexoes.length > 0;

    campos.nome.definir(conta?.nome ?? '');
    campos.banco.definir(conta?.banco ?? 'outro');
    aparencia.definir({ icone: conta?.icone, cor: conta?.cor });
    campos.saldo.definir(conta ? valorParaCampo(conta.saldoInicial) : '');
    rotuloSaldo.textContent = 'Saldo bancário';
    atualizarTipo();
    // editar muda só o nome e o banco: o saldo inicial se define ao criar a conta
    if (conta) areaSaldo.hidden = true;
    // conta Open Finance: só o ícone e a cor mudam
    areaNome.hidden = areaBanco.hidden = soAparencia();

    painel.classList.add('conta-painel--aberto');
    fundo.classList.add('conta-fundo--aberto');
    travar();
    campos.nome.focar();
    campos.banco.controle.dispatchEvent(new Event('change', { bubbles: true })); // a lista mostra a opção escolhida
  }

  raiz.querySelector('#conta-fechar').addEventListener('click', fechar, { signal });
  raiz.querySelector('#conta-cancelar').addEventListener('click', fechar, { signal });
  fundo.addEventListener('click', fechar, { signal });
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && aberta()) fechar();
  }, { signal });
  signal?.addEventListener('abort', liberar);

  // O Tab circula só dentro da janela enquanto ela está aberta.
  painel.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Tab') return;
    const focaveis = [...painel.querySelectorAll('input, select, textarea, button')].filter((el) => !el.disabled && el.offsetParent !== null);
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

  const soAparencia = () => editando?.tipo === 'open_finance';

  /** Confere os campos. Devolve { erros, dados }: `dados` é o corpo pronto para a API (ou null se algo está errado). */
  function validar() {
    const erros = {};
    if (soAparencia()) return { erros, dados: aparencia.ler() }; // { icone, cor }
    const nome = campos.nome.ler().trim();
    if (!nome) erros.nome = 'Informe o nome da conta.';
    else if (nome.length > LIMITE_NOME) erros.nome = `Máximo de ${LIMITE_NOME} caracteres.`;

    const banco = campos.banco.ler();
    if (!banco) erros.banco = 'Escolha o banco.';

    const open = !editando && tipoEscolhido() === 'open_finance';
    const dados = { nome, banco };
    // ícone e cor: ao criar só vão se escolhidos; ao editar, null tira o que já havia (volta ao logo do banco)
    const { icone, cor } = aparencia.ler();
    if (editando) Object.assign(dados, { icone, cor });
    else Object.assign(dados, icone ? { icone } : {}, cor ? { cor } : {});

    if (open) {
      dados.tipo = 'open_finance';
      dados.conectadaId = campos.conexao.ler();
      if (!dados.conectadaId) erros.conexao = 'Escolha a conexão. Se não houver, conecte uma conta abaixo.';
    } else if (!areaSaldo.hidden) {
      const texto = campos.saldo.ler().trim();
      const saldo = texto ? lerTaxa(texto) : 0; // em branco = 0
      if (Number.isNaN(saldo)) erros.saldo = 'Saldo inválido.';
      else dados.saldoInicial = Math.round(saldo * 100) / 100;
    }
    return Object.keys(erros).length > 0 ? { erros, dados: null } : { erros, dados };
  }

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limparErros();
    const { erros, dados } = validar();
    if (!dados) {
      for (const [nome, mensagem] of Object.entries(erros)) campos[nome].definirErro(mensagem);
      notificar('Corrija os campos destacados.', 'erro');
      campos[Object.keys(erros)[0]]?.focar();
      return;
    }

    botaoSalvar.disabled = true;
    botaoSalvar.setAttribute('aria-busy', 'true');
    try {
      const salva = await comCarregamento('Salvando a conta...', () => (editando ? atualizarConta(editando.id, dados) : criarConta(dados)));
      fechar();
      notificar(editando ? 'Conta alterada.' : 'Conta criada.', 'sucesso');
      await aoSalvar(salva);
    } catch (erro) {
      if (erro?.code === 'ACCOUNT_NAME_IN_USE') {
        campos.nome.definirErro('Você já tem uma conta com este nome.');
        campos.nome.focar();
      } else if (erro?.code === 'PLAN_REQUIRED') {
        notificar('Contas Open Finance fazem parte do plano Pro.', 'aviso');
      } else {
        notificar(mensagemDeErro(erro, 'Não foi possível salvar a conta.'), 'erro');
      }
    } finally {
      botaoSalvar.disabled = false;
      botaoSalvar.removeAttribute('aria-busy');
    }
  }, { signal });

  return {
    abrir,
    fechar,
    /** Põe a lista de bancos (de GET /accounts/banks) no campo Banco. */
    definirBancos(bancos) {
      preencher(campos.banco.controle, bancos.map((b) => ({ valor: b.codigo, rotulo: b.nome })));
      // na lista em folha cada banco aparece com o círculo na cor dele
      for (const opcao of campos.banco.controle.querySelectorAll('option')) definirAvatar(opcao, { banco: opcao.value, sigla: iniciais(opcao.textContent), titulo: opcao.textContent });
    },
  };
}
