# Tareas: Precarga de herramientas en FCR

Spec: [SPEC.md](SPEC.md) · Plan: [plan.md](plan.md)

## Fase 1 — Configurar kits

### B1: Backend — tabla `ConfiguracionCodigoFcr` + API  (M) ✅ 2026-10-07 — unit (10) + e2e `fcr-configuracion-codigos` (5); suites completas en verde (120 unit, 33 e2e)
- [x] Modelo Prisma `ConfiguracionCodigoFcr` (`clienteId`, `codigo`, `clase`, `kit` JSON, `@@unique([clienteId, codigo])`) y migración **(pedir confirmación antes de correrla)**.
- [x] `GET ?clienteId=`, `PUT` (upsert por cliente + código) y `DELETE :id`; escritura con `fcrConfiguracionCodigos` (Ventas, Ventas FCR y admins; `catalogosWrite` es de ubicación y no incluye a Ventas FCR), lectura además con `fcrRead`.
- [x] Validación: clase entre las 3; kit solo en `herramienta`; cantidad entera ≥ 1; cada `articuloId` es `HERRAMIENTAS` activo (si no, 400).
- [x] La Lista de Precios y `import-datos-reales.ts` no cambian.
- [x] `articulosRead` incluye a Ventas FCR (sin eso no podía leer el catálogo de HERRAMIENTAS, tampoco en el Pedido).
- Verificar: unit del service + e2e `test/fcr-configuracion-codigos.e2e-spec.ts`, `npm run build` (backend).
- Archivos: `prisma/schema.prisma`, `libs/domains/operaciones/src/fcr-configuracion-codigos/{dto,service,controller}.ts` (+ specs), el módulo de Operaciones.

### F1: Frontend — pantalla de configuración de códigos por cliente  (M) ✅ código 2026-10-07 — falta revisión manual + AXE del usuario
- [x] Modelo puro (`models/fcr-configuracion-codigos.ts`, spec 9 tests) y servicio.
- [x] Ruta lazy `/modulos/operativo/fcr/configuracion-codigos` (Superadmin, Jefe de Base, Ventas FCR) + entrada "Códigos por cliente" en el menú de Ventas FCR y Superadmin (spec de navegación).
- [x] Cliente en la URL (`?cliente=`), `rxResource` para la carga, búsqueda, chips por clase y paginación de 25.
- [x] Diálogo "Configurar" (clase + kit) con validación previa; quitar configuración con confirmación; botones de icono con tooltip.
- [x] Marca las configuraciones huérfanas.
- [x] Backend: el `GET` devuelve los códigos de las listas activas del cliente **sin precios** + su configuración (Ventas FCR no puede leer la Lista de Precios); escritura solo Ventas FCR y admins.
- [ ] Revisión manual del usuario y AXE sin errores.
- Archivos: `fcr/models/fcr-configuracion-codigos{,.spec}.ts`, `fcr/services/fcr-configuracion-codigos.service.ts`, `fcr/components/configurar-codigo-dialog.*`, `fcr/pages/configuracion-codigos-page/*`, `fcr.routes.ts`, `layout/navigation/navigation.service{,.spec}.ts`.

### Checkpoint 1
- [ ] Builds y tests en verde en los dos repos.
- [ ] Usuario: configura `SH1101` y `SFS6057` como herramienta con su kit, y `SFS6146`/`SFS6147` como movilización, para el cliente del 4332, y siguen ahí después de correr `import-datos-reales.ts`.

## Fase 2 — El ticket nace con herramientas

### B2: Backend — `PrecargaFcrService` y creación del ticket  (M) ✅ 2026-10-07 — unit 13 + regresión de prefactura + e2e `fcr-precarga` (3); suites completas en verde (135 unit, 38 e2e)
- [x] `juegosPorLinea(unidad, cantidad)`: unidad de tiempo → 1; si no, `Math.ceil(cantidad)`, mínimo 1.
- [x] `PrecargaFcrService.resolver(pedido)` → `{ herramientas (sin id), movilizaciones, avisos }`; una fila por herramienta física con `codigoPedido`; stock en una sola consulta agrupada.
- [x] `avisos` con motivo (`pedido_sin_cliente`, `sin_configurar`, `kit_vacio`, `articulo_inactivo`) en vez de una lista `lineasSinKit`: se pueden sumar motivos sin cambiar el contrato.
- [x] Compatibilidad: una línea sin configurar cuyo código ES una herramienta de Inventario se sigue precargando (comportamiento previo).
- [x] `ticketFcrInicial` guarda `tools`, `movilizaciones` y `avisosPrecarga`; se borró `resolverHerramientasDelPedido`. Los Pedidos de AS2 ahora pasan `clienteId` e `itemsEstimados` al ticket.
- [x] Regresión: la prefactura del 4332 da lo mismo con y sin `esHerramienta` ($4892.41). El campo nuevo se llama `codigoPedido` y **no** `codigo` a propósito: la prefactura cobra por `tool.codigo`, y con ese nombre habría cobrado cada herramienta además de su línea.
- Archivos: `precarga-fcr/precarga-fcr.service{,.spec}.ts`, `facturacion-domain.service.ts`, `facturacion-domain.prefactura.spec.ts`, `facturacion.module.ts`, `index.ts`, `test/fcr-precarga.e2e-spec.ts`.

### B2b: Backend — la movilización sale del Pedido  (S)  *(revisión 2026-10-07)* ✅ 2026-10-07 — 138 unit, 38 e2e
- [x] `PrecargaFcrService`: una línea `esMovilizacion` va a `movilizaciones`, con prioridad sobre la configuración (también sin cliente).
- [x] `CLASES_OPERATIVAS` queda en `herramienta` | `servicio`; el `PUT` rechaza `movilizacion` (400).
- [x] Filas viejas con una clase retirada se leen como sin configurar y la precarga las ignora (sin migración de datos).
- [x] Tests unitarios y e2e (`fcr-precarga`, `fcr-configuracion-codigos`) actualizados.

### F1b: Frontend — quitar "Movilización" de Códigos por cliente  (XS) ✅ 2026-10-07
- [x] `CLASES_OPERATIVAS`, labels, chips y textos sin `movilizacion`; la descripción de "Servicio" aclara que la movilización se marca en el Pedido.

### F2: Frontend Pedido — tipo de línea "Movilización" + dejar de forzar `esHerramienta` en FCR  (M) ✅ código 2026-10-07 — falta revisión manual + AXE del usuario
- [x] `ItemEstimado.esMovilizacion?` en `pedido.model.ts`.
- [x] FCR: columna Tipo con Servicio / Herramienta / Movilización. Servicio y Movilización eligen el código de la Lista de Precios del cliente (o la Normal si no tiene) y autocompletan descripción, unidad y precio; ya no hay código de texto libre en FCR. Pumping no cambia.
- [x] Movilización: precio fijo si está en la lista del cliente; editable con aviso "precio de referencia (lista Normal), no pactado con el cliente" si no.
- [x] La plantilla Excel marca sola las líneas de movilización (si el código no es herramienta ni químico).
- [x] Sin `|| this.esFcr()` en `esHerramienta`; las listas pasan a un signal (`listas`) para que las opciones reaccionen.
- [x] Lógica pura en `facturacion/models/lineas-lista-precios.ts` (spec 7 tests).
- [ ] Revisión manual del usuario y AXE sin errores.
- Archivos: `pedido.model.ts`, `nuevo-pedido-dialog.{ts,html}`, `models/lineas-lista-precios{,.spec}.ts`.

### B4: Backend — prefactura cobra la movilización fuera de la lista del cliente  (S) ✅ 2026-10-07 — **ya existía**, se agregaron tests
- [x] `armarPrefacturaItems` ya cobraba toda línea sin código en la lista del cliente (o sin lista) con `descripcion`/`unidad`/`valorUnitario` del Pedido, como `fuente: 'personal_manual'` para revisión de Facturación. No hizo falta cambiar código.
- [x] Tests de regresión: movilización de la Normal → precio del Pedido; sin lista → precio del Pedido; con lista del cliente → precio de la lista; el 4332 sigue en $4892.41.
- [x] Corregido el texto del Pedido que decía "no entra a la prefactura automática" (era falso) y su comentario.

### F3: Frontend FCR — "Actividades según el Pedido" + avisos de la precarga  (M) ✅ código 2026-10-07 — falta revisión manual + AXE del usuario
- [x] `fcr.model.ts`: `movilizaciones?`, `avisosPrecarga?` en el ticket y `codigoPedido?` en la herramienta.
- [x] "Actividades según el Pedido" en tres grupos: **Herramientas · se solicitan a Bodega** (con cuántas quedaron en la lista), **Movilización · informativa, no requiere acción** (la del ticket; en tickets anteriores, la que marca el Pedido) y **Otros servicios del Pedido** (nada queda oculto).
- [x] Recuadro "⚠ Revise la precarga de herramientas" con un texto por motivo que dice qué hacer.
- [x] Encabezado: "Precargadas de los kits del Pedido (Códigos por cliente)".
- [x] Lógica pura en `models/fcr-actividades-pedido.ts` (spec 4 tests); `<h3>` bajo el `<h2>` real de la sección; el aviso no depende solo del color (⚠ + texto).
- [ ] Revisión manual del usuario y AXE sin errores.
- Archivos: `fcr.model.ts`, `models/fcr-actividades-pedido{,.spec}.ts`, `ticket-detail-page.{ts,html,scss}`.

### Checkpoint 2
- [ ] Builds y tests en verde.
- [ ] Usuario: crea un Pedido FCR con la plantilla del 4332 → el ticket nace con las herramientas del kit y la movilización aparte.

## Fase 3 — Tickets ya creados

### B3: Backend — `POST /operations/fcr/tickets/:id/recargar-desde-pedido`  (M) ✅ 2026-10-07 — unit 8 + e2e 4; suites completas en verde (148 unit, 42 e2e)
- [x] `FcrRecargaService` propio (no se tocó el constructor de `FcrDomainService`; solo `nextGlobalToolId` pasó a público para no duplicarlo).
- [x] Guard de fase (`@WorkflowGate('fcr')`: en Preparación de Herramientas solo el Supervisor) + dominio: fuera de esa fase o con la lista cerrada → 409; sin Pedido → 400.
- [x] `reconciliarHerramientas` (pura): quita solo las del Pedido en `seleccionada` sin `sentToBodega`; las manuales y las ya enviadas se conservan y cuentan como cargadas (por línea + artículo, o por artículo en tickets anteriores); agrega lo que falta con ids globales; `addedLate` si el proceso ya avanzó; reemplaza `movilizaciones` y `avisosPrecarga`.
- Archivos: `fcr-tickets/fcr-recarga.service{,.spec}.ts`, `fcr-actions.controller.ts`, `fcr-domain.service.ts`, `operaciones.module.ts`, `test/fcr-precarga.e2e-spec.ts`.

### F4: Frontend FCR — botón "Recargar desde el Pedido"  (S) ✅ código 2026-10-07 — falta revisión manual del usuario
- [x] `fcr.service.ts`: `recargarDesdePedido(id)`.
- [x] Botón de icono `reload` (con tooltip) en "Actividades según el Pedido", solo para el Supervisor en la fase actual con la lista abierta; pide confirmación; muestra el motivo del backend si no se puede.
- [x] `ReloadOutline` registrado en `app.config.ts` (ng-zorro registra los íconos uno por uno).
- [x] De paso: los íconos `settings` (Códigos por cliente) y `add` (diálogo Configurar) no existen en ng-zorro y salían vacíos → `iconSource="dynadrill"`.
- Archivos: `fcr.service.ts`, `ticket-detail-page.{ts,html,scss}`, `app.config.ts`, `configuracion-codigos-page.html`, `configurar-codigo-dialog.html`.

### Checkpoint 3 — Completo
- [ ] Usuario: recarga FCR-209 y aparecen las herramientas.
- [ ] Criterios de éxito de la spec verificados.
- [ ] Revisión de código (`code-review-and-quality`) antes del commit.

## Ajustes pedidos durante la revisión (2026-10-07)

### Bitácora: campo Fecha y fechas del servicio del Pedido ✅ 2026-10-07
- [x] "Registrar actividad" tiene campo Fecha (antes la fecha era siempre hoy) en su propia fila (en la fila de horas aplastaba los selects de HH/MM).
- [x] La fecha tiene que estar dentro del servicio del Pedido (`fechaInicioServicio`–`fechaFinServicio`): el calendario deshabilita los días de afuera, se sugiere hoy o el día más cercano dentro, y se muestra el rango. Sin fechas en el Pedido no limita. Las fechas futuras dentro del servicio se permiten.
- [x] El backend lo valida también (`assertFechaEnServicio` en registrar y corregir día; 400 con el rango); la carga masiva por Excel salta y reporta las filas de afuera.
- [x] `toIso` en hora local: después de las 19:00 (UTC-5) los registros quedaban con la fecha de mañana.
- [x] PDF del Reporte Job: la fila del día va bajo Inicio/Fin/Horas con formato `27-ago-2026`, igual que el Excel.
- [x] Footer "gigante" en el detalle del ticket: los textos solo para lectores de pantalla (`position: absolute`) no tenían ancestro posicionado dentro del área con scroll y alargaban la página → `position: relative` en `.shell__content`. Falta confirmarlo en el navegador.
- [x] Uso de herramientas igual que la bitácora: fecha dentro del servicio (front + backend), confirmación antes de reemplazar el registro de la misma herramienta y día (antes se pisaba en silencio), tabla agrupada por día y mensaje del backend en los errores.
- [x] Rango del servicio como banner a todo el ancho arriba de "Ejecución del Trabajo"; bajo cada fecha solo el error.
- [x] Datos del Pedido (FCR y Pumping) en un componente compartido `app-pedido-datos`: grilla de orden de trabajo con líneas finas, cliente a toda la fila, ubicación a media fila, fecha de inicio y de fin separadas, etiquetas chicas en mayúsculas y valores en negrita; sin "Bloque BLOQUE 61".
- [x] Ítems estimados (FCR y Pumping) en `app-pedido-items`: cifras a la derecha con dígitos de ancho fijo, formato `es` y total como fila de pie.

## Revisión de código (2026-10-07) ✅
Dos revisores independientes (backend y frontend). Corregido antes de commitear:
- Backend: tope de 20 juegos por línea con aviso `cantidad_excedida` (kit `cantidad` 1..20, máx. 50 artículos);
  `itemsEstimados` mal formado se ignora (no rompe el puente AS2); códigos sin espacios sobrantes; formato
  `AAAA-MM-DD` obligatorio antes del rango de fechas; `close()` con guard de fase; comentario del schema.
- Front: fecha sugerida resuelta al guardar (no "ayer" pasada la medianoche); recargar vuelve a leer el Pedido;
  textos viejos de "movilización" como clase; filtro de Códigos por cliente vuelve a "Todos" al cambiar de
  cliente; aviso de precio de referencia también en Servicio FCR; RUC en Pumping; "Fases completadas" solo
  las terminadas; artículos dados de baja visibles en el kit; tooltips por fila; fechas del Pedido en hora local.

Pendiente a propósito (aparte):
- [ ] Partir `fcr/.../ticket-detail-page.ts` (~2050 líneas): bitácora/uso de herramientas y armado del PDF de cierre en componentes/helpers propios.
- [ ] Id global de herramienta: hoy se calcula en dos lugares leyendo todos los tickets (y dos altas simultáneas podrían chocar) → un solo helper y luego secuencia en BD.
- [ ] Macroestado `finalizado` en `libs/common/src/estados` (ver tasks/plan.md).
- [ ] 3 tests del front que ya fallaban (navegación Supervisor Pumping / Jefe de Base, `app.spec.ts`).
- FYI: GET de Códigos por cliente lo puede leer Ingeniería de Ventas (`fcrRead`); solo lectura, sin precios.
