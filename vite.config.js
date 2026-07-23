import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Vendor-Code in eigene, langlebig cachebare Chunks aufteilen: React (sehr
        // stabil) und die Charting-Libs (Recharts + d3, groß, seltener geändert)
        // getrennt vom häufig wechselnden App-Code. Reine Caching-Optimierung – kein
        // Laufzeitverhalten geändert. Der Standalone-Build (esbuild, siehe
        // scripts/build-standalone.mjs) nutzt Vite nicht und bleibt ein einzelnes Bundle.
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: "vendor", test: /node_modules/ },
          ],
        },
      },
    },
  },
});
