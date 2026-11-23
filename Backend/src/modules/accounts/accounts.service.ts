/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
// src/modules/accounts/accounts.service.ts
// Contas do usuário (especificação de contas e transferências).
//
// - Conta manual: o saldo atual é calculado pelo Servidor Java (PedidoCalcularSaldoContas) a partir do saldoInicial e dos
//   movimentos; o Backend só lê o banco e monta o pedido (RN2, RN6, RN9).
// - Conta Open Finance: o saldo vem do provedor (soma das contas bancárias da conexão), somente leitura. Só o plano Pro cria (RN3).
// - Migração (RN10): lançamentos antigos sem conta vão para a "Conta principal" e as conexões já existentes viram contas
//   Open Finance. Roda sozinha, uma vez por usuário, na primeira leitura de contas ou de lançamentos.
import mongoose from "mongoose";
import { AppError } from "../../shared/errors/app-error";
import { aparenciaNaResposta } from "../../shared/aparencia/aparencia";
import { guardarParaDesfazer } from "../../shared/lixeira/lixeira";
import { javaServerClient } from "../../java-client/java-server.client";
import { authRepository } from "../auth/auth.repository";
import { connectedAccountsRepository } from "../connected-accounts/connected-accounts.repository";
import { transactionsRepository } from "../transactions/transactions.repository";
import { investmentsRepository } from "../investments/investments.repository";
import { valorJaDescontado } from "../../shared/fatura/fatura";
import { CARTAO_PADRAO, MAX_CARTOES } from "../investments/investments.model";
import { accountsRepository } from "./accounts.repository";
import { AccountDocument, BANCOS, nomeDoBanco } from "./accounts.model";
import {
  AccountResponseDto,
  AccountResumoDto,
  CreateAccountDto,
  PedidoCalcularSaldoContas,
  RespostaCalcularSaldoContas,
  UpdateAccountDto,
} from "./accounts.dto";

export const NOME_CONTA_PRINCIPAL = "Conta principal";

type ContaLida = AccountDocument & { _id: { toString(): string }; createdAt: Date };
// O que o repository devolve (lean) tem _id e createdAt, mas o tipo gerado pelo Mongoose não os expõe: afirmamos aqui, num lugar só.
const comoLida = (doc: unknown) => doc as ContaLida;

const chaveDoNome = (nome: string) => nome.trim().toLowerCase();
const emReais = (valor: number) => Math.round(valor * 100) / 100;

const naoEncontrada = () => new AppError("Conta não encontrada", 404, "ACCOUNT_NOT_FOUND");
const nomeEmUso = () => new AppError("Já existe uma conta com este nome", 409, "ACCOUNT_NAME_IN_USE");
const ehNomeDuplicado = (erro: any) => erro?.code === 11000;

// O plano vem do usuário (coleção users). Um id que não é de usuário real (ou usuário apagado) conta como Free.
async function planoDoUsuario(userId: string): Promise<"free" | "pro"> {
  if (!mongoose.isValidObjectId(userId)) return "free";
  return (await authRepository.findById(userId))?.plano === "pro" ? "pro" : "free";
}

// O saldo de uma conta Open Finance é o do provedor: a soma das contas bancárias (BANK) da conexão.
function saldoDaConexao(conexao: { contas: { tipo: string; saldo?: number }[] } | null): number | undefined {
  if (!conexao) return undefined;
  const bancarias = conexao.contas.filter((c) => c.tipo === "BANK" && typeof c.saldo === "number");
  if (bancarias.length === 0) return undefined;
  return emReais(bancarias.reduce((soma, c) => soma + (c.saldo as number), 0));
}

function paraDto(conta: ContaLida, saldoAtual: number): AccountResponseDto {
  return {
    id: conta._id.toString(),
    nome: conta.nome,
    banco: conta.banco,
    bancoNome: nomeDoBanco(conta.banco),
    tipo: conta.tipo,
    saldoInicial: conta.saldoInicial,
    saldoAtual,
    ...(conta.conectadaId ? { conectadaId: conta.conectadaId } : {}),
    ...aparenciaNaResposta(conta),
    criadaEm: conta.createdAt.toISOString(),
  };
}

export const resumoDaConta = (conta: ContaLida): AccountResumoDto => ({
  id: conta._id.toString(),
  nome: conta.nome,
  banco: conta.banco,
  bancoNome: nomeDoBanco(conta.banco),
  ...aparenciaNaResposta(conta),
});

// Cria a conta; se o nome já existe (corrida entre duas chamadas), tenta de novo com o desempate " (2)", " (3)"...
async function criarComNomeLivre(dados: Omit<AccountDocument, "nomeChave">) {
  for (let n = 1; n <= 20; n++) {
    const nome = n === 1 ? dados.nome : `${dados.nome.slice(0, 40 - ` (${n})`.length)} (${n})`;
    try {
      return comoLida(await accountsRepository.create({ ...dados, nome, nomeChave: chaveDoNome(nome) }));
    } catch (erro) {
      if (!ehNomeDuplicado(erro)) throw erro;
      // a conexão já virou conta (corrida): devolve a existente
      if (dados.conectadaId) {
        const existente = await accountsRepository.findByConectada(dados.userId, dados.conectadaId);
        if (existente) return comoLida(existente);
      }
    }
  }
  throw nomeEmUso();
}

export const accountsService = {
  banks() {
    return BANCOS.map((b) => ({ codigo: b.codigo, nome: b.nome }));
  },

  /**
   * Migração (RN10), idempotente e por usuário: (1) cada conexão Open Finance existente vira uma conta open_finance, sem a
   * trava do plano (já existia); (2) os lançamentos importados passam para a conta da sua conexão; (3) os lançamentos
   * antigos sem conta passam para a conta manual "Conta principal" (banco "Outro", saldo inicial 0), criada só se preciso.
   */
  async garantirMigracao(userId: string) {
    const conexoes = await connectedAccountsRepository.findByUser(userId);
    for (const conexao of conexoes) {
      const id = String((conexao as { _id: unknown })._id);
      const existente = await accountsRepository.findByConectada(userId, id);
      if (!existente && (conexao as { contaDispensada?: boolean }).contaDispensada) continue; // o usuário excluiu a conta: não volta sozinha
      const contaId = existente ? String(existente._id) : String((await criarContaDaConexao(userId, conexao, id))._id);
      await transactionsRepository.ligarSemContaA(userId, contaId, { contaConectadaId: id });
    }

    if ((await transactionsRepository.countSemConta(userId)) > 0) {
      const principal =
        (await accountsRepository.findByNomeChave(userId, chaveDoNome(NOME_CONTA_PRINCIPAL))) ??
        (await criarComNomeLivre({ userId, nome: NOME_CONTA_PRINCIPAL, banco: "outro", tipo: "manual", saldoInicial: 0 }));
      await transactionsRepository.ligarSemContaA(userId, String(principal._id));
    }
  },

  /** As contas do usuário, cada uma com o saldo atual (das manuais, calculado pelo Servidor Java). */
  async list(userId: string): Promise<AccountResponseDto[]> {
    await accountsService.garantirMigracao(userId);
    const contas = (await accountsRepository.findByUser(userId)).map(comoLida);
    const manuais = contas.filter((c) => c.tipo === "manual");
    const saldos = new Map<string, number>();

    if (manuais.length > 0) {
      const ids = manuais.map((c) => c._id.toString());
      const movimentos = await transactionsRepository.movimentosDasContas(userId, ids);
      // Uma despesa só sai do saldo quando chega a data dela; a compra no cartão, só quando a fatura vence (ver shared/fatura).
      // Compra no crédito sem cartão gravado vale para o cartão mais antigo da conta (como na fatura).
      const cartoes = (await investmentsRepository.findCards(userId)).map((c) => ({
        id: String((c as { _id: unknown })._id),
        contaId: c.contaId,
        diaFechamento: c.diaFechamento,
      }));
      const diaDoCartao = (m: { cartaoId?: string; contaId?: string; formaPagamento?: string }) => {
        if (m.formaPagamento !== "credito") return undefined;
        const cartao = m.cartaoId
          ? cartoes.find((c) => c.id === m.cartaoId)
          : (cartoes.find((c) => c.contaId === m.contaId) ?? cartoes.find((c) => !c.contaId));
        return cartao?.diaFechamento;
      };
      const hoje = new Date();
      const efetivos = movimentos
        .map((m) => ({ ...m, valor: m.tipo === "despesa" ? valorJaDescontado(m, diaDoCartao(m), hoje) : m.valor }))
        .filter((m) => m.valor > 0); // o Servidor Java recusa valor zero: a despesa que ainda não saiu fica de fora
      const resposta = await javaServerClient.enviarPedido<PedidoCalcularSaldoContas, RespostaCalcularSaldoContas>(
        "PedidoCalcularSaldoContas",
        "RespostaCalcularSaldoContas",
        {
          contas: manuais.map((c) => ({ id: c._id.toString(), saldoInicial: c.saldoInicial })),
          movimentos: efetivos.map((m) => ({
            tipo: m.tipo,
            valor: m.valor,
            contaId: m.contaId as string,
            ...(m.contaDestinoId ? { contaDestinoId: m.contaDestinoId } : {}),
          })),
        }
      );
      for (const s of resposta.saldos) saldos.set(s.contaId, s.saldoAtual);
    }

    const conexoes = new Map(
      (await connectedAccountsRepository.findByUser(userId)).map((c) => [String((c as { _id: unknown })._id), c])
    );
    return contas.map((conta) => {
      if (conta.tipo === "manual") return paraDto(conta, saldos.get(conta._id.toString()) ?? conta.saldoInicial);
      const doProvedor = saldoDaConexao(conta.conectadaId ? (conexoes.get(conta.conectadaId) ?? null) : null);
      return paraDto(conta, doProvedor ?? conta.saldoInicial);
    });
  },

  async create(userId: string, dados: CreateAccountDto): Promise<AccountResponseDto> {
    let saldoInicial = dados.saldoInicial;
    let saldoAtual = saldoInicial;

    if (dados.tipo === "open_finance") {
      // RN3: só o plano Pro cria conta Open Finance
      if ((await planoDoUsuario(userId)) !== "pro") {
        throw new AppError("Contas Open Finance fazem parte do plano Pro", 403, "PLAN_REQUIRED");
      }
      const conexao = await connectedAccountsRepository.findOne(userId, dados.conectadaId as string);
      if (!conexao) throw new AppError("Conta conectada não encontrada", 404, "NOT_FOUND");
      if (await accountsRepository.findByConectada(userId, dados.conectadaId as string)) {
        throw new AppError("Esta conexão já tem uma conta", 409, "ACCOUNT_ALREADY_CONNECTED");
      }
      // o saldo é o do provedor: o informado pelo usuário não vale (somente leitura)
      saldoInicial = saldoDaConexao(conexao) ?? 0;
      saldoAtual = saldoInicial;
    }
    if (await accountsRepository.findByNomeChave(userId, chaveDoNome(dados.nome))) throw nomeEmUso();

    try {
      const criada = comoLida(
        await accountsRepository.create({
          userId,
          nome: dados.nome,
          nomeChave: chaveDoNome(dados.nome),
          banco: dados.banco,
          tipo: dados.tipo,
          saldoInicial,
          ...(dados.conectadaId ? { conectadaId: dados.conectadaId } : {}),
          ...(dados.icone ? { icone: dados.icone } : {}),
          ...(dados.cor ? { cor: dados.cor } : {}),
        })
      );
      if (criada.conectadaId) {
        await connectedAccountsRepository.update(userId, criada.conectadaId, { contaDispensada: false });
        // RN5: o que já foi importado dessa conexão passa a ser dela
        await transactionsRepository.ligarSemContaA(userId, criada._id.toString(), { contaConectadaId: criada.conectadaId });
      }
      return paraDto(criada, saldoAtual);
    } catch (erro) {
      if (ehNomeDuplicado(erro)) throw nomeEmUso();
      throw erro;
    }
  },

  async update(userId: string, id: string, dados: UpdateAccountDto): Promise<AccountResponseDto> {
    const conta = await accountsRepository.findOne(userId, id);
    if (!conta) throw naoEncontrada();
    // uma conta Open Finance não se edita (nome, banco e saldo vêm do banco); se a conexão for desconectada, ela vira manual
    // (só o ícone e a cor, que são do FinanceAI e não do banco, podem mudar numa conta Open Finance)
    if (conta.tipo === "open_finance" && Object.keys(dados).some((campo) => campo !== "icone" && campo !== "cor")) {
      throw new AppError("Uma conta Open Finance não pode ser editada", 422, "ACCOUNT_READ_ONLY");
    }

    const alteracoes: Partial<AccountDocument> = { ...dados };
    if (dados.nome !== undefined) {
      const outra = await accountsRepository.findByNomeChave(userId, chaveDoNome(dados.nome));
      if (outra && String(outra._id) !== id) throw nomeEmUso();
      alteracoes.nomeChave = chaveDoNome(dados.nome);
    }
    try {
      await accountsRepository.update(userId, id, alteracoes);
    } catch (erro) {
      if (ehNomeDuplicado(erro)) throw nomeEmUso();
      throw erro;
    }
    // devolve com o saldo atual recalculado (mudar o saldo inicial muda o atual)
    const atualizada = (await accountsService.list(userId)).find((c) => c.id === id);
    if (!atualizada) throw naoEncontrada();
    return atualizada;
  },

  async remove(userId: string, id: string): Promise<{ desfazerId: string; cartoes: number; lancamentos: number }> {
    const conta = await accountsRepository.findOne(userId, id);
    if (!conta) throw naoEncontrada();
    // Uma conta Open Finance não se exclui: o usuário a desconecta (DELETE /connected-accounts/:id), ela vira manual e então pode ser excluída.
    if (conta.tipo === "open_finance") {
      throw new AppError(
        "Desconecte esta conta do Open Finance antes de excluí-la: ao desconectar, ela passa a ser uma conta manual",
        409,
        "ACCOUNT_IS_OPEN_FINANCE"
      );
    }
    // Excluir a conta exclui TUDO o que é dela: os cartões (com os parcelamentos e os lançamentos no cartão) e os lançamentos da conta (inclusive as
    // transferências em que ela é origem ou destino). A tela avisa antes de excluir. A resposta traz um id para desfazer (POST /v1/undo/:id).
    const cartoes = await investmentsRepository.findCardsByConta(userId, id);
    const maisAntigo = await investmentsRepository.idDoCartaoMaisAntigo(userId);
    const doCartao = await investmentsRepository.excluirCartoesComTudo(
      userId,
      cartoes.map((c) => ({ id: String(c._id), ehPadrao: String(c._id) === maisAntigo }))
    );
    const lancamentos = await transactionsRepository.excluirDaConta(userId, id);
    await accountsRepository.remove(userId, id);
    // a conexão continua (dá para criar a conta de novo), mas a migração não a transforma em conta outra vez
    if (conta.conectadaId) await connectedAccountsRepository.update(userId, conta.conectadaId, { contaDispensada: true });

    const desfazerId = guardarParaDesfazer(userId, async () => {
      await accountsRepository.restaurar(conta);
      await investmentsRepository.restaurarCartoes(doCartao);
      await transactionsRepository.restaurar(lancamentos);
      if (conta.conectadaId) await connectedAccountsRepository.update(userId, conta.conectadaId, { contaDispensada: false });
    });
    return { desfazerId, cartoes: doCartao.cartoes.length, lancamentos: lancamentos.length + doCartao.transacoes.length };
  },

  /**
   * Ao conectar o Open Finance: cada conta CREDIT da conexão (o Pluggy Bank tem cartão de crédito) vira um cartão do FinanceAI, com o
   * limite e o fechamento que a Pluggy informa e vinculado à conta Open Finance da conexão. Idempotente (não repete o cartão de uma conta CREDIT
   * que já virou cartão) e respeita o máximo de cartões.
   */
  async criarCartoesDaConexao(userId: string, conectadaId: string): Promise<void> {
    await accountsService.garantirMigracao(userId); // garante a conta Open Finance da conexão
    const conta = await accountsRepository.findByConectada(userId, conectadaId);
    const conexao = await connectedAccountsRepository.findOne(userId, conectadaId);
    if (!conta || !conexao) return;

    for (const sub of conexao.contas.filter((c) => c.tipo === "CREDIT")) {
      if (await investmentsRepository.findCardByPluggyAccount(userId, sub.pluggyAccountId)) continue;
      if ((await investmentsRepository.countCards(userId)) >= MAX_CARTOES) return;

      // nome único (o do cartão na Pluggy, com " (2)", " (3)"... se já existir)
      let nome = sub.nome.trim().slice(0, 40) || "Cartão";
      for (let n = 2; await investmentsRepository.findCardByName(userId, nome); n++) nome = `${sub.nome.trim().slice(0, 36)} (${n})`;

      await investmentsRepository.createCard({
        userId,
        nome,
        limite: sub.limite && sub.limite > 0 ? sub.limite : CARTAO_PADRAO.limite,
        diaFechamento: sub.diaFechamento ?? CARTAO_PADRAO.diaFechamento,
        contaId: String(conta._id),
        pluggyAccountId: sub.pluggyAccountId,
      });
    }
  },

  /**
   * A conexão Open Finance foi desconectada: a conta ligada a ela passa a ser manual. O saldo atual não muda de repente: o saldo
   * inicial é recalculado para que `saldoInicial` + movimentos continue dando o último saldo que o banco informou.
   */
  async converterParaManual(userId: string, conectadaId: string): Promise<void> {
    const encontrada = await accountsRepository.findByConectada(userId, conectadaId);
    if (!encontrada) return; // a conexão nunca virou conta (por exemplo, o usuário a excluiu): nada a converter
    const conta = comoLida(encontrada);
    const id = conta._id.toString();
    const ultimoSaldo = saldoDaConexao(await connectedAccountsRepository.findOne(userId, conectadaId)) ?? conta.saldoInicial;
    const movimentos = await transactionsRepository.movimentosDasContas(userId, [id]);
    let liquido = 0;
    for (const m of movimentos) {
      if (m.tipo === "receita") liquido += m.valor;
      else if (m.tipo === "despesa") liquido -= m.valor;
      else if (m.contaId === id) liquido -= m.valor;
      else if (m.contaDestinoId === id) liquido += m.valor;
    }
    await accountsRepository.converterParaManual(userId, id, emReais(ultimoSaldo - liquido));
    await investmentsRepository.soltarCartoesDaConta(userId, id);
  },

  /** As contas do usuário por id, com nome e banco: o que a listagem de transações mostra em cada lançamento. */
  async resumos(userId: string): Promise<Map<string, AccountResumoDto>> {
    const contas = (await accountsRepository.findByUser(userId)).map(comoLida);
    return new Map(contas.map((c) => [c._id.toString(), resumoDaConta(c)]));
  },

  /** Uma conta do usuário, para validar o `contaId` de um lançamento (404 ACCOUNT_NOT_FOUND se não existe ou é de outro). */
  async obterDoUsuario(userId: string, id: string) {
    const conta = await accountsRepository.findOne(userId, id);
    if (!conta) throw naoEncontrada();
    return comoLida(conta);
  },

  /** A conta Open Finance ligada a uma conexão (para as transações importadas), ou undefined. */
  async idDaContaDaConexao(userId: string, conectadaId: string): Promise<string | undefined> {
    const conta = await accountsRepository.findByConectada(userId, conectadaId);
    return conta ? String(conta._id) : undefined;
  },
};

async function criarContaDaConexao(userId: string, conexao: any, conectadaId: string) {
  return criarComNomeLivre({
    userId,
    nome: String(conexao.instituicao ?? "Open Finance").trim().slice(0, 40) || "Open Finance",
    banco: "outro",
    tipo: "open_finance",
    saldoInicial: saldoDaConexao(conexao) ?? 0,
    conectadaId,
  });
}
