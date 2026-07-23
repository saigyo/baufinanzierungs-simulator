# Tilgungsplan & Tilgungschart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Popup je Modell (aus der Modellvergleich-Tabelle), das die Zins/Tilgung-Aufteilung über die Laufzeit als Chart (Standard) oder Tilgungsplan-Tabelle zeigt.

**Architecture:** Reine Logik in `src/lib/` (Monatszins als `zinsArr` aus den Loan-Funktionen; neue reine Aggregatfunktion `tilgungsReihe`), Darstellung in einer neuen React-Komponente `TilgungsplanModal`, ausgelöst über einen Zeilen-Button in `ModelTable`, mit Overlay-Render und Zustand im Orchestrator.

**Tech Stack:** React 18, Recharts (bereits vorhanden), Vite/Rolldown, Vitest. Keine neuen Abhängigkeiten.

## Global Constraints

Gelten für **jede** Task (verbatim aus der Spec):

- **Keine neuen Abhängigkeiten** – nur React + Recharts (Recharts ist bereits Dependency).
- `src/lib/` bleibt **React-frei und rein**; der einzige unreine Aufruf (`new Date()`) lebt im Orchestrator.
- UI-Sprache **Deutsch**; Geldbeträge nur über `eur()` (de-DE), Prozente über `pct()`.
- CSS ausschließlich in `src/styles.js` (Template-String) – **kein** separater `.css`-Import (der Standalone-Build liest nur `outputFiles[0]`).
- Tests prüfen **Invarianten** (Summenbilanz, Gegenrechnung), keine willkürlichen Festwerte.
- Komponenten werden im Repo **nicht** unit-getestet (keine React-Test-Abhängigkeit); UI-Tasks werden per `npm run build` + Browser verifiziert. Die gesamte Logik liegt in der getesteten reinen Funktion `tilgungsReihe`.
- Jede Commit-Message endet mit dem Trailer:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` und `Claude-Session: https://claude.ai/code/session_01FYS4WCGxHtG5Cs8kSMSRNP`
- Testlauf: `npm test` (Vitest einmalig). Build: `npm run build`. Standalone: `npm run build:standalone`.
- Branch: `feat/tilgungsplan` (bereits ausgecheckt, Spec bereits committet).

---

### Task 1: Monatszins (`zinsArr`) in `annuLoan`

**Files:**
- Modify: `src/lib/finance.js:19-44` (`annuLoan`)
- Test: `src/lib/finance.test.js`

**Interfaces:**
- Produces: `annuLoan(K, n, phases, ziel?, sonderJahr?)` gibt zusätzlich `zinsArr: number[]` (Länge `n`, wie `payArr` nullgepolstert) zurück. Invariante: `sum(zinsArr) === interest`.

- [ ] **Step 1: Failing tests schreiben**

In `src/lib/finance.test.js` innerhalb des bestehenden `describe("annuLoan", …)` (nach dem Test „hat eine monoton fallende Restschuld") ergänzen:

```js
  it("liefert Monatszinsen (zinsArr), deren Summe den Gesamtzinsen entspricht", () => {
    const loan = annuLoan(D, N, PHASEN);
    expect(loan.zinsArr).toHaveLength(N);
    const summe = loan.zinsArr.reduce((a, b) => a + b, 0);
    expect(Math.abs(summe - loan.interest)).toBeLessThan(0.01);
  });

  it("erster Monatszins = Restschuld × Monatszins der ersten Phase", () => {
    const loan = annuLoan(D, N, PHASEN);
    expect(loan.zinsArr[0]).toBeCloseTo(D * (PHASEN[0].rate / 100 / 12), 6);
  });
```

- [ ] **Step 2: Tests laufen lassen (müssen fehlschlagen)**

Run: `npx vitest run src/lib/finance.test.js -t "zinsArr"`
Expected: FAIL – `loan.zinsArr` ist `undefined` (`toHaveLength` wirft).

- [ ] **Step 3: `annuLoan` implementieren**

`src/lib/finance.js`, Funktion `annuLoan` (Zeilen 19–44) vollständig ersetzen durch:

```js
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
```

- [ ] **Step 4: Tests laufen lassen (müssen bestehen)**

Run: `npx vitest run src/lib/finance.test.js`
Expected: PASS (alle bestehenden + zwei neue).

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance.js src/lib/finance.test.js
git commit -m "feat(finance): annuLoan liefert Monatszins-Serie (zinsArr)"
# Trailer (Global Constraints) anhängen
```

---

### Task 2: `zinsArr` in `addLoans`

**Files:**
- Modify: `src/lib/finance.js:46-52` (`addLoans`)
- Test: `src/lib/finance.test.js`

**Interfaces:**
- Consumes: `a.zinsArr`, `b.zinsArr` (Task 1).
- Produces: `addLoans(a, b)` gibt zusätzlich `zinsArr` (elementweise Summe, Länge `max(len)-1` wie `payArr`) zurück.

- [ ] **Step 1: Failing test schreiben**

In `src/lib/finance.test.js` im `describe("addLoans", …)` ergänzen:

```js
  it("summiert zinsArr beider Darlehen und trifft die Gesamtzinsen", () => {
    const a = annuLoan(100000, N, [{ rate: 3.4, months: 120 }, { rate: 4.2, months: Infinity }]);
    const b = annuLoan(300000, N, [{ rate: 3.7, months: 180 }, { rate: 4.2, months: Infinity }]);
    const sum = addLoans(a, b);
    expect(sum.zinsArr).toHaveLength(N);
    for (let i = 0; i < N; i++) {
      expect(sum.zinsArr[i]).toBeCloseTo((a.zinsArr[i] || 0) + (b.zinsArr[i] || 0), 8);
    }
    const s = sum.zinsArr.reduce((x, y) => x + y, 0);
    expect(Math.abs(s - sum.interest)).toBeLessThan(0.01);
  });
```

- [ ] **Step 2: Test laufen lassen (fehlschlagen)**

Run: `npx vitest run src/lib/finance.test.js -t "summiert zinsArr"`
Expected: FAIL – `sum.zinsArr` ist `undefined`.

- [ ] **Step 3: `addLoans` implementieren**

`src/lib/finance.js`, `addLoans` (Zeilen 46–52) ersetzen durch:

```js
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
```

- [ ] **Step 4: Tests laufen lassen (bestehen)**

Run: `npx vitest run src/lib/finance.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance.js src/lib/finance.test.js
git commit -m "feat(finance): addLoans summiert Monatszins-Serie"
# + Trailer
```

---

### Task 3: `zinsArr` + `fee` im Bauspar-Modell

**Files:**
- Modify: `src/lib/finance.js:115-152` (Bauspar-Zweig in `buildModels`)
- Test: `src/lib/finance.test.js`

**Interfaces:**
- Consumes: `sub.zinsArr` (Task 1).
- Produces: Bauspar-`loan` erhält `zinsArr` (Länge `nMonths`) und `loan.fee` (Abschlussgebühr). Invariante: `sum(zinsArr) + (loan.fee || 0) === loan.interest`. Übrige Modelle: `loan.fee` nicht gesetzt, `sum(zinsArr) === interest`.

- [ ] **Step 1: Failing tests schreiben**

In `src/lib/finance.test.js` im `describe("buildModels – Bauspar-Modell", …)` ergänzen:

```js
  it("Bauspar-Loan: Summe zinsArr + Abschlussgebühr = Gesamtzinsen", () => {
    const bsp = buildModels(D, N, Z, BSP).find((m) => m.key === "bsp");
    expect(bsp.loan.zinsArr).toHaveLength(N);
    expect(bsp.loan.fee).toBeGreaterThan(0);
    const s = bsp.loan.zinsArr.reduce((a, b) => a + b, 0);
    expect(Math.abs(s + bsp.loan.fee - bsp.loan.interest)).toBeLessThan(0.01);
  });

  it("Nicht-Bauspar-Modelle: Summe zinsArr = Zinskosten, keine Gebühr", () => {
    const models = buildModels(D, N, Z, BSP);
    ["a10", "a15", "a20", "vt", "kfw"].forEach((key) => {
      const m = models.find((x) => x.key === key);
      const s = m.loan.zinsArr.reduce((a, b) => a + b, 0);
      expect(Math.abs(s - m.loan.interest), key).toBeLessThan(0.01);
      expect(m.loan.fee || 0).toBe(0);
    });
  });
```

- [ ] **Step 2: Tests laufen lassen (fehlschlagen)**

Run: `npx vitest run src/lib/finance.test.js -t "zinsArr"`
Expected: FAIL – Bauspar-`loan.zinsArr` ist `undefined`.

- [ ] **Step 3: Bauspar-Zweig implementieren**

In `src/lib/finance.js` im `else`-Zweig des Bauspar-Blocks (aktuell Zeilen 124–150): die Schleife um `zinsArr` erweitern und das `loan`-Objekt anpassen. Konkret den Block

```js
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
```

ersetzen durch:

```js
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
      sub.zinsArr.forEach((z) => zinsArr.push(z));
      const fee = D * 0.01; // Abschlussgebühr ~1 % der Bausparsumme
      const loan = { restArr, payArr, zinsArr, interest: interest + fee, fee };
```

- [ ] **Step 4: Tests laufen lassen (bestehen)**

Run: `npx vitest run src/lib/finance.test.js`
Expected: PASS (inkl. bestehende Bauspar-Tests, die nur `restArr`/`payArr` prüfen).

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance.js src/lib/finance.test.js
git commit -m "feat(finance): Bauspar-Loan mit zinsArr und separater Abschlussgebühr (fee)"
# + Trailer
```

---

### Task 4: Aggregatfunktion `tilgungsReihe`

**Files:**
- Modify: `src/lib/calc.js` (neue Export-Funktion am Dateiende)
- Test: `src/lib/calc.test.js`

**Interfaces:**
- Consumes: `loan.zinsArr`, `loan.payArr`, `loan.restArr` (Tasks 1–3); `model.zinskosten` (= `loan.interest`).
- Produces: `tilgungsReihe(loan, nMonths, alterStart, startJahr) -> Array<{ alter, jahr, rate, zins, tilgung, sonder, rest }>` (ein Eintrag je Jahr).

- [ ] **Step 1: Failing tests schreiben**

In `src/lib/calc.test.js` die Imports oben ergänzen bzw. sicherstellen:

```js
import { computeCalc, computeInvers, tilgungsReihe } from "./calc.js";
import { buildModels } from "./finance.js";
import { DEFAULTS } from "./persistence.js";
```

(Falls `computeCalc`/`computeInvers`/`DEFAULTS` bereits importiert sind, nur `tilgungsReihe` und `buildModels` hinzufügen.)

Am Dateiende ergänzen:

```js
describe("tilgungsReihe", () => {
  const D = 437850, N = 348;

  it("aggregiert Jahreswerte konsistent (Summenbilanz, Rest, Labels)", () => {
    const m = buildModels(D, N, DEFAULTS.z, DEFAULTS.bsp, 0, 0).find((x) => x.key === "a15");
    const rows = tilgungsReihe(m.loan, N, 38, 2026);
    expect(rows).toHaveLength(N / 12);
    expect(rows[0].jahr).toBe(2026);
    expect(rows[0].alter).toBe(38);
    expect(rows[rows.length - 1].jahr).toBe(2026 + N / 12 - 1);
    const sumZ = rows.reduce((a, r) => a + r.zins, 0);
    const sumT = rows.reduce((a, r) => a + r.tilgung, 0);
    const sumS = rows.reduce((a, r) => a + r.sonder, 0);
    expect(Math.abs(sumZ - m.loan.interest)).toBeLessThan(1);
    expect(Math.abs(sumT + sumS - D)).toBeLessThan(1); // ziel = 0
    for (let i = 1; i < rows.length; i++) expect(rows[i].rest).toBeLessThanOrEqual(rows[i - 1].rest);
    expect(rows[rows.length - 1].rest).toBeCloseTo(0, 0);
    rows.forEach((r) => expect(r.rate).toBeCloseTo(r.zins + r.tilgung, 6));
  });

  it("respektiert die Ziel-Restschuld am Laufzeitende", () => {
    const ziel = 50000;
    const m = buildModels(D, N, DEFAULTS.z, DEFAULTS.bsp, ziel, 0).find((x) => x.key === "vt");
    const rows = tilgungsReihe(m.loan, N, 38, 2026);
    expect(rows[rows.length - 1].rest).toBeCloseTo(ziel, 0);
    const sumT = rows.reduce((a, r) => a + r.tilgung, 0);
    const sumS = rows.reduce((a, r) => a + r.sonder, 0);
    expect(Math.abs(sumT + sumS - (D - ziel))).toBeLessThan(1);
  });

  it("weist Sondertilgung im jeweiligen Jahr aus", () => {
    const m = buildModels(D, N, DEFAULTS.z, DEFAULTS.bsp, 0, 5000).find((x) => x.key === "vt");
    const rows = tilgungsReihe(m.loan, N, 38, 2026);
    const sumS = rows.reduce((a, r) => a + r.sonder, 0);
    expect(sumS).toBeGreaterThan(0);
    const sumT = rows.reduce((a, r) => a + r.tilgung, 0);
    expect(Math.abs(sumT + sumS - D)).toBeLessThan(2);
  });
});
```

- [ ] **Step 2: Tests laufen lassen (fehlschlagen)**

Run: `npx vitest run src/lib/calc.test.js -t "tilgungsReihe"`
Expected: FAIL – `tilgungsReihe is not a function` / not exported.

- [ ] **Step 3: `tilgungsReihe` implementieren**

Am Ende von `src/lib/calc.js` ergänzen:

```js
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
    const restVor = loan.restArr[Math.min(von, loan.restArr.length - 1)] || 0;
    const rest = loan.restArr[Math.min(bis, loan.restArr.length - 1)] || 0;
    const sonder = Math.max(0, (restVor - rest) - tilgung); // Jahresend-Sondertilgung
    rows.push({ alter: alterStart + y, jahr: startJahr + y, rate, zins, tilgung, sonder, rest });
  }
  return rows;
}
```

- [ ] **Step 4: Tests laufen lassen (bestehen)**

Run: `npx vitest run src/lib/calc.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calc.js src/lib/calc.test.js
git commit -m "feat(calc): tilgungsReihe – Jahres-Tilgungsplan je Modell-Loan"
# + Trailer
```

---

### Task 5: `TilgungsplanModal`-Komponente, Farben & Styles

**Files:**
- Modify: `src/lib/constants.js:17` (nach `MODEL_COLORS`)
- Create: `src/components/TilgungsplanModal.jsx`
- Modify: `src/styles.js` (neue Klassen vor dem schließenden Backtick, Zeile 107)

**Interfaces:**
- Consumes: `tilgungsReihe` (Task 4), `TILGUNG_COLORS`, `eur`, Recharts.
- Produces: `default export TilgungsplanModal({ model, inp, nMonths, alterStart, startJahr, onClose })`.

- [ ] **Step 1: Farbkonstante ergänzen**

In `src/lib/constants.js` nach der `MODEL_COLORS`-Definition (Zeile 17) einfügen:

```js
// Zins-/Tilgungsanteil im Tilgungschart
export const TILGUNG_COLORS = { zins: "#C4703A", tilgung: "#2E7D5B" };
```

- [ ] **Step 2: Komponente anlegen**

`src/components/TilgungsplanModal.jsx` neu erstellen:

```jsx
/* ------------------------------------------------------------------ */
/*  Tilgungsplan-Popup je Modell: Chart (Zins/Tilgung) ⇄ Tabelle       */
/* ------------------------------------------------------------------ */

import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

import { TILGUNG_COLORS } from "../lib/constants.js";
import { tilgungsReihe } from "../lib/calc.js";
import { eur } from "../lib/format.js";

export default function TilgungsplanModal({ model, inp, nMonths, alterStart, startJahr, onClose }) {
  const [view, setView] = useState("chart"); // "chart" | "tabelle"
  const rows = useMemo(
    () => tilgungsReihe(model.loan, nMonths, alterStart, startJahr),
    [model, nMonths, alterStart, startJahr]
  );
  const zeigeSonder = (inp.sonderTilgung || 0) > 0 && rows.some((r) => r.sonder > 0.5);
  const isBsp = model.key === "bsp";
  const summe = rows.reduce(
    (a, r) => ({ rate: a.rate + r.rate, zins: a.zins + r.zins, tilgung: a.tilgung + r.tilgung, sonder: a.sonder + r.sonder }),
    { rate: 0, zins: 0, tilgung: 0, sonder: 0 }
  );

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="bf-modal-backdrop" onClick={onClose}>
      <div className="bf-modal" role="dialog" aria-modal="true" aria-label={"Tilgungsplan " + model.name}
        onClick={(e) => e.stopPropagation()}>
        <div className="bf-modal-head">
          <div>
            <h2>Tilgungsplan · {model.name}</h2>
            <p className="bf-modal-sub">Zins- und Tilgungsanteil pro Jahr über die Laufzeit</p>
          </div>
          <div className="bf-modal-actions">
            <div className="bf-toggle" role="tablist">
              <button role="tab" aria-selected={view === "chart"} className={view === "chart" ? "on" : ""}
                onClick={() => setView("chart")}>Chart</button>
              <button role="tab" aria-selected={view === "tabelle"} className={view === "tabelle" ? "on" : ""}
                onClick={() => setView("tabelle")}>Tabelle</button>
            </div>
            <button className="bf-modal-x" aria-label="Schließen" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="bf-modal-body">
          {view === "chart" ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid stroke="#D8DEDA" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="jahr" tick={{ fontFamily: "IBM Plex Mono", fontSize: 11 }}
                  label={{ value: "Jahr", position: "insideBottomRight", offset: -2, fontSize: 11 }} />
                <YAxis tickFormatter={(v) => (v / 1000) + "k"} tick={{ fontFamily: "IBM Plex Mono", fontSize: 11 }} width={52} />
                <Tooltip
                  formatter={(v, name) => [eur(v), name === "zins" ? "Zins" : "Tilgung"]}
                  labelFormatter={(jahr, payload) => {
                    const r = payload && payload[0] && payload[0].payload;
                    return "Jahr " + jahr + (r ? " · Alter " + r.alter + " · Rate " + eur(r.rate) : "");
                  }} />
                <Legend formatter={(k) => (k === "zins" ? "Zinsanteil" : "Tilgungsanteil")} />
                <Bar dataKey="zins" stackId="a" fill={TILGUNG_COLORS.zins} />
                <Bar dataKey="tilgung" stackId="a" fill={TILGUNG_COLORS.tilgung} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="bf-tablewrap">
              <table className="bf-table bf-tp-table">
                <thead>
                  <tr>
                    <th>Jahr</th><th>Alter</th><th>Rate</th><th>Zins</th><th>Tilgung</th>
                    {zeigeSonder && <th>Sondertilgung</th>}<th>Restschuld</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.jahr}>
                      <td>{r.jahr}</td>
                      <td className="bf-num">{r.alter}</td>
                      <td className="bf-num">{eur(r.rate)}</td>
                      <td className="bf-num bf-tp-zins">{eur(r.zins)}</td>
                      <td className="bf-num bf-tp-tilg">{eur(r.tilgung)}</td>
                      {zeigeSonder && <td className="bf-num">{r.sonder > 0.5 ? eur(r.sonder) : "—"}</td>}
                      <td className="bf-num">{eur(r.rest)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Summe</td>
                    <td className="bf-num">{eur(summe.rate)}</td>
                    <td className="bf-num bf-tp-zins">{eur(summe.zins)}</td>
                    <td className="bf-num bf-tp-tilg">{eur(summe.tilgung)}</td>
                    {zeigeSonder && <td className="bf-num">{eur(summe.sonder)}</td>}
                    <td className="bf-num">{eur(rows.length ? rows[rows.length - 1].rest : 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <p className="bf-tp-note">
            <strong>Steuerlicher Hinweis:</strong> Bei vermieteten Objekten ist der Zinsanteil als
            Werbungskosten absetzbar – die Tabelle weist den Betrag je Jahr aus. Bei Selbstnutzung nicht
            absetzbar. Vereinfachte Simulation, keine Steuerberatung.
            {isBsp && " Bauspar-Modell: Ansparen zählt hier als Netto-Tilgung des Vorausdarlehens; die ~1 % Abschlussgebühr (" + eur(model.loan.fee || 0) + ") ist eine separate Einmalgebühr und nicht in Chart/Tabelle enthalten."}
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Styles ergänzen**

In `src/styles.js` unmittelbar **vor** der schließenden Zeile `` `; `` (Zeile 107) einfügen:

```css
.bf-row-actions{display:flex;gap:6px;justify-content:flex-end}
.bf-modal-backdrop{position:fixed;inset:0;background:rgba(28,40,38,.45);display:flex;align-items:center;justify-content:center;padding:20px;z-index:50}
.bf-modal{background:var(--panel);border:1px solid var(--line);max-width:900px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(28,40,38,.28)}
.bf-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 18px;border-bottom:1px solid var(--line)}
.bf-modal-head h2{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:0}
.bf-modal-sub{font-size:12px;color:var(--muted);margin:3px 0 0}
.bf-modal-actions{display:flex;align-items:center;gap:10px;flex-shrink:0}
.bf-toggle{display:flex;border:1px solid var(--line);background:#FBFCFB}
.bf-toggle button{font:inherit;font-size:11px;text-transform:uppercase;letter-spacing:.05em;padding:5px 12px;border:none;background:transparent;cursor:pointer;color:var(--muted)}
.bf-toggle button.on{background:var(--ink);color:#fff}
.bf-modal-x{border:1px solid var(--line);background:#FBFCFB;font:inherit;font-size:14px;line-height:1;padding:5px 9px;cursor:pointer;color:var(--muted)}
.bf-modal-body{padding:16px 18px;overflow-y:auto}
.bf-tp-table tfoot td{border-top:2px solid var(--line);font-weight:700}
.bf-tp-zins{color:#C4703A}
.bf-tp-tilg{color:#2E7D5B}
.bf-tp-note{font-size:12px;color:var(--muted);line-height:1.5;background:#FAF3EC;border:1px solid #ECDCC9;border-left:3px solid #C4703A;padding:10px 12px;margin:14px 0 0}
```

- [ ] **Step 4: Build prüfen (Komponente kompiliert)**

Run: `npm run build`
Expected: Build erfolgreich, keine Import-/Syntaxfehler. (Komponente noch nicht eingebunden – nur Kompilierbarkeit.)

- [ ] **Step 5: Bestehende Tests unverändert grün**

Run: `npm test`
Expected: PASS (unverändert; keine Logikänderung).

- [ ] **Step 6: Commit**

```bash
git add src/lib/constants.js src/components/TilgungsplanModal.jsx src/styles.js
git commit -m "feat(ui): TilgungsplanModal (Chart/Tabelle-Umschalter) inkl. Styles"
# + Trailer
```

---

### Task 6: Verdrahtung (Button, Orchestrator) + Doku + Integrationstest

**Files:**
- Modify: `src/components/ModelTable.jsx:10-13` (Signatur) und `:69-75` (Aktionsspalte)
- Modify: `src/BaufinanzierungsSimulator.jsx` (Import, State, Prop, Overlay-Render)
- Modify: `CLAUDE.md` (Doku)
- Test: manuell/Browser + voller Testlauf + Standalone-Build

**Interfaces:**
- Consumes: `TilgungsplanModal` (Task 5), `calc.nMonths`.
- Produces: pro darstellbarer Modellzeile ein „Tilgungsplan"-Button; Orchestrator-State `tilgungsplanKey`.

- [ ] **Step 1: `ModelTable` – Prop + Button**

In `src/components/ModelTable.jsx` die Funktions-Signatur (Zeilen 10–13) um `onTilgungsplan` erweitern:

```jsx
export default function ModelTable({
  models, beste, stressDelta, anschluss, klv, g, zielRest, sonder,
  fokusKey, onToggleFokus, detail, setDetail, onTilgungsplan,
}) {
```

Und die Aktionsspalte (aktuell Zeilen 69–75) ersetzen durch:

```jsx
                <td>
                  {!m.infeasible && (
                    <div className="bf-row-actions">
                      <button className="bf-mini" onClick={(e) => { e.stopPropagation(); onTilgungsplan(m.key); }}>
                        Tilgungsplan
                      </button>
                      <button className="bf-mini" onClick={(e) => { e.stopPropagation(); setDetail(detail === m.key ? null : m.key); }}>
                        {detail === m.key ? "−" : "Info"}
                      </button>
                    </div>
                  )}
                </td>
```

- [ ] **Step 2: Orchestrator – Import, State, `startJahr`**

In `src/BaufinanzierungsSimulator.jsx`:

Nach der `ComparisonCharts`-Import-Zeile (Zeile 12) ergänzen:

```jsx
import TilgungsplanModal from "./components/TilgungsplanModal.jsx";
```

Nach `const [detail, setDetail] = useState(null);` (Zeile 23) ergänzen:

```jsx
  const [tilgungsplanKey, setTilgungsplanKey] = useState(null);
  const [startJahr] = useState(() => new Date().getFullYear());
```

- [ ] **Step 3: Orchestrator – Prop an `ModelTable` durchreichen**

Den `ModelTable`-Aufruf (Zeilen 149–153) um die Prop ergänzen – die letzte Prop-Zeile

```jsx
                detail={detail} setDetail={setDetail} />
```

ersetzen durch:

```jsx
                detail={detail} setDetail={setDetail}
                onTilgungsplan={setTilgungsplanKey} />
```

- [ ] **Step 4: Orchestrator – Modal als Overlay rendern**

Unmittelbar vor dem schließenden `</div>` von `.bf-root` (aktuell Zeile 165, direkt nach `</div>` von `.bf-layout`) einfügen:

```jsx
      {(() => {
        const tp = tilgungsplanKey ? models.find((m) => m.key === tilgungsplanKey && !m.infeasible) : null;
        return tp ? (
          <TilgungsplanModal model={tp} inp={inp} nMonths={calc.nMonths}
            alterStart={inp.alter} startJahr={startJahr} onClose={() => setTilgungsplanKey(null)} />
        ) : null;
      })()}
```

- [ ] **Step 5: Build + voller Testlauf**

Run: `npm run build && npm test`
Expected: Build erfolgreich; alle Tests grün.

- [ ] **Step 6: Browser-Verifikation**

Run: `npm run preview` (dann im Browser öffnen) oder `npm run dev`.
Prüfen:
- In „Modellvergleich" hat jede Modellzeile einen „Tilgungsplan"-Button.
- Klick öffnet das Popup für **dieses** Modell (Zeilenklick/Fokus bleibt unberührt).
- Standardansicht = **Chart** (gestapelte Balken, Zins amber unten, Tilgung grün oben, x-Achse Jahr); Tooltip zeigt Jahr · Alter · Rate.
- Umschalter zeigt die **Tabelle** (Jahr | Alter | Rate | Zins | Tilgung | Restschuld; Summenzeile).
- Bei gesetzter Sondertilgung (> 0 €) erscheint zusätzlich die Spalte „Sondertilgung".
- Bauspar-Popup zeigt den Zusatz-Hinweis inkl. Abschlussgebühr.
- Schließen per ✕, Backdrop-Klick und `Esc`.
Expected: alle Punkte erfüllt, keine Konsolenfehler.

- [ ] **Step 7: Standalone-Build unberührt**

Run: `npm run build:standalone`
Expected: `dist/baufinanzierung-simulator.html` erzeugt (ein einzelnes Bundle) – belegt, dass keine externe CSS-/Asset-Abhängigkeit eingeführt wurde.

- [ ] **Step 8: `CLAUDE.md` dokumentieren**

Im Abschnitt „Architektur" bei `src/lib/finance.js` ergänzen, dass `annuLoan`/`addLoans` zusätzlich `zinsArr` liefern und der Bauspar-Loan `fee` trägt; bei `src/lib/calc.js` `tilgungsReihe` erwähnen; unter `src/components/` `TilgungsplanModal.jsx` (Tilgungsplan-Popup, Chart/Tabelle) aufnehmen. Im Abschnitt „Finanzmathematik" einen Punkt zum Tilgungsplan (Zins/Tilgung je Jahr, x-Achse Kalenderjahr) ergänzen.

- [ ] **Step 9: Commit**

```bash
git add src/components/ModelTable.jsx src/BaufinanzierungsSimulator.jsx CLAUDE.md
git commit -m "feat(ui): Tilgungsplan-Popup aus dem Modellvergleich öffnen + Doku"
# + Trailer
```

---

## Self-Review

**Spec-Abdeckung:**
- Datenschicht `zinsArr` (annuLoan/addLoans/Bauspar) + `fee` → Tasks 1–3. ✓
- Reine `tilgungsReihe` mit Jahr+Alter, Summenbilanz-Tests → Task 4. ✓
- `TilgungsplanModal` (Chart-Default, Toggle, Tabelle Jahr+Alter, Sonder-Spalte bedingt, Summe, Steuerhinweis, Bauspar-Note) → Task 5. ✓
- Trigger-Button + Orchestrator-State + Overlay + `startJahr` (Reinheit) → Task 6. ✓
- Chart: gestapelte Balken, x-Achse Jahr, Alter im Tooltip → Task 5. ✓
- Styles in `styles.js`, keine neuen Deps, Standalone intakt → Tasks 5/6. ✓
- Infeasible-Modelle ohne Button; Modal schließt, wenn Modell wegfällt → Task 6 (Guard `&& !m.infeasible`). ✓
- Doku (CLAUDE.md) → Task 6. ✓

**Placeholder-Scan:** keine TBD/TODO; jeder Code-Step enthält vollständigen Code. ✓

**Typ-Konsistenz:** `tilgungsReihe(loan, nMonths, alterStart, startJahr)` einheitlich in Task 4 (Definition) und Task 5 (`useMemo`-Aufruf) und Task 6 (Props `nMonths`/`alterStart`/`startJahr`). Zeilenfelder `{ alter, jahr, rate, zins, tilgung, sonder, rest }` konsistent zwischen Task 4 und Task 5. `TILGUNG_COLORS.{zins,tilgung}` in Task 5 definiert und genutzt. `onTilgungsplan` in Task 6 (ModelTable-Prop) = `setTilgungsplanKey` (Orchestrator). ✓
