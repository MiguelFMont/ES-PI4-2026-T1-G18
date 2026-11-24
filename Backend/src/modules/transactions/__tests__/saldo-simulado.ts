/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
// src/modules/transactions/__tests__/saldo-simulado.ts
// A conta do Servidor Java para PedidoCalcularSaldoContas, em TypeScript, só para o Backend ter uma resposta realista nos
// testes de rota (o Servidor de verdade tem os próprios testes: mvn test, SaldoContasTest). Mesma regra: saldo inicial +
// receitas - despesas - transferências enviadas + transferências recebidas; movimentos de contas fora do pedido são ignorados.
import type { PedidoCalcularSaldoContas, RespostaCalcularSaldoContas } from "../../accounts/accounts.dto";

const emReais = (n: number) => Math.round(n * 100) / 100;

export function calcularSaldoContas({ contas, movimentos }: PedidoCalcularSaldoContas): RespostaCalcularSaldoContas {
  const saldos = new Map(contas.map((c) => [c.id, c.saldoInicial]));
  const somar = (id: string | undefined, valor: number) => {
    if (id !== undefined && saldos.has(id)) saldos.set(id, (saldos.get(id) as number) + valor);
  };
  for (const m of movimentos) {
    if (m.tipo === "receita") somar(m.contaId, m.valor);
    else if (m.tipo === "despesa") somar(m.contaId, -m.valor);
    else {
      somar(m.contaId, -m.valor);
      somar(m.contaDestinoId, m.valor);
    }
  }
  return { saldos: [...saldos].map(([contaId, saldoAtual]) => ({ contaId, saldoAtual: emReais(saldoAtual) })) };
}
