# Plan de implementación: Envío diario de la bitácora FCR

Spec: `specs/fcr-bitacora-envio-diario/SPEC.md` · Tareas: `tasks/todo.md`

## Resumen
El operador FCR envía cada día de la bitácora a Facturación durante la Ejecución de Campo. La
bitácora del ticket FCR (`activityLog`) es la única fuente de verdad: el backend regenera el
`reporte_job` de un día cada vez que cambia una actividad de un día ya enviado, sin importar si el
cambio lo hizo el operador o Facturación.

## Decisiones de arquitectura
- **La regeneración vive en un solo lugar:** `FcrDomainService.empujarReporteJobDia(t, fecha)`, que
  sale de partir el `empujarReportesAFacturacion` actual. La usan enviar día, el PUT por día,
  agregar/quitar entrada y la aprobación.
- **Facturación edita a través de FCR** (`PUT /operations/fcr/tickets/:id/activity-log/dias/:fecha`),
  porque `operaciones → facturacion` es la única dirección de dependencia que existe.
- **`diasBitacoraEnviados` va en el JSON del ticket**: no hay cambio de schema Prisma.
- **Se quita el push del frontend** en la aprobación (`ticket-detail-page.ts:1177`): hoy duplica lo
  que ya hace el backend.
- Para borrar el `reporte_job` de un día que quedó vacío se agrega
  `FacturacionDomainService.quitarDocumentoOperativo(pedidoId, origen, tipo, fecha)`, simétrico a la
  idempotencia de `pushDocumentoOperativo`.

## Grafo de dependencias
```
B1 empujarReporteJobDia + enviar día (backend)
 ├── F1 FCR: bitácora por día + botón Enviar (frontend)
 ├── B2 PUT reemplazar día + permisos + resync add/remove (backend)
 │    ├── F2 Facturación: diálogo Corregir actividades (frontend)
 │    └── F3 FCR: edición de días enviados + "Corregido por Facturación" (frontend)
 └── B3 Aprobación envía solo días pendientes (backend) ── F4 quitar push del front
```

## Lista de tareas
### Fase 1: Enviar un día (slice A)
- [x] B1 — Backend: enviar día a Facturación
- [x] F1 — Frontend FCR: bitácora agrupada por día con estado y botón "Enviar día"
### Checkpoint 1: el operador envía D y D+1 y el Pedido muestra 2 Reporte Job

### Fase 2: Corregir (slice B)
- [x] B2 — Backend: PUT reemplazar día, reglas de bloqueo y resync en agregar/quitar
- [x] F2 — Frontend Facturación: diálogo "Corregir actividades"
- [x] F3 — Frontend FCR: estado "Corregido por Facturación" y aviso al editar
### Checkpoint 2: Facturación corrige D → FCR y el PDF del Pedido coinciden

### Fase 3: Cierre (slice C)
- [ ] B3 — Backend: la aprobación envía solo los días pendientes
- [ ] F4 — Frontend FCR: quitar `enviarReportesAFacturacion`
### Checkpoint 3: criterios de éxito 1–7 de la spec

## Riesgos y mitigaciones
| Riesgo | Impacto | Mitigación |
|---|---|---|
| `WorkflowRoleGuard` bloquea a Facturación en el PUT porque la fase del ticket es otra | Alto | `@Roles` explícito en el endpoint; test e2e con rol FACTURACION. Se valida primero en B2. |
| Fechas `'YYYY-MM-DD'` contra `fecha` guardada como `DateTime` en `documentoOperativo` (zona horaria) | Medio | Comparar normalizando con el mismo `flat()` que ya usa la idempotencia; test con una fecha cerca de medianoche. |
| La carga masiva por CSV crea N entradas → N regeneraciones del mismo día | Bajo | Aceptable (solo regenera si el día ya fue enviado, y el CSV se suele cargar antes de enviar). |
| "Solicitar corrección" no resetea `workReportUploaded` (bug existente): el operador no puede corregir | Medio | **Fuera de alcance.** Se avisa; Facturación igual puede corregir. Preguntar si se arregla aparte. |
| Pedidos ya en curso con Reporte Job enviados por la aprobación vieja no tienen `diasBitacoraEnviados` | Bajo | Si un día tiene `reporte_job` en el Pedido pero no está en la lista, se trata como enviado (fallback en el GET o en B3). |

## Preguntas abiertas
- Ninguna que bloquee el plan. Queda pendiente decidir aparte el arreglo del bug de "Solicitar corrección".

## Siguiente trabajo (aparte, después de F4): estado "Finalizado" del ticket FCR — solo FCR
Diagnóstico (2026-10-07): `close()` (`fcr-domain.service.ts`) pone `status: 'cerrado'` pero no agrega
evento a `phaseHistory`, así que `timelineResumen.macroEstadoActual` se queda en "Aprobado" (macro de
`cierre`), y no existe macroestado "Finalizado" (front `timeline.model.ts`, back `libs/common/src/estados`).
Propuesta aprobada en alcance: macroestado `finalizado`; `close()` registra el evento y valida fase
`cierre` y que no esté ya cerrado; frontend con el ticket cerrado en solo lectura, pero con
imprimibles y descargables disponibles. Pumping fuera de alcance. Hacer spec corta antes de implementar.
