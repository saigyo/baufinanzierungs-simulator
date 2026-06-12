/* ------------------------------------------------------------------ */
/*  Modellvergleich-Tabelle (inkl. Fokus-Modus und Stress-Spalte)      */
/* ------------------------------------------------------------------ */

import React from "react";

import { MODEL_COLORS } from "../lib/constants.js";
import { eur, pct } from "../lib/format.js";

export default function ModelTable({
  models, beste, stressDelta, anschluss, klv, g, zielRest, sonder,
  fokusKey, onToggleFokus, detail, setDetail,
}) {
  return (
    <section className="bf-panel">
      <h2>Modellvergleich</h2>
      <div className="bf-tablewrap">
        <table className="bf-table">
          <thead>
            <tr>
              <th>Modell</th><th>Sollzins</th><th>Rate (Start)</th>
              <th>Rate (später)</th><th>Belastung (Spitze)</th>
              {stressDelta > 0 && (
                <th>Stress +{pct(stressDelta, 1)}<br />
                  <span className="bf-th-sub">Anschluss {pct(anschluss + stressDelta)}</span>
                </th>
              )}
              <th>Zinskosten gesamt</th><th></th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.key}
                className={[
                  beste && beste.key === m.key ? "bf-tr-best" : "",
                  m.infeasible ? "" : "bf-tr-klick",
                  fokusKey === m.key ? "bf-tr-fokus" : "",
                  fokusKey && fokusKey !== m.key ? "bf-tr-dim" : "",
                ].filter(Boolean).join(" ")}
                style={fokusKey === m.key ? { boxShadow: `inset 3px 0 0 ${MODEL_COLORS[m.key]}` } : undefined}
                onClick={m.infeasible ? undefined : () => onToggleFokus(m.key)}>
                <td>
                  <span className="bf-dot" style={{ background: MODEL_COLORS[m.key] }} />
                  {m.name}
                  {beste && beste.key === m.key && <span className="bf-badge">Empfehlung</span>}
                </td>
                {m.infeasible ? (
                  <td colSpan={stressDelta > 0 ? 6 : 5} className="bf-muted">{m.hinweis}</td>
                ) : (
                  <>
                    <td className="bf-num">{m.zinsInfo}</td>
                    <td className="bf-num">{eur(m.rate1)}</td>
                    <td className="bf-num">{m.rate2 ? eur(m.rate2) : "—"}</td>
                    <td className={"bf-num " + (m.belastung > 40 ? "bf-red" : m.belastung > 35 ? "bf-amber" : "bf-green")}>
                      {pct(m.belastung, 0)}
                      {g > 0 && <span className="bf-cell-sub">Start {pct(m.belastungStart, 0)}</span>}
                    </td>
                    {stressDelta > 0 && (
                      <td className={"bf-num " + (m.stressBelastung > 40 ? "bf-red" : m.stressBelastung > 35 ? "bf-amber" : "bf-green")}>
                        {m.stressBelastung != null ? pct(m.stressBelastung, 0) : "—"}
                        {m.stressZinskosten != null && (
                          <span className="bf-cell-sub">Zinsen {eur(m.stressZinskosten)}</span>
                        )}
                      </td>
                    )}
                    <td className="bf-num">{eur(m.zinskosten)}</td>
                  </>
                )}
                <td>
                  {!m.infeasible && (
                    <button className="bf-mini" onClick={(e) => { e.stopPropagation(); setDetail(detail === m.key ? null : m.key); }}>
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
        Belastung (Spitze) = höchster Wert von Monatsrate{klv > 0 ? ` + KLV-Beitrag (${eur(klv)})` : ""} ÷
        Nettoeinkommen des jeweiligen Jahres (Steigerung {pct(g * 100, 1)} p. a.) über die gesamte Laufzeit.
        Bei wachsendem Einkommen liegt die Spitze typischerweise zu Beginn der Finanzierung.
        Faustregel: bis 35 % komfortabel, 35–40 % angespannt, über 40 % kritisch.
        Alle Modelle sind so gerechnet, dass die Restschuld
        zum Renteneintritt {zielRest > 0 ? eur(zielRest) : "0 €"} beträgt
        {zielRest > 0 ? " – dieser Betrag muss dann z. B. durch eine fällige Kapitallebensversicherung abgelöst werden." : "."}
        {sonder > 0 && ` Sondertilgungen (${eur(sonder)} p. a.) verkürzen die Tilgung bzw. senken die Folge-Raten, zählen aber nicht zur Belastungsquote.`}
        {stressDelta > 0 && ` Stress-Spalte: Spitzen-Belastung und Zinskosten, falls der Anschlusszins um ${pct(stressDelta, 1)}-Punkte höher ausfällt (${pct(anschluss + stressDelta)}) – Modelle ohne Anschlussfinanzierung sind davon nicht betroffen. Die Empfehlung basiert auf dem Basisszenario.`}
      </p>
    </section>
  );
}
