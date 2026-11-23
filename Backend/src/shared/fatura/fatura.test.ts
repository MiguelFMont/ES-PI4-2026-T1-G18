/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { fechamentoDaCompra, inicioDaFatura, valorJaDescontado } from "./fatura";

const d = (texto: string) => new Date(`${texto}T00:00:00.000Z`);
const dia = (data: Date) => data.toISOString().slice(0, 10);

describe("ciclo da fatura (fechamento dia 15)", () => {
  test("a compra até o dia do fechamento entra na fatura do mês; depois dele, na do mês seguinte", () => {
    assert.equal(dia(fechamentoDaCompra(d("2026-11-15"), 15)), "2026-11-15");
    assert.equal(dia(fechamentoDaCompra(d("2026-11-16"), 15)), "2026-12-15");
    assert.equal(dia(fechamentoDaCompra(d("2026-12-20"), 15)), "2027-01-15");
  });

  test("a fatura começa no dia seguinte ao fechamento anterior", () => {
    assert.equal(dia(inicioDaFatura(d("2026-12-15"), 15)), "2026-11-16");
    assert.equal(dia(inicioDaFatura(d("2027-03-28"), 28)), "2027-03-01"); // fevereiro de 2027 tem 28 dias
  });
});

describe("valor que já saiu do saldo", () => {
  test("despesa comum: só quando a data chega (hoje conta)", () => {
    const despesa = { valor: 100, data: d("2026-11-20") };
    assert.equal(valorJaDescontado(despesa, undefined, d("2026-11-19")), 0);
    assert.equal(valorJaDescontado(despesa, undefined, d("2026-11-20")), 100);
  });

  test("compra no crédito: só no vencimento da fatura (fechamento 15, vence 22)", () => {
    const compra = { valor: 300, data: d("2026-11-16"), formaPagamento: "credito" };
    assert.equal(valorJaDescontado(compra, 15, d("2026-12-21")), 0);
    assert.equal(valorJaDescontado(compra, 15, d("2026-12-22")), 300);
  });

  test("compra parcelada: 1/n a cada vencimento", () => {
    const compra = { valor: 300, data: d("2026-11-10"), formaPagamento: "credito", parcelas: 3 };
    assert.equal(valorJaDescontado(compra, 15, d("2026-11-21")), 0);
    assert.equal(valorJaDescontado(compra, 15, d("2026-11-22")), 100);
    assert.equal(valorJaDescontado(compra, 15, d("2027-01-22")), 300);
  });
});
