/* ------------------------------------------------------------------ */
/*  Unit-Tests für calc.js                                               */
/* ------------------------------------------------------------------ */

import { describe, expect, it } from "vitest";
import { computeCalc, computeInvers } from "./calc.js";
import { DEFAULTS } from "./persistence.js";

/* ======================================================================== */
/*  computeCalc – Nebenkosten                                              */
/* ======================================================================== */

describe("computeCalc – Nebenkosten", () => {
  it("berechnet Grunderwerbsteuer je Bundesland korrekt", () => {
    const inp = { bundesland: "Berlin", kaufpreis: 500000, eigenkapital: 0, makler: false, alter: 38, rente: 67 };
    const result = computeCalc(inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    expect(result.grest).toBeCloseTo(500000 * 0.06, 2); // Berlin: 6%
  });

  it("berechnet Notarkosten (2%) korrekt", () => {
    const inp = { bundesland: "Berlin", kaufpreis: 500000, eigenkapital: 0, makler: false, alter: 38, rente: 67 };
    const result = computeCalc(inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    expect(result.notar).toBeCloseTo(500000 * 0.02, 2);
  });

  it("berechnet Maklerkosten korrekt", () => {
    const inp = { bundesland: "Berlin", kaufpreis: 500000, eigenkapital: 0, makler: true, maklerProzent: 3.57, alter: 38, rente: 67 };
    const result = computeCalc(inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    expect(result.makler).toBeCloseTo(500000 * 0.0357, 2);
  });

  it("summiert Nebenkosten korrekt", () => {
    const inp = { bundesland: "Berlin", kaufpreis: 500000, eigenkapital: 0, makler: true, maklerProzent: 3.57, alter: 38, rente: 67 };
    const result = computeCalc(inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    expect(result.nk).toBeCloseTo(result.grest + result.notar + result.makler, 2);
  });

  it("setzt Maklerkosten auf 0 wenn deaktiviert", () => {
    const inp = { bundesland: "Berlin", kaufpreis: 500000, makler: false, alter: 38, rente: 67 };
    const result = computeCalc(inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    expect(result.makler).toBe(0);
  });
});

/* ======================================================================== */
/*  computeCalc – Darlehen & Beleihungsauslauf                              */
/* ======================================================================== */

describe("computeCalc – Darlehen & Beleihungsauslauf", () => {
  it("berechnet Darlehen = Kaufpreis + NK - Eigenkapital", () => {
    const inp = { kaufpreis: 500000, eigenkapital: 120000, bundesland: "Berlin", makler: false, alter: 38, rente: 67 };
    const result = computeCalc(inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    const expectedNK = 500000 * (0.06 + 0.02); // 8%
    expect(result.darlehen).toBeCloseTo(500000 + expectedNK - 120000, 2);
  });

  it("begrenzt Darlehen auf >= 0", () => {
    const inp = { kaufpreis: 100000, eigenkapital: 500000, bundesland: "Berlin", alter: 38, rente: 67 };
    const result = computeCalc(inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    expect(result.darlehen).toBe(0);
  });

  it("berechnet Beleihungsauslauf (bla) korrekt", () => {
    const inp = { kaufpreis: 500000, eigenkapital: 100000, bundesland: "Berlin", makler: false, alter: 38, rente: 67 };
    const result = computeCalc(inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    const expectedDarlehen = 500000 + result.nk - 100000;
    expect(result.bla).toBeCloseTo((expectedDarlehen / 500000) * 100, 2);
  });

  it("setzt bla auf 0 wenn Kaufpreis = 0", () => {
    const inp = { kaufpreis: 0, eigenkapital: 0, bundesland: "Berlin", alter: 38, rente: 67 };
    const result = computeCalc(inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    expect(result.bla).toBe(0);
  });

  it("berechnet jahre und nMonths korrekt", () => {
    const inp = { alter: 38, rente: 67, bundesland: "Berlin" };
    const result = computeCalc(inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    expect(result.jahre).toBe(29);
    expect(result.nMonths).toBe(348);
  });
});

/* ======================================================================== */
/*  computeCalc – Ziel-Restschuld & Sondertilgung                            */
/* ======================================================================== */

describe("computeCalc – Ziel-Restschuld & Sondertilgung", () => {
  it("begrenzt zielRest auf darlehen", () => {
    const inp = { kaufpreis: 500000, eigenkapital: 0, zielRest: 1000000, bundesland: "Berlin", alter: 38, rente: 67 };
    const result = computeCalc(inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    expect(result.zielRest).toBe(result.darlehen);
    expect(result.zielGekappt).toBe(true);
  });

  it("setzt zielRest auf 0 wenn undefiniert", () => {
    const inp = { kaufpreis: 500000, eigenkapital: 100000, bundesland: "Berlin", alter: 38, rente: 67 };
    const result = computeCalc(inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    expect(result.zielRest).toBe(0);
  });

  it("setzt klv auf 0 wenn zielRest = 0", () => {
    const inp = { zielRest: 0, klvBeitrag: 100, bundesland: "Berlin", alter: 38, rente: 67, kaufpreis: 500000 };
    const result = computeCalc(inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    expect(result.klv).toBe(0);
  });

  it("übernimmt sonderTilgung korrekt", () => {
    const inp = { sonderTilgung: 5000, bundesland: "Berlin", alter: 38, rente: 67, kaufpreis: 500000 };
    const result = computeCalc(inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    expect(result.sonder).toBe(5000);
  });
});
