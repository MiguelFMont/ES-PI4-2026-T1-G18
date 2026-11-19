// src/modules/transactions/transactions.service.ts
import { AtualizacaoDeTransacao, transactionsRepository } from "./transactions.repository";
import { TransactionDocument } from "./transactions.model";
import {
  CreateTransactionDto,
  DuplicateTransactionDto,
  PedidoCategorizarTransacao,
  RespostaCategorizarTransacao,
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

// Se a categoria não vier, o Servidor Java a sugere pela descrição (PedidoCategorizarTransacao, issue #34).
// "Outros" é a categoria quando o Servidor não acha nenhuma palavra-chave e também quando ele está fora do ar.
const CATEGORIA_PADRAO = "Outros";

// Códigos de AppError (java-client) que significam "o Servidor Java não respondeu".
const CODES_SERVIDOR_INDISPONIVEL = ["JAVA_SERVER_UNAVAILABLE", "JAVA_SERVER_SHUTTING_DOWN"];

// valores em reais: arredonda em 2 casas para a soma de decimais não deixar "0.30000000000000004"
const emReais = (valor: number) => Math.round(valor * 100) / 100;

function paraDto(t: TransactionDocument & { _id: { toString(): string } }): TransactionResponseDto {
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
    ...(t.metaId ? { metaId: t.metaId } : {}),
    ...(t.cartaoId ? { cartaoId: t.cartaoId } : {}),
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
async function garantirCartoesDoUsuario(userId: string, cartaoIds: string[]) {
  const ids = [...new Set(cartaoIds)];
  const encontrados = await Promise.all(ids.map((id) => investmentsRepository.findCard(userId, id)));
  if (encontrados.some((cartao) => !cartao)) throw new AppError("Cartão não encontrado", 404, "CARD_NOT_FOUND");
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

async function cartaoMaisAntigo(userId: string) {
  return idDe(await investmentsRepository.findOldestCard(userId));
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
      cartaoDoPedido || (alt.cartaoId === null ? undefined : existente?.cartaoId) || (await cartaoMaisAntigo(userId));
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
    }
  }
  return { alteracoes: extras, acao };
}

export const transactionsService = {
  async list(userId: string, filtros: TransactionFiltersDto): Promise<TransactionListResponseDto> {
    const { docs, total, totais } = await transactionsRepository.findByUser(userId, filtros);
    return {
      itens: docs.map(paraDto),
      pagina: filtros.pagina,
      limite: filtros.limite,
      total,
      totalPaginas: Math.ceil(total / filtros.limite),
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

  // Compra no crédito: cartaoId (do próprio usuário) e parcelas (1 a 24). Com parcelas > 1 o Backend cria o parcelamento
  // no cartão (sem juros, nenhuma parcela paga) e liga a transação a ele: a fatura passa a contar as parcelas, não a compra
  // à vista. Sem cartaoId, a compra parcelada fica no cartão mais antigo. Sem o Servidor Java: o cálculo vem na leitura.
  async create(userId: string, dados: CreateTransactionDto) {
    if (dados.metaId) await garantirMetasDoUsuario(userId, [dados.metaId]);
    const credito = dados.formaPagamento === "credito";
    let cartaoId = credito ? dados.cartaoId : undefined;
    const parcelas = credito ? (dados.parcelas ?? 1) : undefined;
    if (cartaoId) await garantirCartoesDoUsuario(userId, [cartaoId]);

    const categoria = dados.categoria ?? (await transactionsService.sugerirCategoria(dados.descricao, dados.valor));

    let parcelamentoId: string | undefined;
    if (parcelas !== undefined && parcelas > 1) {
      cartaoId ??= await cartaoMaisAntigo(userId);
      parcelamentoId = await criarParcelamentoDaCompra(userId, cartaoId, dados.descricao, dados.valor, parcelas);
    }
    try {
      const transacao = await transactionsRepository.create({ ...dados, categoria, userId, cartaoId, parcelas, parcelamentoId });
      return paraDto(transacao);
    } catch (erro) {
      // sem a transação o parcelamento ficaria órfão, cobrando na fatura
      if (parcelamentoId) await investmentsRepository.removeInstallment(userId, parcelamentoId);
      throw erro;
    }
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
    const parcelas = original.parcelas;
    let parcelamentoId: string | undefined;
    if (original.formaPagamento === "credito" && original.tipo === "despesa" && parcelas !== undefined && parcelas > 1) {
      cartaoId ??= await cartaoMaisAntigo(userId);
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
        metaId: original.metaId,
        cartaoId,
        parcelas: parcelamentoId ? parcelas : original.formaPagamento === "credito" ? 1 : undefined,
        parcelamentoId,
        userId,
      });
      return paraDto(copia);
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
    const idsExistentes = new Set(existentes.map((t) => idDe(t)));
    const afetadas = await transactionsRepository.removeMany(userId, [...idsExistentes]);
    await investmentsRepository.removeInstallments(
      userId,
      existentes.flatMap((t) => t.parcelamentoId ?? [])
    );
    return { afetadas, naoEncontradas: ids.filter((id) => !idsExistentes.has(id)) };
  },
};
