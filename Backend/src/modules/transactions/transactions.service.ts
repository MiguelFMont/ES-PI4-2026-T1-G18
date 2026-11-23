// src/modules/transactions/transactions.service.ts
import { AtualizacaoDeTransacao, transactionsRepository } from "./transactions.repository";
import { TransactionDocument } from "./transactions.model";
import {
  CreateTransactionDto,
  CreateTransferDto,
  DuplicateTransactionDto,
  PedidoCategorizarTransacao,
  RespostaCategorizarTransacao,
  SuggestCategoryDto,
  TransactionFiltersDto,
  TransactionListResponseDto,
  TransactionResponseDto,
  UpdateTransactionDto,
  BulkResultDto,
} from "./transactions.dto";
import { javaServerClient } from "../../java-client/java-server.client";
import { AppError } from "../../shared/errors/app-error";
import { goalsRepository } from "../goals/goals.repository";
import { investmentsRepository } from "../investments/investments.repository";
import { InstallmentDocument } from "../investments/investments.model";
import { accountsService } from "../accounts/accounts.service";
import { accountsRepository } from "../accounts/accounts.repository";
import { guardarParaDesfazer } from "../../shared/lixeira/lixeira";
import { AccountResumoDto } from "../accounts/accounts.dto";

// A categoria (e, sem descrição, o texto) de uma transferência entre contas.
export const CATEGORIA_TRANSFERENCIA = "Transferência";

// Se a categoria não vier, o Servidor Java a sugere pela descrição (PedidoCategorizarTransacao, issue #34).
// "Outros" é a categoria quando o Servidor não acha nenhuma palavra-chave e também quando ele está fora do ar.
const CATEGORIA_PADRAO = "Outros";

// Códigos de AppError (java-client) que significam "o Servidor Java não respondeu".
const CODES_SERVIDOR_INDISPONIVEL = ["JAVA_SERVER_UNAVAILABLE", "JAVA_SERVER_SHUTTING_DOWN"];

// valores em reais: arredonda em 2 casas para a soma de decimais não deixar "0.30000000000000004"
const emReais = (valor: number) => Math.round(valor * 100) / 100;

// Os cartões do usuário por id (nome para a tela: "Crédito · Nubank").
async function cartoesDoUsuario(userId: string): Promise<Map<string, { id: string; nome: string }>> {
  const cartoes = await investmentsRepository.findCards(userId);
  return new Map(cartoes.map((c) => [String(c._id), { id: String(c._id), nome: c.nome }]));
}

function paraDto(
  t: TransactionDocument & { _id: { toString(): string } },
  contas: Map<string, AccountResumoDto> = new Map(),
  cartoes: Map<string, { id: string; nome: string }> = new Map()
): TransactionResponseDto {
  const cartao = t.cartaoId ? cartoes.get(t.cartaoId) : undefined;
  const conta = t.contaId ? contas.get(t.contaId) : undefined;
  const contaDestino = t.contaDestinoId ? contas.get(t.contaDestinoId) : undefined;
  return {
    id: t._id.toString(),
    tipo: t.tipo,
    valor: t.valor,
    categoria: t.categoria,
    data: t.data.toISOString(),
    descricao: t.descricao,
    ...(t.observacoes ? { observacoes: t.observacoes } : {}),
    formaPagamento: t.formaPagamento,
    origem: t.origem,
    ...(t.contaId ? { contaId: t.contaId } : {}),
    ...(conta ? { conta } : {}),
    ...(t.contaDestinoId ? { contaDestinoId: t.contaDestinoId } : {}),
    ...(contaDestino ? { contaDestino } : {}),
    ...(t.metaId ? { metaId: t.metaId } : {}),
    ...(t.cartaoId ? { cartaoId: t.cartaoId } : {}),
    ...(cartao ? { cartao } : {}),
    // só compras no crédito têm parcelas (sem o campo gravado, é à vista)
    ...(t.formaPagamento === "credito" ? { parcelas: t.parcelas ?? 1 } : {}),
    ...(t.parcelamentoId ? { parcelamentoId: t.parcelamentoId } : {}),
  };
}

// Só dá para vincular uma transação a uma meta do PRÓPRIO usuário. Uma meta que não existe, ou que é de outro usuário, é
// "não encontrada" (404 GOAL_NOT_FOUND) e nada é gravado.
async function garantirMetasDoUsuario(userId: string, metaIds: string[]) {
  const ids = [...new Set(metaIds)];
  const encontradas = await Promise.all(ids.map((id) => goalsRepository.findOneByUser(userId, id)));
  if (encontradas.some((meta) => !meta)) throw new AppError("Meta não encontrada", 404, "GOAL_NOT_FOUND");
}

// Só dá para ligar uma compra a um cartão do PRÓPRIO usuário. Um cartão que não existe, ou que é de outro usuário, é
// "não encontrado" (404 CARD_NOT_FOUND) e nada é gravado.
async function garantirCartoesDoUsuario(userId: string, cartaoIds: string[], contaId?: string) {
  const ids = [...new Set(cartaoIds)];
  const encontrados = await Promise.all(ids.map((id) => investmentsRepository.findCard(userId, id)));
  if (encontrados.some((cartao) => !cartao)) throw new AppError("Cartão não encontrado", 404, "CARD_NOT_FOUND");
  if (contaId) encontrados.forEach((cartao) => garantirCartaoDaConta(cartao as { contaId?: string }, contaId));
}

// Uma compra no cartão sai da conta a que o cartão está vinculado: não dá para lançar na conta A pagando com o cartão da conta B.
// Cartões antigos, sem conta, valem para qualquer conta.
function garantirCartaoDaConta(cartao: { contaId?: string }, contaId: string) {
  if (cartao.contaId && cartao.contaId !== contaId) {
    throw new AppError("Este cartão é de outra conta: a compra no cartão precisa ser da conta a que ele está vinculado", 422, "CARD_ACCOUNT_MISMATCH");
  }
}

// RN4 e RN5: o lançamento manual precisa de uma conta do PRÓPRIO usuário. Sem nenhuma conta, 422 ACCOUNT_REQUIRED (a tela leva o
// usuário a criar uma); uma conta que não existe, ou é de outro usuário, é 404 ACCOUNT_NOT_FOUND.
async function garantirContaDoLancamento(userId: string, contaId: string) {
  await accountsService.garantirMigracao(userId);
  if ((await accountsService.resumos(userId)).size === 0) {
    throw new AppError("Crie uma conta antes de fazer lançamentos", 422, "ACCOUNT_REQUIRED");
  }
  const conta = await accountsService.obterDoUsuario(userId, contaId);
  garantirContaManual(conta);
  return conta;
}

// Lançamento manual não entra numa conta Open Finance: o saldo dela vem do banco e só as transações importadas ficam nela.
function garantirContaManual(conta: { tipo: string }) {
  if (conta.tipo !== "manual") {
    throw new AppError("Não dá para lançar manualmente numa conta Open Finance: use uma conta manual", 422, "MANUAL_ENTRY_NOT_ALLOWED");
  }
}

// Transferência (RN6 e RN7): contas diferentes e manuais (o saldo de uma Open Finance vem do banco e não pode ser mexido).
function garantirParDeContasDaTransferencia(origem: { _id: unknown; tipo: string }, destino: { _id: unknown; tipo: string }) {
  if (String(origem._id) === String(destino._id)) throw invalido("A conta de origem e a de destino devem ser diferentes");
  if (origem.tipo !== "manual" || destino.tipo !== "manual") {
    throw new AppError("Transferências só envolvem contas manuais", 422, "TRANSFER_NOT_ALLOWED");
  }
}

const idDe = (doc: unknown) => (doc as { _id: { toString(): string } })._id.toString();

// A descrição de um parcelamento tem até 100 caracteres (a da transação não tem limite).
const descricaoDoParcelamento = (descricao: string) => descricao.slice(0, 100);

// O parcelamento de uma compra parcelada: sem juros, nenhuma parcela paga. Só a descrição, o valor e o número de parcelas
// vêm da transação; as parcelas e o saldo devedor o Servidor Java calcula quando a fatura é lida.
async function criarParcelamentoDaCompra(userId: string, cartaoId: string, descricao: string, valor: number, parcelas: number) {
  const dados: InstallmentDocument = {
    userId,
    cartaoId,
    descricao: descricaoDoParcelamento(descricao),
    valorTotal: valor,
    parcelas,
    parcelasPagas: 0,
    taxaJurosMensal: 0,
  };
  return idDe(await investmentsRepository.createInstallment(dados));
}

// Toda compra no crédito precisa de um cartão. As antigas (de antes disso) sem cartão são ligadas ao cartão mais antigo da conta delas; sem
// nenhum cartão na conta, ficam como estão até o usuário criar um (aí a próxima leitura as liga).
async function vincularCreditoSemCartao(userId: string) {
  for (const contaId of await transactionsRepository.contasComCreditoSemCartao(userId)) {
    const cartao = await investmentsRepository.findOldestCardOfConta(userId, contaId);
    if (cartao) await transactionsRepository.vincularCreditoSemCartao(userId, contaId, idDe(cartao));
  }
}

// O cartão onde uma compra parcelada sem `cartaoId` cai: o mais antigo DA CONTA do lançamento. Ter cartão é opcional; parcelar é que
// precisa de um cartão (da conta) onde criar o parcelamento.
async function cartaoMaisAntigo(userId: string, contaId?: string) {
  const maisAntigo = contaId ? await investmentsRepository.findOldestCardOfConta(userId, contaId) : await investmentsRepository.findOldestCard(userId);
  if (!maisAntigo) throw new AppError("Para parcelar uma compra, cadastre na aba Cartão um cartão vinculado a esta conta", 422, "CARD_REQUIRED");
  return idDe(maisAntigo);
}

const invalido = (mensagem: string) => new AppError(mensagem, 400, "VALIDATION_ERROR");
const parcelamentoEmAndamento = () =>
  new AppError(
    "O parcelamento desta transação já tem parcelas pagas: só dá para trocar o cartão e a descrição",
    409,
    "INSTALLMENT_IN_PROGRESS"
  );

// O que fazer com o parcelamento ligado a uma transação editada.
type AcaoDoParcelamento =
  | { tipo: "criar"; dados: InstallmentDocument }
  | { tipo: "atualizar"; id: string; campos: Partial<InstallmentDocument> }
  | { tipo: "remover"; id: string };

interface PlanoDaTransacao {
  alteracoes: AtualizacaoDeTransacao;
  acao?: AcaoDoParcelamento;
}

// Edição em lote de uma transação: decide, ANTES de gravar qualquer coisa, o estado final do cartão, das parcelas e do
// parcelamento ligado. Regras:
//  - cartaoId e parcelas > 1 só valem se a forma de pagamento FINAL for crédito (senão 400); parcelar só despesa manual;
//  - trocar a forma de pagamento para uma que não é crédito desliga cartão, parcelas e parcelamento;
//  - compra parcelada (parcelas > 1): o parcelamento é criado, atualizado (valor, parcelas, cartão, descrição) ou, ao
//    voltar para à vista, removido; a compra sem cartaoId fica ligada ao cartão do parcelamento (ou ao mais antigo);
//  - com parcelas já pagas o valor e o número de parcelas não mudam, e o parcelamento não é removido: 409
//    INSTALLMENT_IN_PROGRESS (só cartão e descrição podem mudar).
async function planejarEdicao(
  userId: string,
  original: TransactionDocument,
  alt: AtualizacaoDeTransacao,
  existente: (InstallmentDocument & { _id: { toString(): string } }) | undefined
): Promise<PlanoDaTransacao> {
  const forma = alt.formaPagamento ?? original.formaPagamento;
  const tipo = alt.tipo ?? original.tipo;
  const valor = alt.valor ?? original.valor;
  const descricao = alt.descricao ?? original.descricao;
  const credito = forma === "credito";
  const pedeParcelar = alt.parcelas !== undefined && alt.parcelas !== null && alt.parcelas > 1;

  if (!credito && (typeof alt.cartaoId === "string" || pedeParcelar)) {
    throw invalido("Cartão e parcelas só valem com a forma de pagamento crédito");
  }
  if (pedeParcelar && tipo !== "despesa") throw invalido("Só despesas podem ser parceladas");
  if (pedeParcelar && original.origem !== "manual") throw invalido("Transações importadas não podem ser parceladas");

  const mexeNoCartao = ["valor", "descricao", "formaPagamento", "tipo", "cartaoId", "parcelas"].some(
    (campo) => (alt as Record<string, unknown>)[campo] !== undefined
  );
  if (!mexeNoCartao) return { alteracoes: alt };

  const extras: AtualizacaoDeTransacao = { ...alt };
  const parcelasFinal = credito ? (alt.parcelas ?? original.parcelas ?? 1) : 1;
  const parcelada = credito && tipo === "despesa" && parcelasFinal > 1;
  let acao: AcaoDoParcelamento | undefined;

  if (parcelada) {
    const cartaoDoPedido = alt.cartaoId !== undefined ? alt.cartaoId : original.cartaoId;
    const cartaoId =
      cartaoDoPedido || (alt.cartaoId === null ? undefined : existente?.cartaoId) || (await cartaoMaisAntigo(userId, alt.contaId ?? original.contaId));
    extras.cartaoId = cartaoId;
    extras.parcelas = parcelasFinal;

    if (existente) {
      const pagas = existente.parcelasPagas > 0;
      if (pagas && (valor !== existente.valorTotal || parcelasFinal !== existente.parcelas)) throw parcelamentoEmAndamento();
      const campos: Partial<InstallmentDocument> = {};
      if (valor !== existente.valorTotal) campos.valorTotal = valor;
      if (parcelasFinal !== existente.parcelas) campos.parcelas = parcelasFinal;
      if (cartaoId !== existente.cartaoId) campos.cartaoId = cartaoId;
      if (descricaoDoParcelamento(descricao) !== existente.descricao) campos.descricao = descricaoDoParcelamento(descricao);
      extras.parcelamentoId = idDe(existente);
      if (Object.keys(campos).length > 0) acao = { tipo: "atualizar", id: idDe(existente), campos };
    } else {
      acao = {
        tipo: "criar",
        dados: {
          userId,
          cartaoId,
          descricao: descricaoDoParcelamento(descricao),
          valorTotal: valor,
          parcelas: parcelasFinal,
          parcelasPagas: 0,
          taxaJurosMensal: 0,
        },
      };
    }
  } else {
    // à vista (ou receita, ou outra forma de pagamento): se a compra era parcelada, o parcelamento deixa de existir
    if (existente) {
      if (existente.parcelasPagas > 0) throw parcelamentoEmAndamento();
      acao = { tipo: "remover", id: idDe(existente) };
    }
    if (!credito) {
      // saiu do crédito: cartão, parcelas e parcelamento deixam de valer
      if (alt.formaPagamento !== undefined) Object.assign(extras, { cartaoId: null, parcelas: null, parcelamentoId: null });
    } else {
      if (existente || original.parcelamentoId) extras.parcelamentoId = null;
      if (alt.parcelas !== undefined || original.parcelas !== undefined || existente) extras.parcelas = 1;
      // toda compra no crédito é vinculada a um cartão: sem cartão (nem novo nem o que já tinha), vale o mais antigo da conta
      const cartaoFinal = alt.cartaoId !== undefined ? alt.cartaoId : original.cartaoId;
      if (!cartaoFinal) extras.cartaoId = await cartaoMaisAntigo(userId, alt.contaId ?? original.contaId);
    }
  }
  return { alteracoes: extras, acao };
}

// O que dá para editar numa transação importada do Open Finance (o resto vem do banco).
const CAMPOS_EDITAVEIS_DO_OPEN_FINANCE = ["descricao", "categoria", "metaId", "observacoes"];

// Campos de receita/despesa que não existem numa transferência.
const CAMPOS_FORA_DA_TRANSFERENCIA = ["tipo", "categoria", "formaPagamento", "metaId", "cartaoId", "parcelas"] as const;

// Edição em lote e contas: o `contaId` (mover para outra conta) e o `contaDestinoId` (só da transferência) precisam ser contas do
// próprio usuário; só lançamentos manuais mudam de conta; uma transferência continua entre duas contas manuais diferentes e não
// ganha campos de receita/despesa. Tudo é conferido ANTES de gravar qualquer coisa.
async function validarContasDaEdicao(
  userId: string,
  itens: { id: string; alteracoes: UpdateTransactionDto }[],
  originais: Map<string, TransactionDocument>
) {
  const contas = new Map<string, Awaited<ReturnType<typeof accountsService.obterDoUsuario>>>();
  const conta = async (id: string) => {
    if (!contas.has(id)) contas.set(id, await accountsService.obterDoUsuario(userId, id));
    return contas.get(id)!;
  };

  for (const { id, alteracoes: alt } of itens) {
    const original = originais.get(id)!;
    const transferencia = original.tipo === "transferencia";

    // o que vem do Open Finance é do banco: só a descrição, a categoria, a meta e a observação se editam
    if (original.origem === "pluggy") {
      const proibido = Object.keys(alt).find((campo) => !CAMPOS_EDITAVEIS_DO_OPEN_FINANCE.includes(campo));
      if (proibido) {
        throw new AppError(
          "Uma transação do Open Finance só pode ter a descrição, a categoria, a meta e a observação alteradas",
          422,
          "OPEN_FINANCE_READ_ONLY"
        );
      }
    }

    if (transferencia) {
      const proibido = CAMPOS_FORA_DA_TRANSFERENCIA.find((campo) => alt[campo] !== undefined);
      if (proibido) throw invalido(`Uma transferência não tem ${proibido}`);
    } else if (alt.contaDestinoId !== undefined) {
      throw invalido("Só uma transferência tem conta de destino");
    }
    if ((alt.contaId !== undefined || alt.contaDestinoId !== undefined) && original.origem !== "manual") {
      throw invalido("Transações importadas ficam na conta de onde vieram");
    }
    if (alt.contaId !== undefined) garantirContaManual(await conta(alt.contaId)); // mover um lançamento: só para conta manual
    if (alt.contaDestinoId !== undefined) await conta(alt.contaDestinoId);

    // compra no cartão: o cartão (o novo ou o que ela já tem) precisa ser da conta final do lançamento
    const contaFinal = alt.contaId ?? original.contaId;
    const cartaoFinal = alt.cartaoId !== undefined ? alt.cartaoId : original.cartaoId;
    const formaFinal = alt.formaPagamento ?? original.formaPagamento;
    if (!transferencia && contaFinal && cartaoFinal && formaFinal === "credito" && (alt.contaId !== undefined || alt.cartaoId)) {
      const cartao = await investmentsRepository.findCard(userId, cartaoFinal);
      if (cartao) garantirCartaoDaConta(cartao, contaFinal);
    }

    if (transferencia && (alt.contaId !== undefined || alt.contaDestinoId !== undefined)) {
      const origem = await conta(alt.contaId ?? (original.contaId as string));
      const destino = await conta(alt.contaDestinoId ?? (original.contaDestinoId as string));
      garantirParDeContasDaTransferencia(origem, destino);
    }
  }
}

export const transactionsService = {
  async list(userId: string, filtros: TransactionFiltersDto): Promise<TransactionListResponseDto> {
    let cartaoPadrao = false;
    if (filtros.cartaoId) {
      if (!(await investmentsRepository.findCard(userId, filtros.cartaoId))) {
        throw new AppError("Cartão não encontrado", 404, "CARD_NOT_FOUND");
      }
      const maisAntigo = await investmentsRepository.findOldestCard(userId);
      cartaoPadrao = String(maisAntigo?._id) === filtros.cartaoId;
    }
    await accountsService.garantirMigracao(userId);
    await vincularCreditoSemCartao(userId);
    const { docs, total, totais } = await transactionsRepository.findByUser(userId, filtros, { cartaoPadrao });
    const contas = await accountsService.resumos(userId);
    const cartoes = await cartoesDoUsuario(userId);
    return {
      itens: docs.map((d) => paraDto(d, contas, cartoes)),
      // todos=true: uma página só, com tudo (o `limite` devolvido é a quantidade de itens)
      pagina: filtros.todos ? 1 : filtros.pagina,
      limite: filtros.todos ? Math.max(total, 1) : filtros.limite,
      total,
      totalPaginas: filtros.todos ? (total > 0 ? 1 : 0) : Math.ceil(total / filtros.limite),
      resumo: {
        receitas: emReais(totais.receitas),
        despesas: emReais(totais.despesas),
        saldo: emReais(totais.receitas - totais.despesas),
      },
    };
  },

  // Pede ao Servidor Java a categoria de uma transação. Cadastrar não pode depender de um serviço de apoio: se o
  // Servidor estiver fora do ar, devolve "Outros" (e avisa no log). Qualquer outro erro dele (resposta inesperada,
  // validação) continua sendo erro, porque indicaria um problema no contrato entre Backend e Servidor.
  async sugerirCategoria(descricao: string, valor: number): Promise<string> {
    try {
      const resposta = await javaServerClient.enviarPedido<PedidoCategorizarTransacao, RespostaCategorizarTransacao>(
        "PedidoCategorizarTransacao",
        "RespostaCategorizarTransacao",
        { descricao, valor }
      );
      return resposta.categoria;
    } catch (erro) {
      if (erro instanceof AppError && CODES_SERVIDOR_INDISPONIVEL.includes(erro.code)) {
        console.warn(`[transactions] Servidor Java indisponível: categoria "${CATEGORIA_PADRAO}" para "${descricao}"`);
        return CATEGORIA_PADRAO;
      }
      throw erro;
    }
  },

  // O botão "Sugerir" do formulário: pergunta ao Servidor Java a categoria de uma descrição, sem gravar nada. Diferente de
  // sugerirCategoria (que cai em "Outros" para o cadastro não falhar), aqui o usuário pediu a sugestão: se o Servidor
  // estiver fora do ar, o erro (503) segue e a tela avisa, em vez de devolver uma categoria que não foi sugerida por ninguém.
  async suggestCategory(dados: SuggestCategoryDto): Promise<{ categoria: string }> {
    const resposta = await javaServerClient.enviarPedido<PedidoCategorizarTransacao, RespostaCategorizarTransacao>(
      "PedidoCategorizarTransacao",
      "RespostaCategorizarTransacao",
      { descricao: dados.descricao, valor: dados.valor ?? 0 }
    );
    return { categoria: resposta.categoria };
  },

  // Compra no crédito: cartaoId (do próprio usuário) e parcelas (1 a 24). Com parcelas > 1 o Backend cria o parcelamento
  // no cartão (sem juros, nenhuma parcela paga) e liga a transação a ele: a fatura passa a contar as parcelas, não a compra
  // à vista. Sem cartaoId, a compra parcelada fica no cartão mais antigo. Sem o Servidor Java: o cálculo vem na leitura.
  async create(userId: string, dados: CreateTransactionDto) {
    await garantirContaDoLancamento(userId, dados.contaId);
    if (dados.metaId) await garantirMetasDoUsuario(userId, [dados.metaId]);
    const credito = dados.formaPagamento === "credito";
    let cartaoId = credito ? dados.cartaoId : undefined;
    const parcelas = credito ? (dados.parcelas ?? 1) : undefined;
    // toda compra no crédito é vinculada a um cartão: sem `cartaoId`, vale o mais antigo da conta (sem nenhum, 422 CARD_REQUIRED)
    if (credito && !cartaoId) cartaoId = await cartaoMaisAntigo(userId, dados.contaId);
    if (cartaoId) await garantirCartoesDoUsuario(userId, [cartaoId], dados.contaId);

    const categoria = dados.categoria ?? (await transactionsService.sugerirCategoria(dados.descricao, dados.valor));

    let parcelamentoId: string | undefined;
    if (parcelas !== undefined && parcelas > 1) {
      cartaoId ??= await cartaoMaisAntigo(userId, dados.contaId);
      parcelamentoId = await criarParcelamentoDaCompra(userId, cartaoId, dados.descricao, dados.valor, parcelas);
    }
    try {
      const transacao = await transactionsRepository.create({ ...dados, categoria, userId, cartaoId, parcelas, parcelamentoId });
      return paraDto(transacao, await accountsService.resumos(userId), await cartoesDoUsuario(userId));
    } catch (erro) {
      // sem a transação o parcelamento ficaria órfão, cobrando na fatura
      if (parcelamentoId) await investmentsRepository.removeInstallment(userId, parcelamentoId);
      throw erro;
    }
  },

  // Transferência entre duas contas manuais do usuário: um único registro (tipo "transferencia"), que não é receita nem despesa
  // e por isso não entra nos totais. O saldo das contas é sempre calculado (RN9): nada é gravado nas contas.
  async createTransfer(userId: string, dados: CreateTransferDto) {
    await accountsService.garantirMigracao(userId);
    if (dados.contaId === dados.contaDestinoId) throw invalido("A conta de origem e a de destino devem ser diferentes");
    const origem = await accountsService.obterDoUsuario(userId, dados.contaId);
    const destino = await accountsService.obterDoUsuario(userId, dados.contaDestinoId);
    garantirParDeContasDaTransferencia(origem, destino);

    const transacao = await transactionsRepository.create({
      tipo: "transferencia",
      valor: dados.valor,
      categoria: CATEGORIA_TRANSFERENCIA,
      data: dados.data,
      descricao: dados.descricao ?? CATEGORIA_TRANSFERENCIA,
      observacoes: dados.observacoes,
      formaPagamento: "outro",
      origem: "manual",
      contaId: dados.contaId,
      contaDestinoId: dados.contaDestinoId,
      userId,
    });
    return paraDto(transacao, await accountsService.resumos(userId));
  },

  // Duplica um lançamento manual: copia tudo menos a data (e o id), inclusive a meta a que ele está vinculado (um aporte
  // parecido, como o do mês seguinte), e grava como um lançamento novo e manual. O original não muda. Importadas da Pluggy não duplicam (a fonte delas é o extrato da instituição). Sem Servidor Java: a
  // categoria é a do original.
  async duplicate(userId: string, id: string, dados: DuplicateTransactionDto) {
    const original = await transactionsRepository.findOneByUser(userId, id);
    if (!original) throw new AppError("Transação não encontrada", 404, "TRANSACTION_NOT_FOUND"); // código próprio: o Frontend separa "não existe" de "rota inexistente"
    if (original.origem !== "manual") {
      throw new AppError("Só lançamentos manuais podem ser duplicados", 422, "DUPLICATE_NOT_ALLOWED");
    }
    // o cartão e as parcelas também são copiados; uma compra parcelada ganha o próprio parcelamento novo (o do original
    // continua dele)
    let cartaoId = original.cartaoId;
    if (cartaoId && !(await investmentsRepository.findCard(userId, cartaoId))) cartaoId = undefined;
    if (original.formaPagamento === "credito" && !cartaoId && original.contaId) cartaoId = await cartaoMaisAntigo(userId, original.contaId);
    const parcelas = original.parcelas;
    let parcelamentoId: string | undefined;
    if (original.formaPagamento === "credito" && original.tipo === "despesa" && parcelas !== undefined && parcelas > 1) {
      cartaoId ??= await cartaoMaisAntigo(userId, original.contaId);
      parcelamentoId = await criarParcelamentoDaCompra(userId, cartaoId, original.descricao, original.valor, parcelas);
    }
    try {
      const copia = await transactionsRepository.create({
        tipo: original.tipo,
        valor: original.valor,
        categoria: original.categoria,
        data: dados.data ?? new Date(),
        descricao: original.descricao,
        observacoes: original.observacoes,
        formaPagamento: original.formaPagamento,
        origem: "manual",
        contaId: original.contaId,
        contaDestinoId: original.contaDestinoId,
        metaId: original.metaId,
        cartaoId,
        parcelas: parcelamentoId ? parcelas : original.formaPagamento === "credito" ? 1 : undefined,
        parcelamentoId,
        userId,
      });
      return paraDto(copia, await accountsService.resumos(userId), await cartoesDoUsuario(userId));
    } catch (erro) {
      if (parcelamentoId) await investmentsRepository.removeInstallment(userId, parcelamentoId);
      throw erro;
    }
  },

  // Lote: não é tudo ou nada. Faz o que existe e devolve os ids que não foram encontrados. Meta ou cartão que não são do
  // usuário, e alterações de cartão/parcelas inválidas ou inseguras (planejarEdicao), recusam o lote inteiro, antes de gravar.
  async updateMany(userId: string, itens: { id: string; alteracoes: UpdateTransactionDto }[]): Promise<BulkResultDto> {
    await garantirMetasDoUsuario(userId, itens.flatMap((i) => (i.alteracoes.metaId ? [i.alteracoes.metaId] : [])));
    await garantirCartoesDoUsuario(userId, itens.flatMap((i) => (i.alteracoes.cartaoId ? [i.alteracoes.cartaoId] : [])));
    await accountsService.garantirMigracao(userId);

    const originais = new Map(
      (await transactionsRepository.findManyByUser(userId, itens.map((i) => i.id))).map((t) => [idDe(t), t as TransactionDocument])
    );
    const encontrados = itens.filter((i) => originais.has(i.id));
    const parcelamentos = new Map(
      (
        await investmentsRepository.findInstallmentsByIds(
          userId,
          encontrados.flatMap((i) => originais.get(i.id)?.parcelamentoId ?? [])
        )
      ).map((p) => [idDe(p), p as InstallmentDocument & { _id: { toString(): string } }])
    );

    await validarContasDaEdicao(userId, encontrados, originais);

    const planos: { id: string; plano: PlanoDaTransacao }[] = [];
    for (const { id, alteracoes } of encontrados) {
      const original = originais.get(id)!;
      const existente = original.parcelamentoId ? parcelamentos.get(original.parcelamentoId) : undefined;
      planos.push({ id, plano: await planejarEdicao(userId, original, alteracoes, existente) });
    }

    // tudo validado: agora os parcelamentos e, por fim, as transações
    for (const { plano } of planos) {
      const acao = plano.acao;
      if (acao?.tipo === "criar") plano.alteracoes.parcelamentoId = idDe(await investmentsRepository.createInstallment(acao.dados));
      else if (acao?.tipo === "atualizar") await investmentsRepository.updateInstallment(userId, acao.id, acao.campos);
      else if (acao?.tipo === "remover") await investmentsRepository.removeInstallment(userId, acao.id);
    }
    const afetadas = await transactionsRepository.updateMany(
      userId,
      planos.map(({ id, plano }) => ({ id, alteracoes: plano.alteracoes }))
    );
    return { afetadas, naoEncontradas: itens.map((i) => i.id).filter((id) => !originais.has(id)) };
  },

  // Excluir uma compra parcelada exclui também o parcelamento ligado a ela (as transações saem primeiro: se algo falhar no
  // meio, sobra um parcelamento sem dono, que o usuário ainda consegue excluir, e não uma compra sumida da fatura).
  async removeMany(userId: string, ids: string[]): Promise<BulkResultDto> {
    const existentes = await transactionsRepository.findManyByUser(userId, ids);
    // Lançamento de conta com conexão Open Finance não se exclui (quem manda nele é o banco): desconectando a conta, ela vira manual e libera a exclusão.
    const contasOpenFinance = new Set((await accountsRepository.findByUser(userId)).filter((c) => c.tipo === "open_finance").map((c) => String(c._id)));
    if (existentes.some((t) => contasOpenFinance.has(String(t.contaId)) || contasOpenFinance.has(String(t.contaDestinoId)))) {
      throw new AppError(
        "Lançamentos de uma conta Open Finance não podem ser excluídos. Desconecte a conta para que ela passe a ser manual",
        422,
        "OPEN_FINANCE_READ_ONLY"
      );
    }
    const idsExistentes = new Set(existentes.map((t) => idDe(t)));
    const idsParcelamentos = existentes.flatMap((t) => t.parcelamentoId ?? []);
    const parcelamentos = await investmentsRepository.findInstallmentsByIds(userId, idsParcelamentos);
    const afetadas = await transactionsRepository.removeMany(userId, [...idsExistentes]);
    await investmentsRepository.removeInstallments(userId, idsParcelamentos);
    // o que saiu fica na lixeira por alguns minutos: POST /v1/undo/:id traz de volta os lançamentos e os parcelamentos, com os mesmos ids
    const desfazerId =
      existentes.length > 0
        ? guardarParaDesfazer(userId, async () => {
            await transactionsRepository.restaurar(existentes);
            await investmentsRepository.restaurarParcelamentos(parcelamentos);
          })
        : undefined;
    return { afetadas, naoEncontradas: ids.filter((id) => !idsExistentes.has(id)), ...(desfazerId ? { desfazerId } : {}) };
  },
};
