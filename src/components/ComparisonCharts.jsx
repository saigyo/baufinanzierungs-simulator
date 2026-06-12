/* ------------------------------------------------------------------ */
/*  Vergleichsdiagramme: Restschuld + Belastungsquote (mit Fokus-Modus)*/
/* ------------------------------------------------------------------ */

import React from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend,
} from "recharts";

import { MODEL_COLORS } from "../lib/constants.js";
import { eur, pct } from "../lib/format.js";

export default function ComparisonCharts({
  models, chart, chartBelastung, rente, zielRest, klv, g,
  fokusKey, onToggleFokus, onResetFokus,
}) {
  // stopPropagation, damit der Reset-Handler des Diagramms den Klick nicht gleich wieder aufhebt
  const stoppe = (args) => args.forEach((a) => { if (a && typeof a.stopPropagation === "function") a.stopPropagation(); });
  const kurvenKlick = (key) => (...args) => { stoppe(args); onToggleFokus(key); };
  const legendenKlick = (...args) => {
    stoppe(args);
    const key = args[0] && (args[0].dataKey || args[0].value);
    if (typeof key === "string") onToggleFokus(key);
  };
  // Dimmen über die Strichfarbe, damit Legenden-Icon und -Text automatisch mitdimmen
  const modellLinie = (m) => (
    <Line key={m.key} dataKey={m.key}
      stroke={fokusKey && fokusKey !== m.key ? "#CBD4CF" : MODEL_COLORS[m.key]}
      strokeWidth={fokusKey === m.key ? 3 : 2} dot={false}
      onClick={kurvenKlick(m.key)} />
  );
  /* Die fokussierte Kurve nochmals als oberste Ebene zeichnen (SVG malt in DOM-Reihenfolge),
     damit gedimmte Kurven sie nicht verdecken – ohne Eintrag in Legende und Tooltip,
     damit Reihenfolge und Inhalte dort stabil bleiben. */
  const fokusLinie = fokusKey ? (
    <Line key={"fokus-" + fokusKey} dataKey={fokusKey} stroke={MODEL_COLORS[fokusKey]}
      strokeWidth={3} dot={false} legendType="none" tooltipType="none"
      isAnimationActive={false} onClick={kurvenKlick(fokusKey)} />
  ) : null;
  // Explizites Legenden-Payload: hält die Fokus-Überlagerungslinie aus der Legende heraus
  const legendenPayload = models.filter((m) => !m.infeasible).map((m) => ({
    value: m.key, dataKey: m.key, type: "plainline",
    color: fokusKey && fokusKey !== m.key ? "#CBD4CF" : MODEL_COLORS[m.key],
    payload: { strokeDasharray: "" },
  }));

  return (
    <>
      <section className="bf-panel bf-chart">
        <h2>Restschuld bis zur Rente</h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chart} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
            onClick={onResetFokus}>
            <CartesianGrid stroke="#D8DEDA" strokeDasharray="2 4" />
            <XAxis dataKey="alter" tick={{ fontFamily: "IBM Plex Mono", fontSize: 11 }}
              label={{ value: "Alter", position: "insideBottomRight", offset: -2, fontSize: 11 }} />
            <YAxis tickFormatter={(v) => (v / 1000) + "k"} tick={{ fontFamily: "IBM Plex Mono", fontSize: 11 }} width={52} />
            <Tooltip formatter={(v, name) => [eur(v), models.find((m) => m.key === name)?.short || name]}
              labelFormatter={(l) => "Alter " + l} />
            <Legend formatter={(key) => models.find((m) => m.key === key)?.short || key}
              payload={legendenPayload} onClick={legendenKlick} />
            <ReferenceLine x={rente} stroke="#1C2826" strokeDasharray="4 3"
              label={{ value: "Rente", position: "top", fontSize: 11, fontFamily: "IBM Plex Mono" }} />
            {zielRest > 0 && (
              <ReferenceLine y={zielRest} stroke="#A5524B" strokeDasharray="5 4"
                label={{ value: "Ablösung (z. B. KLV)", position: "insideTopRight", fontSize: 11, fontFamily: "IBM Plex Mono", fill: "#A5524B" }} />
            )}
            {models.filter((m) => !m.infeasible).map(modellLinie)}
            {fokusLinie}
          </LineChart>
        </ResponsiveContainer>
        <p className="bf-note">
          Klick auf eine Kurve, die Legende oder eine Zeile im Modellvergleich hebt das Modell hervor
          (gilt für beide Diagramme und die Tabelle); erneuter Klick oder Klick ins Diagramm stellt
          den Normalzustand wieder her.
        </p>
      </section>

      <section className="bf-panel bf-chart">
        <h2>Belastungsquote über die Laufzeit</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartBelastung} margin={{ top: 8, right: 38, bottom: 4, left: 8 }}
            onClick={onResetFokus}>
            <CartesianGrid stroke="#D8DEDA" strokeDasharray="2 4" />
            <XAxis dataKey="alter" tick={{ fontFamily: "IBM Plex Mono", fontSize: 11 }}
              label={{ value: "Alter", position: "insideBottomRight", offset: -2, fontSize: 11 }} />
            <YAxis tickFormatter={(v) => v + " %"} tick={{ fontFamily: "IBM Plex Mono", fontSize: 11 }}
              width={52} domain={[0, (dataMax) => Math.max(45, Math.ceil(dataMax / 5) * 5)]} />
            <Tooltip formatter={(v, name) => [v.toLocaleString("de-DE") + " %", models.find((m) => m.key === name)?.short || name]}
              labelFormatter={(l) => "Alter " + l} />
            <Legend formatter={(key) => models.find((m) => m.key === key)?.short || key}
              payload={legendenPayload} onClick={legendenKlick} />
            <ReferenceLine y={40} stroke="#A5524B" strokeDasharray="4 3"
              label={{ value: "40 %", position: "right", fontSize: 10, fontFamily: "IBM Plex Mono", fill: "#A5524B" }} />
            <ReferenceLine y={35} stroke="#B0762B" strokeDasharray="4 3"
              label={{ value: "35 %", position: "right", fontSize: 10, fontFamily: "IBM Plex Mono", fill: "#B0762B" }} />
            {models.filter((m) => !m.infeasible).map(modellLinie)}
            {fokusLinie}
          </LineChart>
        </ResponsiveContainer>
        <p className="bf-note">
          Monatsrate{klv > 0 ? " + KLV-Beitrag" : ""} ÷ Nettoeinkommen des jeweiligen Jahres
          bei {pct(g * 100, 1)} Einkommenssteigerung p. a. Sprünge entstehen durch
          Anschlussfinanzierung bzw. Bauspar-Zuteilung.
        </p>
      </section>
    </>
  );
}
