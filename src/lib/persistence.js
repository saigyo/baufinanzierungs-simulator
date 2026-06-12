/* ------------------------------------------------------------------ */
/*  Persistenz: Eingaben <-> URL-Parameter                             */
/* ------------------------------------------------------------------ */

import { GREST } from "./constants.js";

export const DEFAULTS = {
  inp: {
    kaufpreis: 500000, eigenkapital: 120000, netto: 4500, einkommenPlus: 3,
    alter: 38, rente: 67, bundesland: "Berlin",
    makler: true, maklerProzent: 3.57, zielRest: 0, klvBeitrag: 0, sonderTilgung: 0,
  },
  z: { z10: 3.5, z15: 3.7, z20: 3.85, volltilger: 3.8, kfw: 3.4, anschluss: 4.2 },
  bsp: { vorausZins: 3.9, bausparZins: 2.75, ansparJahre: 10, ansparQuote: 40 },
  modus: "vergleich", limits: [30, 35, 40], stress: 0,
};

const URL_KEYS = {
  inp: {
    kaufpreis: "kp", eigenkapital: "ek", netto: "net", einkommenPlus: "ep",
    alter: "al", rente: "re", bundesland: "bl", makler: "mk", maklerProzent: "mp",
    zielRest: "zr", klvBeitrag: "klv", sonderTilgung: "so",
  },
  z: { z10: "z10", z15: "z15", z20: "z20", volltilger: "zvt", kfw: "zkfw", anschluss: "zan" },
  bsp: { vorausZins: "bvz", bausparZins: "bbz", ansparJahre: "baj", ansparQuote: "baq" },
};

export function stateFromURL() {
  const s = {
    inp: { ...DEFAULTS.inp }, z: { ...DEFAULTS.z }, bsp: { ...DEFAULTS.bsp },
    modus: DEFAULTS.modus, limits: [...DEFAULTS.limits], stress: DEFAULTS.stress,
  };
  try {
    const p = new URLSearchParams(window.location.search);
    for (const [slice, map] of Object.entries(URL_KEYS)) {
      for (const [field, key] of Object.entries(map)) {
        const raw = p.get(key);
        if (raw === null) continue;
        const def = DEFAULTS[slice][field];
        if (typeof def === "boolean") s[slice][field] = raw === "1";
        else if (typeof def === "number") { const v = Number(raw); if (Number.isFinite(v)) s[slice][field] = v; }
        else s[slice][field] = raw;
      }
    }
    if (!(s.inp.bundesland in GREST)) s.inp.bundesland = DEFAULTS.inp.bundesland;
    if (p.get("m") === "max") s.modus = "max";
    const lim = (p.get("lim") || "").split(",").map(Number);
    if (lim.length === DEFAULTS.limits.length && lim.every(Number.isFinite)) s.limits = lim;
    if (p.has("sx")) { const v = Number(p.get("sx")); if (Number.isFinite(v)) s.stress = Math.max(0, v); }
  } catch { /* z. B. eingeschränkte file://-Kontexte: Defaults verwenden */ }
  return s;
}

export function stateToQuery(inp, z, bsp, modus, limits, stress) {
  const p = new URLSearchParams();
  const slices = { inp, z, bsp };
  for (const [slice, map] of Object.entries(URL_KEYS)) {
    for (const [field, key] of Object.entries(map)) {
      const v = slices[slice][field], def = DEFAULTS[slice][field];
      if (v === def) continue;
      p.set(key, typeof def === "boolean" ? (v ? "1" : "0") : String(v));
    }
  }
  if (modus !== DEFAULTS.modus) p.set("m", modus);
  if (limits.join(",") !== DEFAULTS.limits.join(",")) p.set("lim", limits.join(","));
  if (stress !== DEFAULTS.stress) p.set("sx", String(stress));
  return p.toString();
}
