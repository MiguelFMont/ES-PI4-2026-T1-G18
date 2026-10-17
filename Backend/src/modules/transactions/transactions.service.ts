// src/modules/transactions/transactions.service.ts
import { transactionsRepository } from "./transactions.repository";
import { TransactionDocument } from "./transactions.model";
import {
  CreateTransactionDto,
  TransactionFiltersDto,
  TransactionListResponseDto,
  TransactionResponseDto,
} from "./transactions.dto";

// Sprint 1: a categoria vem do usuário; se faltar, usa "Outros".
// Sprint 2 (issue #34): se faltar, o Servidor Java sugere a categoria (PedidoCategorizarTransacao).
const CATEGORIA_PADRAO = "Outros";

function paraDto(t: TransactionDocument & { _id: { toString(): string } }): TransactionResponseDto {
  return {
    id: t._id.toString(),
    tipo: t.tipo,
    valor: t.valor,
    categoria: t.categoria,
    data: t.data.toISOString(),
    descricao: t.descricao,
    formaPagamento: t.formaPagamento,
    origem: t.origem,
  };
}

export const transactionsService = {
  async list(userId: string, filtros: TransactionFiltersDto): Promise<TransactionListResponseDto> {
    const { docs, total } = await transactionsRepository.findByUser(userId, filtros);
    return {
      itens: docs.map(paraDto),
      pagina: filtros.pagina,
      limite: filtros.limite,
      total,
      totalPaginas: Math.ceil(total / filtros.limite),
    };
  },

  async create(userId: string, dados: CreateTransactionDto) {
    const transacao = await transactionsRepository.create({
      ...dados,
      categoria: dados.categoria ?? CATEGORIA_PADRAO,
      userId,
    });
    return paraDto(transacao);
  },
};
