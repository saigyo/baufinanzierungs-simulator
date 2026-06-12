import React, { useEffect, useMemo, useState } from "react";

import { eur, pct } from "./lib/format.js";
import { CSS } from "./styles.js";

import { stateFromURL, stateToQuery } from "./lib/persistence.js";
import { computeCalc, computeInvers } from "./lib/calc.js";
import Footer from "./components/Footer.jsx";
import InputPanel from "./components/InputPanel.jsx";
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
        <InputPanel modus={modus}
          inp={inp} setInp={setInp} z={z} setZ={setZ} bsp={bsp} setBsp={setBsp}
          stress={stress} setStress={setStress}
          nk={{ grest: calc.grest, notar: calc.notar, makler: calc.makler, sum: calc.nk }}
          nkQ={invers.nkQ} />

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
