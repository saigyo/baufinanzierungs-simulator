/* ------------------------------------------------------------------ */
/*  Umkehr-Modus: maximaler Kaufpreis je Modell und Belastungsgrenze   */
/* ------------------------------------------------------------------ */

import React from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

import { MODEL_COLORS, LIMIT_COLORS } from "../lib/constants.js";
import { eur, pct } from "../lib/format.js";
import { Field, Num } from "./controls.jsx";

export default function MaxPriceSection({ inp, invers, limits, setLimits, jahre }) {
  const inversChart = (invers.rows || [])
    .filter((r) => !r.infeasible)
    .map((r) => {
      const o = { name: r.short };
      r.cells.forEach((c, i) => { o["l" + i] = c ? (c.capped ? 10000000 : c.P) : 0; });
      return o;
    });

  return (
    <>
      <section className="bf-kpis">
        <div className="bf-kpi"><span>Eigenkapital</span><strong>{eur(inp.eigenkapital)}</strong></div>
        <div className="bf-kpi"><span>Nettoeinkommen</span><strong>{eur(inp.netto)}</strong></div>
        <div className="bf-kpi"><span>Nebenkostenquote</span><strong>{pct(invers.nkQ * 100, 1)}</strong></div>
        <div className="bf-kpi"><span>Tilgungszeit</span><strong>{jahre} Jahre</strong></div>
        {inp.zielRest > 0 && (
          <div className="bf-kpi"><span>Restschuld bei Rente</span><strong>{eur(inp.zielRest)}</strong></div>
        )}
        {invers.klv > 0 && (
          <div className="bf-kpi"><span>KLV-Beitrag / Monat</span><strong>{eur(invers.klv)}</strong></div>
        )}
      </section>

      {jahre <= 0 && <p className="bf-banner bf-banner-warn">Renteneintritt muss nach dem aktuellen Alter liegen.</p>}

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
          {inp.sonderTilgung > 0 && " Sondertilgungen und Zins-Stresstest bleiben in dieser Berechnung unberücksichtigt."}
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
  );
}
