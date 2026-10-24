# Protocolo HID del AJ139 V2 MC (extraído de la web del fabricante)

Fuente: bundle JS público de `https://139v2mc.yjx2012.com`
(`page-8ebf300afffc81d0.js`, clases de comandos y transporte). Esto documenta
cómo habla la web con **tu** mouse. Los valores marcados como *inferido* no
están confirmados con hardware y deben verificarse con captura USB.

## Identificación del dispositivo (WebHID)

| Campo | Valor | Notas |
|---|---|---|
| vendorId (USB cable) | `43172` (`0xA8A4`) | `getConnectMode()` => `"USB"` |
| vendorId (dongle 2.4G) | `43173` (`0xA8A5`) | `"2.4G"` |
| productId | `8789` (`0x2255`) | igual en ambos modos |
| usagePage | `65281` (`0xFF00`) | página vendor, no bloqueada por WebHID |
| usage | `1` y `16` | la web filtra por `usage 16` |

Filtro de `requestDevice` usado por la web:
```js
[{vendorId: 43172, productId: 8789, usagePage: 65281, usage: 16},
 {vendorId: 43173, productId: 8789, usagePage: 65281, usage: 16}]
```

## Transporte

- Cada comando es un arreglo de **65 bytes**: `frame[0]` es el **Report ID**,
  `frame[1..64]` es el payload (64 bytes).
- Los comandos de configuración se envían con `device.sendReport(reportId, payload)`.
- La respuesta llega como evento `inputreport` de 64 bytes. La web empareja
  pedido y respuesta con una cola FIFO (`commandQueue`), una petición a la vez.
- `sendDeviceData` (la vía que usa casi todo) escribe el frame y espera la
  siguiente `inputreport` como respuesta.

Plantilla de comando normal (Report ID 0):

```
byte: [0]   [1]   [2]=cmd  [3..]=parámetros...
val : 0x00  0x55  ...      ...
```

`0x55` (85) es el byte mágico de cabecera. Los comandos de macros usan
`0x55` en la posición 1 también. Hay comandos con cabecera distinta:
`[6,12,n,lo,hi]` y `[6,15,4]` (Report ID 6), usados para leer macros y resetearlas.

## Comandos

Todas las posiciones indicadas son índices del frame de 65 bytes.

### Versión de firmware
- Envío: `[0, 0x55, 0x03]`
- Respuesta: `t[23]`, `t[24]`, `t[25]` son dígitos ASCII (`"1.2.3"`).

### Batería
- Envío: `[0, 0x55, 0x30, 0xA5, 0x0B, 0x2E, 1, 1, 0, 0, 0]`
- Respuesta: `t[8]` = porcentaje, `t[9]` = flag de carga.

### Estado en línea
- Envío: `[0, 0x55, 0xED, 0, 1, 0x2E, 0, 0]`
- Respuesta: `t[8] == 2` => online.

### Modo de luz
- Envío: `[0, 0x55, 0x21, 0, 0, 3, 0, 0, 0, 0, 0, MODO]`
- `MODO` es el valor de `light_mode` (0-3 según la UI, *inferido*).

### Configuración general (lectura)
- Envío: `[0, 0x55, 0x0E, 0xA5, 0x0B, 0x2F, 1, 1, 0, 0, 0]`
- Respuesta:

| Campo | Índice | Cálculo |
|---|---|---|
| light_mode | `t[9]` | directo |
| report_rate | `t[10]` | `valor - 1` (la UI muestra 1 + índice) |
| dpi_index | `t[12]` | `valor - 1` |
| dpi_count | `t[11]` | directo |
| dpi_flag | `t[11]` | *posible error: la web usa el mismo byte para ambos* |
| dpi1..dpi6 | pares en `t[13..24]` | little-endian: `valor = lo + hi*256` |
| scroll_flag | `t[48]` | |
| lod_value | `t[49]` | altura de lift-off |
| sensor_flag | `t[50]` | |
| key_respond | `t[51]` | |
| sleep_light | `t[52]` | |
| highspeed_mode | `t[53]` | |
| wakeup_flag | `t[55]` | |

Si la respuesta viene con todos los bytes en 0 o en 255, la web usa valores
por defecto de fábrica: DPI 400/800/1200/1600/2400/3200, `light_mode 2`,
`report_rate 3`, `dpi_index 1`, `dpi_count 5`.

**Desfase de índices:** las respuestas están desplazadas **-1** respecto a los
índices de escritura (por ejemplo, `light_mode` se escribe en `t[10]` y se lee
en `t[9]`). Es coherente con que la respuesta no incluya el byte de Report ID.
Así se explica la diferencia de un índice entre lectura y escritura en el bundle.

### Configuración general (escritura)
- Envío: `[0, 0x55, 0x0F, 0xAE, 0x0A, 0x2F, 1, 1, 0, 0, ...]`
- Campos: `t[10]=light_mode`, `t[11]=report_rate+1`, `t[12]=dpi_count`,
  `t[13]=dpi_index+1`, `t[14..25]` = DPI en little-endian,
  `t[49]=scroll_flag`, `t[50]=lod_value`, `t[51]=sensor_flag`,
  `t[52]=key_respond`, `t[53]=sleep_light`, `t[54]=highspeed_mode`,
  `t[55]=wakeup_flag`.

### Mapeo de botones
- Lectura: `[0, 0x55, 0x08, 0xA5, 0x0B, 0x20, 0, 0, 0, 0, 0]`
  Respuesta: desde `t[8]`, 8 entradas de 4 bytes: `type, code1, code2, code3`.
- Escritura: `[0, 0x55, 0x09, 0xA5, 0x22, 0x31, ...]` con 8 entradas empaquetadas
  desde el índice 9. La web también escribe una tabla fija de bytes en índices
  9..40 (`0x20` como tipo de cabecera).
- Reset: misma cabecera con `0x20` en índice 5 y valores por defecto.

Tipos de acción y códigos (tomados del JSON `j.B` de la web):

| Acción | type | code1 | code2 |
|---|---|---|---|
| Click izquierdo | 32 | 1 | 0 |
| Click derecho | 32 | 2 | 0 |
| Click central | 32 | 4 | 0 |
| Adelante | 32 | 16 | 0 |
| Atrás | 32 | 8 | 0 |
| Rueda arriba | 33 | 56 | 1 |
| Rueda abajo | 33 | 56 | 255 |
| DPI loop + | 33 | 85 | 0 |
| Deshabilitado | 32 | 0 | 0 |
| Volumen + | 48 | 233 | 0 |
| Volumen - | 48 | 234 | 0 |
| Mute | 48 | 226 | 0 |
| Play/Pausa | 48 | 205 | 0 |
| Siguiente pista | 48 | 181 | 0 |
| Pista anterior | 48 | 182 | 0 |

El catálogo completo de códigos (teclado, multimedia, web, calculadora, etc.)
está en el JSON `j.B.p` del bundle y debe copiarse al proyecto.

### Macros
- Lectura: 4096 bytes en bloques de 56. Envío por bloque:
  `[6, 12, n, lo, hi]` (Report ID 6), donde `(lo, hi)` es la dirección.
  Se descartan los primeros 8 bytes de cada respuesta.
- Escritura: bloques de 56 bytes con cabecera `[0, 0x55, 0x0D, 0, 0, len, lo, hi, 0, ...datos]`.
  Al final se confirma con `[0, 0x55, 0x10, 0xA5, 0x22, 0, 0, 0, 5]`.
- Reset: `[6, 15, 4]`.

### Restaurar valores de fábrica
- La web define `restoreFactorySettings(){}` vacío: no hay comando conocido.

## Confirmado con hardware (2026-10-23, USB, firmware 2.2.0)

Probado con `scripts/probe.js` y node-hid en Windows, sin escribir nada al mouse.
Respaldo crudo en `captures/factory.json`.

- La interfaz de control es la **MI_02** (usagePage `0xFF00`, usage `16`).
- En Windows, `write()` con el frame de **65 bytes** (Report ID `0` en `[0]`) funciona.
  Las respuestas llegan con **64 bytes, sin Report ID**.
- Cabecera de respuesta: `r[0] = 0xAA`, `r[1]` = eco del comando. Por eso cada
  índice de respuesta es el de escritura menos 1 (se confirma el desfase).
- **Cabecera completa:** `r[4]` = longitud de los datos, que empiezan en `r[8]`
  (readConfig 47, readButtons 32, version 56). Coincide con `f[5]` del pedido
  en readConfig (`0x2F`) y readButtons (`0x20`).
- **Checksum de respuesta:** `r[3] = (r[4] + ... + r[7 + r[4]]) & 0xFF`. Verificado
  en 30 respuestas. Ver `isValidResponse` en `src/protocol.js`.
- **dpi_index confirmado:** al elegir 2400 DPI en la web, `r[12]` pasó de 4 a 5
  (nivel 5 contando desde 1). La web cambia el nivel activo, no `dpi_count`.
- **sleep_light = minutos de suspensión:** "Sleep Time" de 10 a 3 min cambió
  `r[52]` de 10 a 3. El valor se guarda directo en minutos.
- **scroll_flag:** "Scroll Wheel Direction" en Reverse cambió `r[48]` de 0 a 1
  (`0` = Forward, `1` = Reverse).
- **wakeup_flag:** desmarcar "Move to Wake" cambió `r[55]` de 0 a 1
  (`0` = despierta al mover, `1` = no). Ese byte está **fuera** de los 47 bytes
  de datos y no entra en el checksum.
- ~~⚠️ Posible error en `writeConfig`~~ (**descartado**, ver captura 12): los datos leídos `r[8..54]` equivalen a
  `f[9..55]` en escritura, y `writeConfig` pone `wakeup_flag` en `f[55]`, que
  corresponde a `r[54]` (hoy `0x64`, sin identificar). Puede que la web escriba
  `wakeup_flag` con otro comando. No escribir la configuración hasta capturar
  el `sendReport` real de la web.
- **Versión:** `r[8..19]` = `"YJX.co.mouse"`; `r[23..25]` = `"220"` (2.2.0); a
  partir de `r[26]` vienen fechas de compilación (`Sep  4 2025 15:09:54`,
  `May  6 2024 15:15:45`).
- **Batería:** `r[8] = 100`, `r[9] = 1` (cargando por cable).
- **Online:** `r[8] = 0` por cable. Probablemente solo aplica al dongle 2.4G (pendiente).
- **Configuración:** `light_mode 0`, `report_rate 3` (byte 4), `dpi_count 6`,
  `dpi_index 3` (1600), DPI `400/800/1200/1600/2400/3200`. Cola de la respuesta:
  `r[48..55] = 00 ff 01 0a 0a ff 64 00`. Los `0xFF` en `r[49]` (lod) y `r[53]`
  (highspeed) parecen "sin configurar"; falta confirmar qué byte es cada campo
  cambiándolos uno a uno en la web oficial. `r[54] = 0x64` (100) no está mapeado.
- **Botones:** `r[8..39]` todo `0xFF`: el mouse usa su mapeo interno de fábrica.
  La app debe tratar `0xFF` como "por defecto" y no mostrarlo como acción.

## Lo que aún no se sabe

1. Qué hace exactamente `light_mode` (0-3) y si hay colores RGB. La web solo
   manda un modo, no color. Si el mouse tiene RGB, el color puede venir en
   otro comando que no aparece en la web.
2. Si `dpi_flag` y `dpi_count` deben ser diferentes (ver tabla).
3. Confirmar que `Report ID 6` es el mismo colectivo que `Report ID 0`.
4. Tamaño y formato exacto del payload en Windows (`sendReport` en Chrome puede
   requerir 64 bytes sin el Report ID). Verificar con una captura USB.

Para cerrar estas dudas: conectar el mouse, abrir la web oficial en Chrome, y
capturar el tráfico con USBPcap + Wireshark (filtro `usb.device_address`) mientras
se cambia cada opción una vez, o loguear `sendReport` / `sendFeatureReport`
desde la consola.

## Botones (2026-10-23, captura `06-backward-disable.json`)

Al poner Backward en Disable en la web, el mouse **guardó la tabla completa**, no solo ese botón:
las 8 entradas de 4 bytes (`r[8..39]`) pasaron de `FF FF FF FF` a valores explícitos.

| # | bytes | significado |
|---|-------|-------------|
| 1 | `20 01 00 00` | clic izquierdo (type 0x20 = botón de mouse, code1 = máscara) |
| 2 | `20 02 00 00` | clic derecho |
| 3 | `20 04 00 00` | clic central |
| 4 | `20 00 00 00` | **Backward = Disable** (de fábrica sería máscara 0x08) |
| 5 | `20 10 00 00` | Forward (máscara 0x10) |
| 6 | `F0 01 01 00` | botón DPI (type 0xF0) |
| 7 | `21 38 01 00` | rueda arriba (type 0x21, 0x38 = usage Wheel, +1) |
| 8 | `21 38 FF 00` | rueda abajo (-1) |

- `r[3]` (checksum) pasó de 0 a 0x7B: ya no es todo 0xFF.
- Un solo cambio reescribe toda la tabla: la app debe escribir las 8 entradas juntas.
- Pendiente: probar "Reset All Keys" para ver si vuelve a `0xFF`.

### Reset All Keys (captura `07-reset-keys.json`)

- **No vuelve a `0xFF`.** Escribe una tabla explícita con los valores de fábrica:
  `20 01`, `20 02`, `20 04`, `20 08` (Backward restaurado), `20 10`, `21 55 00` (botón DPI), `21 38 01`, `21 38 FF`.
- Backward `20 00` → `20 08`: Disable = máscara 0; el valor de fábrica es 0x08.
- Botón 6 (DPI): reset da `21 55 00 00` (type 0x21, code 0x55), pero al guardar Disable la web lo había
  reescrito como `F0 01 01 00`. Son dos codificaciones del mismo botón; la 0x55 es la que escribe el reset.
  Por eso `FF FF FF FF` solo aparece en un mouse que nunca se tocó desde la web.
- Para la app: tratar `FF` como "por defecto" al leer, y al escribir usar siempre la tabla explícita.

### Captura `08-varias.json` (vs `07-reset-keys.json`)

- `light_mode` `r[9]`: 0 -> 5. El rango no es 0-3: al menos hay un valor 5. Pendiente anotar qué efecto eligió el usuario.
- `scroll_flag` `r[48]`: 1 -> 0 (volvió a Forward).
- Sin cambios en `key_respond`, `sleep_light`, `report_rate`, `lod`, `highspeed` ni DPI.

### Modos de luz (`scripts/watch.js`, el usuario presionó el botón de luz del mouse)

- `light_mode` (`r[9]`) es el **efecto actual** y el propio mouse lo cambia al presionar su botón de luz.
- Ciclo observado: `0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 0`. Son **7 modos (0-6)**, no 0-3 como suponía el código.
- En pulsaciones rápidas aparecieron saltos (`5 -> 0`, `3 -> 5`): es el sondeo de 300 ms que se pierde pulsaciones, no modos omitidos. Pendiente confirmar yendo despacio.
- Falta saber qué efecto es cada número (el usuario los eligió en la web, sin nombres anotados).

### Tabla de `light_mode` (descripción del usuario, mouse leído en 0 = arcoíris)

| valor | efecto observado |
|---|---|
| 0 | arcoíris (estado inicial) |
| 1 | colores que pasan uno por uno, ~1.5 s cada uno |
| 2 | arcoíris más rápido |
| 3 | colores que pasan, algo más rápido que el anterior (descripción dudosa) |
| 4 | colores que pasan, ~1 s (descripción dudosa; el usuario lo comparó con el 1) |
| 5 | un color aparece, se desvanece y cambia, cada 1.5-2 s ("respiración") |
| 6 | sin luces |

- Falta verificar 3 y 4 con la web, que debe mostrar el nombre de cada efecto.
- No hay color configurable: solo se guarda el número del efecto.

### Captura `09-dpi.json` (vs `08-varias.json`)

- `dpi_index` `r[12]`: 5 -> 6 (nivel 6 = 3200 DPI). Es el único cambio hecho desde la web.
- `r[9]` (`light_mode`) 5 -> 1 y `r[3]` (checksum) cambiaron por el botón de luz y por el checksum, no por la web.
- Ningún otro byte cambió, incluidos `r[54]` y `r[55]`. La lectura no muestra la trama de escritura,
  así que el posible error de `wakeup_flag` en `writeConfig` sigue sin resolverse.

## Dongle 2.4G (captura `10-actual.json`, 2026-10-23)

- Aparece como `AJAZZ 2.4G` (vendorId 43173). La misma interfaz de control y los mismos comandos funcionan.
- **Online:** `r[8] = 2` con el dongle (por cable era 0). Confirma que online solo aplica al 2.4G.
- **Batería:** `r[8] = 94`, `r[9] = 0` (no está cargando).
- **`r[54]` de readConfig es la batería** (100 -> 94, igual que `battery r[8]`). No es `wakeup_flag`: es solo lectura.
  Esto aclara el posible error de `writeConfig`: poner `wakeup_flag` en `f[55]` pisaría el campo de batería.
- **Report rate:** `r[10]` pasó de 4 (cable, 1000 Hz) a 1 en 2.4G. Falta saber a cuántos Hz corresponde el 1
  (anotar el valor que muestra la web). Con la tabla de la web sabremos si 1 = 125 Hz, etc.
- `dpi_index` bajó a 5 (2400 DPI) por un cambio del usuario en la web.
- El bloque `version` cambió en `r[20..63]` (cadenas de compilación distintas: el dongle tiene su propio firmware
  con fechas propias); `r[23..25]` sigue siendo `220`.

### Report rate (`r[10]`)

- La web ofrece 125, 250, 500 y 1000 Hz. Con el cable `r[10] = 4` era 1000 Hz, por lo que el mapeo probable es
  `1 = 125`, `2 = 250`, `3 = 500`, `4 = 1000`. En 2.4G se leyó `1` (125 Hz).
- Inferido por orden, **sin confirmar**: falta ver qué opción muestra seleccionada la web con el dongle,
  o cambiarla y comparar.

- **Confirmado** (`11-500hz.json`): al elegir 500 Hz en la web, `r[10]` pasó de 1 a 3. El mapeo
  `1=125, 2=250, 3=500, 4=1000` queda validado. `decodeConfig` devuelve `r[10] - 1` (0-3) en `report_rate`.

## Tramas reales de la web (captura `12-web-sendreport.txt`, WebHID `sendReport`)

Log hecho con el hook de `HIDDevice.prototype.sendReport`. WebHID entrega 64 bytes sin Report ID, así que
**el índice del log es el mismo que el índice `r[]` de las respuestas** (y es `f[i+1]` en nuestros frames de 65 bytes).
Cada trama aparece duplicada en el log porque el hook se pegó dos veces; no son envíos dobles de la web.

- **`writeConfig` está bien.** Construyendo el frame con `cmd.writeConfig()` salió **idéntico byte a byte** a
  las dos tramas capturadas (con `wakeup_flag` 0 y 1). El aviso anterior queda descartado: `wakeup_flag` va en
  `f[55]` (= log `[54]`). La lectura lo devuelve en `r[55]` porque la respuesta intercala la batería en `r[54]`.
- `[2..3]` de la cabecera es una **constante por comando**, no un checksum: `0f -> ae 0a`, `09 -> a5 22`,
  `10 -> a5 22`, `0d -> 00 00`. No cambió al cambiar un dato (`wakeup_flag` 0 -> 1).
- `report_rate` 250 Hz se escribió como `[10] = 02`, lo que confirma la tabla 1=125 / 2=250 / 3=500 / 4=1000.
- **Escritura de botones: comando `0x09`**, cabecera `55 09 a5 22 31 00 00 00`, longitud `0x31` (49). Datos desde `[8]`:
  8 entradas de 4 bytes (la tabla de fábrica `20 01 / 20 02 / 20 04 / 20 08 o 00 / 20 10 / 21 55 / 21 38 01 / 21 38 ff`).
- **Confirmación `0x10`:** `55 10 a5 22 00 00 00 05`, igual que `macroWriteFrames` y que el cierre de la escritura de macros.

### Macros (comando `0x0D`)
- Cabecera: `55 0D 00 00 <len> <addrLo> <addrHi> 00` y datos desde `[8]`, en bloques de hasta 56 bytes.
  Se cierra con `0x10`.
- Memoria: `[0..55]` empieza con `40 00` = dirección de inicio de la macro 0 (**0x40 = 64**). `[56..63]` son ceros.
  Los eventos empiezan en `[64]`.
- Cada evento mide **4 bytes**: `0A 00` (retardo, 10 en LE) + 2 bytes `<código con banderas> <tipo>`.
  Se escribe toda la macro cada vez (4, 6 u 8 eventos en las capturas).
- Banderas del byte de código, hipótesis a verificar: `0x40` = pulsar, sin bandera = soltar, `0x80` = último evento.
  Secuencia de la macro de 8 eventos: `43 01, 03 01, 42 04, 02 04, 42 04, 02 04, 43 01, 83 01`.
  El tipo parece ser `01` y `04` (¿teclado y mouse?). Falta saber qué teclas/clics grabó el usuario para fijar el mapeo.

### Formato de evento de macro (resuelto con la captura de pantalla de la web)

La macro "Super Macro" era: Mouse L Press, Mouse L Release, A Press, A Release, A Press, A Release,
Mouse L Press, Mouse L Release, todos con delay 10. Cruzado con los 8 eventos escritos
(`43 01, 03 01, 42 04, 02 04, 42 04, 02 04, 43 01, 83 01`):

Evento de 4 bytes: `[delayLo, delayHi, flags, code]`
- `delay` = u16 LE en ms (`0A 00` = 10).
- `code`: **mouse L = `01`** (máscara de botón), **A = `04`** (código HID de teclado).
- `flags` (bits bajos): `3` = mouse, `2` = teclado. `0x40` = **Press Down**, sin esa bandera = **Release**.
  `0x80` = **último evento** (el último release salió como `83 01`).
- Ejemplos: Mouse L Press = `0A 00 43 01`; Mouse L Release = `0A 00 03 01`;
  A Press = `0A 00 42 04`; A Release = `0A 00 02 04`.
- Los nombres de macro ("Super Macro", "Macro2") no aparecieron en ninguna trama: la web los guarda en el
  navegador, no en el mouse. Pendiente: cómo se asigna una macro a un botón (entrada de la tabla de botones).

## Asignación de botones y macros (captura `13-asignaciones.txt`, con sendReport e inputreport)

Todo se escribe en la entrada 4 (Backward) de la tabla de botones (comando `0x09`, ver arriba):

| asignación | entrada (4 bytes) |
|---|---|
| Teclado, Alt+F | `10 04 09 00` = tipo `0x10`, modificadores (Ctrl 1, Shift 2, Alt 4, Win 8), código HID (F = 9) |
| Macro "Super Macro", Loop Count 1 | `70 00 01 00` = tipo `0x70`, índice de macro, veces, modo de bucle |
| Macro, otras opciones de bucle | `70 00 01 02` y `70 00 01 03` (a verificar cuál es cuál) |
| Mouse | `20 <máscara> 00 00` (ya conocido) |

- Modos de bucle de la web: "Loop Until Key is Released", "Loop Until Any Key is Pressed", "Loop Count".
  Por el orden de los clics, `2` = hasta soltar y `3` = hasta pulsar otra tecla; `0` = contar (con el número en byte 2).
  Sin confirmar: no sé en qué orden hizo los clics el usuario.
- **Toda escritura recibe eco**: la respuesta repite los datos con `aa` en `[0]` y checksum en `[3]`
  (`aa 09 a5 61 31 ...`). La confirmación `0x10` responde `aa 10 a5 05 00 00 00 05`.
- Comandos de lectura de la web, para la app: `0x03` versión, `0x30` batería (`r[8]` = %, `r[9]` = carga),
  `0xED` online (`r[8] = 2` con dongle), `0x08` botones, `0x0E` configuración.
- Las macros no se leen del mouse en estas capturas: la web solo las escribe. La app debe guardar las macros
  localmente (igual que la web, que guarda sus nombres en el navegador).
- Mensaje no solicitado `aa fa a5 6a 38 00 00 05 d0 5d` al final: evento del mouse sin identificar; ignorar por ahora.

## Restore Factory Settings (captura del botón de la web, 2026-10-23)

La web **sí** implementa el reset, aunque `restoreFactorySettings(){}` esté vacío: el botón dispara tres escrituras
seguidas (índices = log de `sendReport`, 64 bytes sin Report ID). No toca las macros (no hay `0x0D` ni `[6,15,4]`).

1. **Botones (`0x09`)**, longitud `0x20` (no `0x31`): `20 01 / 20 02 / 20 04 / 20 08 / 20 10 / 21 55 / 21 38 01 / 21 38 ff`.
2. **Configuración (`0x0F`)** con valores de fábrica:

| campo | índice | valor |
|---|---|---|
| light_mode | `[9]` | 0 (arcoíris) |
| report_rate | `[10]` | 4 (1000 Hz) |
| dpi_count | `[11]` | 5 |
| dpi_index + 1 | `[12]` | 2 (nivel 2 = 800 DPI) |
| DPI 1..6 | `[13..24]` | 400/800/1200/1600/2400/3200 (se guardan 6, pero count = 5) |
| scroll_flag | `[48]` | 0 |
| lod_value | `[49]` | 1 |
| sensor_flag | `[50]` | `0x35` (53, ¿máscara de bits?) |
| key_respond | `[51]` | 4 |
| sleep_light | `[52]` | 10 min |
| highspeed_mode | `[53]` | 0 |
| wakeup_flag | `[54]` | 0 |

3. **Modo de luz (`0x21`)**: `55 21 00 00 03 00 00 00 00 ...` (modo 0 en `[11]`). El mouse repite el eco `aa 21 ...`.

- Tras el `0x0F` el mouse emite dos mensajes no solicitados `aa fa ae 23 0a 01 01 01 10 02 04` (evento de cambio de
  configuración; ignorar por ahora).
- Antes, la configuración en el mouse tenía `lod 0xFF` y `highspeed 0xFF` ("sin configurar"); el reset los fija en 1 y 0.
- Para la app: `factoryReset()` = escribir botones de fábrica + `writeConfig` con esta tabla + luz 0, sin tocar macros.

## Datos extraídos del código de la web (2026-10-23, `page-8ebf300afffc81d0.js` y chunks 968/249)

Sin hardware: leído del bundle público. Lo que contradice una observación con el mouse queda marcado.

- **Catálogo de acciones** (JSON `j.B.p`): copiado a `src/catalog.js`. Multimedia usa `30 <lo> <hi> 00` con el
  código "consumer" HID de 16 bits (p. ej. Calculadora `30 92 01`, Home `30 23 02`). Teclado `10 <mods> <hid> 00`;
  modificadores: LCtrl 1, LShift 2, LAlt 4, LWin 8, RCtrl 0x10, RShift 0x20, RAlt 0x40.
- **Modos de bucle de macro (confirmado en el código):** `2` = "Loop Until Key is Released", `3` = "Loop Until Any Key
  is Pressed", `0` = "Loop Count" (veces en el byte 2).
- **Tabla de macros (función `eI` de la web):** buffer de 64 bytes de cabecera + eventos. La dirección u16 LE de la
  macro `i` va en `[2*i]`; una macro vacía no recibe dirección (queda `00 00`). Los eventos de todas las macros van
  seguidos desde `0x40`. Flags del evento: mouse `3`, teclado `2`, un tercer tipo `4` (sin uso en la UI), `0x40` = pulsar,
  `0x80` = último evento de esa macro. Máximo 32 macros por la tabla (*inferido* del tamaño de la cabecera).
  Con hardware solo se probó la macro 0. Códigos de mouse en macros: L 1, R 2, M 4, Atrás 8, Adelante 0x10.
- **Mensajes `aa fa` no solicitados:** si `r[8] = 0xD0` es batería (`r[9]` %, `r[10]` carga); si no, es estado:
  `r[9]` = nivel de DPI (desde 1) y `r[10]` = report rate (desde 1). El `aa fa ae 23 0a 01 01 01 10 02 04` tras el
  reset es nivel 2 y 1000 Hz, coherente con la configuración de fábrica.
- **Report rate:** la web solo ofrece 1000 Hz por cable (`reportRate: {USB: [1000], "2.4G": [125, 250, 500, 1000]}`)
  y fuerza `report_rate = 3` al guardar en modo USB.
- **`sensor_flag` es una máscara:** bit `1` = Ripple Control, `0x10` = Linear Correction, `0x20` = Motion Sync.
  El valor de fábrica `0x35` tiene además los bits `4` (sin nombre en la UI).
- **`lod_value`:** `1` = 1 mm (bajo), `2` = 2 mm (alto).
- **`sleep_light`:** opciones 1, 3, 5, 10, 20, 30 y 60 minutos.
- **`key_respond` y `highspeed_mode`** no tienen control en la UI de la web (los textos "Button Delay Response (ms)"
  y "Game Safe Mode" existen pero no se usan). La app los muestra como avanzados.
- **Efectos de luz:** los nombres en orden son Wave, Neon, Cycling Flash, YOYO Ball, Single Flash, Breathing Loop, Off.
  La web los asigna a los valores 1..6 y Off = 0, pero **con el mouse** se observó 0 = arcoíris y 6 = apagado,
  5 = respiración. La app usa el orden observado (0 = Wave ... 5 = Breathing Loop, 6 = Off); *a confirmar* el 1-4.

## Dongle sin mouse (2026-10-23, `probe.js --raw` con el mouse dormido)

- `online` responde `r[8] = 1`: el dongle está enchufado pero el mouse no está enlazado (apagado o dormido).
  Valores vistos: `0` = cable, `1` = dongle sin mouse, `2` = dongle con mouse en línea.
- En ese estado el dongle responde por su cuenta: `readConfig` con `r[4] = 0x2e`, DPI todo `FF` y la cola en `FF`;
  `readButtons` todo `FF`; `version` trae el firmware del dongle (`r[20..22] = "273"`, `r[23..25] = "220"`).
- La app no lee ni escribe la configuración hasta que `online` devuelve `2`.

## Checksum de la batería por el dongle (2026-10-23)

- Por el dongle con el mouse en línea, la respuesta de `0x30` trae siempre `r[3] = 0x0b`: es un eco del byte `[3]`
  de la petición (`55 30 a5 0b`), no el checksum (en las capturas 10, 11 y en el respaldo actual el checksum daría
  `0x6a`, `0x6d` y `0x66`). Por cable y con el dongle sin mouse sí es el checksum.
- `version`, `online`, `readConfig` y `readButtons` cumplen el checksum también por el dongle.
- La app valida el checksum en esas cuatro lecturas y, en la batería, solo el eco del comando.
