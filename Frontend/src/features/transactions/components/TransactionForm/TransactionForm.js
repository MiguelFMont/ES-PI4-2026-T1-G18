import { criarTransacao, criarTransferencia, sugerirCategoria } from '../../services/transactionsService.js';
import { dataValida } from '../../../../shared/utils/dateRange.js';
import { aplicarMascaraMoeda, ligarCampo } from '../../../../shared/components/campos.js';
import { ligarCalendario } from '../../../../shared/components/Calendario.js';
import { comCarregamento, notificar } from '../../../../shared/components/notificacao.js';
import { liberarRolagem, travarRolagem } from '../../../../shared/utils/rolagem.js';
import { dataDeHoje } from '../../utils/format.js';
import { CATEGORIAS, rotuloDe } from '../../utils/constants.js';
import { LIMITE_OBSERVACOES, MENSAGENS_CAMPO, lerValor, validarFormulario } from '../../utils/formValidation.js';
import { ligarMeta } from './MetaDoLancamento.js';
import { ligarCartao } from './CartaoDoLancamento.js';
import { definirAvatar, iniciais } from '../../../../shared/utils/avatar.js';

const ORDEM_DOS_CAMPOS = ['tipo', 'descricao', 'valor', 'data', 'conta', 'categoria', 'formaPagamento', 'cartao', 'meta', 'observacoes'];
const ESPERA_DA_TROCA_MS = 320; // quanto o esqueleto de carregamento fica à vista ao trocar entre lançamento e transferência
// campos do formulário que a validação de utils/formValidation.js não conhece (a conta tem validação própria, abaixo)
const SEM_VALIDACAO_COMUM = new Set(['conta', 'cartao', 'meta']);

// Campo da API -> campo do formulário, quando os nomes são diferentes (cartaoId e parcelas aparecem juntos, no campo Cartão)
const CAMPO_DA_API = { metaId: 'meta', cartaoId: 'cartao', parcelas: 'cartao', contaId: 'conta' };

/**
 * Liga a lógica à janela "Novo lançamento" (HTML em TransactionForm.html), que abre no centro da tela. O botão
 * #botao-alternar-form da página (e o menu dele) a abre (o clique direto no botão passa por `aoAbrirPeloBotao`, que a página usa para
 * levar o usuário a criar uma conta quando ele não tem nenhuma). A aba Transferência troca os campos da própria janela (origem, destino,
 * valor, data, descrição e observação; uma transferência não é receita nem despesa), passando por um esqueleto de carregamento; ela fecha com o X, com a tecla Esc ou clicando no fundo escuro.
 * A categoria é escolhida na lista ou pelo botão Sugerir, que chama o Servidor Java antes de salvar. Observação e Meta ficam recolhidas atrás de botões redondos. O botão verde salva e fecha; "Salvar e criar outro" salva e
 * deixa a janela aberta, com os campos limpos; a lixeira limpa o formulário.
 * Erros de preenchimento mostram uma mensagem curta no campo e uma notificação geral. Só atualiza a tela depois
 * que o Backend confirma a gravação. Depois de salvar, o painel fecha e `aoSalvar()` é chamado (e aguardado); o tipo
 * e a data escolhidos ficam para o próximo lançamento.
 * A opção "Vincular a uma meta" (MetaDoLancamento.js) liga a transação a uma meta: o valor conta no progresso dela. No crédito,
 * o usuário escolhe o cartão e as parcelas (CartaoDoLancamento.js).
 */
export function iniciarFormulario(raiz, { aoSalvar, aoAbrirPeloBotao, recarregarContas, abrirCartaoRapido, signal }) {
  const formulario = raiz.querySelector('#form-transacao');
  const botaoSalvar = raiz.querySelector('#botao-salvar');
  const contador = raiz.querySelector('#contador-observacoes');
  const painel = raiz.querySelector('#transactions-painel-form');
  const fundo = raiz.querySelector('#transactions-fundo');
  const botaoAbrir = raiz.querySelector('#botao-alternar-form');

  const campos = {
    tipo: ligarCampoTipo(raiz),
    descricao: ligarCampo(raiz, 'campo-descricao'),
    valor: ligarCampo(raiz, 'campo-valor'),
    data: ligarCalendario(formulario.querySelector('[data-calendario]'), { signal }),
    conta: ligarCampo(raiz, 'campo-conta'),
    contaDestino: ligarCampo(raiz, 'campo-conta-destino'),
    categoria: ligarCampo(raiz, 'campo-categoria'),
    formaPagamento: ligarCampo(raiz, 'campo-formaPagamento'),
    meta: ligarMeta(raiz, { signal }),
    observacoes: ligarCampo(raiz, 'campo-observacoes'),
  };
  campos.cartao = ligarCartao(raiz, {
    signal,
    formaPagamento: campos.formaPagamento,
    tipo: campos.tipo,
    valor: () => lerValor(campos.valor.ler()),
    conta: () => campos.conta.ler(),
    // a janela "Novo cartão" (quem a liga é a página): recebe a conta escolhida e a lista de contas para o campo "Conta do cartão"
    abrirCartaoRapido: () => abrirCartaoRapido?.({ contaId: campos.conta.ler(), contas: contasAtuais ?? [] }),
  });
  campos.conta.controle.addEventListener('change', () => campos.cartao.atualizarConta(), { signal }); // a lista de cartões acompanha a conta

  campos.data.definir(dataDeHoje());
  aplicarMascaraMoeda(campos.valor.controle); // o valor já aparece formatado (1 -> 0,01; 11 -> 0,11)

  campos.observacoes.controle.addEventListener('input', () => {
    contador.textContent = `${campos.observacoes.ler().length}/${LIMITE_OBSERVACOES}`;
  });

  const painelAberto = () => painel.classList.contains('transactions-painel--aberto');
  let rolagemTravada = false;
  const travar = () => { if (!rolagemTravada) { travarRolagem(); rolagemTravada = true; } };
  const liberar = () => { if (rolagemTravada) { liberarRolagem(); rolagemTravada = false; } };

  // `tipo` ('despesa' ou 'receita') abre o formulário já nele; sem tipo (o clique direto no botão) vale o que estava marcado.
  function abrirPainel(tipo) {
    if (tipo === 'despesa' || tipo === 'receita' || tipo === 'transferencia') {
      const opcao = raiz.querySelector(`input[name="tipo"][value="${tipo}"]`);
      if (opcao && !opcao.checked) {
        opcao.checked = true;
        opcao.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    limparErros(); // os avisos de uma abertura anterior não ficam
    painel.classList.add('transactions-painel--aberto');
    fundo.classList.add('transactions-fundo--aberto');
    travar(); // trava a rolagem da página de trás, sem a barra sumir e deslocar os campos
    botaoAbrir.setAttribute('aria-expanded', 'true');
    campos.descricao.focar();
  }

  function fecharPainel() {
    painel.classList.remove('transactions-painel--aberto');
    fundo.classList.remove('transactions-fundo--aberto');
    liberar();
    botaoAbrir.setAttribute('aria-expanded', 'false');
    botaoAbrir.focus(); // devolve o foco a quem abriu
  }

  // ---------------------------------------------------------------- lançamento ou transferência (as abas do topo)
  const tituloForm = raiz.querySelector('#transactions-form-titulo');
  const esqueleto = raiz.querySelector('#form-esqueleto');
  const textoSalvar = raiz.querySelector('#botao-salvar-texto');
  const rotuloConta = raiz.querySelector('#rotulo-conta');
  const rotuloDescricao = raiz.querySelector('#rotulo-descricao');
  const botaoOutroRotulo = raiz.querySelector('#botao-salvar-outro');
  let modo = 'lancamento'; // 'lancamento' (despesa e receita) ou 'transferencia'
  let tipoAnterior = 'despesa';
  let temporizadorTroca = 0;
  let contasAtuais = null; // as contas do usuário (null até chegarem)
  formulario.dataset.modo = modo;

  const manuais = () => (contasAtuais ?? []).filter((c) => c.tipo === 'manual');

  /** Põe as contas nas listas do formulário: no lançamento, todas; na transferência, só as manuais (origem e destino). */
  function preencherContas() {
    const usar = manuais(); // lançamento manual e transferência só em conta manual: o saldo de uma conta Open Finance vem do banco
    const trocar = (campo, opcoes, padrao) => {
      const select = campo.controle;
      const escolhida = select.value;
      for (const antiga of select.querySelectorAll('option')) antiga.remove();
      for (const conta of opcoes) { const opcao = new Option(`${conta.nome} (${conta.bancoNome})`, conta.id); definirAvatar(opcao, { banco: conta.banco, sigla: iniciais(conta.nome), titulo: conta.nome, subtitulo: conta.bancoNome, icone: conta.icone, cor: conta.cor }); select.add(opcao); }
      select.value = opcoes.some((c) => c.id === escolhida) ? escolhida : (padrao ?? opcoes[0]?.id ?? '');
      select.dispatchEvent(new Event('change', { bubbles: true })); // a lista mostra a opção escolhida
    };
    trocar(campos.conta, usar);
    const origem = campos.conta.ler();
    trocar(campos.contaDestino, manuais(), manuais().find((c) => c.id !== origem)?.id);
  }

  function aplicarModo(novo) {
    modo = novo;
    formulario.dataset.modo = novo;
    const transferencia = novo === 'transferencia';
    tituloForm.textContent = transferencia ? 'Nova transferência' : 'Novo lançamento';
    textoSalvar.textContent = transferencia ? 'Salvar transferência' : 'Salvar lançamento';
    rotuloConta.textContent = transferencia ? 'De (conta de origem)' : 'Conta';
    rotuloDescricao.textContent = transferencia ? 'Descrição (opcional)' : 'Descrição';
    botaoOutroRotulo.setAttribute('aria-label', transferencia ? 'Salvar e criar outra transferência' : 'Salvar e criar outro lançamento');
    painel.setAttribute('aria-label', tituloForm.textContent);
    preencherContas();
    limparErros();
  }

  // Troca o modo passando por um esqueleto de carregamento (os campos somem um instante e voltam já no novo modo).
  function trocarModo(novo) {
    if (novo === modo) return;
    if (novo === 'transferencia' && contasAtuais && manuais().length < 2) {
      notificar('Transferir exige duas contas manuais. Crie outra conta.', 'aviso');
      raiz.querySelector(`input[name="tipo"][value="${tipoAnterior}"]`).checked = true;
      return;
    }
    clearTimeout(temporizadorTroca);
    formulario.classList.add('transactions-form--trocando');
    esqueleto.hidden = false;
    temporizadorTroca = setTimeout(() => {
      aplicarModo(novo);
      esqueleto.hidden = true;
      formulario.classList.remove('transactions-form--trocando');
    }, ESPERA_DA_TROCA_MS);
  }
  signal?.addEventListener('abort', () => clearTimeout(temporizadorTroca));

  for (const opcao of raiz.querySelectorAll('input[name="tipo"]')) {
    opcao.addEventListener('change', () => {
      if (!opcao.checked) return;
      if (opcao.value !== 'transferencia') tipoAnterior = opcao.value;
      trocarModo(opcao.value === 'transferencia' ? 'transferencia' : 'lancamento');
    }, { signal });
  }

  botaoAbrir.addEventListener('click', () => (aoAbrirPeloBotao ? aoAbrirPeloBotao() : abrirPainel()));
  raiz.querySelector('#botao-fechar-form').addEventListener('click', fecharPainel);
  fundo.addEventListener('click', fecharPainel);
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && painelAberto()) fecharPainel();
  }, { signal }); // `signal` tira este ouvinte do document quando a tela é desmontada
  // ao sair da tela com o painel aberto, destrava a rolagem da página (a classe fica no <body>, que não é desmontado)
  signal?.addEventListener('abort', liberar);

  // O Tab circula só dentro do painel enquanto ele está aberto.
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
  });

  // Observação e Meta ficam recolhidas atrás dos botões redondos (aria-expanded diz se estão abertas)
  const partes = [
    { botao: raiz.querySelector('#form-alternar-obs'), area: raiz.querySelector('#form-obs-area') },
    { botao: raiz.querySelector('#form-alternar-meta'), area: raiz.querySelector('#form-meta-area'), meta: true },
  ];
  const caixaMeta = raiz.querySelector('#campo-vincular-meta'); // escondida: o botão redondo de meta é quem a liga e desliga
  function alternarParte(parte, abrir = parte.area.hidden) {
    const { botao, area } = parte;
    area.hidden = !abrir;
    botao.setAttribute('aria-expanded', String(abrir));
    botao.classList.toggle('form-redondo--ativo', abrir);
    if (parte.meta && caixaMeta.checked !== abrir) {
      caixaMeta.checked = abrir; // abrir = vincular a uma meta (carrega a lista ou abre a janela "Nova meta"); fechar = desvincular
      caixaMeta.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  for (const parte of partes) parte.botao.addEventListener('click', () => alternarParte(parte));
  const recolherPartes = () => partes.forEach((parte) => alternarParte(parte, false));

  function limparErros() {
    for (const campo of Object.values(campos)) campo.definirErro(null);
  }

  /** Guarda as contas do usuário e as põe nas listas (mantendo a escolha atual; sem escolha, vale a primeira, a mais antiga). */
  function definirContas(contas) {
    contasAtuais = contas;
    preencherContas();
  }

  function mostrarErros(erros) {
    if (erros.observacoes) alternarParte(partes[0], true); // o erro não pode ficar escondido atrás do botão
    if (erros.meta) alternarParte(partes[1], true);
    const comErro = ORDEM_DOS_CAMPOS.filter((nome) => erros[nome]);
    for (const nome of comErro) campos[nome].definirErro(erros[nome]);
    notificar(comErro.length === 1 ? 'Corrija o campo destacado.' : 'Corrija os campos destacados.', 'erro');
    campos[comErro[0]]?.focar();
  }

  function limparParaProximo() {
    for (const nome of ['descricao', 'valor', 'categoria', 'formaPagamento', 'observacoes']) campos[nome].definir('');
    campos.cartao.reiniciar(); // sem pagamento escolhido, as áreas de cartão e parcelas somem
    campos.meta.reiniciar(); // a meta não se repete de uma transação para a próxima
    recolherPartes();
    contador.textContent = `0/${LIMITE_OBSERVACOES}`;
    campos.descricao.focar();
  }

  // Sugerir: pergunta ao Servidor Java a categoria da descrição digitada e já a coloca no campo (nada é gravado ainda)
  const botaoSugerir = raiz.querySelector('#botao-sugerir');
  const textoSugerir = botaoSugerir.querySelector('span');
  botaoSugerir.addEventListener('click', async () => {
    const descricao = campos.descricao.ler().trim();
    campos.descricao.definirErro(null);
    if (!descricao) {
      campos.descricao.definirErro('Informe a descrição para sugerir a categoria.');
      campos.descricao.focar();
      return;
    }
    const valor = lerValor(campos.valor.ler());
    botaoSugerir.disabled = true;
    textoSugerir.textContent = 'Sugerindo...';
    try {
      const { categoria } = await sugerirCategoria(descricao, Number.isNaN(valor) ? undefined : valor);
      campos.categoria.definirErro(null);
      campos.categoria.definir(categoria);
      if (campos.categoria.ler() !== categoria) throw new Error('A categoria sugerida não está na lista. Escolha uma.');
      campos.categoria.controle.dispatchEvent(new Event('change', { bubbles: true }));
      notificar(`Categoria sugerida: ${rotuloDe(CATEGORIAS, categoria)}.`, 'info');
    } catch (erro) {
      notificar(erro?.status ? 'Não foi possível sugerir a categoria agora. Escolha na lista.' : (erro?.message ?? 'Erro inesperado.'), 'erro');
    } finally {
      botaoSugerir.disabled = false;
      textoSugerir.textContent = 'Sugerir';
    }
  });

  // a lixeira: apaga o que foi digitado (o tipo e a data ficam) e tira os avisos de erro
  raiz.querySelector('#botao-limpar-form').addEventListener('click', () => {
    limparErros();
    limparParaProximo();
  });

  // "Salvar e criar outro": envia o formulário e, se der certo, deixa a janela aberta
  let criarOutro = false;
  const botaoOutro = raiz.querySelector('#botao-salvar-outro');
  botaoOutro.addEventListener('click', () => {
    criarOutro = true;
    formulario.requestSubmit();
  });

  // enquanto grava, os botões de salvar ficam parados (o verde é só um ícone: o estado vai no aria-busy)
  function ocupado(sim) {
    botaoSalvar.disabled = sim;
    botaoOutro.disabled = sim;
    botaoSalvar.setAttribute('aria-busy', String(sim));
  }

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const manterAberto = criarOutro;
    criarOutro = false;
    limparErros();

    if (modo === 'transferencia') {
      await enviarTransferencia(manterAberto);
      return;
    }

    const valores = Object.fromEntries(ORDEM_DOS_CAMPOS.filter((nome) => !SEM_VALIDACAO_COMUM.has(nome)).map((nome) => [nome, campos[nome].ler()]));
    const { erros, dados } = validarFormulario(valores);
    const contaId = campos.conta.ler();
    if (!contaId) erros.conta = MENSAGENS_CAMPO.conta; // sem conta (nenhuma criada, ou a lista não carregou)
    const erroDaMeta = campos.meta.validar(); // marcou "Vincular a uma meta" e não escolheu qual
    if (erroDaMeta) erros.meta = erroDaMeta;
    const erroDoCartao = campos.cartao.validar(); // crédito sem cartão escolhido
    if (erroDoCartao) erros.cartao = erroDoCartao;
    if (!dados || erroDaMeta || erroDoCartao || erros.conta) {
      mostrarErros(erros);
      return;
    }
    dados.contaId = contaId;

    const meta = campos.meta.lerMeta();
    if (meta) dados.metaId = meta.id;
    const cartao = campos.cartao.ler(); // só no crédito
    if (cartao?.cartaoId) dados.cartaoId = cartao.cartaoId;
    if (cartao && cartao.parcelas > 1) dados.parcelas = cartao.parcelas;

    ocupado(true);
    let criada;
    try {
      criada = await comCarregamento('Salvando o lançamento...', () => criarTransacao(dados));
    } catch (erro) {
      ocupado(false);

      if (erro?.code === 'GOAL_NOT_FOUND') {
        // a meta foi excluída (em outra aba, por exemplo) depois de escolhida: busca as metas de novo
        notificar('Essa meta não existe mais. Escolha outra.', 'erro');
        await campos.meta.recarregar();
        return;
      }

      if (erro?.code === 'MANUAL_ENTRY_NOT_ALLOWED') {
        notificar('Escolha uma conta manual: Open Finance não aceita lançamento.', 'erro');
        return;
      }

      if (erro?.code === 'ACCOUNT_REQUIRED' || erro?.code === 'ACCOUNT_NOT_FOUND') {
        // a conta foi excluída (em outra aba, por exemplo) depois de escolhida: a página busca as contas de novo
        notificar(erro.code === 'ACCOUNT_REQUIRED' ? 'Crie uma conta antes de fazer lançamentos.' : 'Essa conta não existe mais. Escolha outra.', 'erro');
        await recarregarContas?.();
        return;
      }

      if (erro?.code === 'CARD_NOT_FOUND') {
        // o cartão foi excluído (em outra aba, por exemplo) depois de escolhido: busca os cartões de novo
        notificar('Esse cartão não existe mais. Escolha outro.', 'erro');
        await campos.cartao.recarregar();
        return;
      }

      if (erro?.code === 'VALIDATION_ERROR' && erro.details) {
        // o Backend recusou campos: mostra a mensagem em português junto de cada um
        const errosApi = {};
        for (const nome of Object.keys(erro.details)) {
          const campo = CAMPO_DA_API[nome] ?? nome; // o campo da API pode ter outro nome que o do formulário
          if (campos[campo]) errosApi[campo] = MENSAGENS_CAMPO[campo];
        }
        if (Object.keys(errosApi).length > 0) {
          mostrarErros(errosApi);
          return;
        }
      }
      // falha de rede (mensagem já amigável) ou erro inesperado
      notificar(erro?.status ? 'Não foi possível salvar a transação. Tente novamente.' : (erro?.message ?? 'Erro inesperado.'), 'erro');
      return;
    }

    ocupado(false);
    limparParaProximo();
    if (!manterAberto) fecharPainel();
    // sem categoria escolhida, o Servidor sugeriu uma: o usuário fica sabendo qual foi
    const sugerida = dados.categoria === undefined && criada?.categoria;
    const vinculada = meta ? ` Vinculada à meta "${meta.titulo}".` : '';
    const parcelada = dados.parcelas > 1 ? ` Parcelada em ${dados.parcelas}x (veja na aba Cartão).` : '';
    notificar(
      (sugerida ? `Transação cadastrada. Categoria sugerida: ${rotuloDe(CATEGORIAS, criada.categoria)}.` : 'Transação cadastrada.') + vinculada + parcelada,
      'sucesso'
    );
    await aoSalvar();
  });

  // ---------------------------------------------------------------- transferência (POST /transactions/transfers)
  async function enviarTransferencia(manterAberto) {
    const erros = {};
    const origem = campos.conta.ler();
    const destino = campos.contaDestino.ler();
    if (!origem) erros.conta = 'Escolha a conta de origem.';
    if (!destino) erros.contaDestino = 'Escolha a conta de destino.';
    else if (origem && origem === destino) erros.contaDestino = 'O destino deve ser diferente da origem.';

    const texto = campos.valor.ler().trim();
    const valor = lerValor(texto);
    if (!texto) erros.valor = 'Informe o valor.';
    else if (!(valor > 0)) erros.valor = 'Informe um valor maior que zero.';

    const data = campos.data.ler();
    if (!dataValida(data)) erros.data = data ? 'Data inválida.' : 'Informe uma data válida.';

    const descricao = campos.descricao.ler().trim();
    if (descricao.length > 100) erros.descricao = 'Máximo de 100 caracteres.';
    const observacoes = campos.observacoes.ler().trim();
    if (observacoes.length > LIMITE_OBSERVACOES) erros.observacoes = MENSAGENS_CAMPO.observacoes;

    const comErro = ['descricao', 'valor', 'data', 'conta', 'contaDestino', 'observacoes'].filter((nome) => erros[nome]);
    if (comErro.length > 0) {
      if (erros.observacoes) alternarParte(partes[0], true);
      for (const nome of comErro) campos[nome].definirErro(erros[nome]);
      notificar(comErro.length === 1 ? 'Corrija o campo destacado.' : 'Corrija os campos destacados.', 'erro');
      campos[comErro[0]]?.focar();
      return;
    }

    const dados = { contaId: origem, contaDestinoId: destino, valor: Math.round(valor * 100) / 100, data };
    if (descricao) dados.descricao = descricao;
    if (observacoes) dados.observacoes = observacoes;

    ocupado(true);
    try {
      await comCarregamento('Salvando a transferência...', () => criarTransferencia(dados));
    } catch (erro) {
      ocupado(false);
      if (erro?.code === 'ACCOUNT_NOT_FOUND') {
        notificar('Uma das contas não existe mais. Escolha de novo.', 'erro');
        await recarregarContas?.();
      } else if (erro?.code === 'TRANSFER_NOT_ALLOWED') {
        notificar('Transferências só envolvem contas manuais.', 'erro');
      } else {
        notificar(erro?.status ? 'Não foi possível salvar a transferência. Tente novamente.' : (erro?.message ?? 'Erro inesperado.'), 'erro');
      }
      return;
    }

    ocupado(false);
    limparParaProximo();
    if (!manterAberto) fecharPainel();
    notificar('Transferência registrada.', 'sucesso');
    await aoSalvar();
  }

  // Na aba Cartão: abre o lançamento já na conta e no cartão escolhidos, pagando no crédito (esses três campos ficam escondidos pelo CSS).
  async function abrirNoCartao(tipo, cartao) {
    abrirPainel(tipo === 'receita' ? 'receita' : 'despesa');
    campos.conta.definir(cartao.contaId);
    campos.conta.controle.dispatchEvent(new Event('change', { bubbles: true }));
    campos.formaPagamento.definir('credito');
    campos.formaPagamento.controle.dispatchEvent(new Event('change', { bubbles: true }));
    await campos.cartao.cartaoCriado(cartao); // busca a lista de cartões da conta e escolhe este
  }

  return { abrir: abrirPainel, abrirNoCartao, fechar: fecharPainel, definirContas, cartaoCriado: (cartao) => campos.cartao.cartaoCriado(cartao) };
}

/** Escolha entre despesa e receita (botões de opção). Mesma interface dos outros campos. */
function ligarCampoTipo(raiz) {
  const erro = raiz.querySelector('#campo-tipo-erro');
  const opcoes = raiz.querySelectorAll('input[name="tipo"]');

  return {
    focar: () => opcoes[0]?.focus(),
    ler: () => raiz.querySelector('input[name="tipo"]:checked')?.value ?? '',
    definir: () => {},
    definirErro(mensagem) {
      erro.hidden = !mensagem;
      erro.textContent = mensagem ?? '';
    },
  };
}
