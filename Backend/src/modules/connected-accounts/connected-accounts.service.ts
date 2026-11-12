// src/modules/connected-accounts/connected-accounts.service.ts
// Contas conectadas (Open Finance, sandbox da Pluggy) e a importação das transações delas.
//
// Fluxo de conectar: o item da Pluggy é criado com o `clientUserId` do usuário (pelo widget Pluggy Connect ou pelo
// sandbox direto). Ao registrar o item aqui, conferimos que o `clientUserId` é o do usuário logado: sem isso,
// qualquer um poderia "adotar" o item de outro, já que a chave da Pluggy é uma só para o sistema.
//
// Fluxo de importar: lê as transações das contas do item, ignora o que não é gasto real (pendentes, zeradas e o
// pagamento da fatura do cartão), pula as que já foram importadas (pelo id da Pluggy), pede a categoria de cada nova
// ao Servidor Java e grava com origem "pluggy".
import { AppError } from "../../shared/errors/app-error";
import { CONECTOR_SANDBOX, CREDENCIAIS_SANDBOX, pluggyClient } from "../../integrations/pluggy/pluggy.client";
import { MotivoIgnorada, TransacaoParaImportar, mapearTransacao } from "../../integrations/pluggy/pluggy.mapper";
import { PluggyAccount } from "../../integrations/pluggy/pluggy.types";
import { transactionsRepository } from "../transactions/transactions.repository";
import { transactionsService } from "../transactions/transactions.service";
import { ConnectedAccountDocument, ContaDaConexao } from "./connected-accounts.model";
import { connectedAccountsRepository } from "./connected-accounts.repository";
import { ConnectedAccountResponseDto, ResultadoImportacao } from "./connected-accounts.dto";

// Limite por usuário: a chave da Pluggy é uma só e compartilhada pelo time, então evitamos abuso do sandbox.
const MAX_CONTAS_POR_USUARIO = 5;
const CONCORRENCIA_DA_CATEGORIZACAO = 5; // o mesmo tamanho do pool de conexões com o Servidor Java

// Status do item na Pluggy que pedem ação do usuário (refazer a conexão).
const STATUS_COM_ERRO = ["LOGIN_ERROR", "OUTDATED", "WAITING_USER_INPUT", "WAITING_USER_ACTION", "ERROR"];

type ContaLida = ConnectedAccountDocument & { _id: { toString(): string }; createdAt: Date };

// O que o repository devolve (lean) tem _id e createdAt, mas o tipo gerado pelo Mongoose não os expõe: afirmamos aqui, num lugar só.
const comoLida = (doc: unknown) => doc as ContaLida;

function paraDto(conta: ContaLida): ConnectedAccountResponseDto {
  return {
    id: conta._id.toString(),
    instituicao: conta.instituicao,
    status: conta.status,
    contas: conta.contas.map((c) => ({
      id: c.pluggyAccountId,
      tipo: c.tipo,
      nome: c.nome,
      ...(c.saldo !== undefined ? { saldo: c.saldo } : {}),
      ...(c.moeda ? { moeda: c.moeda } : {}),
    })),
    ...(conta.ultimaSincronizacao ? { ultimaSincronizacao: conta.ultimaSincronizacao.toISOString() } : {}),
    criadaEm: conta.createdAt.toISOString(),
  };
}

function resumirContas(contas: PluggyAccount[]): ContaDaConexao[] {
  return contas.map((c) => ({
    pluggyAccountId: c.id,
    tipo: c.type,
    nome: c.name,
    ...(typeof c.balance === "number" ? { saldo: c.balance } : {}),
    ...(c.currencyCode ? { moeda: c.currencyCode } : {}),
  }));
}

// Como Promise.all, mas só `limite` ao mesmo tempo (para não inundar o Servidor Java com pedidos).
async function mapearComLimite<T, R>(itens: T[], limite: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const resultados: R[] = new Array(itens.length);
  let proximo = 0;
  const trabalhadores = Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (proximo < itens.length) {
      const i = proximo++;
      resultados[i] = await fn(itens[i]);
    }
  });
  await Promise.all(trabalhadores);
  return resultados;
}

function garantirQueHaEspaco(total: number) {
  if (total >= MAX_CONTAS_POR_USUARIO) {
    throw new AppError(`Limite de ${MAX_CONTAS_POR_USUARIO} contas conectadas atingido`, 422, "ACCOUNT_LIMIT_REACHED");
  }
}

async function importar(userId: string, conta: ContaLida): Promise<ResultadoImportacao> {
  const id = conta._id.toString();

  // a conexão precisa estar sincronizada na Pluggy (alguns segundos depois de criada)
  const item = await pluggyClient.esperarItem(conta.pluggyItemId);
  await connectedAccountsRepository.update(userId, id, { status: item.status });
  if (STATUS_COM_ERRO.includes(item.status)) {
    throw new AppError("A conexão com a instituição precisa ser refeita", 422, "PLUGGY_ITEM_ERROR");
  }
  if (item.status !== "UPDATED") {
    throw new AppError("A instituição ainda está sincronizando. Tente de novo em instantes.", 409, "PLUGGY_SYNC_IN_PROGRESS");
  }

  const contasPluggy = await pluggyClient.listarContas(conta.pluggyItemId);
  const ignoradas: Record<MotivoIgnorada | "duplicadas", number> = {
    duplicadas: 0,
    pendente: 0,
    zerada: 0,
    faturaCartao: 0,
    invalida: 0,
  };
  const candidatas: TransacaoParaImportar[] = [];
  let lidas = 0;

  for (const contaPluggy of contasPluggy) {
    const transacoes = await pluggyClient.listarTransacoes(contaPluggy.id);
    lidas += transacoes.length;
    for (const t of transacoes) {
      const mapeada = mapearTransacao(t, contaPluggy.type);
      if (mapeada.ok) candidatas.push(mapeada.transacao);
      else ignoradas[mapeada.motivo]++;
    }
  }

  const jaImportadas = await transactionsRepository.externalIdsExistentes(userId, candidatas.map((c) => c.externalId));
  const novas = candidatas.filter((c) => !jaImportadas.has(c.externalId));
  ignoradas.duplicadas = candidatas.length - novas.length;

  // a categoria de cada nova vem do Servidor Java (se ele estiver fora do ar, cai em "Outros" sem falhar)
  const categorias = await mapearComLimite(novas, CONCORRENCIA_DA_CATEGORIZACAO, (n) =>
    transactionsService.sugerirCategoria(n.descricao, n.valor)
  );
  const importadas = await transactionsRepository.inserirImportadas(
    novas.map((n, i) => ({
      userId,
      tipo: n.tipo,
      valor: n.valor,
      categoria: categorias[i],
      data: n.data,
      descricao: n.descricao,
      formaPagamento: n.formaPagamento,
      origem: "pluggy" as const,
      externalId: n.externalId,
      contaConectadaId: id,
    }))
  );

  await connectedAccountsRepository.update(userId, id, {
    contas: resumirContas(contasPluggy),
    ultimaSincronizacao: new Date(),
  });

  return {
    lidas,
    importadas,
    ignoradas: {
      duplicadas: ignoradas.duplicadas,
      pendentes: ignoradas.pendente,
      zeradas: ignoradas.zerada,
      faturaCartao: ignoradas.faturaCartao,
      invalidas: ignoradas.invalida,
    },
  };
}

export const connectedAccountsService = {
  async listar(userId: string): Promise<ConnectedAccountResponseDto[]> {
    return (await connectedAccountsRepository.findByUser(userId)).map((c) => paraDto(comoLida(c)));
  },

  /** Token para o Frontend abrir o widget Pluggy Connect. O item criado por ele fica marcado com este usuário. */
  async criarConnectToken(userId: string) {
    return pluggyClient.criarConnectToken(userId);
  },

  /**
   * Registra um item da Pluggy (criado pelo widget) como conta conectada do usuário e já importa as transações.
   * Se a importação falhar (por exemplo, a instituição ainda está sincronizando), a conta fica conectada e a
   * resposta traz `avisoImportacao`: dá para importar depois com `sincronizar`.
   */
  async conectar(userId: string, itemId: string) {
    const item = await pluggyClient.obterItem(itemId);
    if (!item.clientUserId || item.clientUserId !== userId) {
      throw new AppError("Esta conexão não pertence ao usuário", 403, "PLUGGY_ITEM_NOT_OWNED");
    }
    garantirQueHaEspaco(await connectedAccountsRepository.countByUser(userId));
    if (await connectedAccountsRepository.findByItemId(itemId)) {
      throw new AppError("Esta conta já está conectada", 409, "ACCOUNT_ALREADY_CONNECTED");
    }

    const contasPluggy = await pluggyClient.listarContas(itemId);
    let criada: ContaLida;
    try {
      criada = comoLida(
        await connectedAccountsRepository.create({
        userId,
        pluggyItemId: itemId,
        connectorId: item.connector?.id ?? 0,
        instituicao: item.connector?.name ?? "Instituição",
        status: item.status,
        contas: resumirContas(contasPluggy),
      })
      );
    } catch (erro: any) {
      if (erro?.code === 11000) throw new AppError("Esta conta já está conectada", 409, "ACCOUNT_ALREADY_CONNECTED");
      throw erro;
    }

    try {
      const importacao = await importar(userId, criada);
      const atual = comoLida(await connectedAccountsRepository.findOne(userId, criada._id.toString()));
      return { conta: paraDto(atual), importacao };
    } catch (erro) {
      if (!(erro instanceof AppError)) throw erro;
      const atual = comoLida(await connectedAccountsRepository.findOne(userId, criada._id.toString()));
      return { conta: paraDto(atual), importacao: null, avisoImportacao: { code: erro.code, message: erro.message } };
    }
  },

  /** Conecta o conector de teste "Pluggy Bank" do sandbox (credenciais públicas), sem precisar do widget. */
  async conectarSandbox(userId: string) {
    garantirQueHaEspaco(await connectedAccountsRepository.countByUser(userId));
    const item = await pluggyClient.criarItem(CONECTOR_SANDBOX, CREDENCIAIS_SANDBOX, userId);
    try {
      await pluggyClient.esperarItem(item.id);
      return await this.conectar(userId, item.id);
    } catch (erro) {
      await pluggyClient.apagarItem(item.id).catch(() => undefined); // não deixa um item órfão na Pluggy
      throw erro;
    }
  },

  async sincronizar(userId: string, id: string): Promise<ResultadoImportacao> {
    const conta = await connectedAccountsRepository.findOne(userId, id);
    if (!conta) throw new AppError("Conta conectada não encontrada", 404, "NOT_FOUND");
    return importar(userId, comoLida(conta));
  },

  /** Remove a conexão (e o item na Pluggy). As transações já importadas continuam; só param de chegar novas. */
  async desconectar(userId: string, id: string): Promise<void> {
    const conta = await connectedAccountsRepository.findOne(userId, id);
    if (!conta) throw new AppError("Conta conectada não encontrada", 404, "NOT_FOUND");

    try {
      await pluggyClient.apagarItem(conta.pluggyItemId);
    } catch (erro) {
      // Se o item já não existe na Pluggy, tudo bem. Qualquer outra falha não impede o usuário de desconectar.
      if (!(erro instanceof AppError && erro.code === "PLUGGY_NOT_FOUND")) {
        console.warn(`[connected-accounts] item ${conta.pluggyItemId} não apagado na Pluggy: ${(erro as Error).message}`);
      }
    }
    await connectedAccountsRepository.remove(userId, id);
  },
};
