import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { DocumentoPdfService } from '../../../../../shared/documentos';
import { ChecklistHerramientaHoja } from '../../../../../shared/documentos/formatos/checklist-herramienta-hoja';
import {
  ESTADO_INSPECCION_LABELS,
  ESTADO_INSPECCION_TONO,
  FIRMA_LABELS,
  FIRMAS,
  mensajeErrorTicket,
  type InspeccionHerramienta,
  type TicketFcr,
} from '../models/ticket-fcr';
import { TicketsFcrService } from '../services/tickets-fcr.service';
import { inspeccionAFormato } from './inspeccion-formato';

interface FilaInspeccion {
  herramientaId: string;
  nombre: string;
  codigo: string;
  inspeccion: InspeccionHerramienta | null;
}

const dia = (iso: string | null): string =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—';
const responsable = (r: 'dynadrill' | 'proveedor_externo' | null): string =>
  r === 'dynadrill' ? 'Dynadrill' : r === 'proveedor_externo' ? 'Proveedor externo' : '—';

/**
 * Detalle de las inspecciones de las herramientas seleccionadas para inspeccionar (solo consulta): estado, fechas, quién inspeccionó y reparó,
 * resumen de las partes, firmas y el formato «Registro de inspección y reparación de herramientas» (DYN-FCR-RE-009) con lo registrado.
 */
@Component({
  selector: 'app-ticket-fcr-inspecciones-detalle',
  imports: [DynadrillBannerComponent, DynadrillButtonComponent, DynadrillTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error(); as e) {
      <dynadrill-banner variant="warning" [message]="e" />
    }
    <div class="d__tabla">
      <table>
        <caption class="sr-only">
          Detalle de las inspecciones de las herramientas seleccionadas
        </caption>
        <thead>
          <tr>
            <th scope="col">Herramienta</th>
            <th scope="col">Inspección</th>
            <th scope="col">Fechas</th>
            <th scope="col">Inspeccionó / reparó</th>
            <th scope="col">Partes</th>
            <th scope="col">Firmas</th>
            <th scope="col"><span class="sr-only">Formato</span></th>
          </tr>
        </thead>
        <tbody>
          @for (f of filas(); track f.herramientaId) {
            <tr>
              <td>
                {{ f.nombre }} <span class="d__meta">{{ f.codigo }}</span>
                @if (f.inspeccion?.numeroSerie) {
                  <div class="d__meta">Serie {{ f.inspeccion?.numeroSerie }}</div>
                }
              </td>
              @if (f.inspeccion; as i) {
                <td>
                  <dynadrill-tag
                    [label]="estadoTxt(i.estado) + ' · v' + i.version"
                    [variant]="tono(i.estado)"
                    [uppercase]="false"
                  />
                  @if (i.motivoRechazo) {
                    <div class="d__nov">Devuelta: {{ i.motivoRechazo }}</div>
                  }
                </td>
                <td class="d__meta">
                  Inspección: {{ dia(i.fechaInspeccion) }}<br />Reparación:
                  {{ dia(i.fechaReparacion) }}
                </td>
                <td class="d__meta">
                  {{ responsable(i.inspeccionadoPor) }} / {{ responsable(i.reparadoPor) }}
                </td>
                <td class="d__meta">{{ resumenPartes(i) }}</td>
                <td class="d__meta">{{ firmasTxt(i) }}</td>
                <td>
                  <dynadrill-button variant="secondary" size="small" (clicked)="verFormato(i)"
                    >Ver formato</dynadrill-button
                  >
                </td>
              } @else {
                <td colspan="6" class="d__meta">Sin inspección iniciada.</td>
              }
            </tr>
          } @empty {
            <tr>
              <td colspan="7" class="d__meta">
                {{
                  cargado() ? 'No hay herramientas seleccionadas para inspeccionar.' : 'Cargando…'
                }}
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .d__tabla {
      overflow-x: auto;
    }
    .d__tabla table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }
    .d__tabla th,
    .d__tabla td {
      padding: 0.5rem 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--border-default, #e0e0e0);
      vertical-align: top;
    }
    .d__tabla thead th {
      font-weight: 600;
      color: var(--text-secondary, #666);
      white-space: nowrap;
      background: var(--dynadrill-purple-tint, rgba(102, 46, 155, 0.06));
    }
    .d__tabla tbody tr:nth-child(even) {
      background: var(--surface-muted, #faf9fc);
    }
    .d__meta {
      font-size: 0.75rem;
      color: var(--text-secondary, #666);
    }
    .d__nov {
      font-size: 0.75rem;
      color: #8a4b00;
    }
  `,
})
export class TicketFcrInspeccionesDetalle {
  private readonly servicio = inject(TicketsFcrService);
  private readonly pdf = inject(DocumentoPdfService);

  readonly ticket = input.required<TicketFcr>();

  protected readonly filas = signal<FilaInspeccion[]>([]);
  protected readonly cargado = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly dia = dia;
  protected readonly responsable = responsable;
  protected readonly estadoTxt = (e: keyof typeof ESTADO_INSPECCION_LABELS) =>
    ESTADO_INSPECCION_LABELS[e];
  protected readonly tono = (e: keyof typeof ESTADO_INSPECCION_TONO) => ESTADO_INSPECCION_TONO[e];

  constructor() {
    effect(() => {
      this.ticket().version;
      untracked(() => this.cargar());
    });
  }

  protected firmasTxt(i: InspeccionHerramienta): string {
    const hechas = FIRMAS.filter((r) => i.firmas[r]);
    return hechas.length
      ? hechas.map((r) => `${FIRMA_LABELS[r]}: ${i.firmas[r]?.nombre}`).join(' · ')
      : '—';
  }

  /** «8 revisadas · 1 defectuosa · 2 con cambio»: lo que ya se llenó de las partes de la herramienta. */
  protected resumenPartes(i: InspeccionHerramienta): string {
    const total = i.partes.length;
    if (!total) return 'Sin partes';
    const revisadas = i.partes.filter((p) => p.visual || p.endResultado).length;
    const defectuosas = i.partes.filter(
      (p) => p.visual === 'defectuoso' || p.endResultado === 'defectuoso',
    ).length;
    const cambio = i.partes.filter((p) => (p.cambioCantidad ?? 0) > 0).length;
    return `${revisadas} de ${total} revisadas · ${defectuosas} defectuosas · ${cambio} con cambio`;
  }

  private cargar(): void {
    const id = this.ticket().id;
    this.servicio.inspecciones(id).subscribe({
      next: (lista) => {
        const poner = (detalles: InspeccionHerramienta[]) => {
          const porId = new Map(detalles.map((d) => [d.herramientaId, d]));
          this.filas.set(
            lista.map((r) => ({
              herramientaId: r.herramientaId,
              nombre: r.nombre,
              codigo: r.codigo,
              inspeccion: porId.get(r.herramientaId) ?? null,
            })),
          );
          this.cargado.set(true);
        };
        const con = lista.flatMap((r) => (r.inspeccion ? [r.inspeccion.id] : []));
        if (!con.length) return poner([]);
        forkJoin(con.map((inspeccionId) => this.servicio.inspeccion(id, inspeccionId))).subscribe({
          next: poner,
          error: (err) =>
            this.error.set(
              mensajeErrorTicket(err, 'No se pudo leer el detalle de las inspecciones.'),
            ),
        });
      },
      error: (err) => {
        this.cargado.set(true);
        this.error.set(mensajeErrorTicket(err, 'No se pudo cargar las inspecciones.'));
      },
    });
  }

  protected verFormato(i: InspeccionHerramienta): void {
    this.pdf.abrir({
      titulo: `Inspección y reparación — ${i.descripcionHerramienta}`,
      component: ChecklistHerramientaHoja,
      inputs: { inspeccion: inspeccionAFormato(i) },
      nombreArchivo:
        `Inspección y reparación ${i.descripcionHerramienta} ${i.numeroSerie ?? ''}`.trim(),
    });
  }
}
