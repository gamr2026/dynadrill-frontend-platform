# Plan de implementación: Precarga de herramientas en FCR

Spec: [SPEC.md](SPEC.md) · Tareas: [todo.md](todo.md)

> Va en esta carpeta y no en `tasks/` porque `tasks/plan.md` y `tasks/todo.md` todavía tienen tareas
> abiertas del envío diario de la bitácora (B3, F4 y revisiones manuales).

## Resumen
Una tabla nueva por cliente y código (`ConfiguracionCodigoFcr`) dice qué es cada código de la Lista de
Precios (herramienta, movilización o servicio) y qué herramientas físicas forman el kit de cada código
de herramienta. La Lista de Precios no se toca. Al crear un ticket
FCR, o al recargarlo, el backend expande esos kits en filas de herramienta listas para Bodega y deja
la movilización como información.

## Decisiones de arquitectura
- **Revisión 2026-10-07 — la movilización sale del Pedido:** tipo de línea "Movilización" en el
  formulario, con código y precio de la Lista de Precios del cliente (o la Normal). Nada se inventa:
  solo se edita lo que el formulario permite. Una sola fuente, por eso se quita la clase
  `movilizacion` de `ConfiguracionCodigoFcr`.
- **La clase y el kit viven en una tabla propia (`clienteId`, `codigo`)**, no en la Lista de Precios:
  esa tabla solo se actualiza con `import-datos-reales.ts`, que borra y recrea sus ítems (RN del
  2026-09-22, `listas-precios.controller.ts`). Así la configuración sobrevive a las importaciones.
- **El CRUD vive en Operaciones** (`fcr-configuracion-codigos/`). `PrecargaFcrService` (Facturación)
  solo lee la tabla por Prisma, igual que ya lee `Articulo`; no importa nada de Operaciones.
- **`PrecargaFcrService` en el dominio Facturación**, con un único método público. Lo usan la creación
  del ticket (Facturación) y la recarga (FCR). Así la dependencia sigue siendo `operaciones → facturacion`, sin ciclo.
- **Una fila por herramienta física.** Bodega, Recepción y el checklist ya trabajan por herramienta;
  agrupar por cantidad rompería ese flujo.
- **Juegos según la unidad**, con una regla pura (`juegosPorLinea`) y testeable aparte.
- **Sin cambios en el JSON del ticket que rompan lo existente**: `movilizaciones` y `avisosPrecarga` son
  campos nuevos y opcionales.

## Grafo de dependencias
```
B1 tabla + API ConfiguracionCodigoFcr ──┬── F1 pantalla de configuración (clase + kit)
                                 └── B2 PrecargaFcrService + creación del ticket ──┬── F3 UI FCR (2 bloques + aviso)
F2 Pedido: quitar forzado esFcr ─┘ (B2 la verifica con la regresión de prefactura) └── B3 endpoint recargar ── F4 botón recargar
```

## Lista de tareas
### Fase 1: Configurar kits (slice A)
- [x] B1 — Backend: tabla `ConfiguracionCodigoFcr` + API
- [x] F1 — Frontend: pantalla de configuración de códigos por cliente (falta revisión manual + AXE)
### Checkpoint 1: el usuario configura el kit de `SH1101` y `SFS6057` para el cliente del Pedido 4332

### Fase 2: El ticket nace con herramientas (slice B)
- [x] B2 — Backend: `PrecargaFcrService` y su uso al crear el ticket
- [x] B2b — Backend: la movilización sale del Pedido (`esMovilizacion`); se quita la clase `movilizacion`
- [x] F1b — Frontend: quitar "Movilización" de Códigos por cliente
- [x] F2 — Frontend Pedido: tipo de línea "Movilización" (código y precio de la Lista de Precios) + dejar de forzar `esHerramienta` en FCR
- [x] B4 — Backend: la prefactura cobra la movilización fuera de la lista del cliente con el precio del Pedido
- [x] F3 — Frontend FCR: "Actividades según el Pedido" en dos bloques + avisos de la precarga
### Checkpoint 2: un Pedido FCR nuevo con la plantilla del 4332 (movilización marcada en el Pedido) crea un ticket con las herramientas del kit y la movilización aparte; la prefactura cobra igual

### Fase 3: Tickets ya creados (slice C)
- [x] B3 — Backend: `POST /fcr-tickets/:id/recargar-desde-pedido`
- [x] F4 — Frontend FCR: botón "Recargar desde el Pedido"
### Checkpoint 3: FCR-209 se recarga; criterios de éxito de la spec verificados; `code-review-and-quality`

## Riesgos y mitigaciones
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Al dejar de forzar `esHerramienta`, la prefactura de FCR cobra distinto (`facturacion-domain.service.ts:1089`) | Alto | Test de regresión en B2 con el Pedido 4332: mismo total antes y después. |
| AS2 renombra un código y su configuración queda huérfana | Medio | F1 marca las filas cuyo código ya no está en la Lista de Precios del cliente. |
| Pedidos sin `clienteId` (viejos o de texto libre) | Medio | No se precarga; F3 muestra el aviso y el Supervisor agrega a mano. |
| El kit apunta a un artículo dado de baja | Bajo | `resolverPrecarga` lo salta y deja la línea en `avisosPrecarga`. |
| La migración Prisma | Medio | Se pide confirmación antes de correr `migrate dev` (Límites de la spec). |

## Preguntas abiertas
Ninguna.
