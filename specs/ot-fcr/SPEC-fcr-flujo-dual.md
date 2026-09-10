# Spec: `fcr-flujo-dual` — Dos entradas, un tronco común en el FcrTicket

Parte del capability map [CAPABILITY-MAP.md](./CAPABILITY-MAP.md). Depende de `fcr-catalogos-roles` y `pedido-tipo-ot`.

## Objective

El `FcrTicket` actual tiene una sola secuencia de 8 fases lineales, pensada para el flujo que el diagrama llama VENTA. Falta la entrada equivalente para SERVICIOS. Confirmado por el usuario:

- **No son dos procesos paralelos independientes** — son **dos entradas distintas que confluyen en el mismo tronco**: `preparacion_herramientas` (y todo lo que sigue) ya es común a ambos.
- El ticket ya nace sabiendo su tipo (`tipoOt`, de `pedido-tipo-ot`) — no hay decisión de tipo dentro de FCR.

Éxito: un `FcrTicket` con `tipoOt: 'servicio'` recorre 4 fases nuevas (`tipo_operador → reparacion → inspeccion → aprobacion_supervisor_operaciones`, con ciclo de rechazo) antes de entrar al mismo tronco que ya usa `tipoOt: 'venta'` desde `preparacion_herramientas`; ambos tipos terminan capturando sus campos específicos (completación+picker para venta, tipo de trabajo+picker para servicio) dentro de ese tronco compartido, sin duplicar ninguna fase ni pantalla.

## Tech Stack

- Backend: NestJS 10 + Prisma 5 + SQLite (todo en `payload`, sin migración de columnas).
- Frontend: Angular 21 standalone, OnPush, signals.

## Commands

Backend: `npm run lint`, `npm run typecheck`, `npm test`.
Frontend: `npm run build`, `npm test`.

## Project Structure

Solo edición de archivos ya existentes — ningún archivo/carpeta/ruta nueva:

Backend:
```
libs/domains/operaciones/src/fcr-tickets/fcr-domain.service.ts
  → nuevos métodos: setTipoOperador, registrarReparacion, subirInspeccion,
    aprobarInspeccion (aprueba→avanza a preparacion_herramientas; rechaza→vuelve a inspeccion),
    setCompletacionYPicker (venta), setTipoTrabajoYPicker (servicio)
libs/domains/operaciones/src/fcr-tickets/fcr-actions.controller.ts
  → nuevos endpoints PATCH :id/tipo-operador, :id/reparacion, :id/inspeccion,
    :id/aprobar-inspeccion, :id/completacion-picker, :id/tipo-trabajo-picker
libs/domains/operaciones/src/workflow/workflow-role.maps.ts
  → FCR_PHASE_ROLE += las 4 fases nuevas
```

Frontend:
```
src/app/features/operations/fcr/models/fcr.model.ts
  → FcrPhase += 4 valores nuevos; FcrTicket += tipoOt, tipoOperador?, reparacionDescripcion?,
    formularioInspeccionExternoUploaded, formatoDimensionamientoServicioUploaded,
    formatoDurezaServicioUploaded (documentos de SERVICIOS, 3 — ver diagrama "Se adjuntan archivos"),
    registroDurezaUploaded, registroQaqcUploaded (documentos de VENTA que faltaban — ver Open
    Question 5, "Se adjuntan documentos de..." ya tenía QAQC y dureza en el diagrama pero ningún
    campo actual del FcrTicket los cubre), inspeccionAprobada?, tipoCompletacion?, tipoTrabajo?, tipoPicker?
src/app/features/operations/fcr/services/fcr.service.ts
  → métodos espejo de las acciones del backend
src/app/features/operations/fcr/pages/ticket-detail-page/ticket-detail-page.ts/.html
  → @switch/@case nuevos para las 4 fases de servicio; en las fases del tronco
    (asignacion_operador o ejecucion_campo — ver Open Question 1) renderizar
    completación+picker si tipoOt==='venta', tipo de trabajo+picker si==='servicio'
```

## Code Style

Backend — `FcrPhase` extendido, mismo `Record` que ya existe:
```ts
export type FcrPhase =
  // ── Entrada SERVICIOS (nueva) ──
  | 'tipo_operador'
  | 'reparacion'
  | 'inspeccion'
  | 'aprobacion_supervisor_operaciones'
  // ── Entrada VENTA (ya existe) + tronco común (ya existe) ──
  | 'validacion'
  | 'preparacion_herramientas'
  | 'asignacion_operador'
  | 'reunion_operativa'
  | 'ejecucion_campo'
  | 'revision_reportes'
  | 'control_retorno'
  | 'cierre';

export const FCR_PHASE_ROLE: Record<FcrPhase, RoleCode> = {
  tipo_operador: RoleCode.SUPERVISOR,
  reparacion: RoleCode.OPERADOR,
  inspeccion: RoleCode.OPERADOR,
  aprobacion_supervisor_operaciones: RoleCode.SUPERVISOR_OPERACIONES_FCR,
  // ...las 8 existentes, sin tocar
};
```

Backend — transición con ciclo de rechazo, mismo patrón que `reviewReports` (`revision_reportes`, ya existente en `fcr-domain.service.ts`):
```ts
async aprobarInspeccion(id: number, decision: 'approved' | 'rejected', motivo?: string) {
  const t = await this.getTicket(id);
  if (decision === 'rejected') {
    return this.service.update(id, {
      currentPhase: 'inspeccion',
      observations: [...t.observations, this.nuevaObservacion(motivo)],
    });
  }
  return this.service.update(id, { currentPhase: 'preparacion_herramientas' });
}
```

Frontend — render condicional por tipo, mismo patrón `@switch (currentPhase())` que ya usa `ticket-detail-page.html`:
```html
@switch (currentPhase()) {
  @case ('tipo_operador') { <!-- solo alcanzable si tipoOt === 'servicio' --> }
  @case ('reparacion') { }
  @case ('inspeccion') { }
  @case ('aprobacion_supervisor_operaciones') { }
  @case ('validacion') { <!-- ya existe, solo alcanzable si tipoOt === 'venta' --> }
  @case ('preparacion_herramientas') {
    <!-- ya existe, sin cambios: es tronco común -->
  }
  @case ('asignacion_operador') {
    <!-- ya existe + agregar bloque condicional: -->
    @if (ticket()!.tipoOt === 'venta') { <!-- selects de completación + picker --> }
    @else { <!-- selects de tipo de trabajo + picker --> }
  }
}
```

## Testing Strategy

- Backend: extender `fcr-domain.service.spec.ts` con casos para las 4 fases nuevas, incluyendo el ciclo `aprobacion_supervisor_operaciones` rechazo→`inspeccion`→reintentar→aprobar→`preparacion_herramientas`; y un test que confirme que un ticket `tipoOt: 'venta'` nunca puede alcanzar `tipo_operador`/`reparacion`/`inspeccion` (guard de negocio, no solo de rol).
- Backend: extender el e2e de `fcr-actions.controller` con los 6 endpoints nuevos + el 403 de `WorkflowRoleGuard` para cada fase nueva con rol incorrecto.
- Frontend: test de `ticket-detail-page` verificando que el render depende de `tipoOt` (un ticket de servicio nunca muestra el `@case('validacion')`, y viceversa), y que el bloque condicional de completación/picker vs. tipo de trabajo/picker aparece correcto en la fase del tronco elegida.

## Boundaries

- **Always**: un ticket con `tipoOt: 'venta'` nunca debe poder transicionar a `tipo_operador`/`reparacion`/`inspeccion`/`aprobacion_supervisor_operaciones`, y viceversa con `validacion` — validar esto en `fcr-domain.service`, no confiar solo en que el frontend no muestre el botón.
- **Ask first**: cualquier cambio a `FCR_PHASE_ROLE`/`WorkflowRoleGuard` que afecte tickets ya creados y en curso (fases existentes no deben re-mapearse).
- **Never**: duplicar `preparacion_herramientas`/`asignacion_operador`/`ejecucion_campo`/etc. en una versión "para servicio" — son el tronco común, se editan una sola vez.

## Success Criteria

- [ ] Un `FcrTicket` con `tipoOt: 'servicio'` nace en fase `tipo_operador` y recorre `tipo_operador → reparacion → inspeccion → aprobacion_supervisor_operaciones` (con reintento en rechazo) antes de entrar a `preparacion_herramientas`.
- [ ] Un `FcrTicket` con `tipoOt: 'venta'` sigue naciendo en `validacion` y su recorrido no cambia respecto a hoy, salvo los campos nuevos de completación/picker.
- [ ] Ambos tipos comparten exactamente el mismo código de `preparacion_herramientas`, `asignacion_operador`, `reunion_operativa`, `ejecucion_campo`, `revision_reportes`, `control_retorno`, `cierre` — sin ramas `if (tipoOt === ...)` dentro de esas fases salvo en el punto puntual donde se captura completación/picker vs. tipo de trabajo/picker.
- [ ] `ticket-list-page` (sin cambios de estructura) muestra ambos tipos de ticket en la misma tabla, distinguibles por una columna/badge de `tipoOt`.
- [ ] Un `FcrTicket` con `tipoOt: 'venta'` puede registrar `registroDurezaUploaded` y `registroQaqcUploaded` (documentos que el diagrama pide en "Se adjuntan documentos de..." — `Registro de dureza` y `Registro firmado de QAQC` — y que ningún campo actual del `FcrTicket` cubre) además de sus 6 flags de documento ya existentes.
- [ ] `npm run lint`, `npm run typecheck`, `npm test` pasan en backend; `npm test`, `npm run build` pasan en frontend.

## Open Questions

1. **Dónde exactamente se captura completación+picker (venta) y tipo de trabajo+picker (servicio) dentro del tronco.** Candidatos: dentro de `asignacion_operador` (justo después de asignar operador, más cerca del diagrama) o dentro de `ejecucion_campo` (donde ya vive el registro de uso diario, y donde el diagrama de SERVICIOS efectivamente lo ubica — "durante el registro de uso diario"). Para VENTA el diagrama lo pone más al final, cerca de "Supervisor FCR asigna operador". Propongo `ejecucion_campo` para ambos (mismo lugar, consistente, y coincide con el sitio real del diagrama para SERVICIOS) — confirmar antes de implementar, cambia dónde se agregan los campos/UI.
2. **Rol de `reparacion`/`inspeccion`.** Propuse `OPERADOR` genérico — `tipoOperador` (mecánico/soldador) queda como dato del ticket, no como `RoleCode` distinto. Confirmar.
3. **"Verificar listado completo"** — ¿es el mismo campo `toolListConfirmed` que ya existe (hoy se confirma en `preparacion_herramientas`, tronco común), o es una verificación nueva y separada específica de picker/tipo de trabajo? Si es la misma, no hace falta campo nuevo, solo mensaje de UI distinto según `tipoOt`.
4. **Documentos de SERVICIOS** (`formulario de inspección externo`, `formato de dimensionamiento`, `formato de dureza`) — ¿son 3 flags booleanos independientes (como asumí) o un único adjunto múltiple? Sigo el patrón de `inspectionDocumentUploaded` existente por default.
5. **Documentos de VENTA que faltan hoy.** El diagrama pide, en el paso "Se adjuntan documentos de..." (entre `Prepara herramientas` y `Se envía a aprobación de Supervisor`), 4 documentos: inspección/dimensionamiento (cubierto por `inspectionDocumentUploaded` ya existente), un `Registro de dureza` (aparece duplicado dos veces en el diagrama, probablemente un solo campo) y un `Registro firmado de QAQC`. Ninguno de los 6 flags actuales del `FcrTicket` (`inspectionDocumentUploaded`, `movementGuideGenerated`, `reviewGuideGenerated`, `workReportUploaded`, `toolReportUploaded`, `finalReviewGuideUploaded`) cubre dureza o QAQC — propongo agregar `registroDurezaUploaded`/`registroQaqcUploaded` como flags nuevos junto a `inspectionDocumentUploaded`, en el mismo paso de `preparacion_herramientas`. Confirmar que esto no es simplemente un duplicado accidental del diagrama que ya está cubierto por otro campo existente con otro nombre.

---
Estado: **borrador, pendiente de revisión humana.** No se ha escrito código todavía.
