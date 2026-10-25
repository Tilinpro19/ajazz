// Detecta el ejecutable de la ventana en primer plano (Windows) con un PowerShell auxiliar
// que imprime una línea cada vez que cambia. Sin módulos nativos.
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";

const SCRIPT = `
$ProgressPreference = "SilentlyContinue"
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class AjFg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
"@
$last = ""
while ($true) {
  $p = 0
  [void][AjFg]::GetWindowThreadProcessId([AjFg]::GetForegroundWindow(), [ref]$p)
  $n = ""
  try { $n = (Get-Process -Id $p -ErrorAction Stop).ProcessName + ".exe" } catch {}
  if ($n -ne $last -and $n -ne "") { [Console]::Out.WriteLine($n); [Console]::Out.Flush(); $last = $n }
  Start-Sleep -Milliseconds 1000
}
`;

export class ForegroundWatcher extends EventEmitter {
  constructor(ownExe) {
    super();
    this.ownExe = (ownExe || "").toLowerCase();
    this.proc = null;
    this.last = null;
  }

  start() {
    if (this.proc) return;
    const encoded = Buffer.from(SCRIPT, "utf16le").toString("base64");
    this.proc = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let buf = "";
    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk) => {
      buf += chunk;
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const line of lines.map((l) => l.trim()).filter(Boolean)) {
        // Al volver a la propia app no se cambia de perfil.
        if (line.toLowerCase() === this.ownExe || line.toLowerCase() === "electron.exe") continue;
        if (line !== this.last) {
          this.last = line;
          this.emit("change", line);
        }
      }
    });
    this.proc.stderr.on("data", (d) => {
      const msg = String(d);
      if (!msg.startsWith("#< CLIXML")) this.emit("error", msg); // CLIXML es ruido de progreso de PowerShell
    });
    this.proc.on("exit", () => (this.proc = null));
  }

  stop() {
    this.proc?.kill();
    this.proc = null;
    this.last = null;
  }
}
