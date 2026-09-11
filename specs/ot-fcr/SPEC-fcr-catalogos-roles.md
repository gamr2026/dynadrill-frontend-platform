# Spec: `fcr-catalogos-roles` — Catálogos y rol base para VENTA/SERVICIOS

Parte del capability map [CAPABILITY-MAP.md](./CAPABILITY-MAP.md). Módulo base, sin dependencias — lo consume `fcr-flujo-dual`.

## Objective

Antes de extender el `FcrTicket` con la entrada nueva de SERVICIOS y los campos de ambas ramas (`fcr-flujo-dual`), el sistema necesita piezas que hoy no existen en ningún repo:

1. **Un rol RBAC nuevo**: `SUPERVISOR_OPERACIONES_FCR` — aprueba/rechaza el formulario de inspección en la rama SERVICIOS. No hay equivalente hoy (revisado: solo existe el `SUPERVISOR` genérico, que ya cubre las fases de VENTA y sigue haciéndolo).
2. **Cuatro catálogos fijos** (listas de opciones cerradas, no administrables por UI) que ambas ramas consumirán: tipo de operador, tipo de completación, tipo de picker, tipo de trabajo.

Éxito: el rol nuevo existe en `RoleCode`/`ModuleRoles` (backend) y en el guard de rutas (frontend), es asignable a un usuario, y los 4 catálogos están definidos en un solo lugar por repo, tipados, listos para ser importados por `fcr-flujo-dual` sin llamada HTTP adicional.

## Tech Stack

- Backend: NestJS 10 + Prisma 5 + SQLite, monorepo Nest (`apps/api-gateway` + `libs/`).
- Frontend: Angular 21 standalone + `ng-zorro-antd` + `@digitec-it-projects/dynadrill-ui`, TypeScript 5.9.

## Commands

Backend (`C:\Users\digitec\Documents\GitHub\dynadrill-backend`):
```
npm run lint
npm run typecheck
npm test
npm run prisma:migrate -- --name add_supervisor_operaciones_fcr_role
npm run prisma:seed
```

Frontend (`C:\Users\digitec\Documents\GitHub\dynadrill-frontend`):
```
npm run build
npm test
```

## Project Structure

Backend — extender archivos existentes, no crear módulo nuevo para esto:
```
libs/common/src/auth/role-code.ts       → agregar SUPERVISOR_OPERACIONES_FCR
libs/common/src/auth/module-roles.ts    → extender ModuleRoles.fcr (Capa A) para que el rol nuevo tenga acceso al módulo FCR existente (no hay módulo nuevo — ver revisión 2 del capability map)
prisma/schema.prisma                    → sin cambios de modelo (Role ya es genérico); solo dato nuevo
prisma/seed.ts                          → agregar el rol nuevo a la siembra + 1 usuario demo
```

Catálogos nuevos — viven junto al `FcrTicket` existente, que es quien los consume (tanto la entrada VENTA como SERVICIOS de `fcr-flujo-dual`):
```
libs/domains/operaciones/src/fcr-tickets/catalogos/
├── tipo-operador.catalog.ts       // 'mecanico' | 'soldador'
├── tipo-completacion.catalog.ts   // 'selectiva' | 'inyeccion' | 'power_oil'
├── tipo-picker.catalog.ts         // '7/8' | '9.5/8' | '5.5/8' | '5/8'
└── tipo-trabajo.catalog.ts        // 'fractura' | 'estimulacion' | 'evaluacion' | 'cemento' | 'picking'
```

Frontend, espejo de los catálogos (mismo shape que `PumpingServiceType` en `src/app/features/operations/pumping/models/pumping.model.ts`):
```
src/app/features/operations/fcr/models/fcr-catalogos.model.ts
```
Roles en frontend: extender el guard de rutas existente (`src/app/core/services/auth.service.ts` + roles usados por `roleGuard`) — no crear archivo nuevo, es el mismo lugar donde ya viven `Supervisor`, `Operador`, etc.

## Code Style

Backend — rol nuevo (extensión literal de `role-code.ts`, sin tocar los existentes):
```ts
export const RoleCode = {
  // ...existentes sin tocar...
  SUPERVISOR_OPERACIONES_FCR: 'supervisor_operaciones_fcr',
} as const;
```

Backend — catálogo (patrón `type` + `Record` de labels, igual que `PumpingServiceType`):
```ts
export type TipoPicker = '7/8' | '9.5/8' | '5.5/8' | '5/8';

export const TIPO_PICKER_LABELS: Record<TipoPicker, string> = {
  '7/8': '7/8"',
  '9.5/8': '9.5/8"',
  '5.5/8': '5.5/8"',
  '5/8': '5/8"',
};

export const ALL_TIPO_PICKER: readonly TipoPicker[] = Object.keys(TIPO_PICKER_LABELS) as TipoPicker[];
```

Frontend — mismo shape, importado por los `DynadrillSelectComponent` de cada wizard:
```ts
export type TipoCompletacion = 'selectiva' | 'inyeccion' | 'power_oil';

export const TIPO_COMPLETACION_OPTIONS: { value: TipoCompletacion; label: string }[] = [
  { value: 'selectiva', label: 'Selectiva' },
  { value: 'inyeccion', label: 'Inyección' },
  { value: 'power_oil', label: 'Power OIL' },
];
```

## Testing Strategy

- Backend: extender el test existente de roles (junto a `workflow-role.guard.spec.ts`) para verificar que `SUPERVISOR_OPERACIONES_FCR` está en `ALL_ROLE_CODES` y que `ModuleRoles.fcr` lo incluye.
- Catálogos: test trivial de que `ALL_TIPO_PICKER.length === Object.keys(TIPO_PICKER_LABELS).length` por catálogo (evita drift entre el type union y el Record) — un `*.spec.ts` por archivo de catálogo.
- Frontend: sin lógica no trivial en este módulo (son constantes); se cubre indirectamente cuando `fcr-flujo-dual` testee sus selects.
- No se requiere test e2e para este módulo (no expone endpoints propios).

## Boundaries

- **Always**: mantener `RoleCode` como fuente única de verdad (nunca hardcodear el string del rol fuera de `role-code.ts`); correr `npm run typecheck` y `npm test` en backend antes de dar el módulo por listo.
- **Ask first**: cualquier cambio al script de seed que pueda afectar usuarios demo ya usados en otros módulos (`prisma/seed.ts` es compartido por todo el repo).
- **Never**: modificar el modelo Prisma `Role`/`User` (no hace falta, los catálogos no son tablas); tocar `role-code.ts`/`module-roles.ts` de forma que remueva o renombre un `RoleCode` existente; agregar `SUPERVISOR_FCR` como rol separado — se descartó, VENTA usa el `SUPERVISOR` genérico ya existente.

## Success Criteria

- [ ] `RoleCode.SUPERVISOR_OPERACIONES_FCR` existe, está en `ALL_ROLE_CODES`, y es asignable a un `User` vía el flujo normal de administración de usuarios (sin cambios ahí, solo que el rol exista como opción).
- [ ] `prisma/seed.ts` crea al menos un usuario demo con el rol nuevo.
- [ ] Los 4 catálogos (`tipo-operador`, `tipo-completacion`, `tipo-picker`, `tipo-trabajo`) existen en backend y frontend, con los valores exactos del diagrama, y compilan (`typecheck`/`build`) sin depender de `fcr-flujo-dual` (módulo sin dependencias salientes de código, solo de `libs/common`).
- [ ] `npm run lint`, `npm run typecheck` y `npm test` pasan en backend; `npm run build` pasa en frontend.

## Open Questions

1. ¿El usuario demo con el rol nuevo debe mapear a una persona/nombre específico (como el resto del seed), o basta con `Supervisor Operaciones FCR Demo`?
2. ¿El label de UI para picker debe mostrar la comilla de pulgada (`7/8"`) o el texto plano del diagrama (`7/8`)? Asumo formato con comilla por legibilidad — corregir si no.
3. Se descartó `SUPERVISOR_FCR` como rol separado (VENTA sigue con `SUPERVISOR` genérico) — confirmar que esto es correcto antes de implementar, ya que si el negocio sí distingue a alguien especial como "Supervisor FCR" dentro de VENTA, se agrega aquí.

---
Estado: **borrador, pendiente de revisión humana.** No se ha escrito código todavía.
