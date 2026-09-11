# Capability Map: Flujo de OT FCR — VENTA / SERVICIOS

Fuente: diagrama de proceso de negocio (FigJam) analizado el 2026-09-09.

## Revisión 2 (2026-09-09) — un solo ticket, dos entradas, un tronco común

Dos correcciones del usuario sobre la primera revisión:

1. **El tipo de OT no se decide dentro de FCR.** "En FCR se inicia desde la misma forma que hasta ahora, se muestra la tabla de tickets... la diferencia es que ahora desde el módulo de ventas va a venir un apartado donde indique si ese ticket es de servicio o de venta." → El campo `tipoOt: 'venta' | 'servicio'` se captura en **Ventas**, al crear el `Pedido` (`nuevo-pedido-dialog.ts`, junto a `lineaServicio`), no en Operaciones/FCR. FCR sigue teniendo una sola tabla de tickets (`ticket-list-page`), y cada ticket ya nace con su tipo definido.
2. **"Preparación de herramientas" es un tronco común a ambos flujos**, no exclusivo de VENTA. → Las dos ramas del diagrama no son dos procesos paralelos independientes: son **dos entradas distintas que confluyen en el mismo tronco** de fases ya existente en `FcrTicket`.

Con esto, **no se crea ninguna entidad/tabla/módulo nuevo**. Todo el trabajo es:
- Un campo nuevo en `Pedido` (`tipoOt`), capturado en Ventas.
- Una extensión de `FcrTicket`/`FcrPhase` (mismo modelo, misma tabla, mismo módulo `fcr` en ambos repos) para soportar dos secuencias de entrada que confluyen en las fases ya existentes.

## Mapeo confirmado diagrama ↔ código

| Diagrama | `FcrPhase` actual / propuesta |
|---|---|
| `Se levanta la OT` → `Tipo de OT` | Ya no ocurre en FCR: es la creación del `Pedido` en Ventas, con `tipoOt` ya elegido |
| VENTA: `Recibe programa` → `Aprueba Programa` | `validacion` (ya existe, sin cambios) |
| SERVICIOS: `Tipo de operador` → `Reparación` → `Formulario de inspección` → `Adjuntar archivos` → `Supervisor de operaciones FCR` → `¿Aprobado?` | **Nuevo**: `tipo_operador` → `reparacion` → `inspeccion` → `aprobacion_supervisor_operaciones` (con rechazo → vuelve a `inspeccion`) |
| **Tronco común, ambas ramas confluyen aquí** | `preparacion_herramientas` → `asignacion_operador` → `reunion_operativa` → `ejecucion_campo` → `revision_reportes` → `control_retorno` → `cierre` (ya existen, sin cambios estructurales) |
| VENTA: `tipo de completación` + `tipo de picker` + `verificar listado` | Campos nuevos `tipoCompletacion`/`tipoPicker`, capturados dentro de una fase del tronco ya existente (ver Open Question en el spec) |
| SERVICIOS: `tipo de trabajo` + `tipo de picker` + `verificar listado de uso` | Campos nuevos `tipoTrabajo`/`tipoPicker`, capturados dentro de `ejecucion_campo` (coincide con el registro de uso diario que ya existe ahí) |

**Discrepancias detectadas al cruzar el diagrama con el código, mantenidas tal como está el código (no se cambian, por decisión del usuario de que VENTA = "como está funcionando FCR hoy"):**
- El diagrama de VENTA muestra `Selecciona operador` antes de `Prepara herramientas`; el `FcrTicket` actual hace `preparacion_herramientas` antes de `asignacion_operador`. Se mantiene el orden del código.
- El diagrama de VENTA pide 2 documentos (`Registro de dureza`, `Registro firmado de QAQC`) que ningún campo actual del `FcrTicket` cubre — ver Open Question 5 de `SPEC-fcr-flujo-dual.md` (se agregan como campos nuevos, no se descartan).

## Módulos

| Module id | Responsabilidad | Depende de |
|---|---|---|
| `fcr-catalogos-roles` | Catálogos fijos (tipo de operador, tipo de completación, tipo de picker, tipo de trabajo) + rol nuevo `SUPERVISOR_OPERACIONES_FCR` | — |
| `pedido-tipo-ot` | Campo `tipoOt: 'venta' \| 'servicio'` en `Pedido`, capturado en `nuevo-pedido-dialog` (Ventas), propagado por el bridge `crearTicketFcrSiAplica` hacia el `FcrTicket` recién creado | — |
| `fcr-flujo-dual` | Extiende `FcrPhase`/`FcrTicket`/`ticket-detail-page` para soportar las dos entradas (venta = `validacion` existente; servicio = 4 fases nuevas) que confluyen en el tronco ya existente, más los campos de completación/picker/tipo de trabajo en el tronco | `fcr-catalogos-roles`, `pedido-tipo-ot` |

Orden de build: (`fcr-catalogos-roles`, `pedido-tipo-ot` en paralelo) → `fcr-flujo-dual`

## Supuestos aceptados (pendientes de corrección explícita)

1. `SUPERVISOR_FCR` como rol separado se descarta — VENTA sigue usando el `SUPERVISOR` genérico.
2. `SUPERVISOR_OPERACIONES_FCR` es un rol nuevo, responsable solo de `aprobacion_supervisor_operaciones`.
3. Catálogos nuevos son listas fijas en código, no CRUD administrable.
4. Documentos del flujo se modelan como flags booleanos + adjunto simple, igual que el patrón actual de `FcrTicket`.
5. No se integra con `Articulo`/`MovimientoInventario`.
6. Los pedidos que llegan por AS2 (no por el Portal de Ventas) necesitan alguna regla de default para `tipoOt` — ver Open Question en `pedido-tipo-ot`.

## Convenciones a seguir

- Backend: editar `fcr-tickets.dto.ts`/`fcr-domain.service.ts`/`fcr-actions.controller.ts` existentes; sin Prisma model nuevo (todo va a `FcrTicket.payload`, igual que hoy).
- RBAC de dos capas: `ModuleRoles.fcr` (Capa A) + `WorkflowRoleGuard`/`FCR_PHASE_ROLE` (Capa B) — se extiende el mapa existente, no se crea uno nuevo.
- Frontend: todo dentro de `src/app/features/operations/fcr/` ya existente — sin carpeta/ruta/lista nueva.
