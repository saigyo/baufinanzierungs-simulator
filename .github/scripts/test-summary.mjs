/**
 * Schreibt das Vitest-Ergebnis (JSON-Reporter, Jest-kompatibles Format) als
 * Markdown ins GitHub-Actions-Step-Summary ($GITHUB_STEP_SUMMARY).
 *
 * Aufruf: node .github/scripts/test-summary.mjs [test-results.json]
 */
import { appendFile, readFile } from "node:fs/promises";

const summaryFile = process.env.GITHUB_STEP_SUMMARY;
if (!summaryFile) {
  console.error("GITHUB_STEP_SUMMARY ist nicht gesetzt – dieses Skript läuft in GitHub Actions.");
  process.exit(1);
}

const resultFile = process.argv[2] ?? "test-results.json";
let data;
try {
  data = JSON.parse(await readFile(resultFile, "utf-8"));
} catch {
  await appendFile(
    summaryFile,
    `## ⚠️ Unit-Tests\n\nKeine Testergebnisse gefunden (\`${resultFile}\` fehlt oder ist unlesbar) – ` +
      "Vitest ist vermutlich vor dem Schreiben der Ergebnisdatei abgebrochen.\n"
  );
  process.exit(0);
}

const ohneAnsi = (s) => s.replace(/\u001b\[[0-9;]*m/g, "");
const endeMax = Math.max(data.startTime, ...data.testResults.map((f) => f.endTime ?? data.startTime));
const dauer = ((endeMax - data.startTime) / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 });

const zeilen = [
  `## ${data.success ? "✅" : "❌"} Unit-Tests`,
  "",
  "| Bestanden | Fehlgeschlagen | Übersprungen | Gesamt | Dauer |",
  "| ---: | ---: | ---: | ---: | ---: |",
  `| ${data.numPassedTests} | ${data.numFailedTests} | ${data.numPendingTests + (data.numTodoTests ?? 0)} | ${data.numTotalTests} | ${dauer} s |`,
  "",
];

const tests = data.testResults.flatMap((f) =>
  f.assertionResults.map((t) => ({ datei: f.name.replace(process.cwd() + "/", ""), ...t }))
);

const fehlschlaege = tests.filter((t) => t.status === "failed");
if (fehlschlaege.length > 0) {
  zeilen.push("### Fehlgeschlagene Tests", "");
  for (const t of fehlschlaege) {
    zeilen.push(`#### ❌ ${[...t.ancestorTitles, t.title].join(" › ")}`, "", `\`${t.datei}\``, "");
    for (const msg of t.failureMessages ?? []) {
      zeilen.push("```", ohneAnsi(msg), "```", "");
    }
  }
}

const statusIcon = { passed: "✅", failed: "❌", skipped: "⏭️", pending: "⏭️", todo: "📝" };
zeilen.push(
  "<details><summary>Alle Tests</summary>",
  "",
  "| Status | Suite | Test |",
  "| :---: | --- | --- |",
  ...tests.map(
    (t) => `| ${statusIcon[t.status] ?? t.status} | ${t.ancestorTitles.join(" › ")} | ${t.title} |`
  ),
  "",
  "</details>",
  ""
);

await appendFile(summaryFile, zeilen.join("\n"));
