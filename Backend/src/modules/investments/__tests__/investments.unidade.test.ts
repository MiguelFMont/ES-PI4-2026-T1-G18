// src/modules/investments/__tests__/investments.unidade.test.ts
// Regras de data do módulo de investimentos, sem HTTP nem banco: meses completos de rendimento e próximo vencimento da fatura.
import "../../transactions/__tests__/ambiente";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mesesCompletos, proximoVencimento } from "../investments.service";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("mesesCompletos (o rendimento só conta meses fechados)", () => {
  test("o mês só fecha no mesmo dia do mês seguinte", () => {
    assert.equal(mesesCompletos(d("2026-01-15"), d("2026-02-14")), 0);
    assert.equal(mesesCompletos(d("2026-01-15"), d("2026-02-15")), 1);
    assert.equal(mesesCompletos(d("2026-01-15"), d("2026-02-16")), 1);
  });

  test("conta vários meses e atravessa o ano", () => {
    assert.equal(mesesCompletos(d("2025-11-10"), d("2026-11-10")), 12);
    assert.equal(mesesCompletos(d("2025-11-10"), d("2026-11-09")), 11);
    assert.equal(mesesCompletos(d("2024-12-31"), d("2026-01-30")), 12);
  });

  test("aplicação feita hoje rende 0 meses", () => {
    assert.equal(mesesCompletos(d("2026-11-14"), d("2026-11-14")), 0);
  });

  test("aplicação no dia 31 só fecha o mês quando o mês seguinte chega ao dia 31 (ou depois)", () => {
    assert.equal(mesesCompletos(d("2026-01-31"), d("2026-02-28")), 0);
    assert.equal(mesesCompletos(d("2026-01-31"), d("2026-03-31")), 2);
  });

  test("data de aplicação no futuro nunca dá meses negativos", () => {
    assert.equal(mesesCompletos(d("2027-01-01"), d("2026-11-14")), 0);
  });
});

describe("proximoVencimento", () => {
  test("o dia ainda não passou: vence neste mês", () => {
    assert.equal(proximoVencimento(10, d("2026-11-03")).toISOString().slice(0, 10), "2026-11-10");
  });

  test("hoje é o dia do vencimento: ainda vence hoje", () => {
    assert.equal(proximoVencimento(10, d("2026-11-10")).toISOString().slice(0, 10), "2026-11-10");
  });

  test("o dia já passou: vence no mês seguinte", () => {
    assert.equal(proximoVencimento(10, d("2026-11-11")).toISOString().slice(0, 10), "2026-12-10");
  });

  test("virada do ano", () => {
    assert.equal(proximoVencimento(5, d("2026-12-20")).toISOString().slice(0, 10), "2027-01-05");
  });

  test("dia 28 existe em todos os meses, inclusive fevereiro", () => {
    assert.equal(proximoVencimento(28, d("2027-02-01")).toISOString().slice(0, 10), "2027-02-28");
    assert.equal(proximoVencimento(28, d("2027-01-29")).toISOString().slice(0, 10), "2027-02-28");
  });
});
