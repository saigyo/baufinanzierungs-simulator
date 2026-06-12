import { afterEach, describe, expect, it } from "vitest";
import { stateFromURL, stateToQuery, DEFAULTS } from "./persistence.js";

describe("URL-Persistenz", () => {
  afterEach(() => { delete globalThis.window; });

  it("erzeugt für Default-Werte eine leere Query", () => {
    expect(stateToQuery(DEFAULTS.inp, DEFAULTS.z, DEFAULTS.bsp, DEFAULTS.modus, DEFAULTS.limits, DEFAULTS.stress)).toBe("");
  });

  it("stellt alle abweichenden Werte verlustfrei wieder her (Round-Trip)", () => {
    const inp = { ...DEFAULTS.inp, kaufpreis: 650000, bundesland: "Bayern", makler: false, sonderTilgung: 5000 };
    const z = { ...DEFAULTS.z, anschluss: 5.1 };
    const qs = stateToQuery(inp, z, DEFAULTS.bsp, "max", [25, 35, 40], 1.5);
    globalThis.window = { location: { search: "?" + qs } };
    const s = stateFromURL();
    expect(s.inp).toEqual(inp);
    expect(s.z).toEqual(z);
    expect(s.bsp).toEqual(DEFAULTS.bsp);
    expect(s.modus).toBe("max");
    expect(s.limits).toEqual([25, 35, 40]);
    expect(s.stress).toBe(1.5);
  });

  it("fällt bei ungültigen Parametern auf die Defaults zurück", () => {
    globalThis.window = { location: { search: "?kp=abc&bl=Nirgendwo&lim=1,2&sx=-3&m=quatsch" } };
    const s = stateFromURL();
    expect(s.inp.kaufpreis).toBe(DEFAULTS.inp.kaufpreis);
    expect(s.inp.bundesland).toBe(DEFAULTS.inp.bundesland);
    expect(s.limits).toEqual(DEFAULTS.limits);
    expect(s.stress).toBe(0);
    expect(s.modus).toBe("vergleich");
  });

  it("liefert ohne window die Defaults (z. B. SSR/Tests)", () => {
    const s = stateFromURL();
    expect(s.inp).toEqual(DEFAULTS.inp);
    expect(s.modus).toBe(DEFAULTS.modus);
  });
});
