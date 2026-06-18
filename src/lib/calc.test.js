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

/* ======================================================================== */
/*  computeCalc – Belastungsquote & Modelle                                */
/* ======================================================================== */

describe("computeCalc – Belastungsquote & Modelle", () => {
  it("berechnet Spitzen-Belastungsquote für alle Modelle", () => {
    const inp = { ...DEFAULTS.inp, bundesland: "Berlin" };
    const result = computeCalc(inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    result.models.forEach(m => {
      if (!m.infeasible) expect(m.belastung).toBeGreaterThan(0);
    });
  });

  it("setzt belastung auf 999 und tragbar=false wenn netto = 0", () => {
    const inp = { ...DEFAULTS.inp, netto: 0, bundesland: "Berlin" };
    const result = computeCalc(inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    result.models.forEach(m => {
      if (!m.infeasible) {
        expect(m.belastung).toBe(999);
        expect(m.tragbar).toBe(false);
      }
    });
  });

  it("findet beste Modell (niedrigste Zinskosten)", () => {
    const result = computeCalc(DEFAULTS.inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    if (result.beste) {
      result.models
        .filter(m => !m.infeasible && m.tragbar && m.key !== result.beste.key)
        .forEach(m => {
          expect(m.zinskosten).toBeGreaterThanOrEqual(result.beste.zinskosten);
        });
    }
  });

  it("setzt beste auf null wenn kein tragbares Modell", () => {
    const inp = { ...DEFAULTS.inp, netto: 100, bundesland: "Berlin" };
    const result = computeCalc(inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    expect(result.beste).toBeNull();
  });

  it("erzeugt leeres models-Array wenn nMonths = 0", () => {
    const inp = { alter: 70, rente: 67, bundesland: "Berlin" };
    const result = computeCalc(inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    expect(result.models).toEqual([]);
  });

  it("erzeugt leeres models-Array wenn darlehen = 0", () => {
    const inp = { kaufpreis: 100000, eigenkapital: 500000, bundesland: "Berlin", alter: 38, rente: 67 };
    const result = computeCalc(inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    expect(result.models).toEqual([]);
  });
});

/* ======================================================================== */
/*  computeCalc – Stress-Szenario                                         */
/* ======================================================================== */

describe("computeCalc – Stress-Szenario", () => {
  it("berechnet Stress-Szenario mit Aufschlag", () => {
    const stress = 1.0;
    const result = computeCalc(DEFAULTS.inp, DEFAULTS.z, DEFAULTS.bsp, stress);
    expect(result.stressDelta).toBe(1.0);
    expect(result.models.some(m => m.stressBelastung !== undefined)).toBe(true);
  });

  it("hat kein Stress-Szenario wenn stress = 0", () => {
    const result = computeCalc(DEFAULTS.inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    expect(result.stressDelta).toBe(0);
    expect(result.models.every(m => m.stressBelastung === undefined)).toBe(true);
  });

  it("Stress-Szenario erhöht Belastung bei Modellen mit Anschlussfinanzierung", () => {
    const result = computeCalc(DEFAULTS.inp, DEFAULTS.z, DEFAULTS.bsp, 2.0);
    const a10 = result.models.find(m => m.key === "a10");
    if (a10?.stressBelastung) {
      // Stress-Szenario sollte Belastung erhöhen oder gleich lassen (bei sehr kleinen Unterschieden)
      expect(a10.stressBelastung).toBeGreaterThanOrEqual(a10.belastung - 0.001);
      // Stress-Zinskosten sollten höher sein
      if (a10.stressZinskosten !== undefined) {
        expect(a10.stressZinskosten).toBeGreaterThan(a10.zinskosten);
      }
    }
  });
});

/* ======================================================================== */
/*  computeCalc – Chart-Daten                                               */
/* ======================================================================== */

describe("computeCalc – Chart-Daten", () => {
  it("erzeugt Chart-Daten mit korrekter Länge", () => {
    const result = computeCalc(DEFAULTS.inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    expect(result.chart.length).toBe(DEFAULTS.inp.rente - DEFAULTS.inp.alter + 1);
  });

  it("Chart-Daten enthalten Alter und Modellwerte", () => {
    const result = computeCalc(DEFAULTS.inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    result.chart.forEach(row => {
      expect(row.alter).toBeGreaterThanOrEqual(DEFAULTS.inp.alter);
      expect(row.alter).toBeLessThanOrEqual(DEFAULTS.inp.rente);
    });
  });

  it("erzeugt Belastungsquote-Chart mit korrekter Länge", () => {
    const result = computeCalc(DEFAULTS.inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    expect(result.chartBelastung.length).toBe(DEFAULTS.inp.rente - DEFAULTS.inp.alter);
  });

  it("Belastungsquote-Chart enthält Alter und Modellwerte", () => {
    const result = computeCalc(DEFAULTS.inp, DEFAULTS.z, DEFAULTS.bsp, 0);
    result.chartBelastung.forEach(row => {
      expect(row.alter).toBeGreaterThanOrEqual(DEFAULTS.inp.alter);
      expect(row.alter).toBeLessThan(DEFAULTS.inp.rente);
    });
  });
});

/* ======================================================================== */
/*  computeInvers – Nebenkostenquote                                      */
/* ======================================================================== */

describe("computeInvers – Nebenkostenquote", () => {
  it("berechnet nkQ mit Makler korrekt", () => {
    const inp = { bundesland: "Berlin", makler: true, maklerProzent: 3.57 };
    const result = computeInvers(inp, DEFAULTS.z, DEFAULTS.bsp, "max", [30, 35, 40]);
    expect(result.nkQ).toBeCloseTo((6.0 + 2.0 + 3.57) / 100, 4);
  });

  it("berechnet nkQ ohne Makler korrekt", () => {
    const inp = { bundesland: "Berlin", makler: false };
    const result = computeInvers(inp, DEFAULTS.z, DEFAULTS.bsp, "max", [30, 35, 40]);
    expect(result.nkQ).toBeCloseTo((6.0 + 2.0) / 100, 4);
  });

  it("berechnet klv korrekt", () => {
    const inp = { zielRest: 50000, klvBeitrag: 200 };
    const result = computeInvers(inp, DEFAULTS.z, DEFAULTS.bsp, "max", [30]);
    expect(result.klv).toBe(200);
  });
});

/* ======================================================================== */
/*  computeInvers – Edge Cases                                            */
/* ======================================================================== */

describe("computeInvers – Edge Cases", () => {
  it("gibt leere rows zurück wenn modus !== 'max'", () => {
    const result = computeInvers(DEFAULTS.inp, DEFAULTS.z, DEFAULTS.bsp, "vergleich", [30]);
    expect(result.rows).toEqual([]);
  });

  it("gibt leere rows zurück wenn jahre <= 0", () => {
    const inp = { ...DEFAULTS.inp, alter: 70, rente: 67 };
    const result = computeInvers(inp, DEFAULTS.z, DEFAULTS.bsp, "max", [30]);
    expect(result.rows).toEqual([]);
  });

  it("gibt leere rows zurück wenn netto <= 0", () => {
    const inp = { ...DEFAULTS.inp, netto: 0 };
    const result = computeInvers(inp, DEFAULTS.z, DEFAULTS.bsp, "max", [30]);
    expect(result.rows).toEqual([]);
  });

  it("gibt korrekte jahre und g zurück", () => {
    const inp = { alter: 38, rente: 67, einkommenPlus: 3 };
    const result = computeInvers(inp, DEFAULTS.z, DEFAULTS.bsp, "max", [30]);
    expect(result.jahre).toBe(29);
    expect(result.g).toBeCloseTo(0.03, 4);
  });
});

/* ======================================================================== */
/*  computeInvers – Binärsuche (max. Kaufpreis)                              */
/* ======================================================================== */

describe("computeInvers – Binärsuche (max. Kaufpreis)", () => {
  it("findet maximalen Kaufpreis für alle Modelle", () => {
    const result = computeInvers(DEFAULTS.inp, DEFAULTS.z, DEFAULTS.bsp, "max", [30, 35, 40]);
    expect(result.rows.length).toBe(6); // 6 Modelle
    result.rows.forEach(row => {
      if (!row.infeasible) {
        expect(row.cells.length).toBe(3); // 3 Limits
      }
    });
  });

  it("behandelt infeasible Modelle korrekt", () => {
    const result = computeInvers(DEFAULTS.inp, DEFAULTS.z, { ...DEFAULTS.bsp, ansparJahre: 30 }, "max", [30]);
    const bspRow = result.rows.find(r => r.key === "bsp");
    expect(bspRow.infeasible).toBe(true);
    expect(bspRow.cells.every(c => c === null)).toBe(true);
  });

  it("capped bei sehr hohem Budget (CAP = 10M)", () => {
    const inp = { ...DEFAULTS.inp, eigenkapital: 1000000, netto: 100000 };
    const result = computeInvers(inp, DEFAULTS.z, DEFAULTS.bsp, "max", [30]);
    result.rows.forEach(row => {
      if (!row.infeasible) {
        row.cells.forEach(cell => {
          if (cell?.capped) expect(cell.P).toBe(10000000);
        });
      }
    });
  });

  it("behandelt KLV-Grenze korrekt", () => {
    const inp = { ...DEFAULTS.inp, netto: 1000, klvBeitrag: 500, zielRest: 50000 };
    const result = computeInvers(inp, DEFAULTS.z, DEFAULTS.bsp, "max", [30]);
    // KLV = 500, netto = 1000 -> 50% Belastung durch KLV allein
    result.rows.forEach(row => {
      if (!row.infeasible && row.cells[0]) {
        expect(row.cells[0].P).toBe(0); // Kein Budget möglich bei 30% Grenze
      }
    });
  });

  it("berechnet D (Darlehen) korrekt für jeden Kaufpreis", () => {
    const inp = { ...DEFAULTS.inp, eigenkapital: 100000 };
    const result = computeInvers(inp, DEFAULTS.z, DEFAULTS.bsp, "max", [30]);
    result.rows.forEach(row => {
      if (!row.infeasible) {
        row.cells.forEach(cell => {
          if (cell && cell.P > 0) {
            const expectedD = Math.max(0, Math.round(cell.P * (1 + result.nkQ) - inp.eigenkapital));
            expect(cell.D).toBe(expectedD);
          }
        });
      }
    });
  });
});
