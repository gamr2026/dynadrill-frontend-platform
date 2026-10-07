# Tareas: Envío diario de la bitácora FCR

Spec: `specs/fcr-bitacora-envio-diario/SPEC.md` · Plan: `tasks/plan.md`
Backend = `../dynadrill-backend` · Sin levantar servidores (el usuario prueba en local).

## Fase 1 — Enviar un día

### B1: Backend — enviar día a Facturación  (M) ✅ 2026-10-07 — unit tests en fcr-domain.service.spec.ts; el e2e del endpoint se cubre en B2 junto con roles
**Descripción:** Partir `empujarReportesAFacturacion` en `empujarReporteJobDia(t, fecha)` + herramientas.
Agregar `POST /operations/fcr/tickets/:id/activity-log/dias/:fecha/enviar`, que registra el día en
`diasBitacoraEnviados` (hora del servidor, usuario con sesión) y genera solo ese `reporte_job`.
**Aceptación:**
- [x] Enviar D crea exactamente 1 `reporte_job` (pedido, fcr, D) con las actividades de D.
- [x] Reenviar D no duplica; un día sin actividades → 400; un ticket sin pedido → 409.
- [x] La aprobación sigue funcionando igual (usa los métodos partidos).
**Verificación:** `npm test` + `npm run test:e2e -- fcr-bitacora-dias` + `npm run build` (backend).
**Dependencias:** ninguna.
**Archivos:** `fcr-domain.service.ts`, `fcr-actions.controller.ts`, `fcr-domain.service.spec.ts`, `test/fcr-bitacora-dias.e2e-spec.ts` (nuevo).

### F1: Frontend FCR — bitácora por día + "Enviar día"  (M) ✅ código 2026-10-07 — falta revisión manual + AXE del usuario
**Descripción:** Agregar `diasBitacoraEnviados` al modelo y `enviarDiaBitacora()` al servicio. En
Ejecución de Campo, la tabla de bitácora se agrupa por fecha (total de horas, estado Pendiente o
Enviado con fecha y hora). Se agrega un botón de icono con tooltip "Enviar día a Facturación", que
pide confirmación y solo aparece en días pendientes si es el turno del operador.
**Aceptación:**
- [x] Un `computed` agrupa y ordena por fecha, con total de horas y estado; tiene test unitario.
- [x] Enviar actualiza el ticket y avisa con "Día dd/mm enviado a Facturación (Pedido X)".
- [ ] AXE sin errores en la tabla agrupada (encabezados de grupo y `aria-label` en el botón).
**Verificación:** `npm test` + `npm run build` (frontend); revisión manual del usuario.
**Dependencias:** B1.
**Archivos:** `fcr/models/fcr.model.ts`, `fcr/services/fcr.service.ts`, `fcr/pages/ticket-detail-page/ticket-detail-page.{ts,html,scss}`.

### Checkpoint 1
- [ ] Builds y tests en verde en los dos repos.
- [ ] Usuario: envía D y D+1 → el Pedido muestra 2 Reporte Job → revisión antes de seguir.

## Fase 2 — Corregir

### B2: Backend — PUT reemplazar día + bloqueos + resync  (M) ✅ 2026-10-07 — e2e test/fcr-bitacora-dias (8); incluye fix de idempotencia de pushDocumentoOperativo
**Descripción:** `PUT /operations/fcr/tickets/:id/activity-log/dias/:fecha` con body
`{ actividades: {startTime,endTime,detail}[] }` (DTO validado, HH:mm). Reemplaza las entradas de esa
fecha, recalcula `durationHours` y registra `modificadoAt/Por/Rol`. Si el día estaba enviado,
regenera su `reporte_job`; si quedó vacío, lo borra (`quitarDocumentoOperativo`). Lleva `@Roles`
explícito: operador FCR + FACTURACION + admins. Se aplican las reglas de bloqueo 1 y 2 de la spec
(409). `addActivityLogEntry` y `removeActivityLogEntry` regeneran el día si ya estaba enviado.
**Aceptación:**
- [x] El PUT de FACTURACION cambia `activityLog` y `reporte_job` igual; deja `modificadoRol: 'Facturación'`.
- [x] 409 si el Pedido está en un estado bloqueado (Facturación) o el ticket ya no está en ejecución / `workReportUploaded` (Operador); 403 para otros roles.
- [x] Agregar o quitar una entrada de un día enviado actualiza su `reporte_job`; un día vacío elimina el documento.
**Verificación:** `npm test` + `npm run test:e2e -- fcr-bitacora-dias` + `npm run build` + `npm run lint` (backend).
**Dependencias:** B1.
**Archivos:** `fcr-domain.service.ts`, `fcr-actions.controller.ts`, `fcr-tickets.dto.ts`, `facturacion-domain.service.ts`, e2e.

### F2: Frontend Facturación — diálogo "Corregir actividades"  (M) ✅ código 2026-10-07 — signals (dynadrill-* no son CVA, no FormArray); falta revisión manual + AXE
**Descripción:** Nuevo `CorregirReporteJobDialog` (standalone, OnPush, formulario reactivo con
FormArray). La fecha es fija y se puede editar, agregar y quitar filas con los mismos selectores de
hora que FCR. En la tabla de Reporte Job de `pedido-detail-page`, se agrega un botón de icono
"Corregir actividades" solo si `origen === 'fcr'` y el Pedido no está bloqueado. Al guardar llama al
PUT y recarga documentos y avance.
**Aceptación:**
- [x] No deja guardar con hora vacía, detalle vacío o sin filas, salvo que se confirme "dejar el día sin actividades".
- [ ] Después de guardar, "Ver PDF" muestra la versión corregida.
- [ ] El foco empieza en la primera fila y vuelve al botón al cerrar; AXE sin errores.
**Verificación:** `npm test` (validaciones del diálogo) + `npm run build`; revisión manual del usuario.
**Dependencias:** B2.
**Archivos:** `facturacion/components/corregir-reporte-job-dialog.ts` (+html/scss), `pedido-detail-page.{ts,html}`, servicio (FCR o `pedido.service.ts`).

### F3: Frontend FCR — "Corregido por Facturación" + aviso  (S) ✅ código 2026-10-07 — falta revisión manual
**Descripción:** El estado del día muestra "Corregido por Facturación" si `modificadoRol === 'Facturación'`.
Agregar o quitar una actividad de un día enviado pide confirmación ("Este día ya está en Facturación
y se actualizará"); si el día fue corregido por Facturación, el texto lo menciona.
**Aceptación:**
- [x] Hay estado y confirmación correctos en los 3 casos: pendiente, enviado y corregido por Facturación.
- [x] Con `workReportUploaded` no aparecen acciones de edición (la tabla ya está dentro del @else de workReportUploaded).
**Verificación:** `npm test` + `npm run build`.
**Dependencias:** F1, B2.
**Archivos:** `fcr/pages/ticket-detail-page/ticket-detail-page.{ts,html}`.

### Checkpoint 2
- [ ] Builds y tests en verde.
- [ ] Usuario: Facturación corrige D → la bitácora FCR y el PDF del Pedido coinciden → revisión.

## Fase 3 — Cierre

### B3: Backend — la aprobación envía solo los días pendientes  (S)
**Descripción:** En `reviewReports('approved')` se envían los días con actividades que no están en
`diasBitacoraEnviados` (o que ya tienen `reporte_job` previo, por compatibilidad con datos viejos) y
se marcan como enviados. Los días ya enviados no se tocan, para no regenerar correcciones de forma
innecesaria. El Reporte de Herramientas se mantiene igual.
**Aceptación:**
- [ ] Con D enviado y corregido, y D+1 pendiente → aprobar crea D+1 y deja D intacto.
**Verificación:** `npm test` + e2e + `npm run build`.
**Dependencias:** B1.
**Archivos:** `fcr-domain.service.ts`, e2e.

### F4: Frontend FCR — quitar push duplicado  (XS)
**Descripción:** Eliminar `enviarReportesAFacturacion` y la inyección de `docsBridge` si queda sin uso
en FCR. Se mantiene el aviso "Reportes enviados a Facturación" al aprobar.
**Aceptación:**
- [ ] No queda ningún `pushReporteJob` en FCR; Pumping no cambia.
**Verificación:** `npm run build` + `npm test`.
**Dependencias:** B3.
**Archivos:** `fcr/pages/ticket-detail-page/ticket-detail-page.ts`.

### Checkpoint 3 — Completo
- [ ] Criterios de éxito 1–7 de la spec verificados.
- [ ] Revisión de código (`code-review-and-quality`) antes del commit.
