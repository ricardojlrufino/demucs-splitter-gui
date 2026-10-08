import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Em desenvolvimento (`make dev`) não há o launcher do WebUI para escrever o config.js: este plugin o serve
 * a partir do arquivo que a API local (`--api-only`) escreve com a porta e o token da execução.
 */
function devApiConfig(): Plugin {
  const file = resolve(__dirname, "../.dev-api.json");
  return {
    name: "dev-api-config",
    configureServer(server) {
      server.middlewares.use("/config.js", (_req, res) => {
        let cfg = "undefined";
        try {
          cfg = readFileSync(file, "utf8");
        } catch {
          /* API ainda não iniciou */
        }
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "no-store");
        res.end(`window.__STEM_API__ = ${cfg};`);
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), devApiConfig()],
  server: { port: 1420, strictPort: true },
});
