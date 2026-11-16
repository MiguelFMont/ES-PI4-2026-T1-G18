// src/modules/goals/__tests__/apoio.ts
// Apoio dos testes de metas e de investimentos (Grupo 5): o que os testes de rota de transações já usam (app Express numa
// porta livre, banco em memória, dois usuários) mais um Servidor Java SIMULADO para os três pedidos do grupo.
// O Servidor de verdade tem os próprios testes (mvn test) e um teste de integração com o Backend (grupo5.integracao.test.ts).
import "../../transactions/__tests__/ambiente"; // ANTES de tudo: o config/env valida o process.env no import
import { mock } from "node:test";
import { javaServerClient } from "../../../java-client/java-server.client";
import { AppError } from "../../../shared/errors/app-error";

export { ANA, BETO, ID_INEXISTENTE, inserir, json, prepararApi, textoDe } from "../../transactions/__tests__/apoio";

const r2 = (n: number) => Math.round(n * 100) / 100;

const diasEntre = (de: Date, ate: Date) => Math.round((ate.getTime() - de.getTime()) / 86_400_000);
const soData = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

// Contas do Servidor Java, em JavaScript, só para o Backend ter uma resposta realista nos testes de rota.
const calculos: Record<string, (dados: any) => any> = {
  PedidoProgressoMeta: ({ valorAtual, valorObjetivo, prazo }) => {
    const atual = Math.max(0, valorAtual);
    const concluida = atual >= valorObjetivo;
    const dias = Math.max(0, diasEntre(soData(new Date()), soData(new Date(prazo))));
    const meses = Math.max(1, Math.ceil(dias / 30));
    const falta = concluida ? 0 : r2(valorObjetivo - atual);
    return {
      percentual: r2(Math.min(100, (atual / valorObjetivo) * 100)),
      falta,
      concluida,
      noPrazo: concluida || soData(new Date(prazo)) >= soData(new Date()),
      diasRestantes: dias,
      mesesRestantes: meses,
      aporteMensalNecessario: concluida ? 0 : r2(falta / meses),
    };
  },

  PedidoRentabilidadeSimulada: ({ ativos }) => {
    const atuais = ativos.map((a: any) => a.valor * Math.pow(1 + a.taxaMensal / 100, a.meses));
    const patrimonio = atuais.reduce((s: number, v: number) => s + v, 0);
    const totalInvestido = ativos.reduce((s: number, a: any) => s + a.valor, 0);
    return {
      ativos: ativos.map((a: any, i: number) => ({
        ...a,
        valorAtual: r2(atuais[i]),
        rendimento: r2(atuais[i] - a.valor),
        rentabilidade: r2((atuais[i] / a.valor - 1) * 100),
        percentualCarteira: patrimonio > 0 ? r2((atuais[i] / patrimonio) * 100) : 0,
      })),
      totalInvestido: r2(totalInvestido),
      patrimonio: r2(patrimonio),
      rendimento: r2(patrimonio - totalInvestido),
      rentabilidade: totalInvestido > 0 ? r2(((patrimonio - totalInvestido) / totalInvestido) * 100) : 0,
    };
  },

  PedidoCalcularParcelamentos: ({ parcelamentos }) => {
    let totalParcelasDoMes = 0;
    let totalSaldoDevedor = 0;
    let totalJuros = 0;
    const saida = parcelamentos.map((p: any) => {
      const i = p.taxaJurosMensal / 100;
      const parcela = i === 0 ? p.valorTotal / p.parcelas : (p.valorTotal * i) / (1 - Math.pow(1 + i, -p.parcelas));
      const restantes = p.parcelas - p.parcelasPagas;
      const saldo = restantes === 0 ? 0 : i === 0 ? parcela * restantes : (parcela * (1 - Math.pow(1 + i, -restantes))) / i;
      const juros = Math.max(0, parcela * p.parcelas - p.valorTotal);
      if (restantes > 0) {
        totalParcelasDoMes += parcela;
        totalSaldoDevedor += saldo;
        totalJuros += juros;
      }
      return {
        ...p,
        valorParcela: r2(parcela),
        parcelasRestantes: restantes,
        saldoDevedor: r2(saldo),
        jurosTotal: r2(juros),
        quitado: restantes === 0,
      };
    });
    return { parcelamentos: saida, totalParcelasDoMes: r2(totalParcelasDoMes), totalSaldoDevedor: r2(totalSaldoDevedor), totalJuros: r2(totalJuros) };
  },
};

export interface PedidoRegistrado {
  tipo: string;
  dados: any;
}

/**
 * Troca `javaServerClient.enviarPedido` por uma versão que responde os três pedidos do Grupo 5 e guarda o que o Backend
 * enviou (para os testes conferirem os dados do pedido). Com `indisponivel`, responde como o Servidor fora do ar (503).
 * Usa o `mock` do node:test; o `prepararApi()` desfaz no fim de cada teste. Só uma chamada por teste (os dublês não empilham).
 */
export function simularServidorGrupo5(opcoes: { indisponivel?: boolean } = {}) {
  const pedidos: PedidoRegistrado[] = [];
  mock.method(javaServerClient, "enviarPedido", async (tipo: string, _resposta: string, dados: any) => {
    if (opcoes.indisponivel) throw new AppError("Servidor indisponível", 503, "JAVA_SERVER_UNAVAILABLE");
    const calculo = calculos[tipo];
    if (!calculo) throw new Error(`Pedido inesperado ao Servidor Java: ${tipo}`);
    pedidos.push({ tipo, dados: structuredClone(dados) });
    return calculo(dados);
  });
  return pedidos;
}

export const inicioDoDiaUtc = (data = new Date()) => soData(data);
export const diasAtras = (dias: number, de = new Date()) => new Date(soData(de).getTime() - dias * 86_400_000);
export const diasAFrente = (dias: number, de = new Date()) => new Date(soData(de).getTime() + dias * 86_400_000);
