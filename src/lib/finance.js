/* ------------------------------------------------------------------ */
/*  Finanzmathematik: Annuitäten, Darlehensphasen, Modell-Berechnung   */
/* ------------------------------------------------------------------ */

import { eur, pct } from "./format.js";

export function annuityPayment(K, rateAnnual, months, residual = 0) {
  if (months <= 0 || K <= 0) return 0;
  const r = rateAnnual / 100 / 12;
  if (r === 0) return Math.max(0, (K - residual) / months);
  const v = Math.pow(1 + r, -months);
  return Math.max(0, ((K - residual * v) * r) / (1 - v));
}

/** Annuitätendarlehen in Phasen; Rate wird je Phase so gesetzt, dass am Ende
 *  der Gesamtlaufzeit n genau die Ziel-Restschuld `ziel` verbleibt.
 *  `sonderJahr` wird jeweils zum Jahresende getilgt, höchstens bis auf `ziel`
 *  herunter; die Rate der Folgephase wird auf der reduzierten Restschuld neu kalibriert. */
export function annuLoan(K, n, phases, ziel = 0, sonderJahr = 0) {
  let rest = K, interest = 0, done = 0;
  const restArr = [K], payArr = [], zinsArr = [];
  for (const ph of phases) {
    const m = Math.min(ph.months, n - done);
    if (m <= 0) break;
    const pay = annuityPayment(rest, ph.rate, n - done, ziel);
    const r = ph.rate / 100 / 12;
    for (let i = 0; i < m; i++) {
      const z = rest * r;
      interest += z;
      rest = Math.max(0, rest + z - pay);
      if (sonderJahr > 0 && (done + i + 1) % 12 === 0)
        rest = Math.max(rest - sonderJahr, Math.min(rest, ziel));
      restArr.push(rest);
      payArr.push(pay);
      zinsArr.push(z);
      if (rest <= 0.5) break;
    }
    done += m;
    if (rest <= 0.5) break;
  }
  const tail = restArr[restArr.length - 1];
  while (restArr.length < n + 1) restArr.push(tail);
  while (payArr.length < n) payArr.push(0);
  while (zinsArr.length < n) zinsArr.push(0);
  return { restArr, payArr, zinsArr, interest };
}

export function addLoans(a, b) {
  const n = Math.max(a.restArr.length, b.restArr.length);
  const restArr = [], payArr = [], zinsArr = [];
  for (let i = 0; i < n; i++) restArr.push((a.restArr[i] || 0) + (b.restArr[i] || 0));
  for (let i = 0; i < n - 1; i++) {
    payArr.push((a.payArr[i] || 0) + (b.payArr[i] || 0));
    zinsArr.push((a.zinsArr[i] || 0) + (b.zinsArr[i] || 0));
  }
  return { restArr, payArr, zinsArr, interest: a.interest + b.interest };
}

export function buildModels(D, nMonths, z, bausparCfg, ziel = 0, sonder = 0) {
  const models = [];
  const INF = Infinity;

  // Annuitätendarlehen mit 10 / 15 / 20 Jahren Zinsbindung
  [[10, z.z10, "a10"], [15, z.z15, "a15"], [20, z.z20, "a20"]].forEach(([jahre, rate, key]) => {
    const loan = annuLoan(D, nMonths, [
      { rate, months: jahre * 12 },
      { rate: z.anschluss, months: INF },
    ], ziel, sonder);
    const hatAnschluss = nMonths > jahre * 12;
    models.push({
      key, name: `Annuität · ${jahre} J. Zinsbindung`,
      short: `Annuität ${jahre} J.`,
      zinsInfo: hatAnschluss ? `${pct(rate)} → ${pct(z.anschluss)}` : pct(rate),
      hinweis: hatAnschluss
        ? `Nach ${jahre} Jahren Anschlussfinanzierung zum angenommenen Zins von ${pct(z.anschluss)} (Zinsänderungsrisiko).`
        : "Zinsbindung deckt die volle Laufzeit ab.",
      ...summarize(loan, nMonths, ziel),
      loan,
    });
  });

  // Volltilgerdarlehen
  {
    const loan = annuLoan(D, nMonths, [{ rate: z.volltilger, months: INF }], ziel, sonder);
    models.push({
      key: "vt", name: "Volltilgerdarlehen", short: "Volltilger",
      zinsInfo: pct(z.volltilger),
      hinweis: "Zins über die gesamte Laufzeit festgeschrieben – volle Planungssicherheit, kein Anschlussrisiko.",
      ...summarize(loan, nMonths, ziel),
      loan,
    });
  }

  // KfW-Kombination (KfW 124, max. 100.000 €, 10 J. Zinsbindung)
  {
    const kfwTeil = Math.min(100000, D);
    const hauptTeil = D - kfwTeil;
    const hauptZiel = Math.min(ziel, hauptTeil);
    const kfwZiel = ziel - hauptZiel; // Rest des Ziels landet ggf. im KfW-Teil
    // Sondertilgung fließt in das Hauptdarlehen; nur ohne Hauptdarlehen in den KfW-Teil
    const kfw = annuLoan(kfwTeil, nMonths, [
      { rate: z.kfw, months: 120 },
      { rate: z.anschluss, months: INF },
    ], kfwZiel, hauptTeil > 0 ? 0 : sonder);
    const haupt = annuLoan(hauptTeil, nMonths, [
      { rate: z.z15, months: 180 },
      { rate: z.anschluss, months: INF },
    ], hauptZiel, hauptTeil > 0 ? sonder : 0);
    const loan = addLoans(kfw, haupt);
    models.push({
      key: "kfw", name: "Annuität 15 J. + KfW-Baustein", short: "KfW-Kombi",
      zinsInfo: `${pct(z.z15)} + KfW ${pct(z.kfw)}`,
      hinweis: `KfW-Wohneigentumsprogramm (${eur(kfwTeil)}, 10 J. Zinsbindung) ergänzt ein Hauptdarlehen mit 15 J. Zinsbindung. Anschluss jeweils zu ${pct(z.anschluss)}.`
        + (sonder > 0 && hauptTeil > 0 ? " Sondertilgungen fließen in das Hauptdarlehen." : ""),
      ...summarize(loan, nMonths, ziel),
      loan,
    });
  }

  // Bauspar-Kombimodell
  {
    const ansparM = Math.round(bausparCfg.ansparJahre * 12);
    if (ansparM >= nMonths || ansparM <= 0) {
      models.push({
        key: "bsp", name: "Bauspar-Kombimodell", short: "Bauspar-Kombi",
        zinsInfo: "—", infeasible: true,
        hinweis: "Ansparphase ist länger als die verbleibende Zeit bis zur Rente – Modell in dieser Konstellation nicht darstellbar.",
      });
    } else {
      const quote = bausparCfg.ansparQuote / 100;
      const S = (D * quote) / ansparM;
      const zinsM = (D * bausparCfg.vorausZins) / 100 / 12;
      const restArr = [D], payArr = [], zinsArr = [];
      let interest = 0;
      for (let i = 1; i <= ansparM; i++) {
        interest += zinsM;
        restArr.push(D - S * i); // Netto-Schuld = Vorausdarlehen − Bausparguthaben
        payArr.push(zinsM + S);
        zinsArr.push(zinsM);
      }
      const sub = annuLoan(D * (1 - quote), nMonths - ansparM,
        [{ rate: bausparCfg.bausparZins, months: INF }],
        Math.min(ziel, D * (1 - quote)));
      interest += sub.interest;
      sub.restArr.slice(1).forEach((r) => restArr.push(r));
      sub.payArr.forEach((p) => payArr.push(p));
      sub.zinsArr.forEach((zi) => zinsArr.push(zi));
      const fee = D * 0.01; // Abschlussgebühr ~1 % der Bausparsumme
      const loan = { restArr, payArr, zinsArr, interest: interest + fee, fee };
      models.push({
        key: "bsp", name: "Bauspar-Kombimodell", short: "Bauspar-Kombi",
        zinsInfo: `${pct(bausparCfg.vorausZins)} → ${pct(bausparCfg.bausparZins)}`,
        hinweis: `Tilgungsfreies Vorausdarlehen (${pct(bausparCfg.vorausZins)}) + paralleles Ansparen von ${bausparCfg.ansparQuote} % über ${bausparCfg.ansparJahre} Jahre, danach Bauspardarlehen zu ${pct(bausparCfg.bausparZins)}. Inkl. ca. 1 % Abschlussgebühr; Guthabenverzinsung vereinfachend vernachlässigt.`
          + (sonder > 0 ? " Sondertilgungen werden in diesem Modell nicht berücksichtigt." : ""),
        ...summarize(loan, nMonths, ziel),
        loan,
      });
    }
  }

  return models;
}

export function summarize(loan, nMonths, ziel = 0) {
  const rate1 = loan.payArr[0] || 0;
  const rateMax = Math.max(...loan.payArr, 0);
  // letzte abweichende Rate (z. B. nach Anschluss / Zuteilung)
  let rate2 = null;
  for (let i = loan.payArr.length - 1; i >= 0; i--) {
    if (loan.payArr[i] > 0) { if (Math.abs(loan.payArr[i] - rate1) > 0.5) rate2 = loan.payArr[i]; break; }
  }
  let payoffMonth = nMonths;
  for (let i = 0; i < loan.restArr.length; i++) {
    if (loan.restArr[i] <= ziel + 0.5) { payoffMonth = i; break; }
  }
  const restRente = loan.restArr[Math.min(nMonths, loan.restArr.length - 1)] || 0;
  return { rate1, rate2, rateMax, zinskosten: loan.interest, payoffMonth, restRente, infeasible: false };
}
