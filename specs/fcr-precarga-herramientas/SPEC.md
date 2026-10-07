# Spec: Precarga de herramientas en FCR, separando la movilización

## Objetivo

Que al crear un ticket FCR desde un Pedido, la fase **Preparación de Herramientas** llegue con las
herramientas físicas ya cargadas, listas para "Solicitar a Bodega". La **movilización** del Pedido
tiene que verse aparte, solo como información, sin ninguna acción de Bodega.

### Problema actual (verificado en BD local: Pedido 4332 → FCR-209)
1. En FCR, el diálogo del Pedido marca **todas** las líneas como `esHerramienta`
   (`nuevo-pedido-dialog.ts:1086`, `l.esHerramienta || this.esFcr()`), incluidas las de movilización
   (`SFS6146`, `SFS6147`).
2. `resolverHerramientasDelPedido` (backend, `facturacion-domain.service.ts:201`) cruza esos códigos
   contra Inventario, categoría `HERRAMIENTAS`. Pero las líneas del Pedido son **códigos de Lista de
   Precios** (`SH1101`, `SFS6057`, …) y no existen como artículo en ninguna categoría. Resultado:
   `tools: []`, la tabla queda vacía.
3. Una línea de servicio agrupa varias herramientas físicas: `SH1101` "Sarta de limpieza 7''" incluye
   casing scraper, cepillo, magneto y canasta. No existe una relación 1 a 1 entre código y herramienta.

### Decisiones tomadas (2026-10-07)
| Tema | Decisión |
|---|---|
| Dónde se clasifica cada línea | En una **tabla propia por cliente + código** (`ConfiguracionCodigoFcr`), aparte de la Lista de Precios: `Herramienta` / `Movilización` / `Servicio`. Todo Pedido lo hereda por código. *(Primero se eligió la Lista de Precios, pero esa tabla solo se actualiza con `import-datos-reales.ts`, que borra y vuelve a crear los ítems: la configuración se perdería en cada importación.)* |
| Cómo se pasa de código de servicio a herramientas físicas | **Kit por código**: cada código `Herramienta` lleva la lista de artículos de Inventario (`HERRAMIENTAS`) con cantidad. |
| Alcance del kit | **Por cliente** (`clienteId` + `codigo`), no global por código. |
| Quién configura | Ingeniería de Ventas FCR y administradores (permiso nuevo `fcrConfiguracionCodigos`). Ingeniería de Ventas no: Ventas y FCR no se cruzan. Lectura: los roles de FCR (`fcrRead`). |
| Cuántos juegos se piden | **Un juego por unidad cotizada** (2 Corridas = 2 juegos), **salvo si la unidad es de tiempo** (día, hora, mes, semana): entonces se pide **1 juego**, porque la cantidad son días de renta. |
| Tickets ya creados | Botón **"Recargar desde el Pedido"** para el Supervisor. |
| Movilización | **Solo se muestra.** No alimenta el Gerenciamiento de Viaje. |
| De dónde sale la movilización (2026-10-07, revisión) | **Del formulario del Pedido**: tipo de línea nuevo **"Movilización"**. Nada se inventa: el código, la descripción, la unidad y el precio salen de la Lista de Precios; solo se edita lo que el formulario permite. Las herramientas siguen con los kits. |
| Qué códigos ofrece | Los ítems de la Lista de Precios del cliente cuya descripción dice "Movilización"; si el cliente no tiene lista, los de la lista **Normal** (referencia interna). |
| Precio | De la lista del cliente → **fijo**. De la Normal ($0.01 de relleno) → **editable con aviso** "precio de referencia, no pactado con el cliente". |
| Prefactura | Si el código de una movilización no está en la lista del cliente, se cobra **el precio del Pedido** (el de la cotización). |
| Clase "Movilización" en Códigos por cliente | **Se quita**: una sola fuente. Esa pantalla queda para herramientas (kits) y servicio. |

## Diseño

### 1. Configuración por cliente y código (`ConfiguracionCodigoFcr`)
```prisma
model ConfiguracionCodigoFcr {
  id        Int      @id @default(autoincrement())
  clienteId Int                       // ClienteCatalogo
  codigo    String                    // código de la Lista de Precios / del Pedido
  clase     String                    // 'herramienta' | 'movilizacion' | 'servicio'
  kit       String   @default("[]")   // JSON: { articuloId, cantidad }[] — solo para 'herramienta'
  updatedAt DateTime @updatedAt
  @@unique([clienteId, codigo])
}
```
```ts
export type ClaseOperativa = 'herramienta' | 'movilizacion' | 'servicio';
export interface KitItem { articuloId: number; cantidad: number } // Articulo HERRAMIENTAS (tiene BOM)
```
Un código sin fila en esta tabla se trata como `servicio`: no genera ninguna acción.
> Revisión 2026-10-07: la clase `movilizacion` se quita de esta tabla — la movilización la marca el
> Pedido (sección 2). Quedan `herramienta` y `servicio`.

API (dominio Operaciones, carpeta `fcr-configuracion-codigos/`, prefijo `/api/operations/fcr/configuracion-codigos`):
- `GET ?clienteId=` → códigos de las listas activas del cliente (sin precios) con su clase y kit, más las configuraciones huérfanas.
- `PUT` → upsert por `(clienteId, codigo)`; valida que la clase sea una de
  las 3, que solo `herramienta` lleve kit, y que cada `articuloId` sea un artículo `HERRAMIENTAS` activo.
- `DELETE /:id`.

Pantalla nueva (ruta lazy en FCR): se elige el cliente; se listan los códigos de **su** Lista de
Precios (solo lectura), y en cada uno se elige la clase y, si es `herramienta`, se arma su kit (select
con búsqueda sobre `HERRAMIENTAS` + cantidad).

### 2. Pedido: tipo de línea "Movilización" y fin del forzado de `esHerramienta`
- `ItemEstimado.esMovilizacion?: boolean` (va en el JSON del Pedido, sin cambio de schema).
- El select de tipo de línea suma **Movilización**. Su código se elige (no se tipea) de los ítems
  `/moviliz/i` de la Lista de Precios del cliente, o de la Normal si el cliente no tiene lista.
  Descripción y unidad salen del ítem. Precio: fijo si viene de la lista del cliente; editable con
  aviso si viene de la Normal.
- Al cargar la plantilla Excel, una línea cuyo código es de movilización en esa lista se marca sola
  (igual que hoy químicos y herramientas).
- Se quita `|| this.esFcr()` de `nuevo-pedido-dialog.ts` (líneas 354, 1086 y el `.html` 253/284/288).

### 3. Backend: resolución al crear el ticket
`resolverHerramientasDelPedido` sale de `facturacion-domain.service.ts` a un servicio propio del
dominio Facturación (`precarga-fcr.service.ts`, una sola responsabilidad) con un método público
`resolverPrecarga(pedido)`. Lo usan la creación del ticket y la recarga (sección 5). La dependencia
sigue en una sola dirección: `operaciones → facturacion`.

`resolverPrecarga` hace esto:
1. Lee las filas de `ConfiguracionCodigoFcr` del `clienteId` del Pedido.
2. Por cada línea de `itemsEstimados`, toma su configuración por código (sin fila = `servicio`):
   - `herramienta` → expande el `kit` en `FcrTool` (`origen: 'pedido'`, `articuloId`, `stockDisponible`).
     Juegos = `1` si la unidad es de tiempo (`/^(d[ií]a|hora|mes|semana)s?$/i`); si no,
     `Math.ceil(cantidad)`. Cada herramienta física es **una fila**: un kit con 2 cepillos × 2 juegos
     da 4 filas de cepillo, porque Bodega, Recepción y el checklist se marcan por herramienta.
   - Línea con `esMovilizacion` → va a `ticket.movilizaciones` (snapshot: código, descripción,
     cantidad, unidad). Tiene prioridad sobre la configuración.
   - `servicio` / sin clase → no genera nada.
3. Agrega al ticket `avisosPrecarga: { motivo, codigo?, descripcion? }[]` para avisarle al Supervisor
   en vez de fallar en silencio. Motivos: `pedido_sin_cliente`, `sin_configurar`, `kit_vacio`,
   `articulo_inactivo`.
4. Compatibilidad: una línea sin configurar cuyo código ES una herramienta `HERRAMIENTAS` activa se
   sigue precargando como antes (kit de sí misma).
5. Cada herramienta lleva `codigoPedido` (la línea de la que salió). No se llama `codigo`: la
   prefactura cobra por `tool.codigo` y habría cobrado dos veces.

Todo queda dentro del JSON del ticket FCR. El único cambio de schema Prisma es la tabla nueva
`ConfiguracionCodigoFcr` (ver Límites). Si el Pedido no tiene `clienteId`, no se precarga nada y la
línea queda como aviso.

### 4. Frontend FCR: Preparación de Herramientas
El recuadro "Actividades según el Pedido" se divide en dos:
- **Herramientas (se solicitan a Bodega)**: líneas `herramienta`, cada una con las herramientas de
  su kit. Si alguna está en `avisosPrecarga`, se muestra un aviso: "Sin kit configurado en la Lista de
  Precios — agregue las herramientas manualmente".
- **Movilización (informativo, no requiere acción)**: `ticket.movilizaciones`, sin botones.

La tabla de herramientas y el flujo Bodega → Recepción → Mecánico no cambian.

### 6. Prefactura: movilización fuera de la lista del cliente
Ya funcionaba así: `armarPrefacturaItems` cobra toda línea cuyo código no está en la Lista de Precios
del cliente (o si no tiene lista) con los datos del Pedido (`descripcion`, `unidad`, `valorUnitario`),
como `fuente: 'personal_manual'` para que Facturación la revise. Se dejó cubierto con tests.

### 5. Recargar desde el Pedido
Endpoint de FCR `POST /fcr-tickets/:id/recargar-desde-pedido` (Supervisor, solo en
`preparacion_herramientas` y con `toolListConfirmed = false`). Vuelve a llamar a `resolverPrecarga`
y:
- **Quita** solo las herramientas `origen: 'pedido'` que todavía están en `seleccionada` y sin
  `sentToBodega`.
- **Agrega** las que resuelve el kit y que no quedaron ya en la lista (las enviadas a Bodega se
  conservan y cuentan como ya cargadas).
- **No toca** las `origen: 'manual'`.
- Reemplaza `movilizaciones` y `avisosPrecarga`.

En el front es un botón de icono con tooltip "Recargar desde el Pedido", con confirmación.

## Comandos
```
Front:  npm run build · npm test
Back:   npm run build · npm test · npx prisma migrate dev --name lista_precios_clase_kit
```
(No se levantan servidores: el usuario prueba en local.)

## Estructura
- Front: `features/facturacion/models/lista-precios.model.ts`, `pages/lista-precios-detail-page/`,
  `components/nuevo-pedido-dialog.*`, `features/operations/fcr/models/fcr.model.ts`,
  `features/operations/fcr/pages/ticket-detail-page/`.
- Back: `prisma/schema.prisma` (tabla nueva), `libs/domains/operaciones/src/fcr-configuracion-codigos/`,
  `libs/domains/facturacion/src/facturacion-domain.service.ts` y `precarga-fcr.service.ts`.
  La Lista de Precios **no se toca**.

## Estrategia de pruebas
- Back (unit): `resolverHerramientasDelPedido` con un Pedido de 1 herramienta con kit de 4 artículos,
  1 herramienta sin kit y 2 movilizaciones → 4 tools, 1 `avisosPrecarga`, 2 `movilizaciones`.
- Front (unit): Preparación de Herramientas muestra los dos bloques y el aviso de "sin kit".
- Manual: crear un Pedido FCR con la plantilla del 4332 → el ticket nace con las herramientas del
  kit de `SH1101`/`SFS6057`, y `SFS6146`/`SFS6147` aparecen solo en Movilización.

## Límites
- **Siempre:** Clean Code/SOLID, signals/OnPush, acciones como botones de icono con tooltip, AXE/WCAG AA.
- **Preguntar antes:** la migración Prisma de `ConfiguracionCodigoFcr`; cualquier cambio en cómo factura
  la prefactura.
- **Nunca:** cambiar el flujo Bodega → Recepción → Mecánico; reabrir la edición de la Lista de Precios; tocar tickets existentes en BD sin pedirlo.

## Criterios de éxito
- [ ] Un código de la Lista de Precios de un cliente se puede clasificar y, si es `herramienta`, tener un kit; la configuración sobrevive a `import-datos-reales.ts`.
- [ ] Un ticket FCR nuevo nace con las herramientas de los kits, con `origen: 'pedido'`.
- [ ] Las líneas de movilización aparecen solo en el bloque informativo, sin fila en la tabla y sin acciones.
- [ ] Una línea `herramienta` sin kit muestra el aviso y no rompe la creación del ticket.
- [ ] 2 Corridas → 2 juegos; 2 días → 1 juego.
- [ ] En el Pedido se agrega una línea "Movilización" eligiendo un código de movilización de la lista del cliente (o la Normal), con su precio; con la Normal el precio es editable y se avisa.
- [ ] La prefactura cobra una movilización tomada de la Normal con el precio del Pedido.
- [ ] "Recargar desde el Pedido" en FCR-209 carga las herramientas y no toca las ya enviadas a Bodega ni las manuales.
- [ ] La prefactura de un Pedido FCR factura lo mismo que antes del cambio (regresión).

## Riesgos
- **Facturación:** `facturacion-domain.service.ts:1089` omite las líneas `esHerramienta` que ya se
  facturan por el Reporte de Herramientas. Al dejar de forzar `esHerramienta` en FCR, hay que
  confirmar que la prefactura no empieza a cobrar dos veces. Se cubre con el criterio de regresión.
- **Código que cambia en una reimportación:** si AS2 renombra un código, su configuración queda
  huérfana y la línea se trata como `servicio`. La pantalla de configuración marca las filas cuyo
  código ya no está en la Lista de Precios del cliente.

## Preguntas abiertas
Ninguna. Se resolvieron el 2026-10-07 (ver Decisiones tomadas).
