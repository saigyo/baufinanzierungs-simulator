# Baufinanzierungs-Simulator

React-App (eine Seite) zum Vergleich von Baufinanzierungsmodellen. Ziel: Finanzierung ist
zum Renteneintritt getilgt bzw. auf eine definierte Ziel-Restschuld zurückgeführt
(Ablösung z. B. durch fällige Kapitallebensversicherung).

## Befehle

- `npm run dev` – Vite-Dev-Server mit Hot Reload (Standard-Workflow)
- `npm run build` – Produktions-Build nach `dist/`
- `npm run build:standalone` – einzelne, offline lauffähige HTML-Datei
  (`dist/baufinanzierung-simulator.html`, React/Recharts inline gebündelt)
- `npm run preview` – Produktions-Build lokal serven
- `npm test` – Unit-Tests (Vitest, einmalig); `npm run test:watch` für den Watch-Modus

## Architektur

Logik und UI sind in Module getrennt; **`src/lib/` ist React-frei** und direkt testbar:

- `src/lib/constants.js` – Grunderwerbsteuersätze je Bundesland (`GREST`), `NOTAR_PROZENT`,
  Modell-/Limit-Farben (`MODEL_COLORS`, `LIMIT_COLORS`).
- `src/lib/format.js` – Formatierer `eur`, `pct` (de-DE).
- `src/lib/finance.js` – Finanzmathematik: `annuityPayment`, `annuLoan`, `addLoans`,
  `buildModels` (erzeugt die sechs Modelle), `summarize` (Kennzahlen). `annuLoan`/`addLoans`
  liefern neben `restArr`/`payArr` zusätzlich `zinsArr` (Zinsanteil je Monat); der
  Bauspar-Loan trägt zudem `fee` (Abschlussgebühr, bereits in `interest` enthalten) –
  Basis für den Tilgungsplan.
- `src/lib/persistence.js` – `DEFAULTS`, `URL_KEYS`, `stateFromURL`, `stateToQuery`.
- `src/lib/calc.js` – `computeCalc` (Modellvergleich inkl. Belastungsquoten, Stress, Charts)
  und `computeInvers` (Umkehr-Modus); pure Funktionen, im Orchestrator per `useMemo` gecacht.
  Außerdem `tilgungsReihe(loan, nMonths, alterStart, startJahr)`: aggregiert einen
  Modell-Loan zu einer Jahresreihe (`{ alter, jahr, rate, zins, tilgung, sonder, rest }`)
  für den Tilgungsplan-Popup; `startJahr` wird als Parameter übergeben statt intern
  `new Date()` aufzurufen, bleibt also rein.
- `src/components/` – UI: `controls.jsx` (`Field`, `Num`), `InputPanel.jsx` (Sektionen 01–04),
  `ComparisonCharts.jsx` (beide LineCharts + Fokus-Render-Helfer), `ModelTable.jsx`
  (Modellvergleich), `MaxPriceSection.jsx` (Umkehr-Modus), `TilgungsplanModal.jsx`
  (Tilgungsplan-Popup je Modell: gestapeltes Balken-Chart Zins/Tilgung ⇄ Tabelle,
  aus dem Modellvergleich per „Tilgungsplan"-Button erreichbar), `Footer.jsx`
  (Annahmen/Disclaimer).
- `src/BaufinanzierungsSimulator.jsx` – schlanker Orchestrator: State, URL-Sync,
  Fokus-Modus (`fokus` ist geteilt zwischen Diagrammen und Tabelle, lebt deshalb hier),
  KPI-Kacheln, Banner, Empfehlung.
- `src/styles.js` – CSS als Template-String (`export const CSS`), per `<style>` injiziert.
  **Bewusst kein `.css`-Import:** der Standalone-Build liest nur `outputFiles[0]` und würde
  eine separate CSS-Datei stillschweigend verwerfen.
  Designsystem über CSS-Variablen (`--bg`, `--ink`, `--accent`, …),
  Schriften: Archivo (Display), IBM Plex Sans (Text), IBM Plex Mono (Zahlen).

Tests (Vitest) liegen neben den Modulen: `src/lib/finance.test.js`,
`src/lib/persistence.test.js`. Bei Änderungen an der Finanzmathematik Tests mitziehen;
sie prüfen Invarianten (Kalibrierung per Gegenrechnung, Summenbilanz, Ziel-Restschuld)
statt Festwerten.

## Finanzmathematik (wichtig bei Änderungen)

- `annuityPayment(K, zins, monate, restschuld)` – Annuität mit Ballon-Restschuld:
  Rate so, dass nach `monate` genau `restschuld` verbleibt
  (`(K − R·v^n)·r / (1 − v^n)` mit `v = (1+r)^-1`).
- `annuLoan(K, n, phasen, ziel, sonderJahr)` – simuliert Phasen (Zinsbindung → Anschlusszins);
  die Rate wird **je Phase neu** auf die Restlaufzeit und das Ziel kalibriert.
- **Sondertilgung** (`inp.sonderTilgung`, €/Jahr): wird in `annuLoan()` jeweils zum
  Jahresende getilgt, höchstens bis auf `ziel` herunter; senkt damit die je Phase neu
  kalibrierten Folge-Raten. Zählt **nicht** zur Belastungsquote. Beim KfW-Modell fließt
  sie ins Hauptdarlehen; im Bauspar-Modell und im Umkehr-Modus wird sie ignoriert (im UI dokumentiert).
- **Zins-Stresstest** (`stress`, %-Punkte Aufschlag nur auf den Anschlusszins): bei > 0
  rechnet `computeCalc` einen zweiten `buildModels()`-Lauf und der Modellvergleich zeigt eine
  Stress-Spalte (Spitzen-Belastung + Zinskosten). Empfehlung bleibt Basisszenario;
  Umkehr-Modus unberührt.
- **Modelle** (Keys): `a10`/`a15`/`a20` (Annuität mit Zinsbindung + Anschluss),
  `vt` (Volltilger), `kfw` (Hauptdarlehen 15 J. + KfW-Baustein ≤ 100 000 €, 10 J. Bindung),
  `bsp` (Bauspar-Kombi: tilgungsfreies Vorausdarlehen + Ansparphase + Bauspardarlehen,
  inkl. ~1 % Abschlussgebühr; Guthabenverzinsung vereinfachend ignoriert).
- **Belastungsquote** = (Monatsrate + KLV-Beitrag) ÷ Nettoeinkommen des jeweiligen Jahres;
  Einkommen wächst mit `einkommenPlus` % p. a. Geprüft wird die **Spitze** über die Laufzeit
  (`m.belastung`), zusätzlich wird `m.belastungStart` ausgewiesen. Schwellen: 35 %/40 %.
- **Umkehr-Modus** (`modus === "max"`): Binärsuche über den Kaufpreis pro Modell und
  Belastungsgrenze (`limits`), prüft die Spitzen-Belastungsquote. Darlehen
  `D = P·(1+Nebenkostenquote) − Eigenkapital`. Ergebnis auf 1 000 € abgerundet.
- **Tilgungsplan** (`TilgungsplanModal`, je Modellzeile per Button erreichbar): zeigt
  Zins- und Tilgungsanteil je Jahr (x-Achse = Kalenderjahr, nicht Laufzeitjahr) als
  gestapeltes Balken-Chart bzw. als Tabelle inkl. Sondertilgungs-Spalte (falls > 0)
  und Summenzeile; Datengrundlage ist `tilgungsReihe`. Der Renteneintritt entspricht
  nicht zwingend dem Laufzeitende, wenn eine Ziel-Restschuld > 0 vorgegeben ist.
- **URL-Persistenz**: Alle Eingaben werden via `history.replaceState` in Query-Parametern
  gespiegelt (`stateToQuery`) und beim Laden wiederhergestellt (`stateFromURL`).
  Defaults erzeugen keine Parameter; ungültige Werte fallen auf `DEFAULTS` zurück.
  Neue State-Felder in `DEFAULTS` + `URL_KEYS` ergänzen (beides in `src/lib/persistence.js`).

## Konventionen

- UI-Sprache ist Deutsch; Zahlenformatierung de-DE (`Intl.NumberFormat`).
- Keine zusätzlichen Abhängigkeiten ohne Not – nur React + Recharts (dev: Vite, esbuild, Vitest).
- Geldbeträge intern als Number in Euro; Render nur über `eur()`/`pct()`.
- Vereinfachungen stehen transparent im UI-Footer; neue Annahmen dort ergänzen.
- Disclaimer beibehalten: Simulation, keine Finanz- oder Anlageberatung.

## Bekannte Vereinfachungen / mögliche nächste Schritte

- Keine Bereitstellungszinsen, Tilgungszuschüsse, Steuereffekte.
- Sondertilgung gilt nicht im Bauspar-Modell und nicht im Umkehr-Modus;
  der Zins-Stresstest variiert nur den Anschlusszins und nur im Modellvergleich.
- Keine bonitäts-/beleihungsabhängigen Zinsaufschläge (Beleihungsauslauf wird nur angezeigt).
- KLV: Beitrag fließt in die Belastung ein, Ablaufleistung/Rendite wird nicht simuliert.
- Ideen: Sondertilgung im Umkehr-Modus, Stresstest auch für Bauspar-Zuteilungsrisiko,
  „Link kopieren"-Button für die URL-Persistenz.
