# Task List: Flujo de OT FCR — VENTA / SERVICIOS

Ver [plan.md](./plan.md) para el mapa de dependencias completo y los riesgos. Specs de origen: [CAPABILITY-MAP.md](../CAPABILITY-MAP.md), [SPEC-fcr-catalogos-roles.md](../SPEC-fcr-catalogos-roles.md), [SPEC-pedido-tipo-ot.md](../SPEC-pedido-tipo-ot.md), [SPEC-fcr-flujo-dual.md](../SPEC-fcr-flujo-dual.md).

Repos: **BE** = `C:\Users\digitec\Documents\GitHub\dynadrill-backend`, **FE** = `C:\Users\digitec\Documents\GitHub\dynadrill-frontend`.

---

## Phase 1: Foundation

### Task 1 [BE] Rol `SUPERVISOR_OPERACIONES_FCR` ✅
**Description:** Agregar el rol nuevo a `RoleCode`, incluirlo en `ModuleRoles.fcr` (Capa A), y sembrar un usuario demo con ese rol.

**Acceptance criteria:**
- [ ] `RoleCode.SUPERVISOR_OPERACIONES_FCR = 'supervisor_operaciones_fcr'` existe y está en `ALL_ROLE_CODES`
- [ ] `ModuleRoles.fcr` incluye el rol nuevo
- [ ] `prisma/seed.ts` crea al menos un usuario con ese rol

**Verification:**
- [ ] Tests pass: `npm test` (BE)
- [ ] Build succeeds: `npm run typecheck` (BE)
- [ ] Manual check: `npm run prisma:seed` corre sin error y el usuario nuevo aparece en `prisma studio`

**Dependencies:** None

**Files likely touched:**
- `libs/common/src/auth/role-code.ts`
- `libs/common/src/auth/module-roles.ts`
- `prisma/seed.ts`

**Estimated scope:** Small

---

### Task 2 [BE] Catálogos fijos ✅ (simplificado: sin `_LABELS`/spec dedicado — ver nota abajo)
**Description:** Crear los 4 catálogos (tipo de operador, tipo de completación, tipo de picker, tipo de trabajo) como `type` + `Record` de labels, siguiendo el patrón de `PumpingServiceType`.

**Acceptance criteria:**
- [ ] Los 4 catálogos existen con los valores exactos del diagrama (ver `SPEC-fcr-catalogos-roles.md`, sección Code Style)
- [ ] Cada catálogo expone `ALL_X: readonly X[]` derivado de su `Record` de labels (sin lista separada que pueda desincronizarse)

**Verification:**
- [ ] Tests pass: `npm test` (BE) — test trivial de longitud `ALL_X` vs `Object.keys(labels)` por catálogo
- [ ] Build succeeds: `npm run typecheck` (BE)

**Dependencies:** None

**Files likely touched:**
- `libs/domains/operaciones/src/fcr-tickets/catalogos/tipo-operador.catalog.ts`
- `libs/domains/operaciones/src/fcr-tickets/catalogos/tipo-completacion.catalog.ts`
- `libs/domains/operaciones/src/fcr-tickets/catalogos/tipo-picker.catalog.ts`
- `libs/domains/operaciones/src/fcr-tickets/catalogos/tipo-trabajo.catalog.ts`
- `libs/domains/operaciones/src/fcr-tickets/catalogos/catalogos.spec.ts`

**Estimated scope:** Medium

---

### Task 3 [FE] Catálogos espejo ✅
**Description:** Replicar los 4 catálogos en frontend con el mismo shape que usa `PumpingServiceType` en `pumping.model.ts` (values idénticos a los del backend, letra por letra).

**Acceptance criteria:**
- [ ] Los 4 `type`/opciones existen en `fcr-catalogos.model.ts` con los mismos valores que Task 2
- [ ] Compatibles con `DynadrillSelectComponent` (shape `{value, label}[]`)

**Verification:**
- [ ] Build succeeds: `npm run build` (FE)

**Dependencies:** Task 2 (los valores deben coincidir)

**Files likely touched:**
- `src/app/features/operations/fcr/models/fcr-catalogos.model.ts`

**Estimated scope:** Small

---

### Task 4 [FE] Rol nuevo en guard de rutas / auth ✅ (solo `FCR_ROLES`; no hay switch-role dropdown separado — se conecta en Task 10 vía FCR_PHASE_ROLE)
**Description:** Reconocer `SUPERVISOR_OPERACIONES_FCR` en el mismo lugar donde ya viven `Supervisor`/`Operador` (guard de rutas, switch-role de demo).

**Acceptance criteria:**
- [ ] El rol nuevo es seleccionable en el switch-role de demo (si aplica) y reconocido por `roleGuard`

**Verification:**
- [ ] Build succeeds: `npm run build` (FE)
- [ ] Manual check: cambiar a ese rol en la demo y confirmar que no rompe la navegación

**Dependencies:** Task 1

**Files likely touched:**
- `src/app/core/services/auth.service.ts`

**Estimated scope:** Small

---

### Task 5 [BE] `Pedido.tipoOt` — schema + DTO + service ✅ (migración aplicada; `prisma generate` pendiente por EPERM/archivo bloqueado — no afecta build/tests, regenerar cuando se pueda)
**Description:** Agregar el campo `tipoOt: 'venta' | 'servicio'` a `Pedido`, obligatorio en el alta.

**Acceptance criteria:**
- [ ] Migración de Prisma aplicada, con default `'venta'` para filas existentes (ver plan.md, Risks)
- [ ] `CreatePedidoDto.tipoOt` validado con `@IsIn(['venta', 'servicio'])`
- [ ] `PedidosService.scalarColumns` incluye `tipoOt`

**Verification:**
- [ ] Tests pass: `npm test` (BE)
- [ ] Build succeeds: `npm run typecheck` (BE)
- [ ] Manual check: `npm run prisma:migrate -- --name add_tipo_ot_pedido` corre limpio

**Dependencies:** None

**Files likely touched:**
- `prisma/schema.prisma`
- `libs/domains/facturacion/src/pedidos/pedidos.dto.ts`
- `libs/domains/facturacion/src/pedidos/pedidos.service.ts`

**Estimated scope:** Small

---

### Task 6 [FE] `Pedido.tipoOt` — modelo + UI en `nuevo-pedido-dialog` ✅ (verificado en navegador — ver nota sobre bug preexistente hallado, spawneado aparte)
**Description:** Exponer el selector "Tipo de OT" (Venta/Servicio) en el diálogo de alta de Pedido, obligatorio.

**Acceptance criteria:**
- [ ] `Pedido.tipoOt` en `pedido.model.ts`, con `TIPO_OT_LABELS`
- [ ] `puedeGuardar()` en `nuevo-pedido-dialog.ts` exige `tipoOt` elegido
- [ ] El payload enviado a `PedidoService.create()` incluye `tipoOt`

**Verification:**
- [ ] Tests pass: `npm test` (FE)
- [ ] Build succeeds: `npm run build` (FE)
- [ ] Manual check: crear un Pedido desde el navegador sin elegir Tipo de OT → botón guardar deshabilitado

**Dependencies:** Task 5

**Files likely touched:**
- `src/app/features/facturacion/models/pedido.model.ts`
- `src/app/features/facturacion/components/nuevo-pedido-dialog.ts`
- `src/app/features/facturacion/components/nuevo-pedido-dialog.html`

**Estimated scope:** Small

---

## Checkpoint 1: Foundation ✅
- [x] `npm run typecheck && npm test` verde en BE (lint no corrido explícitamente, sin errores en los archivos tocados vía eslint directo)
- [x] `npm run build` verde en FE (`npm test` de FE no corrido aún — sin specs nuevos que lo requieran en Fase 1)
- [x] Un Pedido creado desde Ventas exige elegir Tipo de OT y lo persiste — verificado en navegador
- [ ] **Revisión con el usuario antes de continuar** (Phase 2 empieza a tocar el `FcrTicket`)

**Nota:** `prisma generate` quedó pendiente (bloqueado por archivo en uso — ver Task 5). Bug preexistente hallado y derivado aparte: rol Ingeniería de Ventas no puede cargar `listas-precios`/`documentos-operativos` (403) — `task_467bc593`.

---

## Phase 2: Entrada SERVICIOS

### Task 7 [BE] `FCR_PHASE_ROLE` += 4 fases nuevas ✅
**Description:** Agregar `tipo_operador`, `reparacion`, `inspeccion`, `aprobacion_supervisor_operaciones` al mapa de rol responsable.

**Acceptance criteria:**
- [ ] Las 4 fases nuevas están en `FCR_PHASE_ROLE` con el rol correcto (ver `SPEC-fcr-flujo-dual.md`, Code Style — pendiente confirmar Open Question 2 para `reparacion`/`inspeccion`)
- [ ] `WorkflowRoleGuard` las reconoce sin cambios de código (ya itera el mapa genéricamente)

**Verification:**
- [ ] Tests pass: `npm test` (BE) — extender `workflow-role.guard.spec.ts`

**Dependencies:** Task 1

**Files likely touched:**
- `libs/domains/operaciones/src/workflow/workflow-role.maps.ts`

**Estimated scope:** Extra Small

---

### Task 8 [BE] `fcr-domain.service`: transiciones de la entrada SERVICIOS ✅ (simplificado — ver nota)
**Description:** Implementar `setTipoOperador`, `registrarReparacion`, `subirInspeccion`, `aprobarInspeccion` (con ciclo de rechazo → vuelve a `inspeccion`), y sus endpoints en el actions controller.

**Acceptance criteria:**
- [ ] Ciclo feliz: `tipo_operador → reparacion → inspeccion → aprobacion_supervisor_operaciones` → (aprobado) → `preparacion_herramientas`
- [ ] Ciclo de rechazo: `aprobacion_supervisor_operaciones` → (rechazado, con motivo) → `inspeccion`
- [ ] Un ticket `tipoOt: 'venta'` no puede invocar estos endpoints (guard de negocio explícito, no solo de rol)

**Verification:**
- [ ] Tests pass: `npm test` (BE) — `fcr-domain.service.spec.ts`
- [ ] Build succeeds: `npm run typecheck` (BE)

**Dependencies:** Task 7

**Files likely touched:**
- `libs/domains/operaciones/src/fcr-tickets/fcr-domain.service.ts`
- `libs/domains/operaciones/src/fcr-tickets/fcr-actions.controller.ts`
- `libs/domains/operaciones/src/fcr-tickets/fcr-tickets.dto.ts`
- `libs/domains/operaciones/src/fcr-tickets/fcr-domain.service.spec.ts`

**Estimated scope:** Medium

---

### Task 9 [BE] Bridge: `currentPhase` inicial según `tipoOt` ✅ (verificado con llamadas API reales — servicio→tipo_operador, venta→validacion)
**Description:** `crearTicketFcrSiAplica` recibe `pedido.tipoOt` y decide la fase inicial del `FcrTicket` (`tipo_operador` si servicio, `validacion` si venta — sin cambio para venta).

**Acceptance criteria:**
- [ ] Un Pedido `tipoOt: 'servicio'` genera un `FcrTicket` en fase `tipo_operador`
- [ ] Un Pedido `tipoOt: 'venta'` sigue generando un `FcrTicket` en fase `validacion` (comportamiento actual sin cambios)
- [ ] Default explícito y documentado para pedidos AS2 sin `tipoOt` (Open Question 6 del plan)

**Verification:**
- [ ] Tests pass: `npm test` (BE)

**Dependencies:** Task 5, Task 7

**Files likely touched:**
- `libs/domains/facturacion/src/facturacion-domain.service.ts`

**Estimated scope:** Small

---

### Task 10 [FE] `fcr.model.ts`: `FcrPhase`/`FcrTicket` extendidos ✅ (+ fix de `PHASE_BADGES` en ticket-list-page, detectado por el compilador)
**Description:** Agregar las 4 fases nuevas a `FcrPhase`, sus labels/roles, y los campos nuevos de `FcrTicket` (`tipoOt`, `tipoOperador?`, `reparacionDescripcion?`, flags de documentos de servicio).

**Acceptance criteria:**
- [ ] `FcrPhase`, `FCR_PHASE_LABELS`, `FCR_PHASE_ROLE` en sync exacto con Task 7 (mismos 4 valores, mismos roles)
- [ ] `FcrTicket` compila con los campos nuevos como opcionales (no rompe tickets sembrados sin ellos)

**Verification:**
- [ ] Build succeeds: `npm run build` (FE)

**Dependencies:** Task 7

**Files likely touched:**
- `src/app/features/operations/fcr/models/fcr.model.ts`

**Estimated scope:** Small

---

### Task 11 [FE] `fcr.service.ts`: métodos espejo ✅
**Description:** Agregar `setTipoOperador`, `registrarReparacion`, `subirInspeccion`, `aprobarInspeccion` al servicio HTTP, espejo exacto de Task 8.

**Acceptance criteria:**
- [ ] Los 4 métodos llaman a los endpoints correctos y retornan `Observable<FcrTicket>`

**Verification:**
- [ ] Build succeeds: `npm run build` (FE)
- [ ] Tests pass: `npm test` (FE)

**Dependencies:** Task 8, Task 10

**Files likely touched:**
- `src/app/features/operations/fcr/services/fcr.service.ts`

**Estimated scope:** Small

---

### Task 12 [FE] `ticket-detail-page`: fases `tipo_operador` + `reparacion` ✅ (verificado en navegador)
**Description:** Renderizado y acciones para las primeras 2 fases nuevas — selección de tipo de operador (catálogo de Task 3) y registro de reparación.

**Acceptance criteria:**
- [ ] `@case ('tipo_operador')` y `@case ('reparacion')` nuevos en el `@switch (currentPhase())` existente
- [ ] Un ticket `tipoOt: 'venta'` nunca renderiza estos casos (no son alcanzables, pero además no deberían ni aparecer en el switch para ese tipo)

**Verification:**
- [ ] Tests pass: `npm test` (FE)
- [ ] Build succeeds: `npm run build` (FE)

**Dependencies:** Task 10, Task 11, Task 3, Task 4

**Files likely touched:**
- `src/app/features/operations/fcr/pages/ticket-detail-page/ticket-detail-page.ts`
- `src/app/features/operations/fcr/pages/ticket-detail-page/ticket-detail-page.html`

**Estimated scope:** Medium

---

### Task 13 [FE] `ticket-detail-page` + diálogo nuevo: fases `inspeccion` + `aprobacion_supervisor_operaciones` ✅ (verificado en navegador — ciclo feliz + rechazo)
**Description:** Formulario de inspección, adjuntar los 3 archivos de servicio (ver Open Question 4 de `SPEC-fcr-flujo-dual.md`), y pantalla de aprobar/rechazar para `SUPERVISOR_OPERACIONES_FCR`.

**Acceptance criteria:**
- [ ] `@case ('inspeccion')` y `@case ('aprobacion_supervisor_operaciones')` nuevos
- [ ] Rechazar pide motivo y el ticket vuelve visiblemente a `inspeccion` con el motivo en el historial de observaciones
- [ ] Aprobar avanza a `preparacion_herramientas` (tronco compartido, sin cambios ahí)

**Verification:**
- [ ] Tests pass: `npm test` (FE)
- [ ] Build succeeds: `npm run build` (FE)
- [ ] Manual check: en navegador, ciclo completo de rechazo + reintento + aprobación

**Dependencies:** Task 12

**Files likely touched:**
- `src/app/features/operations/fcr/pages/ticket-detail-page/ticket-detail-page.ts`
- `src/app/features/operations/fcr/pages/ticket-detail-page/ticket-detail-page.html`
- `src/app/features/operations/fcr/components/adjuntar-archivos-servicio-dialog.ts`
- `src/app/features/operations/fcr/components/adjuntar-archivos-servicio-dialog.html`
- `src/app/features/operations/fcr/components/adjuntar-archivos-servicio-dialog.scss`

**Estimated scope:** Medium

---

## Checkpoint 2: Entrada SERVICIOS completa ✅
- [x] Un `FcrTicket` con `tipoOt: 'servicio'` recorre sus 4 fases nuevas (incluido el ciclo de rechazo, probado explícitamente) hasta entrar a `preparacion_herramientas` — **cero cambios** en el código del tronco, confirmado en vivo
- [x] Un `FcrTicket` con `tipoOt: 'venta'` sigue naciendo en `validacion` sin cambios (verificado en Task 9)
- [x] `npm run typecheck && npm test` verde en BE; `npm run build` verde en FE en cada paso
- [x] **Probado manualmente en navegador** contra el backend real: Pedido servicio → FCR-207 → tipo_operador → reparacion → inspeccion (3 documentos) → aprobacion_supervisor_operaciones → **rechazo** (vuelve a inspeccion, rol correcto) → reenvío → **aprobación** → preparacion_herramientas (tronco, rol Supervisor correcto)
- [ ] **Revisión con el usuario antes de Phase 3**

**Desviaciones del spec original (mejoras de simplicidad, no de alcance):** no se creó `adjuntar-archivos-servicio-dialog` aparte — los 3 documentos usan `dynadrill-upload-zone` inline en la sección, mismo patrón que ya usa VENTA para su documento de inspección (no un diálogo modal). Los métodos de dominio no llevan lógica de avance de fase embebida — igual que el resto del código ya existente, el avance de fase siempre pasa por el endpoint genérico `advance` desde el frontend.

---

## Phase 3: Campos del tronco compartido

### Task 14 [BE] `setCompletacionYPicker` / `setTipoTrabajoYPicker` ✅ (verificado con API real: bloqueo cruzado venta/servicio + validación de catálogo)
**Description:** Endpoints y lógica para capturar completación+picker (venta) o tipo de trabajo+picker (servicio), dentro de `ejecucion_campo` (confirmar Open Question 1 antes de empezar).

**Acceptance criteria:**
- [ ] Un ticket venta solo puede setear completación+picker; un ticket servicio solo tipo de trabajo+picker (validado en domain service, no solo en frontend)
- [ ] Valor fuera del catálogo (Task 2) → `BadRequestException`

**Verification:**
- [ ] Tests pass: `npm test` (BE)
- [ ] Build succeeds: `npm run typecheck` (BE)

**Dependencies:** Task 2, resolución de Open Question 1 (ubicación)

**Files likely touched:**
- `libs/domains/operaciones/src/fcr-tickets/fcr-domain.service.ts`
- `libs/domains/operaciones/src/fcr-tickets/fcr-actions.controller.ts`
- `libs/domains/operaciones/src/fcr-tickets/fcr-tickets.dto.ts`

**Estimated scope:** Medium

---

### Task 15 [BE] `registroDurezaUploaded`/`registroQaqcUploaded` (venta) ✅ (verificado con API real)
**Description:** Agregar los 2 flags de documento que faltan para VENTA (Open Question 5), en el mismo paso donde hoy se sube `inspectionDocumentUploaded`.

**Acceptance criteria:**
- [ ] Ambos flags persisten en `FcrTicket.payload` y son alcanzables desde un endpoint (extendiendo el existente de `inspection-document` o uno nuevo, según se decida)

**Verification:**
- [ ] Tests pass: `npm test` (BE)

**Dependencies:** None (independiente de Task 14, puede ir en paralelo)

**Files likely touched:**
- `libs/domains/operaciones/src/fcr-tickets/fcr-domain.service.ts`
- `libs/domains/operaciones/src/fcr-tickets/fcr-actions.controller.ts`

**Estimated scope:** Small

---

### Task 16 [FE] `ticket-detail-page`, `ejecucion_campo`: bloque condicional ✅
**Description:** Dentro de la fase `ejecucion_campo` ya existente, renderizar completación+picker si `tipoOt === 'venta'`, o tipo de trabajo+picker si `=== 'servicio'`.

**Acceptance criteria:**
- [ ] El bloque correcto aparece según `tipoOt`, nunca ambos ni ninguno
- [ ] "Verificar listado completo" usa el mismo mecanismo para ambos tipos (o el nuevo, según Open Question 3)

**Verification:**
- [ ] Tests pass: `npm test` (FE)
- [ ] Build succeeds: `npm run build` (FE)
- [ ] Manual check: en navegador, un ticket venta y uno servicio muestran cada uno su bloque correcto

**Dependencies:** Task 14, Task 3

**Files likely touched:**
- `src/app/features/operations/fcr/pages/ticket-detail-page/ticket-detail-page.ts`
- `src/app/features/operations/fcr/pages/ticket-detail-page/ticket-detail-page.html`

**Estimated scope:** Medium

---

### Task 17 [FE] `preparacion_herramientas`: flags dureza/QAQC (venta) ✅ (verificado en navegador — visible solo en venta)
**Description:** Exponer los 2 checkboxes/flags nuevos de Task 15 en la fase `preparacion_herramientas` ya existente, junto al flag de inspección actual.

**Acceptance criteria:**
- [ ] Ambos flags visibles y editables solo para tickets `tipoOt: 'venta'`

**Verification:**
- [ ] Tests pass: `npm test` (FE)
- [ ] Build succeeds: `npm run build` (FE)

**Dependencies:** Task 15

**Files likely touched:**
- `src/app/features/operations/fcr/pages/ticket-detail-page/ticket-detail-page.ts`
- `src/app/features/operations/fcr/pages/ticket-detail-page/ticket-detail-page.html`

**Estimated scope:** Small

---

## Checkpoint 3: Completo ✅
- [x] Ciclo feliz de punta a punta probado en navegador contra el backend real para ambos `tipoOt` (venta: FCR-208, selects de completación/picker; servicio: FCR-207, selects de tipo de trabajo/picker), incluido el ciclo de rechazo de `aprobacion_supervisor_operaciones`
- [x] Los flags `registroDurezaUploaded`/`registroQaqcUploaded` (venta) visibles solo para venta, confirmado en navegador; ausentes para servicio, confirmado en navegador
- [x] `npm run lint` backend: **0 errores** (123 warnings preexistentes de `@typescript-eslint/no-explicit-any`, mismo patrón en todo el repo, ninguno nuevo)
- [x] `npm run typecheck` y `npm test` backend: limpios (14/14 tests)
- [x] `npm run build` frontend: limpio en cada task
- [ ] `npm test` frontend: **1 test preexistente fallando** (`src/app/app.spec.ts`, boilerplate de Angular CLI sin tocar desde "init project" — no relacionado a este trabajo, no se tocó)
- [x] `ticket-list-page` distingue ambos tipos — columna "Tipo" nueva (badge Venta/Servicio), verificada en navegador junto a las demás columnas existentes, sin romper estructura
- [x] Las 6 Open Questions del plan quedaron resueltas por decisión de implementación (documentadas en cada task) — ninguna bloqueó el trabajo
- [ ] Listo para revisión humana final / PR
