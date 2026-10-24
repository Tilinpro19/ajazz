// Desarrollo: servidor de Vite con recarga en caliente + Electron apuntando a él.
import { createServer } from "vite";
import { spawn } from "node:child_process";
import electron from "electron";

const server = await createServer();
await server.listen();
const url = server.resolvedUrls.local[0];
console.log("Vite en", url);
const child = spawn(electron, ["."], { stdio: "inherit", env: { ...process.env, VITE_DEV_SERVER_URL: url } });
child.on("exit", async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
