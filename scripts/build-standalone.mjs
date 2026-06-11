/**
 * Erzeugt eine vollständig eigenständige HTML-Datei (dist/baufinanzierung-simulator.html),
 * die React, Recharts und die App minifiziert als Inline-Skript enthält.
 * Die Datei kann ohne Server per Doppelklick im Browser geöffnet werden.
 *
 * Aufruf: npm run build:standalone
 */
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";

const result = await build({
  entryPoints: ["src/main.jsx"],
  bundle: true,
  minify: true,
  write: false,
  loader: { ".jsx": "jsx" },
  define: { "process.env.NODE_ENV": '"production"' },
});

let js = result.outputFiles[0].text;
// "</script>" und "<!--" im Bundle entschärfen, damit das Inline-Skript nicht vorzeitig endet
js = js.replaceAll("</script", "<\\/script").replaceAll("<!--", "<\\!--");

const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Baufinanzierungs-Simulator</title>
<style>html,body{margin:0;padding:0;background:#E9ECEA}</style>
</head>
<body>
<div id="root"></div>
<script>
${js}
</script>
</body>
</html>
`;

await mkdir("dist", { recursive: true });
await writeFile("dist/baufinanzierung-simulator.html", html, "utf-8");
console.log(
  `dist/baufinanzierung-simulator.html geschrieben (${(html.length / 1024).toFixed(0)} kB)`
);
