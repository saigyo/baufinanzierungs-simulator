import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend,
} from "recharts";

/* ------------------------------------------------------------------ */
/*  Konstanten & Hilfsfunktionen                                       */
/* ------------------------------------------------------------------ */

const GREST = {
  "Baden-Württemberg": 5.0, "Bayern": 3.5, "Berlin": 6.0, "Brandenburg": 6.5,
  "Bremen": 5.0, "Hamburg": 5.5, "Hessen": 6.0, "Mecklenburg-Vorpommern": 6.0,
  "Niedersachsen": 5.0, "Nordrhein-Westfalen": 6.5, "Rheinland-Pfalz": 5.0,
  "Saarland": 6.5, "Sachsen": 5.5, "Sachsen-Anhalt": 5.0,
  "Schleswig-Holstein": 6.5, "Thüringen": 5.0,
};
const NOTAR_PROZENT = 2.0; // Notar + Grundbuch

const eur0 = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur = (v) => eur0.format(Math.round(v));
const pct = (v, d = 2) => v.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d }) + " %";

function annuityPayment(K, rateAnnual, months, residual = 0) {
  if (months <= 0 || K <= 0) return 0;
  const r = rateAnnual / 100 / 12;
  if (r === 0) return Math.max(0, (K - residual) / months);
  const v = Math.pow(1 + r, -months);
  return Math.max(0, ((K - residual * v) * r) / (1 - v));
}

/** Annuitätendarlehen in Phasen; Rate wird je Phase so gesetzt, dass am Ende
 *  der Gesamtlaufzeit n genau die Ziel-Restschuld `ziel` verbleibt. */
function annuLoan(K, n, phases, ziel = 0) {
  let rest = K, interest = 0, done = 0;
  const restArr = [K], payArr = [];
  for (const ph of phases) {
    const m = Math.min(ph.months, n - done);
    if (m <= 0) break;
    const pay = annuityPayment(rest, ph.rate, n - done, ziel);
    const r = ph.rate / 100 / 12;
    for (let i = 0; i < m; i++) {
      const z = rest * r;
      interest += z;
      rest = Math.max(0, rest + z - pay);
      restArr.push(rest);
      payArr.push(pay);
    }
    done += m;
    if (rest <= 0.5) break;
  }
  const tail = restArr[restArr.length - 1];
  while (restArr.length < n + 1) restArr.push(tail);
  while (payArr.length < n) payArr.push(0);
  return { restArr, payArr, interest };
}

function addLoans(a, b) {
  const n = Math.max(a.restArr.length, b.restArr.length);
  const restArr = [], payArr = [];
  for (let i = 0; i < n; i++) restArr.push((a.restArr[i] || 0) + (b.restArr[i] || 0));
  for (let i = 0; i < n - 1; i++) payArr.push((a.payArr[i] || 0) + (b.payArr[i] || 0));
  return { restArr, payArr, interest: a.interest + b.interest };
}

/* ------------------------------------------------------------------ */
/*  Modell-Berechnungen                                                */
/* ------------------------------------------------------------------ */

function buildModels(D, nMonths, z, bausparCfg, ziel = 0) {
  const models = [];
  const INF = Infinity;

  // Annuitätendarlehen mit 10 / 15 / 20 Jahren Zinsbindung
  [[10, z.z10, "a10"], [15, z.z15, "a15"], [20, z.z20, "a20"]].forEach(([jahre, rate, key]) => {
    const loan = annuLoan(D, nMonths, [
      { rate, months: jahre * 12 },
      { rate: z.anschluss, months: INF },
    ], ziel);
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
    const loan = annuLoan(D, nMonths, [{ rate: z.volltilger, months: INF }], ziel);
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
    const kfw = annuLoan(kfwTeil, nMonths, [
      { rate: z.kfw, months: 120 },
      { rate: z.anschluss, months: INF },
    ], kfwZiel);
    const haupt = annuLoan(hauptTeil, nMonths, [
      { rate: z.z15, months: 180 },
      { rate: z.anschluss, months: INF },
    ], hauptZiel);
    const loan = addLoans(kfw, haupt);
    models.push({
      key: "kfw", name: "Annuität 15 J. + KfW-Baustein", short: "KfW-Kombi",
      zinsInfo: `${pct(z.z15)} + KfW ${pct(z.kfw)}`,
      hinweis: `KfW-Wohneigentumsprogramm (${eur(kfwTeil)}, 10 J. Zinsbindung) ergänzt ein Hauptdarlehen mit 15 J. Zinsbindung. Anschluss jeweils zu ${pct(z.anschluss)}.`,
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
      const restArr = [D], payArr = [];
      let interest = 0;
      for (let i = 1; i <= ansparM; i++) {
        interest += zinsM;
        restArr.push(D - S * i); // Netto-Schuld = Vorausdarlehen − Bausparguthaben
        payArr.push(zinsM + S);
      }
      const sub = annuLoan(D * (1 - quote), nMonths - ansparM,
        [{ rate: bausparCfg.bausparZins, months: INF }],
        Math.min(ziel, D * (1 - quote)));
      interest += sub.interest;
      sub.restArr.slice(1).forEach((r) => restArr.push(r));
      sub.payArr.forEach((p) => payArr.push(p));
      const fee = D * 0.01; // Abschlussgebühr ~1 % der Bausparsumme
      const loan = { restArr, payArr, interest: interest + fee };
      models.push({
        key: "bsp", name: "Bauspar-Kombimodell", short: "Bauspar-Kombi",
        zinsInfo: `${pct(bausparCfg.vorausZins)} → ${pct(bausparCfg.bausparZins)}`,
        hinweis: `Tilgungsfreies Vorausdarlehen (${pct(bausparCfg.vorausZins)}) + paralleles Ansparen von ${bausparCfg.ansparQuote} % über ${bausparCfg.ansparJahre} Jahre, danach Bauspardarlehen zu ${pct(bausparCfg.bausparZins)}. Inkl. ca. 1 % Abschlussgebühr; Guthabenverzinsung vereinfachend vernachlässigt.`,
        ...summarize(loan, nMonths, ziel),
        loan,
      });
    }
  }

  return models;
}

function summarize(loan, nMonths, ziel = 0) {
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

/* ------------------------------------------------------------------ */
/*  UI-Bausteine                                                       */
/* ------------------------------------------------------------------ */

const MODEL_COLORS = {
  a10: "#8FB3D9", a15: "#4F81B3", a20: "#1F4E79",
  vt: "#2E7D5B", kfw: "#C07A2E", bsp: "#A5524B",
};

function Field({ label, suffix, children }) {
  return (
    <label className="bf-field">
      <span className="bf-field-label">{label}</span>
      <span className="bf-field-input">{children}{suffix && <span className="bf-suffix">{suffix}</span>}</span>
    </label>
  );
}

function Num({ value, onChange, step = 1, min = 0, max }) {
  return (
    <input type="number" value={value} step={step} min={min} max={max}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />
  );
}

/* ------------------------------------------------------------------ */
/*  Haupt-Komponente                                                   */
/* ------------------------------------------------------------------ */

export default function BaufinanzierungsSimulator() {
  const [inp, setInp] = useState({
    kaufpreis: 500000, eigenkapital: 120000, netto: 4500, einkommenPlus: 3,
    alter: 38, rente: 67, bundesland: "Berlin",
    makler: true, maklerProzent: 3.57, zielRest: 0, klvBeitrag: 0,
  });
  const [z, setZ] = useState({ z10: 3.5, z15: 3.7, z20: 3.85, volltilger: 3.8, kfw: 3.4, anschluss: 4.2 });
  const [bsp, setBsp] = useState({ vorausZins: 3.9, bausparZins: 2.75, ansparJahre: 10, ansparQuote: 40 });
  const [zinsOffen, setZinsOffen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [modus, setModus] = useState("vergleich"); // "vergleich" | "max"
  const [limits, setLimits] = useState([30, 35, 40]);
  const LIMIT_COLORS = ["#9DBBAA", "#5F8F77", "#2E5C46"];

  const set = (k) => (v) => setInp((s) => ({ ...s, [k]: v }));
  const setRate = (k) => (v) => setZ((s) => ({ ...s, [k]: v }));
  const setB = (k) => (v) => setBsp((s) => ({ ...s, [k]: v }));

  const calc = useMemo(() => {
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
    const models = nMonths > 0 && darlehen > 0 ? buildModels(darlehen, nMonths, z, bsp, zielRest) : [];

    const klv = zielRest > 0 ? Math.max(0, inp.klvBeitrag || 0) : 0;
    const g = Math.max(0, inp.einkommenPlus || 0) / 100;
    const einkommenImJahr = (j) => inp.netto * Math.pow(1 + g, j);

    models.forEach((m) => {
      if (m.infeasible) return;
      if (inp.netto <= 0) { m.belastung = 999; m.belastungStart = 999; m.tragbar = false; return; }
      let maxB = 0;
      for (let mo = 0; mo < nMonths; mo++) {
        const b = (((m.loan.payArr[mo] || 0) + klv) / einkommenImJahr(Math.floor(mo / 12))) * 100;
        if (b > maxB) maxB = b;
      }
      m.belastung = maxB; // Spitzen-Belastungsquote über die gesamte Laufzeit
      m.belastungStart = ((m.rate1 + klv) / inp.netto) * 100;
      m.tragbar = m.belastung <= 40;
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
    return { grest, notar, makler, nk, darlehen, bla, jahre, nMonths, models, beste, chart, chartBelastung, zielRest, zielGekappt, klv, g };
  }, [inp, z, bsp]);

  const { models, beste } = calc;
  const warnBLA = calc.bla > 100;

  /* Umkehrrechnung: max. Kaufpreis je Modell und Belastungsgrenze */
  const invers = useMemo(() => {
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
  }, [modus, limits, inp, z, bsp]);

  const inversChart = (invers.rows || [])
    .filter((r) => !r.infeasible)
    .map((r) => {
      const o = { name: r.short };
      r.cells.forEach((c, i) => { o["l" + i] = c ? (c.capped ? 10000000 : c.P) : 0; });
      return o;
    });

  return (
    <div className="bf-root">
      <style>{CSS}</style>

      {/* Schriftfeld / Kopfzeile im Stil eines Bauplans */}
      <header className="bf-titleblock">
        <div className="bf-tb-main">
          <h1>Baufinanzierungs&#8209;Simulator</h1>
          <p className="bf-tb-sub">Modellvergleich · schuldenfrei bis zur Rente</p>
        </div>
        <div className="bf-tb-meta">
          <div><span>Laufzeit</span><strong>{calc.jahre} Jahre</strong></div>
          <div><span>Bis Alter</span><strong>{inp.rente}</strong></div>
          <div><span>Modelle</span><strong>{models.length || "—"}</strong></div>
        </div>
      </header>

      <div className="bf-layout">
        {/* ------------------------------ Eingaben ------------------------------ */}
        <aside className="bf-panel bf-inputs">
          <h2>01 · Objekt &amp; Kapital</h2>
          {modus === "vergleich" ? (
            <Field label="Kaufpreis" suffix="€"><Num value={inp.kaufpreis} step={10000} onChange={set("kaufpreis")} /></Field>
          ) : (
            <p className="bf-note" style={{ margin: "0 0 10px" }}>
              Der maximale Kaufpreis wird aus Einkommen, Belastungsgrenzen und Eigenkapital berechnet.
            </p>
          )}
          <Field label="Eigenkapital" suffix="€"><Num value={inp.eigenkapital} step={5000} onChange={set("eigenkapital")} /></Field>
          <Field label="Nettoeinkommen / Monat" suffix="€"><Num value={inp.netto} step={100} onChange={set("netto")} /></Field>
          <Field label="Einkommenssteigerung p. a." suffix="%">
            <Num value={inp.einkommenPlus} step={0.5} min={0} max={10} onChange={set("einkommenPlus")} />
          </Field>
          <p className="bf-note">
            Idealisierte jährliche Steigerung des Nettoeinkommens (Gehaltserhöhungen, Tarifanpassungen,
            steigender Grundfreibetrag). 0 % = konstantes Einkommen.
          </p>

          <h2>02 · Person &amp; Ziel</h2>
          <div className="bf-row2">
            <Field label="Alter heute"><Num value={inp.alter} min={18} max={80} onChange={set("alter")} /></Field>
            <Field label="Renteneintritt"><Num value={inp.rente} min={50} max={75} onChange={set("rente")} /></Field>
          </div>
          <Field label="Zulässige Restschuld bei Rente" suffix="€">
            <Num value={inp.zielRest} step={10000} onChange={set("zielRest")} />
          </Field>
          <p className="bf-note">
            0 € = volle Tilgung bis zur Rente. Ein höherer Betrag ist sinnvoll, wenn zum Renteneintritt
            eine Ablösesumme fällig wird – z. B. aus einer Kapitallebensversicherung.
          </p>
          {inp.zielRest > 0 && (
            <>
              <Field label="KLV-Beitrag / Monat" suffix="€">
                <Num value={inp.klvBeitrag} step={25} onChange={set("klvBeitrag")} />
              </Field>
              <p className="bf-note">
                Beitrag zur Kapitallebensversicherung (o. Ä.), die die Restschuld ablösen soll.
                Er wird zur Monatsrate addiert und fließt in die Belastungsquote ein.
              </p>
            </>
          )}

          <h2>03 · Nebenkosten</h2>
          <Field label="Bundesland">
            <select value={inp.bundesland} onChange={(e) => set("bundesland")(e.target.value)}>
              {Object.keys(GREST).map((b) => <option key={b}>{b}</option>)}
            </select>
          </Field>
          <label className="bf-check">
            <input type="checkbox" checked={inp.makler} onChange={(e) => set("makler")(e.target.checked)} />
            <span>Maklerprovision ({pct(inp.maklerProzent)})</span>
          </label>
          {modus === "vergleich" ? (
            <div className="bf-nk">
              <div><span>Grunderwerbsteuer ({pct(GREST[inp.bundesland], 1)})</span><b>{eur(calc.grest)}</b></div>
              <div><span>Notar &amp; Grundbuch ({pct(NOTAR_PROZENT, 1)})</span><b>{eur(calc.notar)}</b></div>
              {inp.makler && <div><span>Makler</span><b>{eur(calc.makler)}</b></div>}
              <div className="bf-nk-sum"><span>Nebenkosten gesamt</span><b>{eur(calc.nk)}</b></div>
            </div>
          ) : (
            <div className="bf-nk">
              <div><span>Grunderwerbsteuer</span><b>{pct(GREST[inp.bundesland], 1)}</b></div>
              <div><span>Notar &amp; Grundbuch</span><b>{pct(NOTAR_PROZENT, 1)}</b></div>
              {inp.makler && <div><span>Makler</span><b>{pct(inp.maklerProzent)}</b></div>}
              <div className="bf-nk-sum"><span>Nebenkostenquote</span><b>{pct(invers.nkQ * 100, 1)}</b></div>
            </div>
          )}

          <button className="bf-toggle" onClick={() => setZinsOffen(!zinsOffen)}>
            04 · Zinsannahmen {zinsOffen ? "ausblenden ▲" : "anpassen ▼"}
          </button>
          {zinsOffen && (
            <div className="bf-zins">
              <div className="bf-row2">
                <Field label="Zinsbindung 10 J." suffix="%"><Num value={z.z10} step={0.05} onChange={setRate("z10")} /></Field>
                <Field label="Zinsbindung 15 J." suffix="%"><Num value={z.z15} step={0.05} onChange={setRate("z15")} /></Field>
                <Field label="Zinsbindung 20 J." suffix="%"><Num value={z.z20} step={0.05} onChange={setRate("z20")} /></Field>
                <Field label="Volltilger" suffix="%"><Num value={z.volltilger} step={0.05} onChange={setRate("volltilger")} /></Field>
                <Field label="KfW (10 J.)" suffix="%"><Num value={z.kfw} step={0.05} onChange={setRate("kfw")} /></Field>
                <Field label="Anschlusszins" suffix="%"><Num value={z.anschluss} step={0.05} onChange={setRate("anschluss")} /></Field>
              </div>
              <p className="bf-note">Anschlusszins = Annahme für die Zeit nach Ablauf einer Zinsbindung.</p>
              <h3>Bauspar-Kombi</h3>
              <div className="bf-row2">
                <Field label="Vorausdarlehen" suffix="%"><Num value={bsp.vorausZins} step={0.05} onChange={setB("vorausZins")} /></Field>
                <Field label="Bauspardarlehen" suffix="%"><Num value={bsp.bausparZins} step={0.05} onChange={setB("bausparZins")} /></Field>
                <Field label="Ansparphase" suffix="J."><Num value={bsp.ansparJahre} step={1} min={1} max={25} onChange={setB("ansparJahre")} /></Field>
                <Field label="Ansparquote" suffix="%"><Num value={bsp.ansparQuote} step={5} min={20} max={50} onChange={setB("ansparQuote")} /></Field>
              </div>
            </div>
          )}
        </aside>

        {/* ------------------------------ Ergebnisse ------------------------------ */}
        <main className="bf-results">
          <div className="bf-tabs" role="tablist">
            <button role="tab" aria-selected={modus === "vergleich"} className={modus === "vergleich" ? "on" : ""}
              onClick={() => setModus("vergleich")}>Modellvergleich</button>
            <button role="tab" aria-selected={modus === "max"} className={modus === "max" ? "on" : ""}
              onClick={() => setModus("max")}>Maximaler Kaufpreis</button>
          </div>

          {modus === "vergleich" && (<>
          <section className="bf-kpis">
            <div className="bf-kpi"><span>Darlehenssumme</span><strong>{eur(calc.darlehen)}</strong></div>
            <div className="bf-kpi"><span>Nebenkosten</span><strong>{eur(calc.nk)}</strong></div>
            <div className={"bf-kpi" + (warnBLA ? " bf-warn" : "")}>
              <span>Beleihungsauslauf</span><strong>{pct(calc.bla, 0)}</strong>
            </div>
            <div className="bf-kpi"><span>Tilgungszeit</span><strong>{calc.jahre} Jahre</strong></div>
            {calc.zielRest > 0 && (
              <div className="bf-kpi"><span>Restschuld bei Rente</span><strong>{eur(calc.zielRest)}</strong></div>
            )}
            {calc.klv > 0 && (
              <div className="bf-kpi"><span>KLV-Beitrag / Monat</span><strong>{eur(calc.klv)}</strong></div>
            )}
          </section>

          {calc.zielGekappt && (
            <p className="bf-banner">
              Die gewünschte Restschuld übersteigt die Darlehenssumme und wurde auf {eur(calc.zielRest)} begrenzt.
            </p>
          )}

          {warnBLA && (
            <p className="bf-banner bf-banner-warn">
              Das Eigenkapital deckt die Nebenkosten nicht vollständig (Beleihung &gt; 100 %).
              Viele Banken finanzieren das nur mit deutlichen Zinsaufschlägen – die Voreinstellungen
              wären dann eher zu optimistisch.
            </p>
          )}
          {calc.jahre <= 0 && <p className="bf-banner bf-banner-warn">Renteneintritt muss nach dem aktuellen Alter liegen.</p>}
          {calc.darlehen <= 0 && calc.jahre > 0 && (
            <p className="bf-banner">Das Eigenkapital deckt Kaufpreis und Nebenkosten vollständig – es wird kein Darlehen benötigt.</p>
          )}

          {beste && (
            <section className="bf-best">
              <div className="bf-best-tag">Empfehlung</div>
              <h2>{beste.name}</h2>
              <p>
                Niedrigste Gesamtzinskosten ({eur(beste.zinskosten)}) unter allen Modellen, die bis zum
                Renteneintritt auf {calc.zielRest > 0 ? `die Zielrestschuld von ${eur(calc.zielRest)}` : "0 €"} zurückgeführt
                sind und deren Belastungsquote (Rate{calc.klv > 0 ? " + KLV-Beitrag" : ""} ÷ Einkommen des jeweiligen Jahres)
                zu keinem Zeitpunkt 40 % überschreitet – Spitze: {pct(beste.belastung, 0)}.
              </p>
            </section>
          )}
          {!beste && models.length > 0 && (
            <p className="bf-banner bf-banner-warn">
              Kein Modell bleibt unter 40 % Einkommensbelastung. Mögliche Hebel: mehr Eigenkapital,
              günstigeres Objekt oder späterer Renteneintritt (längere Laufzeit).
            </p>
          )}

          {models.length > 0 && (
            <>
              <section className="bf-panel bf-chart">
                <h2>Restschuld bis zur Rente</h2>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={calc.chart} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                    <CartesianGrid stroke="#D8DEDA" strokeDasharray="2 4" />
                    <XAxis dataKey="alter" tick={{ fontFamily: "IBM Plex Mono", fontSize: 11 }}
                      label={{ value: "Alter", position: "insideBottomRight", offset: -2, fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => (v / 1000) + "k"} tick={{ fontFamily: "IBM Plex Mono", fontSize: 11 }} width={52} />
                    <Tooltip formatter={(v, name) => [eur(v), models.find((m) => m.key === name)?.short || name]}
                      labelFormatter={(l) => "Alter " + l} />
                    <Legend formatter={(key) => models.find((m) => m.key === key)?.short || key} iconType="plainline" />
                    <ReferenceLine x={inp.rente} stroke="#1C2826" strokeDasharray="4 3"
                      label={{ value: "Rente", position: "top", fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                    {calc.zielRest > 0 && (
                      <ReferenceLine y={calc.zielRest} stroke="#A5524B" strokeDasharray="5 4"
                        label={{ value: "Ablösung (z. B. KLV)", position: "insideTopRight", fontSize: 11, fontFamily: "IBM Plex Mono", fill: "#A5524B" }} />
                    )}
                    {models.filter((m) => !m.infeasible).map((m) => (
                      <Line key={m.key} dataKey={m.key} stroke={MODEL_COLORS[m.key]} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </section>

              <section className="bf-panel bf-chart">
                <h2>Belastungsquote über die Laufzeit</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={calc.chartBelastung} margin={{ top: 8, right: 38, bottom: 4, left: 8 }}>
                    <CartesianGrid stroke="#D8DEDA" strokeDasharray="2 4" />
                    <XAxis dataKey="alter" tick={{ fontFamily: "IBM Plex Mono", fontSize: 11 }}
                      label={{ value: "Alter", position: "insideBottomRight", offset: -2, fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => v + " %"} tick={{ fontFamily: "IBM Plex Mono", fontSize: 11 }}
                      width={52} domain={[0, (dataMax) => Math.max(45, Math.ceil(dataMax / 5) * 5)]} />
                    <Tooltip formatter={(v, name) => [v.toLocaleString("de-DE") + " %", models.find((m) => m.key === name)?.short || name]}
                      labelFormatter={(l) => "Alter " + l} />
                    <Legend formatter={(key) => models.find((m) => m.key === key)?.short || key} iconType="plainline" />
                    <ReferenceLine y={40} stroke="#A5524B" strokeDasharray="4 3"
                      label={{ value: "40 %", position: "right", fontSize: 10, fontFamily: "IBM Plex Mono", fill: "#A5524B" }} />
                    <ReferenceLine y={35} stroke="#B0762B" strokeDasharray="4 3"
                      label={{ value: "35 %", position: "right", fontSize: 10, fontFamily: "IBM Plex Mono", fill: "#B0762B" }} />
                    {models.filter((m) => !m.infeasible).map((m) => (
                      <Line key={m.key} dataKey={m.key} stroke={MODEL_COLORS[m.key]} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <p className="bf-note">
                  Monatsrate{calc.klv > 0 ? " + KLV-Beitrag" : ""} ÷ Nettoeinkommen des jeweiligen Jahres
                  bei {pct(calc.g * 100, 1)} Einkommenssteigerung p. a. Sprünge entstehen durch
                  Anschlussfinanzierung bzw. Bauspar-Zuteilung.
                </p>
              </section>

              <section className="bf-panel">
                <h2>Modellvergleich</h2>
                <div className="bf-tablewrap">
                  <table className="bf-table">
                    <thead>
                      <tr>
                        <th>Modell</th><th>Sollzins</th><th>Rate (Start)</th>
                        <th>Rate (später)</th><th>Belastung (Spitze)</th><th>Zinskosten gesamt</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {models.map((m) => (
                        <tr key={m.key} className={beste && beste.key === m.key ? "bf-tr-best" : ""}>
                          <td>
                            <span className="bf-dot" style={{ background: MODEL_COLORS[m.key] }} />
                            {m.name}
                            {beste && beste.key === m.key && <span className="bf-badge">Empfehlung</span>}
                          </td>
                          {m.infeasible ? (
                            <td colSpan={5} className="bf-muted">{m.hinweis}</td>
                          ) : (
                            <>
                              <td className="bf-num">{m.zinsInfo}</td>
                              <td className="bf-num">{eur(m.rate1)}</td>
                              <td className="bf-num">{m.rate2 ? eur(m.rate2) : "—"}</td>
                              <td className={"bf-num " + (m.belastung > 40 ? "bf-red" : m.belastung > 35 ? "bf-amber" : "bf-green")}>
                                {pct(m.belastung, 0)}
                                {calc.g > 0 && <span className="bf-cell-sub">Start {pct(m.belastungStart, 0)}</span>}
                              </td>
                              <td className="bf-num">{eur(m.zinskosten)}</td>
                            </>
                          )}
                          <td>
                            {!m.infeasible && (
                              <button className="bf-mini" onClick={() => setDetail(detail === m.key ? null : m.key)}>
                                {detail === m.key ? "−" : "Info"}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {detail && (() => {
                  const m = models.find((x) => x.key === detail);
                  return m ? <p className="bf-detail">{m.hinweis}</p> : null;
                })()}
                <p className="bf-note">
                  Belastung (Spitze) = höchster Wert von Monatsrate{calc.klv > 0 ? ` + KLV-Beitrag (${eur(calc.klv)})` : ""} ÷
                  Nettoeinkommen des jeweiligen Jahres (Steigerung {pct(calc.g * 100, 1)} p. a.) über die gesamte Laufzeit.
                  Bei wachsendem Einkommen liegt die Spitze typischerweise zu Beginn der Finanzierung.
                  Faustregel: bis 35 % komfortabel, 35–40 % angespannt, über 40 % kritisch.
                  Alle Modelle sind so gerechnet, dass die Restschuld
                  zum Renteneintritt {calc.zielRest > 0 ? eur(calc.zielRest) : "0 €"} beträgt
                  {calc.zielRest > 0 ? " – dieser Betrag muss dann z. B. durch eine fällige Kapitallebensversicherung abgelöst werden." : "."}
                </p>
              </section>
            </>
          )}
          </>)}

          {modus === "max" && (
            <>
              <section className="bf-kpis">
                <div className="bf-kpi"><span>Eigenkapital</span><strong>{eur(inp.eigenkapital)}</strong></div>
                <div className="bf-kpi"><span>Nettoeinkommen</span><strong>{eur(inp.netto)}</strong></div>
                <div className="bf-kpi"><span>Nebenkostenquote</span><strong>{pct(invers.nkQ * 100, 1)}</strong></div>
                <div className="bf-kpi"><span>Tilgungszeit</span><strong>{calc.jahre} Jahre</strong></div>
                {inp.zielRest > 0 && (
                  <div className="bf-kpi"><span>Restschuld bei Rente</span><strong>{eur(inp.zielRest)}</strong></div>
                )}
                {invers.klv > 0 && (
                  <div className="bf-kpi"><span>KLV-Beitrag / Monat</span><strong>{eur(invers.klv)}</strong></div>
                )}
              </section>

              {calc.jahre <= 0 && <p className="bf-banner bf-banner-warn">Renteneintritt muss nach dem aktuellen Alter liegen.</p>}

              <section className="bf-panel" style={{ marginBottom: 14 }}>
                <h2>Belastungsgrenzen</h2>
                <div className="bf-limrow">
                  {limits.map((L, i) => (
                    <Field key={i} label={`Grenze ${i + 1}`} suffix="%">
                      <Num value={L} step={1} min={10} max={60}
                        onChange={(v) => setLimits((ls) => ls.map((x, j) => (j === i ? v : x)))} />
                    </Field>
                  ))}
                </div>
                <p className="bf-note">
                  Anteil des Nettoeinkommens im jeweiligen Jahr (Steigerung {pct(Math.max(0, inp.einkommenPlus || 0), 1)} p. a.),
                  den Monatsrate{invers.klv > 0 ? ` + KLV-Beitrag (${eur(invers.klv)})` : ""} zu keinem Zeitpunkt der
                  Laufzeit überschreiten dürfen. Bei wachsendem Einkommen ist meist der Beginn der Finanzierung maßgeblich.
                </p>
              </section>

              {invers.rows.length > 0 && (
                <>
                  <section className="bf-panel bf-chart">
                    <h2>Maximaler Kaufpreis nach Modell</h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={inversChart} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
                        <CartesianGrid stroke="#D8DEDA" strokeDasharray="2 4" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => (v / 1000) + "k"}
                          tick={{ fontFamily: "IBM Plex Mono", fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={110}
                          tick={{ fontFamily: "IBM Plex Sans", fontSize: 12 }} />
                        <Tooltip formatter={(v, name) => [eur(v), `Grenze ${limits[Number(name.slice(1))]} %`]} />
                        <Legend formatter={(key) => `${limits[Number(key.slice(1))]} % Belastung`} />
                        {limits.map((_, i) => (
                          <Bar key={i} dataKey={"l" + i} fill={LIMIT_COLORS[i % LIMIT_COLORS.length]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </section>

                  <section className="bf-panel">
                    <h2>Was kann ich mir leisten?</h2>
                    <div className="bf-tablewrap">
                      <table className="bf-table">
                        <thead>
                          <tr>
                            <th>Modell</th>
                            {limits.map((L, i) => (
                              <th key={i}>
                                max. Kaufpreis bei {L} %<br />
                                <span className="bf-th-sub">Start-Budget {eur(Math.max(0, (L / 100) * inp.netto - invers.klv))}/Monat</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {invers.rows.map((r) => (
                            <tr key={r.key}>
                              <td><span className="bf-dot" style={{ background: MODEL_COLORS[r.key] }} />{r.name}</td>
                              {r.infeasible ? (
                                <td colSpan={limits.length} className="bf-muted">{r.hinweis}</td>
                              ) : (
                                r.cells.map((c, i) => (
                                  <td key={i} className="bf-num">
                                    {!c || c.P <= 0 ? "—" : c.capped ? "> 10 Mio. €" : (
                                      <>
                                        <strong>{eur(c.P)}</strong>
                                        <span className="bf-cell-sub">Darlehen {eur(c.D)}</span>
                                      </>
                                    )}
                                  </td>
                                ))
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="bf-note">
                      Größter Kaufpreis (auf 1.000 € gerundet), bei dem die Belastungsquote des Modells
                      (Monatsrate{invers.klv > 0 ? " + KLV-Beitrag" : ""} ÷ Einkommen des jeweiligen Jahres) zu keinem
                      Zeitpunkt die jeweilige Grenze überschreitet – inklusive Nebenkosten, abzüglich Eigenkapital,
                      Restschuld bei Rente wie eingestellt ({inp.zielRest > 0 ? eur(inp.zielRest) : "0 €"}).
                      „—" bedeutet: Das Budget reicht für kein Darlehen.
                    </p>
                  </section>
                </>
              )}
            </>
          )}

          <footer className="bf-footer">
            Vereinfachtes Rechenmodell (monatliche Annuitäten, ohne Sondertilgungen, Bereitstellungszinsen,
            Förder-Tilgungszuschüsse und Steuereffekte). Die Einkommenssteigerung ist eine idealisierte,
            gleichmäßige Annahme – reale Einkommen entwickeln sich in Sprüngen und können auch sinken;
            Banken rechnen bei der Kreditvergabe in der Regel mit dem heutigen Einkommen.
            Eine zum Renteneintritt verbleibende Restschuld
            muss durch die geplante Ablösesumme (z. B. Auszahlung einer Kapitallebensversicherung) gedeckt
            sein – der KLV-Beitrag wird in der Belastungsquote berücksichtigt, ob die Ablaufleistung die
            Restschuld tatsächlich deckt (Rendite-, Kosten- und Auszahlungsrisiko), prüft die Simulation
            jedoch nicht. Zinsannahmen sind frei wählbare Szenarien, keine
            aktuellen Konditionen. Dies ist eine Simulation und keine Finanz- oder Anlageberatung –
            für eine konkrete Finanzierung bitte Angebote von Banken bzw. unabhängigen Vermittlern einholen.
          </footer>
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

.bf-root {
  --bg:#E9ECEA; --panel:#FFFFFF; --ink:#1C2826; --muted:#5C6B66;
  --line:#CBD4CF; --accent:#2E7D5B; --warn:#A5524B; --amber:#B0762B;
  background:var(--bg); color:var(--ink); min-height:100vh;
  font-family:'IBM Plex Sans',system-ui,sans-serif; font-size:14px; line-height:1.45;
  padding:20px clamp(12px,3vw,36px) 40px;
}
.bf-root *{box-sizing:border-box}
.bf-root h1,.bf-root h2,.bf-root h3{font-family:'Archivo',sans-serif;margin:0}

/* Schriftfeld */
.bf-titleblock{display:flex;justify-content:space-between;align-items:stretch;gap:16px;
  border:1.5px solid var(--ink);background:var(--panel);margin-bottom:18px}
.bf-tb-main{padding:14px 18px;border-right:1.5px solid var(--ink);flex:1}
.bf-tb-main h1{font-size:clamp(20px,3vw,28px);font-weight:800;letter-spacing:-0.01em;text-transform:uppercase}
.bf-tb-sub{margin:2px 0 0;color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:12px}
.bf-tb-meta{display:flex}
.bf-tb-meta>div{padding:10px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;justify-content:center;min-width:86px}
.bf-tb-meta span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.bf-tb-meta strong{font-family:'IBM Plex Mono',monospace;font-size:18px}

.bf-layout{display:grid;grid-template-columns:330px 1fr;gap:18px;align-items:start}
@media(max-width:880px){.bf-layout{grid-template-columns:1fr}.bf-tb-meta{display:none}}

.bf-panel{background:var(--panel);border:1px solid var(--line);padding:16px 18px}
.bf-panel h2{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:14px 0 10px}
.bf-panel h2:first-child{margin-top:0}
.bf-inputs h3{font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin:12px 0 8px}

.bf-field{display:block;margin-bottom:10px}
.bf-field-label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:3px}
.bf-field-input{display:flex;align-items:center;gap:6px}
.bf-root input[type=number],.bf-root select{width:100%;border:1px solid var(--line);background:#FBFCFB;
  padding:7px 9px;font-family:'IBM Plex Mono',monospace;font-size:14px;color:var(--ink)}
.bf-root input:focus,.bf-root select:focus,.bf-root button:focus{outline:2px solid var(--accent);outline-offset:1px}
.bf-suffix{font-family:'IBM Plex Mono',monospace;color:var(--muted)}
.bf-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.bf-check{display:flex;gap:8px;align-items:center;margin:6px 0 10px;cursor:pointer}

.bf-nk{border-top:1px dashed var(--line);padding-top:8px;font-size:13px}
.bf-nk div{display:flex;justify-content:space-between;padding:2px 0}
.bf-nk b{font-family:'IBM Plex Mono',monospace;font-weight:500}
.bf-nk-sum{border-top:1px solid var(--ink);margin-top:4px;padding-top:4px!important;font-weight:600}

.bf-toggle{margin-top:14px;width:100%;text-align:left;background:none;border:none;border-top:1px solid var(--line);
  padding:12px 0 4px;font:inherit;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.06em;cursor:pointer;color:var(--ink)}
.bf-zins{margin-top:8px}
.bf-note{font-size:12px;color:var(--muted);margin:8px 0 0}

.bf-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:14px}
.bf-kpi{background:var(--panel);border:1px solid var(--line);padding:12px 14px}
.bf-kpi span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.bf-kpi strong{font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:500}
.bf-kpi.bf-warn{border-color:var(--warn)}.bf-kpi.bf-warn strong{color:var(--warn)}

.bf-banner{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--accent);padding:10px 14px;margin:0 0 14px;font-size:13px}
.bf-banner-warn{border-left-color:var(--warn)}

.bf-best{background:var(--ink);color:#F2F5F3;padding:16px 18px;margin-bottom:14px}
.bf-best-tag{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.1em;
  text-transform:uppercase;border:1px solid #6E8A7F;padding:2px 8px;margin-bottom:8px;color:#9FD9BD}
.bf-best h2{font-size:20px;margin-bottom:6px}
.bf-best p{margin:0;font-size:13px;color:#C9D4CE}

.bf-chart{margin-bottom:14px}

.bf-tablewrap{overflow-x:auto}
.bf-table{width:100%;border-collapse:collapse;font-size:13px;min-width:680px}
.bf-table th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);
  border-bottom:1.5px solid var(--ink);padding:6px 8px}
.bf-table td{padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:middle}
.bf-num{font-family:'IBM Plex Mono',monospace;white-space:nowrap}
.bf-dot{display:inline-block;width:10px;height:10px;margin-right:8px;vertical-align:-1px}
.bf-badge{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.07em;text-transform:uppercase;
  background:var(--accent);color:#fff;padding:2px 6px;margin-left:8px}
.bf-tr-best td{background:#EFF6F2}
.bf-green{color:var(--accent)}.bf-amber{color:var(--amber)}.bf-red{color:var(--warn);font-weight:600}
.bf-muted{color:var(--muted);font-size:12px}
.bf-mini{border:1px solid var(--line);background:#FBFCFB;font:inherit;font-size:11px;padding:2px 8px;cursor:pointer}
.bf-detail{font-size:12.5px;color:var(--muted);border-left:3px solid var(--line);padding:6px 10px;margin:10px 0 0}

.bf-tabs{display:flex;width:fit-content;border:1.5px solid var(--ink);background:var(--panel);margin-bottom:14px}
.bf-tabs button{font:inherit;font-family:'Archivo',sans-serif;font-weight:700;font-size:13px;text-transform:uppercase;
  letter-spacing:.05em;padding:8px 18px;border:none;background:none;cursor:pointer;color:var(--ink)}
.bf-tabs button.on{background:var(--ink);color:#F2F5F3}
.bf-tabs button+button{border-left:1.5px solid var(--ink)}
.bf-limrow{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:420px}
.bf-th-sub{font-family:'IBM Plex Mono',monospace;font-size:10px;text-transform:none;letter-spacing:0;color:var(--muted);font-weight:400}
.bf-cell-sub{display:block;font-size:11px;color:var(--muted)}

.bf-footer{margin-top:18px;font-size:11.5px;color:var(--muted);border-top:1px solid var(--line);padding-top:10px}
@media (prefers-reduced-motion: no-preference){.bf-panel,.bf-best,.bf-kpi{transition:border-color .15s}}
`;
