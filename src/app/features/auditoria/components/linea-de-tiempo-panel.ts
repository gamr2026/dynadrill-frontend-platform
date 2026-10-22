import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillEmptyStateComponent,
  DynadrillSkeletonComponent,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { NZ_DRAWER_DATA } from 'ng-zorro-antd/drawer';
import { mensajeError } from '../../roles-permisos/models/roles-permisos.model';
import {
  datosLegibles,
  etiquetaEvento,
  etiquetaOrigen,
  etiquetaSujeto,
  type CatalogosAuditoria,
  type EventoAuditado,
} from '../models/auditoria.model';
import { AuditoriaService } from '../services/auditoria.service';

export interface LineaDeTiempoPanelData {
  sujetoTipo: string;
  sujetoId: string;
  claves: CatalogosAuditoria['claves'];
}

const POR_PAGINA = 50;

/** Contenido del drawer «Línea de tiempo»: todo lo que pasó con una entidad, en orden cronológico (incluye los hechos que la nombran). */
@Component({
  selector: 'app-linea-de-tiempo-panel',
  imports: [
    DatePipe,
    DynadrillButtonComponent,
    DynadrillEmptyStateComponent,
    DynadrillSkeletonComponent,
    DynadrillTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="linea__intro">
      {{ sujeto }} <code>{{ data.sujetoId }}</code>
    </p>

    @if (cargando() && eventos().length === 0) {
      <div class="linea__lista" role="status" aria-label="Cargando la línea de tiempo…">
        @for (placeholder of [1, 2, 3, 4]; track placeholder) {
          <dynadrill-skeleton variant="block" height="72px" />
        }
      </div>
    } @else if (error()) {
      <p class="linea__error" role="alert">{{ error() }}</p>
      <dynadrill-button variant="secondary" (clicked)="cargar()">Reintentar</dynadrill-button>
    } @else if (eventos().length === 0) {
      <dynadrill-empty-state
        title="Sin hechos registrados"
        description="Todavía no hay hechos auditados para esta entidad."
      />
    } @else {
      <ol class="linea__lista">
        @for (e of eventos(); track e.id) {
          <li class="linea__item">
            <div class="linea__cabecera">
              <strong>{{ etiqueta(e) }}</strong>
              <dynadrill-tag [label]="origen(e)" variant="neutral" [uppercase]="false" />
            </div>
            <span class="linea__meta">
              {{ e.ocurridoAt | date: 'dd/MM/yyyy HH:mm:ss' : '' : 'es' }} ·
              {{ e.actor ? e.actor.nombre : 'Sistema' }}
              @if (e.actor?.rol; as r) {
                ({{ r.nombre }})
              }
            </span>
            <code class="linea__codigo">{{ e.tipo }}</code>
            @if (datos(e).length) {
              <dl class="linea__datos">
                @for (d of datos(e); track d.etiqueta) {
                  <div>
                    <dt>{{ d.etiqueta }}</dt>
                    <dd>{{ d.valor }}</dd>
                  </div>
                }
              </dl>
            }
          </li>
        }
      </ol>
      @if (hayMas()) {
        <dynadrill-button variant="secondary" [disabled]="cargando()" (clicked)="cargarMas()"
          >Cargar más</dynadrill-button
        >
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .linea__intro {
      margin: 0 0 16px;
      color: var(--text-muted, #5c5870);
      font-size: 14px;
      overflow-wrap: anywhere;
    }
    .linea__error {
      margin: 0 0 12px;
      color: var(--error, #cf1322);
      font-size: 14px;
    }
    .linea__lista {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 0 0 16px;
      padding: 0;
      list-style: none;
    }
    .linea__item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px;
      border: var(--border-width, 1px) solid var(--border, #e5e4ea);
      border-left: 4px solid var(--dynadrill-purple, #662e9b);
      border-radius: var(--radius-sm, 8px);
    }
    .linea__cabecera {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .linea__meta {
      color: var(--text-muted, #5c5870);
      font-size: 13px;
    }
    .linea__codigo {
      color: var(--text-muted, #5c5870);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .linea__datos {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 6px 16px;
      margin: 6px 0 0;
    }
    .linea__datos div {
      display: flex;
      flex-direction: column;
    }
    .linea__datos dt {
      color: var(--text-muted, #5c5870);
      font-size: 12px;
    }
    .linea__datos dd {
      margin: 0;
      font-size: 14px;
      overflow-wrap: anywhere;
    }
  `,
})
export class LineaDeTiempoPanel {
  protected readonly data = inject<LineaDeTiempoPanelData>(NZ_DRAWER_DATA);
  private readonly servicio = inject(AuditoriaService);

  protected readonly sujeto = etiquetaSujeto(this.data.sujetoTipo);
  protected readonly eventos = signal<EventoAuditado[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  private pagina = 1;

  protected readonly etiqueta = (e: EventoAuditado) => etiquetaEvento(e.tipo);
  protected readonly origen = (e: EventoAuditado) => etiquetaOrigen(e.origen);
  protected readonly datos = (e: EventoAuditado) => datosLegibles(e.datos, this.data.claves);

  constructor() {
    this.cargar();
  }

  protected hayMas(): boolean {
    return this.eventos().length < this.total();
  }

  protected cargar(): void {
    this.pagina = 1;
    this.eventos.set([]);
    this.pedir();
  }

  protected cargarMas(): void {
    this.pagina += 1;
    this.pedir();
  }

  private pedir(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.servicio
      .lineaDeTiempo(this.data.sujetoTipo, this.data.sujetoId, this.pagina, POR_PAGINA)
      .subscribe({
        next: (r) => {
          this.eventos.update((actuales) => [...actuales, ...r.items]);
          this.total.set(r.total);
          this.cargando.set(false);
        },
        error: (err) => {
          this.cargando.set(false);
          this.error.set(
            mensajeError(err, 'No se pudo cargar la línea de tiempo. Intente de nuevo.'),
          );
        },
      });
  }
}
