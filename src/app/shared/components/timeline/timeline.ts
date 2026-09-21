import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DynadrillIconComponent, DynadrillTagComponent } from '@digitec-it-projects/dynadrill-ui';
import { DuracionPipe } from '../../pipes/duracion.pipe';
import { MACRO_ESTADO_LABELS, MACRO_ESTADO_TONE, type TimelineTramo } from '../../models/timeline.model';

/**
 * Tarjeta de detalle de una fase del timeline — compartida por Pedido, FCR
 * y Pumping. A propósito NO dibuja el stepper/track de fases: cada módulo ya
 * tenía el suyo (con sus ajustes responsive). Se instancia dinámicamente
 * dentro de un CDK Overlay por `TimelinePopoverTriggerDirective`, que se
 * cuelga de cada nodo existente del stepper/lista y la muestra como popover
 * anclado a ese nodo, con el tramo del `timelineResumen` que corresponda.
 */
@Component({
  selector: 'app-timeline',
  imports: [DatePipe, DuracionPipe, DynadrillTagComponent, DynadrillIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-timeline-card">
      <div class="app-timeline-card__head">
        <span class="app-timeline-card__eyebrow">● Fase {{ faseIndice() }} — {{ esFaseActual() ? 'Selección actual' : 'Fase completada' }}</span>
        <dynadrill-tag [label]="macroEstadoLabels[tramo().macroEstado]" [variant]="macroEstadoTones[tramo().macroEstado]" />
      </div>
      <h3 class="app-timeline-card__title">{{ faseLabel() }}</h3>

      <div class="app-timeline-card__grid">
        <div class="app-timeline-card__item">
          <span class="app-timeline-card__label">Hora inicio</span>
          <span class="app-timeline-card__value"><dynadrill-icon name="clock" [size]="16" />{{ tramo().inicio | date: 'dd/MM/yyyy HH:mm' }}</span>
        </div>
        <div class="app-timeline-card__item">
          <span class="app-timeline-card__label">Hora finalización</span>
          <span class="app-timeline-card__value">
            <dynadrill-icon name="clock" [size]="16" />{{ tramo().fin ? (tramo().fin | date: 'dd/MM/yyyy HH:mm') : 'En curso' }}
          </span>
        </div>
        <div class="app-timeline-card__item">
          <span class="app-timeline-card__label">Duración transcurrida</span>
          <span class="app-timeline-card__value"><dynadrill-icon name="clock" [size]="16" />{{ tramo().duracionMs | duracion }}</span>
        </div>
        <div class="app-timeline-card__item">
          <span class="app-timeline-card__label">Rol</span>
          <span class="app-timeline-card__value">{{ tramo().actorRolLabel ?? responsableRolActual() ?? '—' }}</span>
        </div>
      </div>

      <div class="app-timeline-card__item">
        <span class="app-timeline-card__label">Responsable</span>
        <span class="app-timeline-card__value">
          <dynadrill-icon name="users" [size]="16" />
          <!-- Sin correo a propósito: es accountability interna, no un dato de contacto —
               mostrarlo a cualquiera con acceso al ticket es exposición innecesaria. -->
          {{ tramo().actorNombre ?? responsableRolActual() ?? '—' }}
        </span>
      </div>

      @if (tramo().motivo; as motivo) {
        <div class="app-timeline-card__footer">
          <dynadrill-icon name="alert" [size]="16" />
          <span>{{ motivo }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 360px;
      /* En viewports angostos (celular) 360px no entra con margen — se ajusta al ancho disponible en vez de desbordar la pantalla. */
      max-width: calc(100vw - 24px);
    }

    .app-timeline-card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px;
      background: var(--surface, #fff);
      border: 1px solid var(--dynadrill-purple, #662e9b);
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }

    /* Flechita apuntando al nodo del stepper — por defecto el popover cae
       debajo del nodo, así que la flecha sale hacia arriba desde el borde
       superior. Si el CDK Overlay lo reubica arriba (poco espacio abajo),
       :host-context toma la clase que puso la posición del overlay y la voltea. */
    .app-timeline-card::before {
      content: '';
      position: absolute;
      top: -7px;
      left: 50%;
      width: 12px;
      height: 12px;
      background: var(--surface, #fff);
      border-left: 1px solid var(--dynadrill-purple, #662e9b);
      border-top: 1px solid var(--dynadrill-purple, #662e9b);
      transform: translateX(-50%) rotate(45deg);
    }

    :host-context(.app-timeline-popover-panel--above) .app-timeline-card::before {
      top: auto;
      bottom: -7px;
      border-left: none;
      border-top: none;
      border-right: 1px solid var(--dynadrill-purple, #662e9b);
      border-bottom: 1px solid var(--dynadrill-purple, #662e9b);
    }

    .app-timeline-card__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }

    .app-timeline-card__eyebrow {
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: var(--dynadrill-purple, #662e9b);
    }

    .app-timeline-card__title {
      margin: 0;
      font-size: 19px;
    }

    .app-timeline-card__grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px 24px;
    }

    @media (max-width: 560px) {
      .app-timeline-card__grid {
        grid-template-columns: 1fr;
      }
    }

    .app-timeline-card__item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      /* Sin esto, un grid item no se achica más allá del contenido (min-width: auto
         por default) y un valor largo sin espacios (ej. un email de responsable)
         desborda la tarjeta en vez de ajustarse a la columna. */
      min-width: 0;
    }

    .app-timeline-card__label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      color: var(--text-muted, #5c5870);
    }

    .app-timeline-card__value {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 14.5px;
      font-weight: 600;
      color: var(--text, #2c2b35);
      min-width: 0;
      /* Un valor largo sin espacios (ej. un email de responsable) tiene que poder
         romper línea — si no, desborda la tarjeta en vez de ajustarse. */
      overflow-wrap: anywhere;
    }

    .app-timeline-card__value dynadrill-icon {
      flex-shrink: 0;
      /* Alinea el ícono con la primera línea si el texto termina ocupando varias. */
      margin-top: 1px;
    }

    .app-timeline-card__footer {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding-top: 10px;
      border-top: 1px solid var(--border, #e5e4ea);
      font-size: 13px;
      color: var(--text-muted, #5c5870);
    }
  `],
})
export class TimelineComponent {
  readonly tramo = input.required<TimelineTramo>();
  /** Número de fase (1-based) — el mismo índice que ya usa el stepper de cada módulo. */
  readonly faseIndice = input.required<number>();
  /** Texto ya resuelto de la fase (cada módulo usa su propio mapa de labels) — no un `(fase) => string` genérico, este componente ya no recorre ninguna lista de fases. */
  readonly faseLabel = input.required<string>();
  readonly esFaseActual = input(false);
  readonly responsableRolActual = input<string | null>(null);

  protected readonly macroEstadoLabels = MACRO_ESTADO_LABELS;
  protected readonly macroEstadoTones = MACRO_ESTADO_TONE;
}
