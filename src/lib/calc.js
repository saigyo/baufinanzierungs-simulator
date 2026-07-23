/* ------------------------------------------------------------------ */
/*  Abgeleitete Berechnungen für die Haupt-Komponente                  */
/*  (pure Funktionen; im Orchestrator per useMemo gecacht)             */
/* ------------------------------------------------------------------ */

import { GREST, NOTAR_PROZENT } from "./constants.js";
import { buildModels } from "./finance.js";

/** Modellvergleich: Nebenkosten, Darlehen, Modelle inkl. Belastungsquoten,
 *  Stress-Szenario, Empfehlung und Chart-Daten. Mutiert die Modell-Objekte
 *  bewusst (belastung, stressBelastung, …). */
export function computeCalc(inp, z, bsp, stress) {
  const grest = (GREST[inp.bundesland] / 100) * inp.kaufpreis;
  const notar = (NOTAR_PROZENT / 100) * inp.kaufpreis;
  const makler = inp.makler ? (inp.maklerProzent / 100) * inp.kaufpreis : 0;
  const nk = grest + notar + makler;
  const darlehen = Math.max(0, inp.kaufpreis + nk - inp.eigenkapital);
  const bla = inp.kaufpreis > 0 ? (darlehen / inp.kaufpreis) * 100 : 0;
  const jahre = Math.max(0, inp.rente - inp.alter);
  const nMonths = jahre * 12;
  const zielRest = Math.min(Math.max(0, inp.zielRest || 0), darlehen);
  const zielGekappt = (inp.zielRest || 0) > darlehen && darlehen > 0;
  const sonder = Math.max(0, inp.sonderTilgung || 0);
  const models = nMonths > 0 && darlehen > 0 ? buildModels(darlehen, nMonths, z, bsp, zielRest, sonder) : [];

  const klv = zielRest > 0 ? Math.max(0, inp.klvBeitrag || 0) : 0;
  const g = Math.max(0, inp.einkommenPlus || 0) / 100;
  const einkommenImJahr = (j) => inp.netto * Math.pow(1 + g, j);
  const spitze = (loan) => {
    let maxB = 0;
    for (let mo = 0; mo < nMonths; mo++) {
      const b = (((loan.payArr[mo] || 0) + klv) / einkommenImJahr(Math.floor(mo / 12))) * 100;
      if (b > maxB) maxB = b;
    }
    return maxB;
  };

  // Stress-Szenario: Anschlusszins um `stress` %-Punkte höher
  const stressDelta = Math.max(0, stress || 0);
  const stressMap = stressDelta > 0 && models.length > 0
    ? Object.fromEntries(
        buildModels(darlehen, nMonths, { ...z, anschluss: z.anschluss + stressDelta }, bsp, zielRest, sonder)
          .map((m) => [m.key, m]))
    : null;

  models.forEach((m) => {
    if (m.infeasible) return;
    if (inp.netto <= 0) { m.belastung = 999; m.belastungStart = 999; m.tragbar = false; return; }
    m.belastung = spitze(m.loan); // Spitzen-Belastungsquote über die gesamte Laufzeit
    m.belastungStart = ((m.rate1 + klv) / inp.netto) * 100;
    m.tragbar = m.belastung <= 40;
    const ms = stressMap && stressMap[m.key];
    if (ms && !ms.infeasible) {
      m.stressBelastung = spitze(ms.loan);
      m.stressZinskosten = ms.zinskosten;
    }
  });
  const kandidaten = models.filter((m) => !m.infeasible && m.tragbar);
  const beste = kandidaten.length
    ? kandidaten.reduce((a, b) => (b.zinskosten < a.zinskosten ? b : a))
    : null;

  // Chart-Daten: Restschuld je Lebensjahr
  const chart = [];
  for (let j = 0; j <= jahre; j++) {
    const row = { alter: inp.alter + j };
    models.forEach((m) => { if (!m.infeasible) row[m.key] = Math.round(m.loan.restArr[Math.min(j * 12, nMonths)]); });
    chart.push(row);
  }
  // Chart-Daten: Belastungsquote je Lebensjahr (Rate + KLV ÷ Einkommen des Jahres)
  const chartBelastung = [];
  for (let j = 0; j < jahre; j++) {
    const row = { alter: inp.alter + j };
    const ink = einkommenImJahr(j);
    models.forEach((m) => {
      if (!m.infeasible && ink > 0) {
        const rate = (m.loan.payArr[Math.min(j * 12, nMonths - 1)] || 0) + klv;
        row[m.key] = Math.round((rate / ink) * 1000) / 10;
      }
    });
    chartBelastung.push(row);
  }
  return { grest, notar, makler, nk, darlehen, bla, jahre, nMonths, models, beste, chart, chartBelastung, zielRest, zielGekappt, klv, g, sonder, stressDelta };
}

/** Umkehrrechnung: max. Kaufpreis je Modell und Belastungsgrenze
 *  (Binärsuche über den Kaufpreis, geprüft wird die Spitzen-Belastungsquote). */
export function computeInvers(inp, z, bsp, modus, limits) {
  const nkQ = (GREST[inp.bundesland] + NOTAR_PROZENT + (inp.makler ? inp.maklerProzent : 0)) / 100;
  const jahre = Math.max(0, inp.rente - inp.alter);
  const n = jahre * 12;
  const klv = (inp.zielRest || 0) > 0 ? Math.max(0, inp.klvBeitrag || 0) : 0;
  if (modus !== "max" || n <= 0 || inp.netto <= 0) return { nkQ, klv, rows: [] };

  const g = Math.max(0, inp.einkommenPlus || 0) / 100;
  const inkJahr = Array.from({ length: jahre + 1 }, (_, j) => inp.netto * Math.pow(1 + g, j));

  // Spitzen-Belastung in % über die Laufzeit für einen Kaufpreis P und ein Modell
  const peakFor = (P, key) => {
    const D = Math.max(0, P * (1 + nkQ) - inp.eigenkapital);
    if (D <= 0) return (klv / inp.netto) * 100;
    const ziel = Math.min(Math.max(0, inp.zielRest || 0), D);
    const m = buildModels(D, n, z, bsp, ziel).find((x) => x.key === key);
    if (!m || m.infeasible) return null;
    let maxB = 0;
    for (let mo = 0; mo < n; mo++) {
      const b = ((m.loan.payArr[mo] || 0) + klv) / inkJahr[Math.floor(mo / 12)];
      if (b > maxB) maxB = b;
    }
    return maxB * 100;
  };

  const CAP = 10000000;
  const sample = buildModels(500000, n, z, bsp, 0);
  const rows = sample.map((meta) => {
    if (meta.infeasible) {
      return { key: meta.key, name: meta.name, short: meta.short, infeasible: true, hinweis: meta.hinweis, cells: limits.map(() => null) };
    }
    const cells = limits.map((L) => {
      if ((klv / inp.netto) * 100 >= L) return { P: 0 }; // KLV-Beitrag sprengt die Grenze bereits allein
      if ((peakFor(CAP, meta.key) ?? Infinity) <= L) return { P: CAP, capped: true };
      let lo = inp.eigenkapital / (1 + nkQ), hi = CAP;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        const b = peakFor(mid, meta.key);
        if (b !== null && b <= L) lo = mid; else hi = mid;
      }
      const P = Math.floor(lo / 1000) * 1000;
      return { P, D: Math.max(0, Math.round(P * (1 + nkQ) - inp.eigenkapital)) };
    });
    return { key: meta.key, name: meta.name, short: meta.short, cells };
  });
  return { nkQ, klv, rows, jahre, g };
}

/** Jahres-Tilgungsplan eines Modell-Loans: aggregiert je Jahr Rate, Zins,
 *  (reguläre) Tilgung, Sondertilgung (Jahresend-Schlag) und Restschuld.
 *  Rein und deterministisch – `startJahr` wird als Parameter übergeben. */
export function tilgungsReihe(loan, nMonths, alterStart, startJahr) {
  const rows = [];
  const jahre = Math.ceil(nMonths / 12);
  for (let y = 0; y < jahre; y++) {
    const von = y * 12;
    const bis = Math.min(von + 12, nMonths);
    let zins = 0, tilgung = 0, rate = 0;
    for (let m = von; m < bis; m++) {
      const z = loan.zinsArr[m] || 0;
      const p = loan.payArr[m] || 0;
      zins += z;
      tilgung += p - z; // reguläre Tilgung
      rate += p;
    }
    const restVor = loan.restArr[Math.min(von, loan.restArr.length - 1)];
    const rest = loan.restArr[Math.min(bis, loan.restArr.length - 1)];
    const sonder = (restVor - rest) - tilgung; // Jahresend-Sondertilgung
    rows.push({ alter: alterStart + y, jahr: startJahr + y, rate, zins, tilgung, sonder, rest });
  }
  return rows;
}
