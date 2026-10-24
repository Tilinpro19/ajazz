# Plan de implementación: app de escritorio para el AJ139 V2 MC

Objetivo: una app de Windows (con soporte futuro para macOS y Linux) que reemplace
la web del fabricante, al estilo de G HUB: configurar DPI, botones, macros,
iluminación, batería y perfiles, sin conexión a internet.

Base técnica ya verificada: [docs/PROTOCOL.md](PROTOCOL.md) y
[src/protocol.js](../src/protocol.js) con pruebas en [test/protocol.test.js](../test/protocol.test.js)
(8 pruebas pasando, sin hardware).

## Decisiones tomadas

- **Stack:** Electron + JavaScript (sin TypeScript para arrancar), UI con React + Vite.
  Motivo: WebHID funciona en Chromium sin compilar módulos nativos, y el protocolo ya
  está escrito en JS. Tauri queda como alternativa si luego se quiere una app más ligera.
- **Transporte:** WebHID dentro del renderer de Electron. Se usa `session.on('select-hid-device')`
  para elegir el dispositivo sin diálogo, y `setDevicePermissionHandler` para permitirlo.
- **Persistencia:** perfiles en JSON dentro de `app.getPath('userData')`.
- **Sin telemetría, sin red.** La app solo habla con el mouse.

## Alcance

Incluido ahora:
1. Detección y conexión (USB y dongle 2.4G) con reconexión automática.
2. Batería y estado en línea.
3. DPI: 6 niveles con valores, nivel activo y paso de DPI con botón.
4. Tasa de reporte (report_rate).
5. Iluminación: modos y brillo según lo que confirme la captura.
6. Mapeo de 8 botones con catálogo completo (mouse, multimedia, web, teclado).
7. Macros: leer, editar, escribir y resetear (4096 bytes).
8. Ajustes: lift-off (lod), sensor, sleep, highspeed, wakeup, key respond, scroll.
9. Perfiles guardados en disco y cambio por ventana activa (fase posterior).
10. Restaurar valores de fábrica (requiere captura, la web no lo implementa).

Fuera de alcance por ahora: firmware, actualizaciones OTA, otros modelos.

## Fases

### Fase 0: Captura del protocolo que falta (requiere el mouse)
Lo que el código de la web no revela:
- Color RGB (si el mouse lo tiene) y qué comando lo envía.
- Confirmar el formato exacto de `sendReport` en Windows (64 bytes sin Report ID).
- Confirmar `dpi_flag` vs `dpi_count`.
- Comando de restaurar fábrica, si existe.

Método: USBPcap + Wireshark con el mouse conectado, cambiando cada opción una vez
en la web oficial. Guardar las capturas en `captures/` (no subirlas a git).

Criterio de salida: tabla de comandos nuevos añadida a PROTOCOL.md, y un script
`scripts/probe.js` que lea la configuración desde el mouse y la imprima.

### Fase 1: Esqueleto Electron + capa de dispositivo
- `electron/main.js`: ventana, permisos HID, selección automática del dispositivo
  con `vendorId`/`productId`/`usagePage` de PROTOCOL.md.
- `src/device/hid.js`: cola de comandos FIFO (una petición a la vez), timeout de 1 s,
  reintentos. Adaptar `flushQueue` del bundle original.
- `src/device/mouse.js`: métodos `readConfig`, `writeConfig`, `readButtons`,
  `writeButtons`, `readMacros`, `writeMacros`, `battery`, `version`, `online`,
  usando `src/protocol.js`.

Criterio de salida: con el mouse real, `version()` y `battery()` devuelven valores
razonables, y `readConfig()` coincide con lo que muestra la web.

### Fase 2: UI principal
- Pantalla de dispositivo: nombre, versión de firmware, batería, modo de conexión.
- Pestañas: Rendimiento (DPI, report rate, lift-off), Botones, Macros, Iluminación,
  Ajustes avanzados.
- Cada cambio se valida con `validateConfig` antes de enviarlo.
- Estado optimista con confirmación: si el mouse no responde, revertir y mostrar error.

### Fase 3: Perfiles y persistencia
- Guardar y cargar perfiles (JSON) con versión de esquema.
- Escribir al mouse solo el perfil activo.
- Exportar e importar perfiles.

### Fase 4: Cambio automático de perfil
- Detectar la ventana activa (en Windows: `GetForegroundWindow` vía `node-ffi-napi`
  o un proceso auxiliar en PowerShell).
- Asociar nombre de ejecutable a un perfil.

### Fase 5: Empaquetado y pruebas
- `electron-builder` para instalador de Windows (NSIS) y portable.
- Pruebas: unitarias de protocolo (ya existen), pruebas de la cola de comandos con un
  mock de HID, y una prueba manual con el checklist de abajo.
- macOS y Linux: solo después de cerrar Windows; el protocolo es el mismo.

## Checklist de prueba manual (con el mouse)

- [ ] Conecta por USB y detecta el dispositivo.
- [ ] Muestra versión y batería correctas.
- [ ] Cambia DPI, reinicia la app y el DPI se mantiene.
- [ ] Cambia cada botón y verifica la acción en Windows.
- [ ] Graba una macro corta y la ejecuta.
- [ ] Desconecta y reconecta sin reiniciar la app.
- [ ] Usa el dongle 2.4G.
- [ ] Restaura los valores de la web oficial y compara los bytes con una captura.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Escribir un valor inválido deja el mouse en mal estado | Validar rangos; siempre leer y guardar la configuración de fábrica antes de la primera escritura |
| Desfase de índices entre lectura y escritura | Pruebas de ida y vuelta en `test/protocol.test.js`; verificar con el mouse |
| Chrome/Electron bloquea la colección HID | Ya verificado en el bundle que la usage page 65281 se usa así desde la web |
| Respuestas perdidas o fuera de orden | Cola FIFO y timeout con reintento |
| Cambio de firmware del fabricante | Versionar el protocolo y comprobar `version()` al conectar |

## Cómo continuar con un modelo más potente

Este plan y los archivos están listos para que un modelo más capaz (por ejemplo
Claude Opus) continúe desde la Fase 0 o la Fase 1. Para eso:

1. Cambiar el modelo de la sesión (desde el selector de modelo de la app).
2. Decir: "Continúa con la Fase 1 de docs/IMPLEMENTATION_PLAN.md usando docs/PROTOCOL.md".
3. Ejecutar `npm test` antes de cada cambio para mantener las pruebas en verde.
