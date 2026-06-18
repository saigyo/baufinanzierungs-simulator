import { describe, expect, it } from "vitest";
import { annuityPayment, annuLoan, addLoans, buildModels, summarize } from "./finance.js";
import { DEFAULTS } from "./persistence.js";

const Z = DEFAULTS.z;
const BSP = DEFAULTS.bsp;
const D = 400000;
const N = 29 * 12; // 348 Monate
const PHASEN = [{ rate: 3.7, months: 180 }, { rate: 4.2, months: Infinity }];

/** Restschuld nach `months` Monaten bei fester Rate `pay` (unabhängige Gegenrechnung). */
function simuliere(K, rateAnnual, months, pay) {
  const r = rateAnnual / 100 / 12;
  let rest = K;
  for (let i = 0; i < months; i++) rest = rest * (1 + r) - pay;
  return rest;
}

const tilgungsMonat = (loan) => loan.restArr.findIndex((r) => r <= 0.5);

describe("annuityPayment", () => {
  it("liefert den bekannten Wert der Annuitätenformel", () => {
    // 100.000 € zu 6 % über 120 Monate: klassisches Lehrbuchbeispiel
    expect(annuityPayment(100000, 6, 120)).toBeCloseTo(1110.21, 2);
  });

  it("führt das Darlehen exakt auf 0 zurück (Gegenrechnung)", () => {
    const pay = annuityPayment(250000, 3.7, 300);
    expect(simuliere(250000, 3.7, 300, pay)).toBeCloseTo(0, 4);
  });

  it("führt das Darlehen exakt auf die Ballon-Restschuld zurück", () => {
    const pay = annuityPayment(250000, 3.7, 300, 80000);
    expect(simuliere(250000, 3.7, 300, pay)).toBeCloseTo(80000, 4);
  });

  it("tilgt bei 0 % Zins linear", () => {
    expect(annuityPayment(120000, 0, 120)).toBeCloseTo(1000, 10);
    expect(annuityPayment(120000, 0, 120, 60000)).toBeCloseTo(500, 10);
  });

  it("liefert 0 bei ungültigen Eingaben und negiert keine Raten", () => {
    expect(annuityPayment(0, 3.7, 120)).toBe(0);
    expect(annuityPayment(-1, 3.7, 120)).toBe(0);
    expect(annuityPayment(100000, 3.7, 0)).toBe(0);
    expect(annuityPayment(50000, 3.7, 120, 100000)).toBe(0); // Restschuld > Darlehen
  });
});

describe("annuLoan", () => {
  it("tilgt über zwei Phasen exakt auf 0 und hält die Array-Längen ein", () => {
    const loan = annuLoan(D, N, PHASEN);
    expect(loan.restArr).toHaveLength(N + 1);
    expect(loan.payArr).toHaveLength(N);
    expect(loan.restArr[0]).toBe(D);
    expect(Math.abs(loan.restArr[N])).toBeLessThan(0.01);
  });

  it("hält die Rate innerhalb einer Phase konstant und kalibriert je Phase neu", () => {
    const loan = annuLoan(D, N, PHASEN);
    expect(loan.payArr[0]).toBe(loan.payArr[179]);
    expect(loan.payArr[180]).toBe(loan.payArr[N - 1]);
    expect(loan.payArr[180]).toBeGreaterThan(loan.payArr[179]); // Anschlusszins 4,2 % > 3,7 %
  });

  it("erfüllt die Summenbilanz: Summe der Raten = Darlehen + Zinsen", () => {
    const loan = annuLoan(D, N, PHASEN);
    const summe = loan.payArr.reduce((a, b) => a + b, 0);
    expect(Math.abs(summe - (D + loan.interest))).toBeLessThan(0.01);
  });

  it("endet exakt bei der Ziel-Restschuld", () => {
    const loan = annuLoan(D, N, PHASEN, 80000);
    expect(loan.restArr[N]).toBeCloseTo(80000, 4);
  });

  it("hat eine monoton fallende Restschuld", () => {
    const loan = annuLoan(D, N, PHASEN, 80000);
    for (let i = 1; i < loan.restArr.length; i++) {
      expect(loan.restArr[i]).toBeLessThanOrEqual(loan.restArr[i - 1]);
    }
  });
});

describe("annuLoan – Sondertilgung", () => {
  const base = annuLoan(D, N, PHASEN);
  const sonder = annuLoan(D, N, PHASEN, 0, 5000);

  it("lässt die Startrate unverändert", () => {
    expect(sonder.payArr[0]).toBe(base.payArr[0]);
  });

  it("tilgt jeweils zum Jahresende den vollen Betrag", () => {
    expect(sonder.restArr[12]).toBeCloseTo(base.restArr[12] - 5000, 6);
    expect(sonder.restArr[11]).toBeCloseTo(base.restArr[11], 6);
  });

  it("senkt Zinskosten und Anschlussrate und tilgt früher", () => {
    expect(sonder.interest).toBeLessThan(base.interest);
    expect(sonder.payArr[180]).toBeLessThan(base.payArr[180]);
    expect(tilgungsMonat(sonder)).toBeLessThan(tilgungsMonat(base));
    expect(tilgungsMonat(base)).toBe(N);
  });

  it("unterschreitet die Ziel-Restschuld per Sondertilgung nicht", () => {
    const loan = annuLoan(D, N, PHASEN, 80000, 50000);
    expect(Math.min(...loan.restArr)).toBeGreaterThanOrEqual(0);
    expect(loan.restArr[N]).toBeLessThanOrEqual(80000 + 0.01);
  });

  it("zahlt nach vollständiger Tilgung keine Raten mehr", () => {
    const loan = annuLoan(D, N, PHASEN, 0, 100000);
    const ende = tilgungsMonat(loan);
    expect(ende).toBeLessThan(60);
    expect(loan.restArr.every((r) => r >= 0)).toBe(true);
    expect(loan.payArr.slice(ende).every((p) => p === 0)).toBe(true);
    expect(loan.restArr).toHaveLength(N + 1); // Padding bleibt erhalten
  });
});

describe("addLoans", () => {
  it("addiert Restschulden, Raten und Zinsen zweier Darlehen", () => {
    const a = annuLoan(100000, N, [{ rate: 3.4, months: 120 }, { rate: 4.2, months: Infinity }]);
    const b = annuLoan(300000, N, [{ rate: 3.7, months: 180 }, { rate: 4.2, months: Infinity }]);
    const sum = addLoans(a, b);
    expect(sum.interest).toBeCloseTo(a.interest + b.interest, 8);
    expect(sum.restArr[0]).toBe(400000);
    expect(sum.restArr[200]).toBeCloseTo(a.restArr[200] + b.restArr[200], 8);
    expect(sum.payArr[0]).toBeCloseTo(a.payArr[0] + b.payArr[0], 8);
  });
});

describe("buildModels", () => {
  it("liefert die sechs Modelle in fester Reihenfolge", () => {
    const keys = buildModels(D, N, Z, BSP).map((m) => m.key);
    expect(keys).toEqual(["a10", "a15", "a20", "vt", "kfw", "bsp"]);
  });

  it("führt alle darstellbaren Modelle exakt auf die Ziel-Restschuld", () => {
    for (const m of buildModels(D, N, Z, BSP, 50000)) {
      if (m.infeasible) continue;
      expect(Math.abs(m.loan.restArr[N] - 50000), m.key).toBeLessThan(1);
    }
  });

  it("Volltilger: konstante Rate, keine Anschlussrate", () => {
    const vt = buildModels(D, N, Z, BSP).find((m) => m.key === "vt");
    expect(vt.rate2).toBeNull();
    expect(vt.rate1).toBeCloseTo(vt.rateMax, 8);
  });

  it("KfW-Kombi: Baustein ist auf 100.000 € gedeckelt, Kombination tilgt auf 0", () => {
    const kfw = buildModels(D, N, Z, BSP).find((m) => m.key === "kfw");
    expect(kfw.hinweis).toContain("100.000");
    expect(Math.abs(kfw.loan.restArr[N])).toBeLessThan(0.01);
    // Darlehen unter der KfW-Grenze: nur KfW-Baustein, trotzdem volle Tilgung
    const klein = buildModels(80000, N, Z, BSP, 0, 2000).find((m) => m.key === "kfw");
    expect(Math.abs(klein.loan.restArr[N])).toBeLessThan(0.01);
  });

  it("Bauspar-Modell ist nicht darstellbar, wenn die Ansparphase die Laufzeit sprengt", () => {
    const bsp = buildModels(D, N, Z, { ...BSP, ansparJahre: 30 }).find((m) => m.key === "bsp");
    expect(bsp.infeasible).toBe(true);
  });

  it("Stress auf den Anschlusszins trifft nur Modelle mit Anschlussfinanzierung", () => {
    const basis = buildModels(D, N, Z, BSP);
    const stress = buildModels(D, N, { ...Z, anschluss: Z.anschluss + 2 }, BSP);
    const zk = (models, key) => models.find((m) => m.key === key).zinskosten;
    expect(zk(stress, "a10")).toBeGreaterThan(zk(basis, "a10"));
    expect(zk(stress, "kfw")).toBeGreaterThan(zk(basis, "kfw"));
    expect(zk(stress, "vt")).toBeCloseTo(zk(basis, "vt"), 8);
    expect(zk(stress, "bsp")).toBeCloseTo(zk(basis, "bsp"), 8);
  });
});

describe("summarize", () => {
  it("extrahiert Raten, Tilgungszeitpunkt und Rest bei Rente", () => {
    const loan = annuLoan(D, N, PHASEN);
    const s = summarize(loan, N);
    expect(s.rate1).toBe(loan.payArr[0]);
    expect(s.rate2).toBe(loan.payArr[N - 1]);
    expect(s.rateMax).toBe(Math.max(...loan.payArr));
    expect(s.payoffMonth).toBe(N);
    expect(s.restRente).toBeCloseTo(0, 4);
    expect(s.infeasible).toBe(false);
  });

  it("erkennt das Erreichen der Ziel-Restschuld als Tilgungszeitpunkt", () => {
    const loan = annuLoan(D, N, PHASEN, 80000, 20000);
    const s = summarize(loan, N, 80000);
    expect(s.payoffMonth).toBeLessThan(N);
    expect(s.restRente).toBeLessThanOrEqual(80000 + 0.01);
  });
});

/* ======================================================================== */
/*  EDGE CASE TESTS (Priorität 1)                                              */
/* ======================================================================== */

describe("annuityPayment – Edge Cases", () => {
  it("behandelt negative Darlehensbeträge sicher", () => {
    expect(annuityPayment(-100000, 3.7, 120)).toBe(0);
  });

  it("behandelt negative Zinssätze sicher", () => {
    expect(annuityPayment(100000, -3.7, 120)).toBe(0);
  });

  it("behandelt negative Laufzeiten sicher", () => {
    expect(annuityPayment(100000, 3.7, -120)).toBe(0);
  });

  it("behandelt Restschuld > Darlehen korrekt", () => {
    expect(annuityPayment(50000, 3.7, 120, 100000)).toBe(0);
  });
});

describe("annuLoan – Edge Cases", () => {
  it("behandelt K=0 korrekt", () => {
    const loan = annuLoan(0, N, PHASEN);
    expect(loan.restArr.every((r) => r === 0)).toBe(true);
    expect(loan.payArr.every((p) => p === 0)).toBe(true);
    expect(loan.interest).toBe(0);
  });

  it("behandelt n=0 korrekt", () => {
    const loan = annuLoan(D, 0, PHASEN);
    expect(loan.restArr).toEqual([D]);
    expect(loan.payArr).toEqual([]);
    expect(loan.interest).toBe(0);
  });

  it("behandelt leere Phasen-Array korrekt", () => {
    const loan = annuLoan(D, N, []);
    expect(loan.restArr[0]).toBe(D);
    expect(loan.restArr[N]).toBe(D);
    expect(loan.interest).toBe(0);
    expect(loan.payArr.every((p) => p === 0)).toBe(true);
  });

  it("behandelt Ziel-Restschuld > Darlehen korrekt", () => {
    const loan = annuLoan(D, N, PHASEN, D + 100000);
    expect(loan.restArr[0]).toBe(D);
    expect(loan.restArr[N]).toBeCloseTo(D, 4);
  });
});

describe("addLoans – Edge Cases", () => {
  it("behandelt leere Loans korrekt", () => {
    const empty = { restArr: [], payArr: [], interest: 0 };
    const sum = addLoans(empty, empty);
    expect(sum.restArr).toEqual([]);
    expect(sum.payArr).toEqual([]);
    expect(sum.interest).toBe(0);
  });

  it("behandelt unterschiedliche Array-Längen korrekt", () => {
    const a = annuLoan(100000, 120, [{ rate: 3.4, months: 120 }]);
    const b = annuLoan(200000, 240, [{ rate: 3.7, months: 240 }]);
    const sum = addLoans(a, b);
    expect(sum.restArr.length).toBe(241); // max(121, 241)
    expect(sum.payArr.length).toBe(240); // max(120, 240)
    expect(sum.interest).toBeCloseTo(a.interest + b.interest, 8);
  });
});

describe("buildModels – Edge Cases", () => {
  it("behandelt Darlehen=0 korrekt", () => {
    const models = buildModels(0, N, Z, BSP);
    expect(models.length).toBe(6);
    models.forEach((m) => {
      if (!m.infeasible) {
        expect(m.loan.restArr[0]).toBe(0);
        expect(m.loan.interest).toBe(0);
      }
    });
  });

  it("behandelt nMonths=0 korrekt", () => {
    const models = buildModels(D, 0, Z, BSP);
    expect(models.length).toBe(6);
    models.forEach((m) => {
      if (!m.infeasible) {
        expect(m.loan.restArr[0]).toBe(D);
      }
    });
  });
});

describe("summarize – Edge Cases", () => {
  it("behandelt leere Arrays korrekt", () => {
    const loan = { restArr: [], payArr: [], interest: 0 };
    const s = summarize(loan, N);
    expect(s.rate1).toBe(0);
    expect(s.rateMax).toBe(0);
    expect(s.payoffMonth).toBe(N);
    expect(s.restRente).toBe(0);
    expect(s.infeasible).toBe(false);
  });

  it("behandelt nMonths=0 korrekt", () => {
    const loan = annuLoan(D, N, PHASEN);
    const s = summarize(loan, 0);
    expect(s.payoffMonth).toBe(0);
    expect(s.restRente).toBe(loan.restArr[0]);
  });

  it("behandelt Ziel-Restschuld korrekt bei summarize", () => {
    const loan = annuLoan(D, N, PHASEN, 50000);
    const s = summarize(loan, N, 50000);
    expect(s.restRente).toBeLessThanOrEqual(50000.01);
    expect(s.payoffMonth).toBeLessThanOrEqual(N);
  });
});
