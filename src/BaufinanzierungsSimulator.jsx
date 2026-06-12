import React, { useEffect, useMemo, useState } from "react";

import { GREST, NOTAR_PROZENT, MODEL_COLORS, LIMIT_COLORS } from "./lib/constants.js";
import { eur, pct } from "./lib/format.js";
import { CSS } from "./styles.js";

import { stateFromURL, stateToQuery } from "./lib/persistence.js";
import { computeCalc, computeInvers } from "./lib/calc.js";
import { Field, Num } from "./components/controls.jsx";
import Footer from "./components/Footer.jsx";
import MaxPriceSection from "./components/MaxPriceSection.jsx";
import ModelTable from "./components/ModelTable.jsx";
import ComparisonCharts from "./components/ComparisonCharts.jsx";

/* ------------------------------------------------------------------ */
/*  Haupt-Komponente                                                   */
/* ------------------------------------------------------------------ */

export default function BaufinanzierungsSimulator() {
  const [init] = useState(stateFromURL);
  const [inp, setInp] = useState(init.inp);
  const [z, setZ] = useState(init.z);
  const [bsp, setBsp] = useState(init.bsp);
  const [zinsOffen, setZinsOffen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [fokus, setFokus] = useState(null); // hervorgehobenes Modell in den Vergleichsdiagrammen
  const [modus, setModus] = useState(init.modus); // "vergleich" | "max"
  const [limits, setLimits] = useState(init.limits);
  const [stress, setStress] = useState(init.stress); // Aufschlag auf den Anschlusszins in %-Punkten

  // Eingaben in der URL spiegeln – Links sind dadurch teil- und wiederherstellbar
  useEffect(() => {
    try {
      const qs = stateToQuery(inp, z, bsp, modus, limits, stress);
      window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : "") + window.location.hash);
    } catch { /* replaceState kann in Sandbox-Kontexten scheitern – dann ohne Persistenz */ }
  }, [inp, z, bsp, modus, limits, stress]);

  const set = (k) => (v) => setInp((s) => ({ ...s, [k]: v }));
  const setRate = (k) => (v) => setZ((s) => ({ ...s, [k]: v }));
  const setB = (k) => (v) => setBsp((s) => ({ ...s, [k]: v }));

  const calc = useMemo(() => computeCalc(inp, z, bsp, stress), [inp, z, bsp, stress]);

  const { models, beste } = calc;
  const warnBLA = calc.bla > 100;

  /* Fokus-Modus: Klick auf Kurve, Legende oder eine Zeile im Modellvergleich hebt ein Modell
     hervor und dimmt die übrigen – in beiden Diagrammen und in der Tabelle; erneuter Klick
     (oder Klick ins Diagramm) setzt zurück. Render-Helfer: components/ComparisonCharts.jsx. */
  const fokusKey = models.some((m) => !m.infeasible && m.key === fokus) ? fokus : null;
  const toggleFokus = (key) => setFokus((f) => (f === key ? null : key));

  /* Umkehrrechnung: max. Kaufpreis je Modell und Belastungsgrenze */
  const invers = useMemo(() => computeInvers(inp, z, bsp, modus, limits), [modus, limits, inp, z, bsp]);

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
          <Field label="Sondertilgung / Jahr" suffix="€">
            <Num value={inp.sonderTilgung} step={1000} onChange={set("sonderTilgung")} />
          </Field>
          <p className="bf-note">
            Jährliche Sondertilgung (jeweils zum Jahresende) aus Ersparnissen. Senkt Restschuld und
            Zinskosten, ist aber nicht Teil der Belastungsquote. Im Bauspar-Modell nicht berücksichtigt.
          </p>

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
              <h3>Stresstest Anschluss</h3>
              <div className="bf-row2">
                <Field label="Zinsaufschlag" suffix="%-Pkt.">
                  <Num value={stress} step={0.5} min={0} max={10} onChange={setStress} />
                </Field>
              </div>
              <p className="bf-note">
                0 = aus. Bei einem Aufschlag &gt; 0 zeigt der Modellvergleich zusätzlich, wie die
                Spitzen-Belastung ausfällt, wenn der Anschlusszins {stress > 0
                  ? `${pct(z.anschluss + stress)} statt ${pct(z.anschluss)}`
                  : "höher als angenommen"} beträgt.
              </p>
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
            {calc.sonder > 0 && (
              <div className="bf-kpi"><span>Sondertilgung / Jahr</span><strong>{eur(calc.sonder)}</strong></div>
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
              <ComparisonCharts models={models}
                chart={calc.chart} chartBelastung={calc.chartBelastung}
                rente={inp.rente} zielRest={calc.zielRest} klv={calc.klv} g={calc.g}
                fokusKey={fokusKey} onToggleFokus={toggleFokus}
                onResetFokus={() => setFokus(null)} />

              <ModelTable models={models} beste={beste}
                stressDelta={calc.stressDelta} anschluss={z.anschluss}
                klv={calc.klv} g={calc.g} zielRest={calc.zielRest} sonder={calc.sonder}
                fokusKey={fokusKey} onToggleFokus={toggleFokus}
                detail={detail} setDetail={setDetail} />
            </>
          )}
          </>)}

          {modus === "max" && (
            <MaxPriceSection inp={inp} invers={invers} limits={limits} setLimits={setLimits} jahre={calc.jahre} />
          )}

          <Footer />
        </main>
      </div>
    </div>
  );
}
