/* ------------------------------------------------------------------ */
/*  Kleine Form-Bausteine                                              */
/* ------------------------------------------------------------------ */

import React from "react";

export function Field({ label, suffix, children }) {
  return (
    <label className="bf-field">
      <span className="bf-field-label">{label}</span>
      <span className="bf-field-input">{children}{suffix && <span className="bf-suffix">{suffix}</span>}</span>
    </label>
  );
}

export function Num({ value, onChange, step = 1, min = 0, max }) {
  return (
    <input type="number" value={value} step={step} min={min} max={max}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />
  );
}
