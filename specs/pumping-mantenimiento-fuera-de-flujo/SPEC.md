# Spec: Mantenimiento fuera del flujo del ticket de Pumping

## Objetivo

El mantenimiento de la unidad a veces se hace meses después de cerrar el ticket. Hoy es un paso del flujo
(`traslado_llegada → mantenimiento → revision_reportes_llegada`) y además **bloquea** el avance: el backend
rechaza pasar a `revision_reportes_llegada` si la unidad tiene sub-órdenes sin cerrar.

Cambio:
1. Sacar `mantenimiento` del flujo: `traslado_llegada → revision_reportes_llegada`.
2. Quitar todo bloqueo por mantenimientos abiertos (el ticket puede llegar a Cierre igual).
3. Nuevo card **"Mantenimientos"** debajo de "Avance del ticket" (columna lateral), visible en cualquier
   estado del ticket — incluso cerrado — con la información, el estado y las acciones de mantenimiento.
4. Migrar los tickets que hoy están parados en `mantenimiento` a `revision_reportes_llegada`.

### Usuarios
- **Jefe de Mantenimiento / Operador de Mantenimiento**: entran al ticket y ejecutan/revisan su sub-orden desde el card.
- **Supervisor Pumping**: revisa las sub-órdenes Operativas (como hoy en el paso Mantenimiento).
- Resto de roles con acceso al ticket: solo lectura.

## Contenido del card "Mantenimientos"

- Encabezado con resumen: `N abiertos · M cerrados` (o "Sin mantenimientos").
- Una fila por sub-orden: código, tipo (Mecánico / Instrumental / Operativo), estado (badge),
  orden padre, novedad original (texto corto), responsable/asignado si existe, fecha de creación.
- Acciones como **botones de icono con tooltip** (no texto):
  - Ver detalle → `SuborderDetailDialog` (todos).
  - Ejecutar → `SuborderExecutionDialog` (Jefe/Operador de Mantenimiento, según estado de la sub-orden).
  - Revisar → `SuborderReviewDialog` (Supervisor Pumping en Operativas; Jefe de Mantenimiento en las suyas, igual que en el módulo de Mantenimiento).
- Las reglas de qué rol puede hacer qué acción en cada estado se **reutilizan** del módulo de Mantenimiento; no se inventan reglas nuevas.
- Al cerrar un diálogo con cambios, se recarga la lista.

## Alcance de datos — CONFIRMADO

Respuesta recibida: *"Es para todos en general, es una actualización de módulo"*. Confirmado:
el card aparece en **todos los tickets de Pumping** y muestra **todas las sub-órdenes de la unidad del ticket**
(mismo criterio que hoy usa el paso `mantenimiento`), no solo las originadas por ese ticket.

## Cambios por capa

### Backend (`dynadrill-backend`, rama `Pumping-modifications`)
- `pumping-domain.service.ts` → `advance()`: eliminar el bloque `step === 'revision_reportes_llegada'` que consulta `subOrdenesAbiertasDe`.
- `workflow/workflow-role.maps.ts`: quitar `mantenimiento` de los mapas de rol/macroestado de Pumping (dejar el valor tolerado en lectura para `stepHistory` histórico).
- `pumping-tickets.service.ts`: la reasignación del tramo "mantenimiento" del timeline solo aplica a historial viejo; no debe romper si el tramo no existe (ya lo contempla).
- Script `scripts/migrate-pumping-sin-mantenimiento.ts`: tickets con `currentStep = 'mantenimiento'` → `revision_reportes_llegada`, con entrada en `stepHistory` (motivo: "Mantenimiento sale del flujo"). Idempotente.

### Frontend
- `pumping.model.ts`: quitar `mantenimiento` de `PumpingStep`, labels y `PUMPING_STEP_ROLE`.
- `ticket-detail-page.ts/html`: quitar `STEP_KEYS` de mantenimiento, `NEXT_STEP` (`traslado_llegada → revision_reportes_llegada`), el bloque `@if (currentStep() === 'mantenimiento')`, `approveMaintenanceStep`, `novedadesSinAtender`/`allNovedadesResolved` como bloqueo.
- Nuevo componente `operations/pumping/components/ticket-maintenance-card` (standalone, OnPush, `input()`/`output()`), colocado en la columna `dyn-detail-layout__aside` debajo de `<app-ticket-progress>`.
- `ticket-list-page`: quitar badge del paso `mantenimiento` y la fila expandible ligada a ese paso.

## Comandos
```
Frontend build: npm run build        Frontend test: npm test
Backend build:  npm run build        Backend test:  npm test
Migración:      npx ts-node scripts/migrate-pumping-sin-mantenimiento.ts
```
(No se levantan servidores; las pruebas en local las haces tú.)

## Pruebas
- Front: spec del card (render por rol/estado, acciones visibles según rol, estado vacío).
- Back: spec de `advance()` — `traslado_llegada → revision_reportes_llegada` pasa con sub-órdenes abiertas.
- Script de migración: probado contra LOCAL antes de QA/PROD.

## Límites
- **Siempre:** reutilizar diálogos y reglas del módulo de Mantenimiento; AXE/WCAG AA; iconos con tooltip.
- **Preguntar antes:** cambios al schema Prisma (no se prevén); correr la migración en QA/PROD.
- **Nunca:** cambiar el flujo del módulo de Mantenimiento en sí; borrar historial `stepHistory` con el paso viejo.

## Criterios de éxito
1. El stepper de "Avance del ticket" ya no muestra "Mantenimiento".
2. Un ticket en `traslado_llegada` con sub-órdenes abiertas avanza a `revision_reportes_llegada` sin error (front y back).
3. El card "Mantenimientos" aparece debajo del stepper en cualquier estado del ticket, incluido Cierre.
4. Jefe/Operador de Mantenimiento pueden ejecutar/revisar desde el card; Supervisor Pumping revisa Operativas; los demás solo ven.
5. Después de la migración no queda ningún ticket con `currentStep = 'mantenimiento'`.
6. Los tickets viejos con `mantenimiento` en `stepHistory` se siguen mostrando sin errores.
7. Build y tests de front y back en verde.

## Decisiones
1. Alcance: todas las sub-órdenes de la unidad del ticket (confirmado 2026-10-06).
2. Acceso de Mantenimiento: enlace "Ver ticket" en la Bandeja de Mantenimiento para órdenes originadas en Pumping (`pumpingTicketId`); el guard de ruta y el backend deben permitirles leer el ticket. No se agrega Pumping a su menú.
3. Vista de Mantenimiento: Jefe/Operador de Mantenimiento ven en el detalle solo "Información del ticket" + stepper + card; no se cargan pasos ni datos de otros módulos (evita 403) y no se les cambia el rol automáticamente.
4. La columna lateral deja de ser sticky en Pumping: con los dos cards supera el alto de la ventana.
5. El stepper empareja tramos del timeline por fase (no por índice) para que los tickets viejos con tramo `mantenimiento` no corran los popovers.
