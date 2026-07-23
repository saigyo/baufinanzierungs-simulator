# Design: Tilgungsplan & Tilgungschart je Modell

**Datum:** 2026-07-23
**Status:** Entwurf zur Umsetzung freigegeben (Brainstorming abgeschlossen)

## Motivation

Nutzer möchten je Finanzierungsmodell sehen, wie sich die Monatsrate über die
Laufzeit in **Zinsanteil** und **Tilgungsanteil** aufteilt. Das Verhältnis
verschiebt sich über die Jahre (anfangs viel Zins, später viel Tilgung) und ist
u. a. steuerlich relevant: Bei **vermieteten** Objekten sind die Schuldzinsen als
Werbungskosten absetzbar, sodass der jährliche Zinsanteil eine konkrete Größe ist.

Die App zeigt bisher nur aggregierte Kennzahlen (Rate, Zinskosten gesamt,
Restschuldverlauf), aber nicht die Zins/Tilgung-Aufteilung pro Jahr.

## Ziel

Ein **Popup je Modell**, erreichbar aus der Modellvergleich-Tabelle, das die
Zins/Tilgung-Aufteilung über die Laufzeit zeigt – umschaltbar zwischen
**Chart** (Standard) und **Tabelle** (Tilgungsplan mit konkreten Jahreswerten).

## Nicht-Ziele (YAGNI)

- Keine monatliche Granularität (nur Jahreswerte).
- Kein Druck/Export/PDF.
- Keine Darstellung mehrerer Modelle gleichzeitig (Aufteilung ist inhärent
  pro Modell).
- Keine echte Steuerberechnung (nur Ausweis des absetzbaren Zinsanteils + Hinweis).
- Kein Tilgungsplan im Umkehr-Modus („Maximaler Kaufpreis").

## Nutzerfluss

1. In der Modellvergleich-Tabelle hat jede darstellbare Modellzeile neben dem
   bestehenden **„Info"**-Button einen neuen **„Tilgungsplan"**-Button.
2. Klick öffnet ein modales Overlay für **genau dieses Modell**.
3. Das Popup zeigt zunächst den **Chart**; ein Umschalter **„Chart ⇄ Tabelle"**
   wechselt zur Tabellenansicht.
4. Schließen per ✕, Klick auf den Backdrop oder `Esc`.

## Architektur

Trennung wie im restlichen Projekt: React-freie, testbare Logik in `src/lib/`,
Darstellung in `src/components/`.

### 1. Datenschicht – Zins pro Monat verfügbar machen (`src/lib/finance.js`)

`annuLoan()` berechnet den Monatszins `z = rest * r` bereits, verwirft ihn aber.
Künftig gibt es diesen als **`zinsArr`** (Länge `n`, zeropadded wie `payArr`)
zurück:

```
annuLoan() -> { restArr, payArr, zinsArr, interest }
```

Fortpflanzung in die zusammengesetzten Modelle:

- **`addLoans(a, b)`** summiert zusätzlich `zinsArr` elementweise (für die
  KfW-Kombi = KfW-Baustein + Hauptdarlehen).
- **Bauspar-Modell** (`buildModels`, Bauspar-Zweig baut das Loan-Objekt manuell):
  `zinsArr` = konstanter `zinsM` je Monat der Ansparphase, danach `sub.zinsArr`
  des Bauspardarlehens. Die ~1 % **Abschlussgebühr** ist **kein** Monatszins und
  bleibt aus `zinsArr` heraus; sie wird als `loan.fee` am Loan-Objekt abgelegt
  (bei den übrigen Modellen nicht gesetzt, daher überall als `loan.fee || 0` gelesen).

**Invariante (Test):** `sum(zinsArr) + (loan.fee || 0) === loan.interest` für jedes
Modell.

> Grund für `zinsArr` statt Rekonstruktion aus `restArr`/`payArr`: Bei
> Sondertilgung (Jahresend-Schlag) und bei phasen-/modellabhängig wechselnden
> Effektivzinsen ist `Zins = Rate − (restArr[i] − restArr[i+1])` falsch. Der
> intern ohnehin berechnete Monatszins ist die korrekte Quelle.

### 2. Aggregator (`src/lib/calc.js`)

Neue reine Funktion:

```
tilgungsReihe(loan, nMonths, alterStart, startJahr) -> Zeile[]
```

Die Sondertilgung wird **nicht** als Parameter gebraucht: der Jahres-Schlag
steckt bereits in `restArr` und wird über die Differenz hergeleitet (siehe
`sonder` unten). Ob die Sondertilgung-Spalte angezeigt wird, entscheidet das
Modal anhand von `inp.sonderTilgung > 0`.

Aggregiert je Kalenderjahr (12 Monate). Für Jahr `y` (0-basiert, Monate
`m ∈ [y·12, min(y·12+12, nMonths))`):

| Feld       | Berechnung                                                        |
|------------|-------------------------------------------------------------------|
| `alter`    | `alterStart + y`                                                  |
| `jahr`     | `startJahr + y`                                                   |
| `zins`     | `Σ loan.zinsArr[m]`                                                |
| `tilgung`  | `Σ (loan.payArr[m] − loan.zinsArr[m])` (reguläre Tilgung)         |
| `rate`     | `Σ loan.payArr[m]` (= `zins + tilgung`)                           |
| `sonder`   | `(restArr[y·12] − restArr[(y+1)·12]) − tilgung` (Jahresend-Schlag) |
| `rest`     | `restArr[min((y+1)·12, nMonths)]` (Restschuld Jahresende)         |

- `nMonths = (rente − alter) · 12` ist stets durch 12 teilbar (ganze Jahre); die
  inneren Grenzen werden dennoch defensiv geklammert.
- Nach vorzeitiger Tilgung (z. B. hohe Sondertilgung) sind `payArr`/`zinsArr` mit
  0 gepolstert → Folgejahre haben Nullbalken; das visualisiert korrekt die frühe
  Ablösung.

**Reinheit:** `startJahr` wird als Parameter übergeben (deterministisch,
testbar). Der Aufrufer (Orchestrator) liefert `new Date().getFullYear()` – der
einzige unreine Aufruf lebt in der React-Schicht, nicht in `lib/`.

**Annahme:** Der Plan startet „heute" (Alter `inp.alter` = aktuelles Jahr). Das
ist die bereits app-weit implizite Annahme; keine neue Ungenauigkeit.

Die Reihe wird **lazy im Modal per `useMemo`** berechnet, nicht für alle sechs
Modelle vorab.

### 3. UI – `src/components/TilgungsplanModal.jsx`

Props: `{ model, inp, alterStart, startJahr, onClose }`.

- **Kopf:** Modellname + ✕.
- **Umschalter** „Chart ⇄ Tabelle" (lokaler `view`-State, Default `chart`).
- **Chart:** Recharts **gestapeltes `BarChart`**, ein Balken je Jahr, zwei
  `Bar` mit `stackId`:
  - Zinsanteil `#C4703A` (unten), Tilgungsanteil `#2E7D5B` (oben).
  - `XAxis dataKey="jahr"` (Kalenderjahr); `Tooltip` zeigt Jahr, Alter, Zins,
    Tilgung, Rate, Restschuld.
  - Sondertilgung wird im Chart **nicht** gestapelt (gestapelte Höhe = Jahresrate);
    sie erscheint nur in der Tabelle.
- **Tabelle (Tilgungsplan):** Spalten
  `Jahr | Alter | Rate | Zins | Tilgung | [Sondertilgung] | Restschuld`.
  - Sondertilgung-Spalte nur, wenn `inp.sonderTilgung > 0`.
  - Summenzeile (Fuß): Σ Rate, Σ Zins, Σ Tilgung, (Σ Sonder), Endrestschuld.
  - Zahlen monospaced/tabular über bestehende Klassen.
- **Steuerhinweis** (siehe unten).
- **Bauspar-Sonderfall:** Zusatznote „Ansparen zählt hier als Netto-Tilgung des
  Vorausdarlehens; die ~1 % Abschlussgebühr (`loan.fee`) ist eine separate
  Einmalgebühr und nicht in Chart/Tabelle enthalten." Fuß zeigt „zzgl.
  Abschlussgebühr `eur(loan.fee)`".

Farb-/Zahlformatierung über `MODEL_COLORS`, `eur`, `pct`. Neue Zins-/Tilgung-Farben
(`#C4703A`, `#2E7D5B`) als Konstanten in `src/lib/constants.js`.

### 4. Trigger & State

- Neuer Mini-Button **„Tilgungsplan"** in der Aktionsspalte von
  `ModelTable.jsx`, nur für `!m.infeasible` (analog zum bestehenden „Info").
  `onClick` mit `e.stopPropagation()` (Zeilenklick = Fokus bleibt unberührt).
- State `tilgungsplanKey` / `setTilgungsplanKey` im Orchestrator
  (`BaufinanzierungsSimulator.jsx`), gespiegelt zum bestehenden `detail`-Muster.
- Das Modal wird auf Orchestrator-Ebene als Overlay gerendert (nicht innerhalb der
  Tabelle), damit es die volle Seite überlagert. Geöffnetes Modell =
  `models.find(m => m.key === tilgungsplanKey)`.
- **Nicht** URL-persistiert (flüchtiger UI-Zustand; kein neues `DEFAULTS`/`URL_KEYS`-Feld).

### 5. Styling (`src/styles.js`)

Neue Klassen im CSS-Template-String: `.bf-modal-backdrop`, `.bf-modal`,
`.bf-modal-head`, `.bf-toggle`, `.bf-tp-table`, `.bf-tp-note`. Design über
bestehende CSS-Variablen (`--bg`, `--ink`, `--accent`, …). **Kein** separater
CSS-Import (Standalone-Build liest nur `outputFiles[0]`).

## Steuerlicher Hinweis / Disclaimer

Im Modal deutlich sichtbar:

> Bei **vermieteten** Objekten sind die Schuldzinsen als Werbungskosten absetzbar –
> die Tabelle weist den Zinsanteil je Jahr aus. Bei **Selbstnutzung** nicht
> absetzbar. Vereinfachte Simulation, keine Steuerberatung.

Ergänzt den bestehenden Footer-Disclaimer, ersetzt ihn nicht.

## Sonderfälle

- **Infeasible-Modelle** (z. B. Bauspar bei zu langer Ansparphase): kein
  Tilgungsplan-Button (kein `loan`).
- **Sondertilgung:** eigene Spalte + Balken-freie Darstellung im Chart; Summenbilanz
  in der Tabelle geht auf (`Σ Tilgung + Σ Sonder = Darlehen − Ziel`).
- **Ziel-Restschuld > 0:** Endrestschuld der Tabelle = `zielRest`; Summenzeile weist
  das aus.
- **Bauspar-Abschlussgebühr:** separat via `loan.fee`, nicht in `zinsArr`.
- **Vorzeitige Volltilgung:** Nulljahre am Ende (korrekt).

## Tests

- **`finance.test.js`:**
  - `zinsArr` Länge = `payArr` Länge; `sum(zinsArr) + (fee||0) === interest` je Modell.
  - `addLoans` summiert `zinsArr` (Gegenrechnung KfW-Teil + Haupt).
  - Monotone/Padding-Invarianten wie bestehend beibehalten.
- **`calc.test.js`:**
  - `tilgungsReihe`: `Σ zins` == `model.zinskosten − (fee||0)`;
    `Σ tilgung + Σ sonder` == `Darlehen − ziel`; `rest` monoton fallend;
    letzte `rest` == `ziel`.
  - `jahr`/`alter`-Mapping korrekt (`jahr[0] === startJahr`,
    `alter[0] === alterStart`).
  - Sondertilgung: `sonder`-Werte > 0 in den betroffenen Jahren, sonst 0.

Keine neuen Abhängigkeiten (Recharts vorhanden).

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/lib/finance.js` | `zinsArr` in `annuLoan`/`addLoans`/Bauspar; `loan.fee` |
| `src/lib/calc.js` | neue Funktion `tilgungsReihe` |
| `src/lib/constants.js` | Zins-/Tilgung-Farben |
| `src/components/TilgungsplanModal.jsx` | **neu** |
| `src/components/ModelTable.jsx` | „Tilgungsplan"-Button + Prop |
| `src/BaufinanzierungsSimulator.jsx` | `tilgungsplanKey`-State, Modal-Render, `startJahr` |
| `src/styles.js` | Modal-/Tabellen-Styles |
| `src/lib/finance.test.js`, `src/lib/calc.test.js` | Tests |
| `CLAUDE.md` | Doku (Tilgungsplan, `zinsArr`, `tilgungsReihe`) |
