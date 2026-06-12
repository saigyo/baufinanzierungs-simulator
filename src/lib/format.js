/* ------------------------------------------------------------------ */
/*  Zahlenformatierung (de-DE)                                         */
/* ------------------------------------------------------------------ */

const eur0 = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
export const eur = (v) => eur0.format(Math.round(v));
export const pct = (v, d = 2) => v.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d }) + " %";
