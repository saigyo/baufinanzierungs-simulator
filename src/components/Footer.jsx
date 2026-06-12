/* ------------------------------------------------------------------ */
/*  Footer: Annahmen, Vereinfachungen, Disclaimer                      */
/* ------------------------------------------------------------------ */

import React from "react";

export default function Footer() {
  return (
    <footer className="bf-footer">
      Vereinfachtes Rechenmodell (monatliche Annuitäten; optionale Sondertilgungen jeweils zum
      Jahresende, im Bauspar-Modell und im Modus „Maximaler Kaufpreis" nicht berücksichtigt; ohne
      Bereitstellungszinsen, Förder-Tilgungszuschüsse und Steuereffekte). Der Zins-Stresstest
      variiert ausschließlich den Anschlusszins. Die Einkommenssteigerung ist eine idealisierte,
      gleichmäßige Annahme – reale Einkommen entwickeln sich in Sprüngen und können auch sinken;
      Banken rechnen bei der Kreditvergabe in der Regel mit dem heutigen Einkommen.
      Eine zum Renteneintritt verbleibende Restschuld
      muss durch die geplante Ablösesumme (z. B. Auszahlung einer Kapitallebensversicherung) gedeckt
      sein – der KLV-Beitrag wird in der Belastungsquote berücksichtigt, ob die Ablaufleistung die
      Restschuld tatsächlich deckt (Rendite-, Kosten- und Auszahlungsrisiko), prüft die Simulation
      jedoch nicht. Zinsannahmen sind frei wählbare Szenarien, keine
      aktuellen Konditionen. Alle Eingaben werden in der Adresszeile gespeichert – die URL kann
      als Lesezeichen abgelegt oder als Link geteilt werden. Dies ist eine Simulation und keine
      Finanz- oder Anlageberatung – für eine konkrete Finanzierung bitte Angebote von Banken
      bzw. unabhängigen Vermittlern einholen.
    </footer>
  );
}
