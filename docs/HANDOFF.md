# HANDOFF: app de escritorio para el mouse AJAZZ AJ139 V2 MC

Documento para que otro agente continúe el trabajo sin contexto previo.
Lee primero este archivo, luego [PROTOCOL.md](PROTOCOL.md) (referencia de bytes) y
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) (plan original).

## 1. Objetivo

App de escritorio (Windows primero; macOS/Linux después) que reemplaza la web del fabricante
(`https://139v2mc.yjx2012.com`) al estilo G HUB: DPI, report rate, botones, macros, iluminación,
batería, ajustes y perfiles. **Sin red y sin telemetría**: solo habla con el mouse por HID.
La app debe poder compartirse con otras personas (instalador y portable).

## 2. Estado actual

Hecho (verificado con hardware, USB y dongle 2.4G, firmware 2.2.0):
- Protocolo HID documentado y comprobado contra tramas reales de la web ([PROTOCOL.md](PROTOCOL.md)).
- [src/protocol.js](../src/protocol.js): constructores de comandos (`cmd.*`), decodificadores
  (`decodeConfig`, `decodeButtons`), `validateConfig`, `encodeMacro`, `isValidResponse`, `responseChecksum`,
  `macroWriteFrames`, `macroReadRequests`, `button`.
- [test/protocol.test.js](../test/protocol.test.js): 8 pruebas (`npm test`).
- Scripts de apoyo con `node-hid` (solo lectura salvo indicación): `probe.js`, `watch.js`, `diff.js`, `macros.js`.
- `captures/`: volcados crudos del mouse (**no se suben a git**).

Pendiente: todo lo que sigue (no existe aún `electron/`, UI, capa de dispositivo ni empaquetado).

## 3. Decisiones tomadas (no re-discutir sin motivo)

- **Stack:** Electron + JavaScript (ESM, sin TypeScript al inicio) y UI con React + Vite.
- **Transporte en la app:** WebHID en el renderer (no hace falta compilar módulos nativos).
  En `main`: `session.on('select-hid-device')` para elegir el dispositivo sin diálogo y
  `setDevicePermissionHandler` para permitirlo.
  Alternativa si WebHID da problemas: `node-hid` en el proceso main con IPC (ya funciona en los scripts).
- **Persistencia:** perfiles JSON en `app.getPath('userData')`, con versión de esquema.
- **Macros y sus nombres se guardan localmente** (el mouse no permite leerlas; la web también las guarda en el navegador).
- Idioma de la UI y del código/comentarios: español.

## 4. Datos clave del protocolo (resumen; el detalle está en PROTOCOL.md)

- Dispositivo: vendorId `43172` (cable) o `43173` (dongle), productId `8789`, usagePage `65281`, usage `16`.
- Frame de escritura: **65 bytes** con Report ID 0 en `[0]` y magic `0x55` en `[1]` (node-hid). En WebHID se envían 64 bytes sin Report ID.
- Respuesta: 64 bytes, `r[0]=0xAA`, `r[1]`=eco del comando, `r[3]`=checksum, `r[4]`=longitud, datos desde `r[8]`.
  Índice de respuesta = índice de escritura - 1.
- Una petición a la vez (cola FIFO), timeout 1 s con reintento.
- Comandos: `0x03` versión, `0x30` batería, `0xED` online (`r[8]=2` solo con dongle), `0x0E` leer config,
  `0x0F` escribir config, `0x08` leer botones, `0x09` escribir botones, `0x0D` escribir macros, `0x10` confirmar, `0x21` modo de luz.
- Report rate: `1=125, 2=250, 3=500, 4=1000` Hz. `light_mode`: 7 efectos (0-6, 6 = apagado, 0 = arcoíris). Sin color RGB configurable.
- `dpi_index` cuenta desde 1; se guardan 6 valores de DPI y `dpi_count` indica cuántos están activos.
- Botones: un cambio **reescribe las 8 entradas juntas**. `FF FF FF FF` = "por defecto, nunca tocado": al leer, tratarlo como factory; al escribir, usar siempre la tabla explícita.
- **Factory reset** = 3 escrituras (botones de fábrica, `writeConfig` de fábrica, luz 0), sin tocar macros. Ver sección final de PROTOCOL.md.

## 5. Reglas de trabajo para el agente

1. **Seguridad del hardware:** nunca escribir al mouse en pruebas automáticas. Antes de la primera escritura real,
   guardar un respaldo (`node scripts/probe.js --save captures/respaldo.json`). Validar siempre con `validateConfig`.
2. **No escribir `0x0F` con datos sin verificar:** reconstruir la config leída, cambiar solo el campo editado y mandar el frame completo.
3. `npm test` en verde antes de cada commit. Toda función nueva de protocolo lleva prueba (sin hardware, con bytes de `PROTOCOL.md`).
4. No subir `captures/`, `node_modules/`, `dist/`, `out/` (ver `.gitignore` en la tarea T0).
5. Commits pequeños con prefijos `feat:`, `fix:`, `docs:`, `test:`, `chore:`. Un commit por tarea o subtarea.
6. Si algo del protocolo no está confirmado, anotarlo como "inferido" en PROTOCOL.md; no inventar bytes.
7. Excluir `node_modules`, `.git`, `dist`, `build`, `captures` al buscar en el repo.

## 6. Tareas (en orden)

Cada tarea indica archivos y criterio de salida.

### T0. Higiene del repo
- Crear `.gitignore`: `node_modules/`, `dist/`, `out/`, `captures/`, `*.log`, `.claude/`.
- Crear `README.md`: qué es, requisitos (Node 20+, Windows), `npm install`, `npm test`, `npm start`, aviso
  "probada solo con AJ139 V2 MC, úsala bajo tu responsabilidad", y cómo reportar capturas de otros modelos.
- Salida: repo limpio, `npm test` pasa.

### T1. Completar `src/protocol.js`
- `cmd.writeButtons(entries)` (comando `0x09`, cabecera `55 09 a5 22 <len> 00 00 00`, 8 entradas de 4 bytes; len `0x31` en asignaciones y `0x20` en reset) y `cmd.confirm()` (`55 10 a5 22 00 00 00 05`).
- `FACTORY_BUTTONS` y `FACTORY_CONFIG` (valores en PROTOCOL.md) y `factoryResetFrames()` que devuelve la secuencia de frames.
- Codificadores de acciones: mouse `20 <máscara>`, teclado `10 <mods> <hid>`, macro `70 <idx> <veces> <modo>`, multimedia `30`, DPI `21 55`, rueda `21 38 01/ff`.
- `decodeButtons` debe devolver acciones legibles (no solo bytes) y manejar `FF FF FF FF`.
- Pruebas de ida y vuelta con las tramas reales de `captures/12-web-sendreport.txt` y `13-asignaciones.txt`
  (el frame generado debe ser idéntico byte a byte).
- Salida: `npm test` verde con las pruebas nuevas.

### T2. Esqueleto Electron + Vite
- Dependencias: `electron`, `vite`, `react`, `react-dom`, `electron-builder` (dev). Scripts: `start`, `dev`, `build`, `dist`.
- `electron/main.js` (ventana, permisos HID, selección automática por `vendorId/productId/usagePage`), `electron/preload.js`, `index.html`, `src/ui/main.jsx`.
- Cuidar que `src/protocol.js` (ESM) sea importable desde el renderer.
- Salida: la app abre una ventana y lista el mouse conectado.

### T3. Capa de dispositivo
- `src/device/hid.js`: apertura, reconexión automática (USB/dongle), cola FIFO, timeout 1 s, reintentos, validación con `isValidResponse`, ignorar mensajes `aa fa ...` no solicitados.
- `src/device/mouse.js`: `version()`, `battery()`, `online()`, `readConfig()`, `writeConfig(c)`, `readButtons()`, `writeButtons()`, `writeMacros()`, `setLightMode()`, `factoryReset()`.
- Pruebas con un mock de HID (cola, timeouts, respuestas fuera de orden).
- Salida: con el mouse real, `version()`/`battery()` correctos y `readConfig()` coincide con la web.

### T4. UI principal
Pestañas: **Rendimiento** (6 niveles de DPI, nivel activo, report rate, lift-off, sensor), **Botones** (catálogo de acciones; recordar que se escriben las 8 juntas),
**Macros** (editor de eventos, retardo, bucle, nombres locales), **Iluminación** (7 efectos), **Ajustes** (sleep, scroll, wakeup, key respond, highspeed, factory reset con confirmación).
Cabecera: nombre, firmware, batería, modo de conexión (USB/2.4G), estado en línea.
Cada cambio se valida con `validateConfig`; estado optimista con reversión si el mouse no responde.
Pendiente de resolver con la web: nombres de los efectos 3 y 4, orden de los modos de bucle de macros (`70 00 01 02/03`), significado de `sensor_flag` y de `lod`.

### T5. Perfiles
Guardar/cargar/exportar/importar JSON con versión de esquema; escribir al mouse solo el perfil activo. Migraciones simples por versión.

### T6. Cambio automático por ventana activa (Windows)
Detectar el ejecutable en primer plano (proceso auxiliar PowerShell o `GetForegroundWindow`), asociar ejecutable → perfil. Opcional y desactivable.

### T7. Empaquetado y compartir
`electron-builder`: instalador NSIS y `.exe` portable; icono; nombre `AJAZZ AJ139 Control`. Documentar en README la descarga/instalación y el driver (no requiere).
Más adelante: macOS/Linux (en Linux hay que agregar una regla udev para el acceso HID).

### T8. Checklist manual (con el mouse)
- [ ] Detecta por USB y por dongle; muestra versión y batería.
- [ ] Cambiar DPI persiste tras reiniciar la app.
- [ ] Cada botón ejecuta la acción en Windows.
- [ ] Macro corta grabada y ejecutada.
- [ ] Desconectar/reconectar sin reiniciar la app.
- [ ] Factory reset deja los bytes idénticos a la captura (`PROTOCOL.md`).

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| Escritura inválida deja el mouse mal | Validar rangos; respaldo previo; factory reset conocido |
| Desfase de índices lectura/escritura | Pruebas de ida y vuelta byte a byte |
| Respuestas perdidas o desordenadas | Cola FIFO, timeout y reintento |
| Firmware distinto en otros usuarios | Leer `version()` al conectar y avisar si no es 2.2.0 |
| Otros modelos AJAZZ | Fuera de alcance: no escribir si el productId no coincide |

## 8. Flujo con git

El dueño crea el repo remoto; los commits se hacen en local y otra herramienta los sube.
No hacer `push` ni crear ramas remotas. Si la carpeta aún no es repo, `git init` y un primer commit con T0.

## 9. Fuera de alcance

Firmware/OTA, otros modelos, color RGB (el mouse solo guarda el número de efecto), telemetría.
