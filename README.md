# AJAZZ AJ139 Control

Aplicación de escritorio para configurar el mouse **AJAZZ AJ139 V2 MC** sin depender de la web del fabricante:
DPI por etapas, tasa de reporte, reasignación de botones, macros, iluminación RGB, batería, ajustes de dispositivo y perfiles con cambio automático según la aplicación activa.

Funciona **100 % local, sin red y sin telemetría**: solo se comunica con el mouse por HID.

> Probada con el **AJ139 V2 MC** (firmware `2.2.0`, por cable USB y con el dongle 2.4G).  
> Úsala bajo tu responsabilidad. La app no escribe nada si el dispositivo no coincide.

---

## Características principales

- **Rendimiento:** hasta 6 etapas de DPI configurables, tasa de reporte (`125`–`1000 Hz`), LOD, debounce, Motion Sync y Angle Snapping.
- **Botones y macros:** reasignación de los botones del mouse, editor de macros con tiempos y retardos.
- **Iluminación:** modos de luz, brillo, velocidad y color.
- **Perfiles automáticos:** cambio de perfil al detectar la ventana/ejecutable en primer plano.
- **Segundo plano en bandeja:** minimiza o cierra a la bandeja del sistema (`tray`) y opción de inicio con Windows.
- **Respaldo automático:** antes de la primera escritura, guarda una copia de la configuración original del mouse.

---

## Descargar e instalar

En la sección de **Releases** del repositorio encontrarás el instalador para Windows (`NSIS`).

- Windows puede mostrar el aviso de SmartScreen porque el ejecutable no está firmado: haz clic en **"Más información" → "Ejecutar de todas formas"**.
- No necesita drivers adicionales: Windows reconoce el mouse como dispositivo HID estándar.
- Cierra la web oficial antes de abrir la app (solo un programa puede comunicarse con el mouse a la vez).

Los perfiles se guardan en:
```text
%APPDATA%\AJAZZ AJ139 Control\profiles.json
```
Y los respaldos originales del hardware en `%APPDATA%\AJAZZ AJ139 Control\respaldos\`.

---

## Desarrollo

### Requisitos
- **Node.js 20+** y **Windows 10/11**
- **Rust / Cargo** (solo para compilar o ejecutar la versión **Tauri**)

### Instalación y pruebas
```bash
npm install
npm test          # pruebas unitarias del protocolo, dispositivo y perfiles (sin hardware)
npm run test:ui   # recorre la UI con un mouse simulado en Electron (sin hardware)
```

### Ejecutar con Tauri (backend nativo en Rust)
```bash
npm run tauri:dev   # desarrollo con recarga en caliente
npm run dist:tauri  # genera el instalador nativo
```

### Ejecutar con Electron
```bash
npm run dev       # UI con recarga en caliente
npm start         # compila la UI y abre Electron
npm run dist      # genera el instalador NSIS en release/
npm run icon      # regenera build/icon.png y build/icon.ico
```

> Si `npm run dist` (Electron) falla con `"Cannot create symbolic link"` en Windows sin Modo Desarrollador, extrae manualmente el `.7z` de `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\` a `winCodeSign-2.6.0` con `node_modules\7zip-bin\win\x64\7za.exe x <archivo>.7z -owinCodeSign-2.6.0` y vuelve a ejecutar `npm run dist`.

---

## Estructura del proyecto

- `src/protocol.js` — codificación y decodificación de tramas HID (ver [`docs/PROTOCOL.md`](docs/PROTOCOL.md)).
- `src/catalog.js` — catálogo de acciones de botón, efectos de luz y teclas.
- `src/device/` — cola de comandos HID, API del mouse, bridge para Tauri (`tauriHid.js`) y mouse simulado (`demo.js`).
- `src/profiles.js` — esquema, validación y migración de perfiles.
- `src/ui/` — interfaz gráfica en React.
- `src-tauri/` — backend nativo en Rust (HID con `hidapi`, bandeja del sistema, perfiles y detector de ventana activa).
- `electron/` — proceso principal alternativo en Electron.
- `scripts/` — utilidades CLI con `node-hid` (solo lectura).
- `test/` — suite de pruebas unitarias.

---

## Modo demo y respaldo manual

Abre la UI con un mouse simulado (no toca el hardware ni tus perfiles reales):
```bash
npx electron scripts/screenshot.js out/capturas 2000 --demo
```

Para guardar un respaldo manual de tu mouse por consola antes de escribir:
```bash
node scripts/probe.js --save captures/respaldo.json
```

---

## Soporte para otros modelos

Si tienes otro mouse AJAZZ y quieres añadir soporte, abre un **Issue** incluyendo:

1. El modelo exacto y la versión de firmware que muestra la web oficial.
2. La salida de `node scripts/probe.js --raw` (solo lee, no modifica nada).
3. De ser posible, una captura de los `sendReport` de la web (ver [`docs/PROTOCOL.md`](docs/PROTOCOL.md)).
