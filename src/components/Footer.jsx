/* ------------------------------------------------------------------ */
/*  Footer: Annahmen, Vereinfachungen, Disclaimer                      */
/* ------------------------------------------------------------------ */

const REPO_URL = "https://github.com/saigyo/baufinanzierungs-simulator";

export default function Footer() {
  return (
    <footer className="bf-footer">
      <p className="bf-footer-text">
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
      </p>
      <a className="bf-gh" href={REPO_URL} target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
          <path fill="currentColor" fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 012-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/>
        </svg>
        Quellcode auf GitHub
      </a>
    </footer>
  );
}
