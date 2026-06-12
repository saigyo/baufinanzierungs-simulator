# Baufinanzierungs-Simulator

One-Page-React-App zum Vergleich von Baufinanzierungsmodellen. Ziel: Finanzierung ist
zum Renteneintritt getilgt bzw. auf eine definierte Ziel-Restschuld zurückgeführt
(Ablösung z. B. durch fällige Kapitallebensversicherung).

## Befehle

- `npm run dev` – Vite-Dev-Server mit Hot Reload (Standard-Workflow)
- `npm run build` – Produktions-Build nach `dist/`
- `npm run build:standalone` – einzelne, offline lauffähige HTML-Datei
  (`dist/baufinanzierung-simulator.html`, React/Recharts inline gebündelt)
- `npm run preview` – Produktions-Build lokal serven

## Architektur

Die gesamte App lebt bewusst in **einer Datei**: `src/BaufinanzierungsSimulator.jsx`.
Sie ist in klar markierte Blöcke gegliedert (Kommentar-Trennlinien):

1. **Konstanten & Hilfsfunktionen** – Grunderwerbsteuersätze je Bundesland (`GREST`),
   Formatierer (`eur`, `pct`), Annuitätenformel.
2. **Modell-Berechnungen** – `buildModels()` erzeugt sechs Modelle,
   `annuLoan()` simuliert phasenweise Annuitätendarlehen, `summarize()` extrahiert Kennzahlen.
3. **UI-Bausteine** – kleine Form-Komponenten (`Field`, `Num`), Modellfarben.
4. **Haupt-Komponente** – State, `useMemo`-Berechnungen (`calc`, `invers`), JSX.
5. **Styles** – CSS als Template-String (`const CSS`), wird per `<style>` injiziert.
   Designsystem über CSS-Variablen (`--bg`, `--ink`, `--accent`, …),
   Schriften: Archivo (Display), IBM Plex Sans (Text), IBM Plex Mono (Zahlen).

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
  rechnet `calc` einen zweiten `buildModels()`-Lauf und der Modellvergleich zeigt eine
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
- **URL-Persistenz**: Alle Eingaben werden via `history.replaceState` in Query-Parametern
  gespiegelt (`stateToQuery`) und beim Laden wiederhergestellt (`stateFromURL`).
  Defaults erzeugen keine Parameter; ungültige Werte fallen auf `DEFAULTS` zurück.
  Neue State-Felder in `DEFAULTS` + `URL_KEYS` ergänzen.

## Konventionen

- UI-Sprache ist Deutsch; Zahlenformatierung de-DE (`Intl.NumberFormat`).
- Keine zusätzlichen Abhängigkeiten ohne Not – nur React + Recharts.
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
