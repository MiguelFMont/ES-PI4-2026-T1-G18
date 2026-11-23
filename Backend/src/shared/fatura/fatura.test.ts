/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { fechamentoDaCompra, inicioDaFatura } from "./fatura";

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
