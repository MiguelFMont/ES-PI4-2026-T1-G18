// src/modules/dashboard/__tests__/apoio.ts
// Reaproveita o ambiente isolado (sem Atlas nem Servidor Java real) e o helper de rotas de transactions.
import "./ambiente";
import { mock } from "node:test";
import { javaServerClient } from "../../../java-client/java-server.client";
import { AppError } from "../../../shared/errors/app-error";

export { ANA, BETO, inserir, json, prepararApi, tokenDe } from "../../transactions/__tests__/apoio";

export interface PedidoRegistrado {
    tipoPedido: string;
    tipoResposta: string;
    dados: unknown;
}

const arredondar = (n: number) => Math.round(n * 100) / 100;

/**
 * Simula as operações do Servidor Java usadas pelo Dashboard (`PedidoCalcularIndicadores` e
 * `PedidoCompararPeriodos`). Devolve a lista de pedidos enviados para os testes conferirem o contrato.
 */
export function simularServidorDashboard({ indisponivel = false }: { indisponivel?: boolean } = {}) {
    const pedidos: PedidoRegistrado[] = [];

    mock.method(
        javaServerClient,
        "enviarPedido",
        async (tipoPedido: string, tipoResposta: string, dados: any) => {
        pedidos.push({ tipoPedido, tipoResposta, dados });

        if (indisponivel) {
            throw new AppError("Servidor Java indisponível", 503, "JAVA_SERVER_UNAVAILABLE");
        }

        if (tipoPedido === "PedidoCalcularIndicadores") {
            const receitas = Number(dados.receitas ?? 0);
            const despesas = Number(dados.despesas ?? 0);
            const saldo = arredondar(receitas - despesas);
            const economia = receitas > 0 ? arredondar((saldo / receitas) * 100) : 0;
            return { saldo, economia, fluxoDeCaixa: saldo };
        }

        if (tipoPedido === "PedidoCompararPeriodos") {
            const lista = Array.isArray(dados.periodos) ? dados.periodos : [];
            let anterior: { receitas: number; despesas: number; saldo: number } | null = null;

            const periodos = lista.map((p: { rotulo: string; receitas: number; despesas: number }) => {
            const saldo = arredondar(p.receitas - p.despesas);
            const variacao = (atual: number, ant: number) =>
                ant === 0 ? 0 : arredondar(((atual - ant) / Math.abs(ant)) * 100);

            const item = {
                rotulo: p.rotulo,
                receitas: p.receitas,
                despesas: p.despesas,
                saldo,
                variacaoReceitas: anterior ? variacao(p.receitas, anterior.receitas) : 0,
                variacaoDespesas: anterior ? variacao(p.despesas, anterior.despesas) : 0,
                variacaoSaldo: anterior ? variacao(saldo, anterior.saldo) : 0,
            };
            anterior = { receitas: p.receitas, despesas: p.despesas, saldo };
            return item;
            });

            const ultimo = periodos[periodos.length - 1];
            const tendenciaDespesas =
            !ultimo || Math.abs(ultimo.variacaoDespesas) <= 5
                ? "estavel"
                : ultimo.variacaoDespesas > 5
                ? "alta"
                : "queda";

            return { periodos, tendenciaDespesas };
        }

        throw new AppError(`Pedido não simulado: ${tipoPedido}`, 500, "UNEXPECTED_REQUEST");
        }
    );

    return pedidos;
}

/** Data no dia 15 de `mesesAtras` meses antes do mês atual (evita virada de fuso horário nos testes). */
export function dataMesesAtras(mesesAtras = 0, dia = 15): Date {
    const agora = new Date();
    return new Date(Date.UTC(agora.getFullYear(), agora.getMonth() - mesesAtras, dia, 12, 0, 0));
}

/** Rótulo YYYY-MM correspondente a `mesesAtras` meses antes do mês atual. */
export function rotuloMesesAtras(mesesAtras = 0): string {
    const agora = new Date();
    const d = new Date(agora.getFullYear(), agora.getMonth() - mesesAtras, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}