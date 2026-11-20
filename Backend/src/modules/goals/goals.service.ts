// src/modules/goals/goals.service.ts
import { Aportes, goalsRepository } from "./goals.repository";
import { GoalDocument } from "./goals.model";
import {
  CreateGoalDto,
  GoalResponseDto,
  PedidoProgressoMeta,
  RespostaProgressoMeta,
  UpdateGoalDto,
} from "./goals.dto";
import { javaServerClient } from "../../java-client/java-server.client";
import { AppError } from "../../shared/errors/app-error";

// valores em reais: arredonda em 2 casas para a soma de decimais não deixar "0.30000000000000004"
const emReais = (valor: number) => Math.round(valor * 100) / 100;

// 00:00 UTC do dia: as transações guardam só a data (meia-noite UTC), então o prazo de hoje ainda vale.
const inicioDoDia = (data = new Date()) => new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));

const SEM_APORTES: Aportes = { total: 0, quantidade: 0 };

type CamposDaMeta = Pick<GoalDocument, "valorObjetivo" | "valorInicial" | "prazo">;

// O que o repository devolve (lean) tem _id e createdAt, mas o tipo gerado pelo Mongoose não os expõe: afirmamos aqui, num lugar só.
type MetaLida = GoalDocument & { _id: { toString(): string }; createdAt: Date };
const comoLida = (doc: unknown) => doc as MetaLida;

function naoEncontrada(): AppError {
  return new AppError("Meta não encontrada", 404, "GOAL_NOT_FOUND");
}

// Uma meta nova (ou com o prazo editado) não pode ter o prazo no passado.
function prazoNaoPassou(prazo: Date) {
  if (prazo < inicioDoDia()) throw new AppError("O prazo não pode ser no passado", 400, "VALIDATION_ERROR");
}

// O progresso vem das transações que o usuário VINCULOU à meta (valorInicial + a soma delas) e a conta (percentual, o que
// falta, aporte por mês) é feita pelo Servidor Java. Nada disto é guardado: é recalculado a cada leitura.
// Meta sem prazo: o Servidor Java exige uma data, então vai a de hoje (só o percentual e o que falta são usados); os campos
// que dependem do prazo (dias, meses, aporte mensal) não são devolvidos e a meta nunca fica "vencida".
async function calcularProgresso(meta: CamposDaMeta, aportes: Aportes) {
  const valorAportado = emReais(aportes.total);
  const valorAtual = emReais(meta.valorInicial + valorAportado);

  const progresso = await javaServerClient.enviarPedido<PedidoProgressoMeta, RespostaProgressoMeta>(
    "PedidoProgressoMeta",
    "RespostaProgressoMeta",
    { valorAtual, valorObjetivo: meta.valorObjetivo, prazo: (meta.prazo ?? inicioDoDia()).toISOString() }
  );
  if (!meta.prazo) {
    const { diasRestantes, mesesRestantes, aporteMensalNecessario, ...semPrazo } = progresso;
    void diasRestantes, mesesRestantes, aporteMensalNecessario;
    return { valorAtual, valorAportado, quantidadeAportes: aportes.quantidade, ...semPrazo, noPrazo: true };
  }
  return { valorAtual, valorAportado, quantidadeAportes: aportes.quantidade, ...progresso };
}

function paraDto(meta: MetaLida, progresso: Awaited<ReturnType<typeof calcularProgresso>>): GoalResponseDto {
  return {
    id: meta._id.toString(),
    titulo: meta.titulo,
    valorObjetivo: meta.valorObjetivo,
    valorInicial: meta.valorInicial,
    ...(meta.prazo ? { prazo: meta.prazo.toISOString() } : {}),
    criadaEm: meta.createdAt.toISOString(),
    ...progresso,
  };
}

export const goalsService = {
  async list(userId: string): Promise<GoalResponseDto[]> {
    const [metas, aportes] = await Promise.all([goalsRepository.findByUser(userId), goalsRepository.somarAportes(userId, new Date())]);
    const progressos = await Promise.all(metas.map((m) => calcularProgresso(m, aportes.get(m._id.toString()) ?? SEM_APORTES)));
    return metas.map((m, i) => paraDto(comoLida(m), progressos[i]));
  },

  async getById(userId: string, id: string): Promise<GoalResponseDto> {
    const meta = await goalsRepository.findOneByUser(userId, id);
    if (!meta) throw naoEncontrada();
    const aportes = await goalsRepository.somarAportes(userId, new Date());
    return paraDto(comoLida(meta), await calcularProgresso(meta, aportes.get(id) ?? SEM_APORTES));
  },

  // O progresso é calculado ANTES de gravar: se o Servidor Java estiver fora do ar (503), nada é salvo.
  async create(userId: string, dados: CreateGoalDto): Promise<GoalResponseDto> {
    if (dados.prazo) prazoNaoPassou(dados.prazo);
    const campos: CamposDaMeta = { valorObjetivo: dados.valorObjetivo, valorInicial: dados.valorInicial, prazo: dados.prazo };
    const progresso = await calcularProgresso(campos, SEM_APORTES); // meta nova: ainda sem transações vinculadas

    const meta = await goalsRepository.create({ userId, titulo: dados.titulo, ...campos });
    return paraDto(comoLida(meta), progresso);
  },

  async update(userId: string, id: string, alteracoes: UpdateGoalDto): Promise<GoalResponseDto> {
    const atual = await goalsRepository.findOneByUser(userId, id);
    if (!atual) throw naoEncontrada();
    if (alteracoes.prazo) prazoNaoPassou(alteracoes.prazo); // null = tirar o prazo

    const campos: CamposDaMeta = {
      valorObjetivo: alteracoes.valorObjetivo ?? atual.valorObjetivo,
      valorInicial: alteracoes.valorInicial ?? atual.valorInicial,
      prazo: alteracoes.prazo === undefined ? atual.prazo : (alteracoes.prazo ?? undefined),
    };
    const aportes = await goalsRepository.somarAportes(userId, new Date());
    const progresso = await calcularProgresso(campos, aportes.get(id) ?? SEM_APORTES);

    const meta = await goalsRepository.update(userId, id, alteracoes);
    if (!meta) throw naoEncontrada(); // excluída entre a leitura e a gravação
    return paraDto(comoLida(meta), progresso);
  },

  async remove(userId: string, id: string): Promise<void> {
    if (!(await goalsRepository.remove(userId, id))) throw naoEncontrada();
  },
};
