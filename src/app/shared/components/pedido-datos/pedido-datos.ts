import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DynadrillIconComponent } from '@digitec-it-projects/dynadrill-ui';
import { fechaDoc } from '../../documentos/documento-format.util';

/** Lo que muestra el bloque — el `Pedido` de Facturación lo cumple tal cual (no se acopla `shared` a ese módulo). */
export interface PedidoDatosInput {
  campo?: string;
  bloque?: string;
  pozo?: string;
  taladroRig?: string;
  numeroContrato?: string;
  agenteComercial?: string;
  representanteCampo?: string;
  fechaInicioServicio?: string;
  fechaFinServicio?: string;
}

/**
 * Datos del Pedido en el detalle de los tickets FCR y Pumping, como la grilla de
 * una orden de trabajo: celdas separadas por líneas finas. El cliente NO va acá:
 * ya está en la tarjeta de resumen de arriba del ticket. Primero dónde y cuándo
 * (ubicación a media fila, inicio y fin) y después referencias y personas.
 * Las filas siempre quedan completas (4 / 2 / 1 columnas) para que la grilla
 * de líneas no deje huecos.
 */
@Component({
  selector: 'app-pedido-datos',
  imports: [DynadrillIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = pedido();
    <dl class="pedido-datos">
      <div class="pedido-datos__campo pedido-datos__campo--media">
        <dt class="pedido-datos__etiqueta"><dynadrill-icon name="location" [size]="14" />Ubicación</dt>
        <dd class="pedido-datos__valor">{{ ubicacion() }}</dd>
      </div>
      <div class="pedido-datos__campo">
        <dt class="pedido-datos__etiqueta"><dynadrill-icon name="calendar" [size]="14" />Fecha de inicio</dt>
        <dd class="pedido-datos__valor">{{ fecha(p.fechaInicioServicio) }}</dd>
      </div>
      <div class="pedido-datos__campo">
        <dt class="pedido-datos__etiqueta"><dynadrill-icon name="calendar" [size]="14" />Fecha de fin</dt>
        <dd class="pedido-datos__valor">{{ fecha(p.fechaFinServicio) }}</dd>
      </div>
      <div class="pedido-datos__campo">
        <dt class="pedido-datos__etiqueta"><dynadrill-icon name="tool" [size]="14" />Taladro</dt>
        <dd class="pedido-datos__valor">{{ p.taladroRig || '—' }}</dd>
      </div>
      <div class="pedido-datos__campo">
        <dt class="pedido-datos__etiqueta"><dynadrill-icon name="file-text" [size]="14" />N° de contrato</dt>
        <dd class="pedido-datos__valor">{{ p.numeroContrato || '—' }}</dd>
      </div>
      <div class="pedido-datos__campo">
        <dt class="pedido-datos__etiqueta"><dynadrill-icon name="users" [size]="14" />Agente comercial</dt>
        <dd class="pedido-datos__valor">{{ p.agenteComercial || '—' }}</dd>
      </div>
      <div class="pedido-datos__campo">
        <dt class="pedido-datos__etiqueta"><dynadrill-icon name="users" [size]="14" />Representante de campo</dt>
        <dd class="pedido-datos__valor">{{ p.representanteCampo || '—' }}</dd>
      </div>
    </dl>
  `,
  styles: `
    /* Líneas finas: el fondo del contenedor es el color del borde y asoma por el gap de 1px entre celdas blancas. */
    .pedido-datos {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1px;
      margin: 0;
      overflow: hidden;
      border: 1px solid var(--border, #e5e4ea);
      border-radius: 0.5rem;
      background: var(--border, #e5e4ea);
    }

    .pedido-datos__campo {
      display: flex;
      flex-direction: column;
      gap: 0.1875rem;
      min-width: 0;
      padding: 0.625rem 0.875rem;
      background: var(--surface, #fff);
    }
    .pedido-datos__campo--media {
      grid-column: span 2;
    }

    .pedido-datos__etiqueta {
      display: flex;
      align-items: center;
      gap: 0.3125rem;
      font-size: 0.625rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--text-muted, #5c5870);
    }

    .pedido-datos__valor {
      margin: 0;
      overflow-wrap: anywhere;
      font-size: 0.8125rem;
      font-weight: 600;
      line-height: 1.35;
      color: var(--text, #2c2b35);
    }

    @media (max-width: 840px) {
      .pedido-datos {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 480px) {
      .pedido-datos {
        grid-template-columns: minmax(0, 1fr);
      }
      .pedido-datos__campo--media {
        grid-column: 1 / -1;
      }
    }
  `,
})
export class PedidoDatos {
  readonly pedido = input.required<PedidoDatosInput>();

  protected readonly ubicacion = computed(() => {
    const p = this.pedido();
    // El catálogo a veces ya trae la palabra ("BLOQUE 61"): no se repite ("Bloque BLOQUE 61").
    const conPrefijo = (prefijo: string, valor?: string) => valor && (new RegExp(`^${prefijo}\\b`, 'i').test(valor) ? valor : `${prefijo} ${valor}`);
    const partes = [p.campo, conPrefijo('Bloque', p.bloque), conPrefijo('Pozo', p.pozo)].filter(Boolean);
    return partes.length ? partes.join(' · ') : '—';
  });

  protected readonly fecha = (iso?: string): string => (iso ? fechaDoc(iso) : '—');
}
