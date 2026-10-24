# AJAZZ AJ139 Control

App de escritorio para configurar el mouse **AJAZZ AJ139 V2 MC** sin la web del fabricante:
DPI, tasa de reporte, botones, macros, iluminación, batería, ajustes y perfiles.
Funciona **sin red y sin telemetría**: solo habla con el mouse por HID.

> Probada solo con el AJ139 V2 MC (firmware 2.2.0, por cable y con el dongle 2.4G).
> Úsala bajo tu responsabilidad. La app no escribe nada si el modelo no coincide.

## Descargar e instalar

En la carpeta `release/` (o en la página de descargas del repositorio) hay dos opciones:

- `AJAZZ AJ139 Control Setup x.y.z.exe`: instalador para Windows.
- `AJAZZ AJ139 Control x.y.z.exe`: versión portable, no se instala.

No necesita drivers: Windows reconoce el mouse como dispositivo HID estándar.
Cierra la web oficial antes de abrir la app (solo un programa puede hablar con el mouse a la vez).

## Desarrollo

Requisitos: Node 20 o superior, Windows 10/11.

```bash
npm install
npm test        # pruebas del protocolo y de la capa de dispositivo (sin hardware)
npm start       # compila la UI y abre la app
npm run dev     # UI con recarga en caliente
npm run dist    # instalador NSIS y .exe portable en release/
```

Estructura:

- `src/protocol.js`: codificación de los comandos HID (ver `docs/PROTOCOL.md`).
- `src/catalog.js`: catálogo de acciones de botón, efectos de luz y teclas.
- `src/device/`: cola de comandos sobre WebHID y API del mouse.
- `src/profiles.js`: esquema y migraciones de perfiles.
- `src/ui/`: interfaz en React.
- `electron/`: proceso principal, permisos HID, perfiles en disco y ventana activa.
- `scripts/`: utilidades de línea de comandos con `node-hid` (solo lectura).

Antes de la primera escritura con hardware, guarda un respaldo:

```bash
node scripts/probe.js --save captures/respaldo.json
```

## Otros modelos

Si tienes otro mouse AJAZZ y quieres que se soporte, abre un issue con:

1. El modelo exacto y la versión de firmware que muestra la web oficial.
2. La salida de `node scripts/probe.js --raw` (solo lee, no cambia nada).
3. Si puedes, una captura de los `sendReport` de la web (ver `docs/PROTOCOL.md`).
