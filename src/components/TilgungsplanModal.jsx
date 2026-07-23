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
