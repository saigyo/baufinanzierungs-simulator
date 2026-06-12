/* ------------------------------------------------------------------ */
/*  Eingabe-Panel: Objekt, Person & Ziel, Nebenkosten, Zinsannahmen    */
/* ------------------------------------------------------------------ */

import React, { useState } from "react";

import { GREST, NOTAR_PROZENT } from "../lib/constants.js";
import { eur, pct } from "../lib/format.js";
import { Field, Num } from "./controls.jsx";

export default function InputPanel({
  modus, inp, setInp, z, setZ, bsp, setBsp, stress, setStress, nk, nkQ,
}) {
  const [zinsOffen, setZinsOffen] = useState(false);
  const set = (k) => (v) => setInp((s) => ({ ...s, [k]: v }));
  const setRate = (k) => (v) => setZ((s) => ({ ...s, [k]: v }));
  const setB = (k) => (v) => setBsp((s) => ({ ...s, [k]: v }));

  return (
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
          <div><span>Grunderwerbsteuer ({pct(GREST[inp.bundesland], 1)})</span><b>{eur(nk.grest)}</b></div>
          <div><span>Notar &amp; Grundbuch ({pct(NOTAR_PROZENT, 1)})</span><b>{eur(nk.notar)}</b></div>
          {inp.makler && <div><span>Makler</span><b>{eur(nk.makler)}</b></div>}
          <div className="bf-nk-sum"><span>Nebenkosten gesamt</span><b>{eur(nk.sum)}</b></div>
        </div>
      ) : (
        <div className="bf-nk">
          <div><span>Grunderwerbsteuer</span><b>{pct(GREST[inp.bundesland], 1)}</b></div>
          <div><span>Notar &amp; Grundbuch</span><b>{pct(NOTAR_PROZENT, 1)}</b></div>
          {inp.makler && <div><span>Makler</span><b>{pct(inp.maklerProzent)}</b></div>}
          <div className="bf-nk-sum"><span>Nebenkostenquote</span><b>{pct(nkQ * 100, 1)}</b></div>
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
  );
}
