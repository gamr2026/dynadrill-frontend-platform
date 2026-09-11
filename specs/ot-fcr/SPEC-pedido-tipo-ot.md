# Spec: `pedido-tipo-ot` — Campo Tipo de OT (venta/servicio) en Ventas

Parte del capability map [CAPABILITY-MAP.md](./CAPABILITY-MAP.md). Módulo base, sin dependencias — lo consume `fcr-flujo-dual`.

## Objective

Hoy el `Pedido` no distingue si el trabajo es "de venta" o "de servicio" — solo tiene `lineaServicio` (`fishing|pumping|completion|ctu`). Según el usuario, esta distinción **la decide Ventas al crear el Pedido**, no Operaciones/FCR. Se necesita un campo nuevo `tipoOt: 'venta' | 'servicio'`, capturado en el diálogo de alta de Pedido (`nuevo-pedido-dialog.ts`, rol Ventas/`INGENIERIA_VENTAS`), persistido en `Pedido`, y propagado al `FcrTicket` que el bridge crea automáticamente — para que `fcr-flujo-dual` sepa qué secuencia de fases usar.

Éxito: al crear un Pedido desde el Portal, Ventas elige explícitamente Venta o Servicio; ese valor viaja intacto hasta el `FcrTicket` resultante.

## Tech Stack

- Backend: NestJS 10 + Prisma 5 + SQLite.
- Frontend: Angular 21 standalone, Reactive/signal forms.

## Commands

Backend: `npm run lint`, `npm run typecheck`, `npm test`, `npm run prisma:migrate -- --name add_tipo_ot_pedido`.
Frontend: `npm run build`, `npm test`.

## Project Structure

Backend — edición de archivos existentes, sin archivos nuevos:
```
prisma/schema.prisma                                          → Pedido.tipoOt String
libs/domains/facturacion/src/pedidos/pedidos.dto.ts            → CreatePedidoDto.tipoOt
libs/domains/facturacion/src/pedidos/pedidos.service.ts        → scalarColumns += 'tipoOt'
libs/domains/facturacion/src/facturacion-domain.service.ts     → crearTicketFcrSiAplica recibe y usa pedido.tipoOt
```

Frontend — edición de archivos existentes:
```
src/app/features/facturacion/models/pedido.model.ts    → TipoOt, TIPO_OT_LABELS, Pedido.tipoOt
src/app/features/facturacion/components/nuevo-pedido-dialog.ts/.html → select de Tipo de OT
src/app/features/operations/fcr/models/fcr.model.ts    → FcrTicket.tipoOt (recibido del Pedido, no editable desde FCR)
```

## Code Style

Backend — DTO (mismo patrón que `lineaServicio`):
```ts
const TIPOS_OT = ['venta', 'servicio'];

// en CreatePedidoDto:
@ApiProperty({ enum: TIPOS_OT })
@IsIn(TIPOS_OT)
tipoOt!: string;
```

Backend — bridge, extensión mínima de la firma existente:
```ts
async crearTicketFcrSiAplica(pedido: {
  id: number;
  lineaServicio: string;
  tipoOt: string; // 'venta' | 'servicio' — nuevo
  code: string;
  // ...resto sin cambios
}): Promise<void> {
  if (!LINEAS_FCR.has(pedido.lineaServicio)) return;
  // ...
  await this.prisma.fcrTicket.create({
    data: {
      // ...
      currentPhase: pedido.tipoOt === 'servicio' ? 'tipo_operador' : 'validacion',
      payload: JSON.stringify({ ...this.ticketFcrInicial(pedido), tipoOt: pedido.tipoOt }),
    },
  });
}
```

Frontend — igual patrón que `lineaServicio`/`LINEA_SERVICIO_LABELS`:
```ts
export type TipoOt = 'venta' | 'servicio';

export const TIPO_OT_LABELS: Record<TipoOt, string> = {
  venta: 'Venta',
  servicio: 'Servicio',
};
```

## Testing Strategy

- Backend: extender el test de `pedidos.service`/`facturacion-domain.service` (si existen) para verificar que `tipoOt` persiste y que `crearTicketFcrSiAplica` setea `currentPhase` correcto según el valor.
- Frontend: test de `nuevo-pedido-dialog` verificando que `puedeGuardar()` exige `tipoOt` seleccionado, y que el payload enviado a `PedidoService.create()` lo incluye.

## Boundaries

- **Always**: mantener `tipoOt` como campo obligatorio en el alta por Portal (no puede quedar `undefined` para pedidos nuevos).
- **Ask first**: cómo tratar pedidos que llegan por AS2 (ver Open Question 1) — puede requerir coordinación con el equipo que mantiene el mapeo AS2.
- **Never**: inferir `tipoOt` a partir de `lineaServicio` de forma implícita/automática — el usuario fue explícito en que es una elección de Ventas, no una regla derivada.

## Success Criteria

- [ ] `Pedido.tipoOt` existe y es obligatorio para pedidos creados por Portal.
- [ ] `nuevo-pedido-dialog` expone el selector y bloquea guardar sin elegirlo.
- [ ] `crearTicketFcrSiAplica` propaga `tipoOt` al `FcrTicket` y decide `currentPhase` inicial en consecuencia.
- [ ] `npm run lint`, `npm run typecheck`, `npm test` pasan en backend; `npm test`, `npm run build` pasan en frontend.

## Open Questions

1. **Pedidos por AS2.** El payload de AS2 (sistema externo) ¿ya incluye o incluirá un campo equivalente a "tipo de OT", o hay que definir una regla de default (ej. todos los AS2 son `'venta'` hasta que AS2 mande el dato)? Esto bloquea la implementación del bridge `sincronizarAs2` si no se resuelve.
2. ¿El nombre de negocio es "Tipo de OT" (como en el diagrama) o hay un término ya usado internamente (ej. "Modalidad", "Categoría de pedido")?
3. ¿Un Pedido con `tipoOt` ya creado puede cambiar de tipo después (ej. se abrió como venta pero requiere servicio), o es inmutable una vez creado el `FcrTicket`? Asumo inmutable — corregir si no.

---
Estado: **borrador, pendiente de revisión humana.** No se ha escrito código todavía.
