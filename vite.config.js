import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// CSP estricta solo en la build (en desarrollo React Refresh necesita un script inline).
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'";
const csp = {
  name: "csp",
  // En Tauri la CSP la pone tauri.conf.json (necesita permitir el IPC).
  apply: (_c, env) => env.command === "build" && !process.env.TAURI_ENV_PLATFORM,
  transformIndexHtml: (html) => html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
};

// La UI se carga con file:// en la app empaquetada: rutas relativas.
export default defineConfig({
  base: "./",
  plugins: [react(), csp],
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 5173, strictPort: true },
});
