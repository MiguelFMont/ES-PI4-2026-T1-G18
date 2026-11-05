// src/modules/transactions/transactions.service.ts
import { transactionsRepository } from "./transactions.repository";
import { TransactionDocument } from "./transactions.model";
import {
  CreateTransactionDto,
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
  };
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

  async create(userId: string, dados: CreateTransactionDto) {
    const transacao = await transactionsRepository.create({
      ...dados,
      categoria: dados.categoria ?? (await transactionsService.sugerirCategoria(dados.descricao, dados.valor)),
      userId,
    });
    return paraDto(transacao);
  },

  // Lote: não é tudo ou nada. Faz o que existe e devolve os ids que não foram encontrados.
  async updateMany(userId: string, itens: { id: string; alteracoes: UpdateTransactionDto }[]): Promise<BulkResultDto> {
    const existentes = await transactionsRepository.idsDoUsuario(userId, itens.map((i) => i.id));
    const afetadas = await transactionsRepository.updateMany(userId, itens.filter((i) => existentes.has(i.id)));
    return { afetadas, naoEncontradas: itens.map((i) => i.id).filter((id) => !existentes.has(id)) };
  },

  async removeMany(userId: string, ids: string[]): Promise<BulkResultDto> {
    const existentes = await transactionsRepository.idsDoUsuario(userId, ids);
    const afetadas = await transactionsRepository.removeMany(userId, [...existentes]);
    return { afetadas, naoEncontradas: ids.filter((id) => !existentes.has(id)) };
  },
};
