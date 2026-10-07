# Spec: Envío diario de la bitácora de actividades — FCR

## Objetivo

Que el operador de FCR **envíe a Facturación la bitácora de actividades día por día** mientras el
trabajo de campo sigue en curso, en lugar de mandarla una sola vez al final. Así Facturación puede
revisar cada Reporte Job (DYN-SGI-RE-047) apenas está disponible y **corregirlo** según sus
observaciones.

Hoy el operador registra actividades y recién con "Finalizar ejecución y subir reportes" + la
aprobación del Supervisor se generan los Reportes Job (uno por fecha) en el Pedido. Facturación
solo puede ver el PDF; no tiene forma de corregirlo.

### Decisiones tomadas (2026-10-07)
| Tema | Decisión |
|---|---|
| Quién envía | El **operador directamente**, día por día. No hace falta aprobación del Supervisor para cada día (igual que en Pumping). |
| Día ya enviado | **Pueden corregirlo los dos**: el operador desde FCR y Facturación desde el Pedido. |
| Qué edita Facturación | **Editar, agregar y quitar** actividades de ese día (horas de inicio y fin, y detalle). |
| Conflicto | **Una sola fuente de verdad**: la bitácora del ticket FCR (`activityLog`). Lo que corrige cualquiera de los dos queda ahí y el Reporte Job del día se regenera. |
| Cierre | Se mantiene "Finalizar ejecución y subir reportes" → revisión del Supervisor → Control de Retorno. |

## Diseño

### Fuente única: el ticket FCR, y el Reporte Job es una proyección
`documentoOperativo` (tipo `reporte_job`) deja de ser una copia que se edita por su cuenta. Pasa a
ser un **derivado** de `ticket.activityLog` filtrado por fecha, y lo regenera **siempre el backend**
con el `empujarReportesAFacturacion` que ya existe (`fcr-domain.service.ts:442`), que es idempotente
por (pedido, origen, tipo, fecha).

Por qué así:
- Facturación **no** escribe en `documentoOperativo` directamente: si lo hiciera, el operador vería
  una bitácora distinta y su próximo envío pisaría la corrección.
- La dependencia ya va en una sola dirección (`operaciones → facturacion`). Facturación edita
  llamando a un endpoint de **FCR**, no al revés, para no crear un ciclo entre módulos.

### Estado por día en el ticket
Se agrega al ticket FCR (dentro del JSON del ticket, **sin cambio de schema Prisma**):
```ts
/** Días de bitácora ya enviados a Facturación — clave: fecha 'YYYY-MM-DD'. */
diasBitacoraEnviados: {
  fecha: string;
  enviadoAt: string;        // hora del servidor
  enviadoPor: string;       // usuario con sesión
  modificadoAt?: string;    // última corrección después del envío
  modificadoPor?: string;
  modificadoRol?: 'Operador' | 'Facturación';
}[];
```

### Backend (dynadrill-backend)
| Endpoint | Quién | Qué hace |
|---|---|---|
| `POST /operations/fcr/tickets/:id/activity-log/dias/:fecha/enviar` | Operador (FCR) | Valida que haya ≥1 actividad ese día, marca el día como enviado y genera **solo** el `reporte_job` de esa fecha. Si se repite, no duplica nada. |
| `PUT /operations/fcr/tickets/:id/activity-log/dias/:fecha` | Operador y **Facturación** | Reemplaza las actividades de esa fecha (`{ actividades: {startTime,endTime,detail}[] }`), recalcula `durationHours` y registra `modificado*`. Si el día ya estaba enviado, regenera su `reporte_job`. Si queda vacío y estaba enviado, borra ese `reporte_job`. |
| `POST/DELETE …/activity-log` (ya existen) | Operador | Si la fecha de la entrada ya fue enviada, regeneran el `reporte_job` de ese día. |
| `reviewReports('approved')` (ya existe) | Supervisor | Envía los días que todavía falten y los marca como enviados. El Reporte de Herramientas no cambia. |

- `empujarReportesAFacturacion` se separa en `empujarReporteJobDia(t, fecha)` y la parte de
  herramientas, para reusar la misma lógica en los tres casos.
- El `PUT` por día lleva `@Roles(...)` explícito que incluye `FACTURACION`, y queda fuera del
  `WorkflowRoleGuard` de paso, porque Facturación corrige cuando la fase del ticket ya avanzó.

### Frontend (dynadrill-frontend)
**FCR — fase Ejecución de Campo** (`fcr/pages/ticket-detail-page`)
- La tabla de bitácora se **agrupa por día**. Cada grupo muestra el total de horas, el estado
  (`Pendiente` / `Enviado dd/mm hh:mm` / `Corregido por Facturación`) y un botón de icono con
  tooltip: **"Enviar día a Facturación"** (se oculta una vez enviado).
- El operador puede agregar o quitar actividades de un día ya enviado; el backend lo resincroniza.
  Si el día fue corregido por Facturación, se muestra un aviso antes de modificarlo.
- Se elimina `enviarReportesAFacturacion` del frontend (`ticket-detail-page.ts:1177`): hoy duplica
  lo que ya hace el backend al aprobar, y además arma los datos con la copia vieja del navegador.

**Facturación — detalle de Pedido** (`facturacion/pages/pedido-detail-page`)
- En la tabla de Reporte Job, junto a "Ver PDF", se agrega un botón de icono **"Corregir actividades"**,
  solo para documentos con `origen: 'fcr'`.
- Abre un diálogo con las filas del día: hora de inicio y fin, detalle, agregar y quitar filas. Usa
  los mismos selectores de hora que la bitácora FCR. Al guardar llama al `PUT` por día con
  `ticketOperativoId` y `fecha` del documento, y después recarga documentos y avance.
- Pumping **no cambia** (su reporte diario ya se envía por día y tiene otro flujo).

## Comandos
```
Frontend:  npm run build        ·  npm test
Backend:   npm run build        ·  npm test  ·  npm run test:e2e  ·  npm run lint
```
(No se levantan servidores: el usuario prueba en local.)

## Estructura afectada
```
dynadrill-backend/libs/domains/operaciones/src/fcr-tickets/
  fcr-actions.controller.ts   → 2 endpoints nuevos
  fcr-domain.service.ts       → enviarDia, reemplazarDia, resync en add/remove, aprobación
  fcr-tickets.dto.ts          → DTO de reemplazo de día
dynadrill-backend/test/fcr-bitacora-dias.e2e-spec.ts   → nuevo
dynadrill-frontend/src/app/features/operations/fcr/
  models/fcr.model.ts, services/fcr.service.ts, pages/ticket-detail-page/*
dynadrill-frontend/src/app/features/facturacion/
  components/corregir-reporte-job-dialog.ts (nuevo), pages/pedido-detail-page/*
```

## Estilo de código
Componentes standalone y OnPush, con `input()`/`output()`, signals y `computed()`, control flow
nativo y acciones como **botones de icono con tooltip**. Se siguen el patrón de
`daily-activity-report-dialog` y los servicios con `inject()`. Se aplican Clean Code y SOLID: la
regeneración del Reporte Job vive en un solo método del backend.

## Testing
- **Backend e2e** (`test/fcr-bitacora-dias.e2e-spec.ts`): enviar día → existe un `reporte_job` de
  esa fecha; reenviar → sigue habiendo uno solo; Facturación hace PUT → cambian el `activityLog` y el
  documento; el operador agrega una entrada a un día enviado → el documento la incluye; dejar vacío un
  día enviado → se borra el documento; aprobación → se envían solo los días pendientes; un rol sin
  permiso → 403.
- **Frontend unit**: agrupación por día con total de horas y estado; el botón Enviar solo aparece en
  días pendientes; el diálogo de Facturación no deja guardar filas inválidas (fin vacío o detalle vacío).
- **Manual** (usuario, en local): el flujo completo operador → Facturación corrige → el operador ve la corrección.

## Límites
- **Siempre:** la bitácora del ticket FCR es la única fuente; la regeneración la hace el backend; se
  usa la hora del servidor; se cumple WCAG AA en los diálogos nuevos.
- **Preguntar antes:** cualquier cambio de schema Prisma; tocar el flujo de Pumping; cambiar las
  reglas de la prefactura (`avance.reporteJobDias`).
- **Nunca:** que Facturación escriba directo en `documentoOperativo.actividades`; levantar servidores;
  hacer push sin pedirlo.

## Criterios de éxito
1. Durante Ejecución de Campo, el operador envía el día D y el Pedido muestra el Reporte Job de D
   sin que el ticket cambie de fase.
2. Puede enviar D+1 por separado; el Pedido muestra los dos días.
3. Facturación corrige D (edita, agrega o quita filas) → el PDF del Pedido y la bitácora FCR muestran
   lo mismo, y FCR marca D como "Corregido por Facturación".
4. El operador modifica un día ya enviado → el Reporte Job de ese día en el Pedido se actualiza solo.
5. Al aprobar el Supervisor, los días no enviados llegan a Facturación y las correcciones previas de
   Facturación **no se pierden**.
6. Nunca hay más de un `reporte_job` por (pedido, fcr, fecha).
7. Build y tests en verde en los dos repos.

## Reglas de bloqueo (aprobadas 2026-10-07)
1. **Facturación** corrige mientras el Pedido **no** está en `enviado_para_firmas`, `ticket_firmado`,
   `aot_generada`, `anulado`, `enviado_a_control_de_costos`, `listo_para_facturar` ni `facturado`.
   En `rechazado_por_cliente` sí puede corregir. Si está bloqueado, el botón no aparece y el backend
   responde 409.
2. **Operador** corrige días enviados solo con el ticket en `ejecucion_operativa` y
   `workReportUploaded = false`. Después de "Finalizar ejecución", solo corrige Facturación.
3. **No se mueven actividades entre días**: la fecha es fija en el diálogo de Facturación y en el
   `PUT` por día.
