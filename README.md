# AJAZZ AJ139 Control

App de escritorio para configurar el mouse **AJAZZ AJ139 V2 MC** sin la web del fabricante:
DPI, tasa de reporte, botones, macros, iluminación, batería, ajustes y perfiles.
Funciona **sin red y sin telemetría**: solo habla con el mouse por HID.

> Probada solo con el AJ139 V2 MC (firmware 2.2.0, por cable y con el dongle 2.4G).
> Úsala bajo tu responsabilidad. La app no escribe nada si el modelo no coincide.

## Descargar e instalar

En la carpeta `release/` (o en la página de descargas del repositorio) hay dos opciones:

- `AJAZZ AJ139 Control Setup x.y.z.exe`: instalador para Windows.
- `AJAZZ AJ139 Control x.y.z portable.exe`: versión portable, no se instala.

Windows puede mostrar el aviso de SmartScreen porque el ejecutable no está firmado:
"Más información" → "Ejecutar de todas formas".

No necesita drivers: Windows reconoce el mouse como dispositivo HID estándar.
Cierra la web oficial antes de abrir la app (solo un programa puede hablar con el mouse a la vez).

Los perfiles se guardan en `%APPDATA%AJAZZ AJ139 Controlprofiles.json` y, al conectar el mouse por
primera vez, la app guarda un respaldo de su configuración en la carpeta `respaldos` de ese mismo directorio.

## Desarrollo

Requisitos: Node 20 o superior, Windows 10/11.

```bash
npm install
npm test        # pruebas del protocolo, la capa de dispositivo y los perfiles (sin hardware)
npm run test:ui # abre la app con un mouse simulado y recorre la UI (sin hardware)
npm start       # compila la UI y abre la app
npm run dev     # UI con recarga en caliente
npm run dist    # instalador NSIS y .exe portable en release/
npm run icon    # regenera build/icon.png y build/icon.ico
```

Si `npm run dist` falla con "Cannot create symbolic link" (Windows sin modo desarrollador): extrae a mano el
`.7z` que electron-builder dejó en `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\` a la carpeta
`winCodeSign-2.6.0` con `node_modules\7zip-bin\win\x64\7za.exe x <archivo>.7z -owinCodeSign-2.6.0`
(los dos errores de enlaces de macOS se pueden ignorar), borra los `.7z` y las carpetas numeradas, y ejecuta
`npx electron-builder --win nsis portable`.

Estructura:

- `src/protocol.js`: codificación de los comandos HID (ver `docs/PROTOCOL.md`).
- `src/catalog.js`: catálogo de acciones de botón, efectos de luz y teclas.
- `src/device/`: cola de comandos sobre WebHID, API del mouse y mouse simulado (`demo.js`).
- `src/profiles.js`: esquema y migraciones de perfiles.
- `src/ui/`: interfaz en React.
- `electron/`: proceso principal, permisos HID, perfiles en disco y ventana activa.
- `scripts/`: utilidades de línea de comandos con `node-hid` (solo lectura).

Modo demo: abre la UI con un mouse simulado (no toca el hardware ni tus perfiles):

```bash
npx electron scripts/screenshot.js out/capturas 2000 --demo
```

Antes de la primera escritura con hardware, guarda un respaldo:

```bash
node scripts/probe.js --save captures/respaldo.json
```

## Otros modelos

Si tienes otro mouse AJAZZ y quieres que se soporte, abre un issue con:

1. El modelo exacto y la versión de firmware que muestra la web oficial.
2. La salida de `node scripts/probe.js --raw` (solo lee, no cambia nada).
3. Si puedes, una captura de los `sendReport` de la web (ver `docs/PROTOCOL.md`).
