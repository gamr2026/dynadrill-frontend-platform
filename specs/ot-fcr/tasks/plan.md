# Implementation Plan: Flujo de OT FCR — VENTA / SERVICIOS

Ubicación no estándar a propósito: `specs/ot-fcr/tasks/` en vez de `tasks/` en la raíz — el trabajo cruza dos repos (`dynadrill-frontend` + `dynadrill-backend`) y se mantiene junto a los specs de origen ([CAPABILITY-MAP.md](../CAPABILITY-MAP.md), `SPEC-*.md`) en vez de la raíz de un solo repo.

## Overview

Un solo `FcrTicket` (sin tabla/módulo nuevo) gana una **entrada alternativa** para la rama SERVICIOS (4 fases nuevas: `tipo_operador → reparacion → inspeccion → aprobacion_supervisor_operaciones`) que confluye en el tronco que ya existe (`preparacion_herramientas → asignacion_operador → ... → cierre`). El tipo de OT (`venta`/`servicio`) se decide en Ventas al crear el `Pedido`, no dentro de FCR. Se agregan catálogos fijos, un rol nuevo (`SUPERVISOR_OPERACIONES_FCR`), y campos de negocio en el tronco compartido (completación+picker para venta, tipo de trabajo+picker para servicio, más 2 documentos de venta que faltaban: dureza y QAQC).

## Architecture Decisions

- **Sin entidad/tabla nueva.** Todo vive en el `FcrTicket` ya existente — confirmado por el usuario tras dos rondas de corrección (ver CAPABILITY-MAP.md, "Revisión 2").
- **`tipoOt` nace en Ventas, no en FCR.** Se agrega a `Pedido`, se propaga por el bridge `crearTicketFcrSiAplica` ya existente.
- **Backend y frontend deben mantenerse en sync manualmente** para `FcrPhase`/`FCR_PHASE_ROLE` — mismo patrón ya usado hoy entre `fcr.model.ts` (frontend) y `workflow-role.maps.ts` (backend), documentado en un comentario del propio archivo backend.
- **Ubicación de completación/picker/tipo de trabajo: dentro de `ejecucion_campo`** (Open Question 1 de `SPEC-fcr-flujo-dual.md`, resuelta aquí para poder planear — confirmar antes de T14/T16 si se prefiere `asignacion_operador`).

## Dependency Graph

```
RoleCode.SUPERVISOR_OPERACIONES_FCR (T1)         Pedido.tipoOt (T5)
        │                                                │
        ├── ModuleRoles.fcr (T1)                         ├── nuevo-pedido-dialog UI (T6)
        │                                                │
Catálogos fijos (T2) ── espejo frontend (T3)              │
        │                                                │
        └──────────────┬─────────────────────────────────┘
                        │
              FCR_PHASE_ROLE += 4 fases (T7, necesita T1)
                        │
        ┌───────────────┴────────────────┐
        │                                 │
fcr-domain.service: fases servicio (T8)   fcr.model.ts: FcrPhase/FcrTicket (T10, necesita T7)
        │                                 │
bridge: currentPhase según tipoOt (T9,    fcr.service.ts (T11, necesita T8+T10)
  necesita T5+T7)                         │
        │                        ticket-detail-page: tipo_operador+reparacion (T12)
        │                                 │
        └───────────────┬─────────────────┘
                         │
        ticket-detail-page: inspección+aprobación (T13, necesita T12)
                         │
        ═══════ CHECKPOINT 2 ═══════
                         │
        setCompletacionYPicker/setTipoTrabajoYPicker (T14, necesita T2)
                         │
        registroDureza/Qaqc — venta (T15)
                         │
        ticket-detail-page: bloque condicional en ejecucion_campo (T16, necesita T14+T3)
                         │
        ticket-detail-page: flags dureza/QAQC en preparacion_herramientas (T17, necesita T15)
```

## Task List

### Phase 1: Foundation (`fcr-catalogos-roles` + `pedido-tipo-ot`)

- [ ] **Task 1** [Backend] Rol `SUPERVISOR_OPERACIONES_FCR`
- [ ] **Task 2** [Backend] Catálogos fijos (tipo de operador, completación, picker, tipo de trabajo)
- [ ] **Task 3** [Frontend] Catálogos espejo
- [ ] **Task 4** [Frontend] Rol nuevo en guard de rutas / auth
- [ ] **Task 5** [Backend] `Pedido.tipoOt` — schema + DTO + service
- [ ] **Task 6** [Frontend] `Pedido.tipoOt` — modelo + `nuevo-pedido-dialog` UI

### Checkpoint 1: Foundation
- [ ] `npm run lint && npm run typecheck && npm test` verde en backend
- [ ] `npm test && npm run build` verde en frontend
- [ ] Un Pedido creado desde Ventas exige elegir Tipo de OT y lo persiste
- [ ] Revisión humana antes de tocar el `FcrTicket`

### Phase 2: Entrada SERVICIOS (`fcr-flujo-dual`, parte 1)

- [ ] **Task 7** [Backend] `FCR_PHASE_ROLE` += 4 fases nuevas
- [ ] **Task 8** [Backend] `fcr-domain.service`: `setTipoOperador`/`registrarReparacion`/`subirInspeccion`/`aprobarInspeccion` + endpoints
- [ ] **Task 9** [Backend] Bridge `crearTicketFcrSiAplica`: decide `currentPhase` inicial según `tipoOt`
- [ ] **Task 10** [Frontend] `fcr.model.ts`: `FcrPhase` += 4 valores, `FcrTicket` += campos de servicio
- [ ] **Task 11** [Frontend] `fcr.service.ts`: métodos espejo
- [ ] **Task 12** [Frontend] `ticket-detail-page`: fases `tipo_operador` + `reparacion`
- [ ] **Task 13** [Frontend] `ticket-detail-page` + diálogo nuevo: fases `inspeccion` + `aprobacion_supervisor_operaciones`

### Checkpoint 2: Entrada SERVICIOS completa
- [ ] Un `FcrTicket` con `tipoOt: 'servicio'` recorre sus 4 fases nuevas (incluido el ciclo de rechazo en `aprobacion_supervisor_operaciones`) hasta entrar a `preparacion_herramientas` sin tocar código del tronco
- [ ] Un `FcrTicket` con `tipoOt: 'venta'` sigue funcionando exactamente igual que antes de este plan
- [ ] `npm run lint && npm run typecheck && npm test` verde en backend; `npm test && npm run build` verde en frontend
- [ ] **Probado manualmente en navegador** (dev server + preview): crear un Pedido de tipo servicio, recorrer las 4 fases nuevas como los roles correspondientes (usando el switch-role de demo)
- [ ] Revisión humana antes de la Fase 3

### Phase 3: Campos del tronco compartido (`fcr-flujo-dual`, parte 2)

- [ ] **Task 14** [Backend] `setCompletacionYPicker` (venta) / `setTipoTrabajoYPicker` (servicio) + endpoints, dentro de `ejecucion_campo`
- [ ] **Task 15** [Backend] `registroDurezaUploaded`/`registroQaqcUploaded` (venta) en `preparacion_herramientas`
- [ ] **Task 16** [Frontend] `ticket-detail-page`, fase `ejecucion_campo`: bloque condicional completación+picker vs. tipo de trabajo+picker
- [ ] **Task 17** [Frontend] `ticket-detail-page`, fase `preparacion_herramientas`: flags dureza/QAQC (venta)

### Checkpoint 3: Completo
- [ ] Ciclo feliz completo de punta a punta para `tipoOt: 'venta'` y para `tipoOt: 'servicio'`, probado manualmente en navegador
- [ ] `ticket-list-page` distingue ambos tipos (columna/badge `tipoOt`), sin cambios de estructura
- [ ] Todos los tests (backend + frontend) pasan; build limpio en ambos repos
- [ ] Las 5 Open Questions de los specs de módulo están resueltas o explícitamente aceptadas como están
- [ ] Listo para revisión humana final / PR

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `FcrPhase`/`FCR_PHASE_ROLE` quedan desincronizados entre frontend y backend (ya es un riesgo hoy, documentado en el propio código) | Alto — un ticket puede quedar bloqueado o con permisos incorrectos | Task 7 y Task 10 se revisan juntas en el mismo PR/commit; agregar test de ambos lados que falle si un valor de fase no tiene rol mapeado |
| Un ticket `tipoOt: 'venta'` alcanza por error una fase de servicio (o viceversa) por un bug en `fcr-domain.service` | Alto — rompe la garantía de "dos entradas, un tronco" | Test explícito en Task 8 que verifique que la transición está bloqueada según `tipoOt`, no solo según `currentPhase` |
| Ubicación real de completación/picker/tipo de trabajo termina siendo distinta a `ejecucion_campo` (Open Question 1 sin resolver) | Medio — Task 14/16 se reharían | Confirmar con el usuario antes de iniciar Phase 3 (no bloquea Phase 1/2) |
| Pedidos que llegan por AS2 no traen `tipoOt` (Open Question 1 de `SPEC-pedido-tipo-ot.md`) | Medio — el bridge no sabría qué fase inicial usar para esos pedidos | Definir un default explícito (ej. `'venta'`) antes de Task 9, documentado en el código con el porqué |
| Migración de Prisma (`Pedido.tipoOt`) en una base ya poblada con pedidos existentes sin este campo | Medio — pedidos viejos quedan con `tipoOt` nulo | Migración con default `'venta'` para filas existentes (son todas anteriores al concepto de "servicio") |

## Open Questions

Heredadas de los specs de módulo (no bloquean Phase 1, sí deberían resolverse antes de Phase 2/3 donde aplica):

1. Ubicación exacta de completación/picker/tipo de trabajo — `ejecucion_campo` (asumido) vs `asignacion_operador`. *(bloquea Task 14/16)*
2. Rol de `reparacion`/`inspeccion`: `OPERADOR` genérico vs. rol propio. *(bloquea Task 8)*
3. "Verificar listado completo" — ¿mismo campo `toolListConfirmed` o uno nuevo? *(bloquea Task 14)*
4. Documentos de SERVICIOS: ¿3 flags booleanos o un adjunto múltiple? *(bloquea Task 13)*
5. Documentos de VENTA (dureza/QAQC): ¿campos nuevos o ya cubiertos con otro nombre? *(bloquea Task 15)*
6. (Nueva, de `SPEC-pedido-tipo-ot.md`) Default de `tipoOt` para pedidos AS2. *(bloquea Task 9)*
