import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillIconComponent,
  DynadrillNotificationService,
} from '@digitec-it-projects/dynadrill-ui';
import { DocumentoPdfService } from '../../../../../shared/documentos';
import {
  ReporteHerramientasHoja,
  type FilaDetalle,
} from '../../../../../shared/documentos/formatos/reporte-herramientas-hoja';
import {
  ReporteJobHoja,
  type ReporteJobExtras,
} from '../../../../../shared/documentos/formatos/reporte-job-hoja';
import type {
  OperativoActivityLogEntry,
  OperativoDocHeader,
  OperativoToolRef,
  OperativoToolUsageEntry,
} from '../../../../../shared/models/operativo-docs.model';
import { mensajeErrorTicket, type TicketFcr } from '../models/ticket-fcr';
import { TicketsFcrService } from '../services/tickets-fcr.service';

const dia = (iso: string): string => iso.slice(0, 10).split('-').reverse().join('/');

/**
 * Documentos que sube el Operador al finalizar la ejecución, listos para revisar: el Reporte de Trabajo (bitácora) y el Reporte de
 * Herramientas DYN-FCR-RE-008, armado con los ítems de la lista de precios del pedido y lo realmente usado.
 */
@Component({
  selector: 'app-ticket-fcr-reportes-revision',
  imports: [DynadrillBannerComponent, DynadrillButtonComponent, DynadrillIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="r">
      <strong class="r__titulo">Documentos subidos por el Operador</strong>
      @if (error(); as e) {
        <dynadrill-banner variant="warning" [message]="e" />
      }
      <ul class="r__lista">
        <li>
          <span class="r__nombre"
            ><dynadrill-icon name="file-text" [size]="18" /> Reporte de trabajo</span
          >
          <dynadrill-button
            variant="secondary"
            size="small"
            [disabled]="!!ocupado()"
            (clicked)="verReporteTrabajo()"
            >Ver PDF</dynadrill-button
          >
        </li>
        <li>
          <span class="r__nombre"
            ><dynadrill-icon name="file-text" [size]="18" /> Reporte de herramientas</span
          >
          <dynadrill-button
            variant="secondary"
            size="small"
            [disabled]="!!ocupado()"
            (clicked)="verReporteHerramientas()"
            >Ver PDF</dynadrill-button
          >
        </li>
      </ul>
    </div>
  `,
  styles: `
    .r {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: var(--surface-muted, #faf9fc);
      border: 1px solid var(--border, #e5e4ea);
      border-radius: 0.5rem;
      max-width: 28rem;
    }
    .r__titulo {
      font-size: 0.875rem;
    }
    .r__lista {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .r__lista li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      background: var(--surface, #fff);
      border: 1px solid var(--border, #e5e4ea);
      border-radius: 0.375rem;
    }
    .r__nombre {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
    }
  `,
})
export class TicketFcrReportesRevision {
  private readonly servicio = inject(TicketsFcrService);
  private readonly pdf = inject(DocumentoPdfService);
  private readonly notify = inject(DynadrillNotificationService);

  readonly ticket = input.required<TicketFcr>();
  /** Representante del cliente en campo (lo trae el pedido, si quien consulta puede leerlo). */
  readonly representanteCliente = input<string | null>(null);

  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);

  private encabezado(): OperativoDocHeader {
    const t = this.ticket();
    return {
      code: String(t.ticketNumero ?? t.pedidoCodigo),
      cliente: t.cliente ?? '',
      pozo: t.pozo ?? '',
      supervisor: t.asignacion.supervisor?.nombre,
      operador: t.asignacion.operadores[0]?.nombre,
    };
  }

  /** La hoja de las herramientas: una fila por ítem de la lista de precios, con sus marcas por día o su cantidad real. */
  protected verReporteHerramientas(descargar = false): void {
    const t = this.ticket();
    this.ocupado.set(true);
    this.error.set(null);
    forkJoin({ reporte: this.servicio.reporte(t.id), uso: this.servicio.uso(t.id) }).subscribe({
      next: ({ reporte, uso }) => {
        this.ocupado.set(false);
        const tools: OperativoToolRef[] = [];
        const usageLog: OperativoToolUsageEntry[] = [];
        reporte.items.forEach((it, i) => {
          tools.push({
            id: i + 1,
            name: it.descripcion,
            codigo: it.codigo,
            serialCode: it.serie ?? undefined,
            unidad: it.unidad,
          });
          for (const d of it.dias)
            usageLog.push({
              id: usageLog.length + 1,
              toolId: i + 1,
              date: d.fecha,
              status: d.estado,
              // en las filas que no son por día la celda lleva la cantidad aplicada ese día
              ...(it.porDia ? {} : { cantidad: d.cantidad }),
            });
        });
        const detallePicker: FilaDetalle[] = uso.usos.map((u) => ({
          herramienta: u.nombre,
          fecha: dia(u.fecha),
          tipo: u.tipoTrabajo ?? u.tipoCompletacion ?? '',
          picker: u.tipoPicker ?? '',
          presion: u.presion === null ? '' : String(u.presion),
          peso: u.peso === null ? '' : String(u.peso),
          observacion: u.observacion ?? '',
        }));
        this.pdf.abrir({
          titulo: 'Reporte de Herramientas',
          component: ReporteHerramientasHoja,
          inputs: { header: this.encabezado(), tools, usageLog, detallePicker },
          orientacion: 'landscape',
          nombreArchivo: `Reporte de Herramientas ${this.encabezado().code}`,
          descargar,
        });
      },
      error: (err) => {
        this.ocupado.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo armar el Reporte de Herramientas.'));
      },
    });
  }

  /** El Reporte de Trabajo con todas las actividades de la bitácora, día por día. */
  protected verReporteTrabajo(descargar = false): void {
    const t = this.ticket();
    this.ocupado.set(true);
    this.error.set(null);
    this.servicio.bitacora(t.id).subscribe({
      next: (b) => {
        const dias = b.dias.filter((d) => d.actividades > 0);
        if (!dias.length) {
          this.ocupado.set(false);
          this.notify.warning('Sin actividades', 'La bitácora todavía no tiene actividades.');
          return;
        }
        forkJoin(dias.map((d) => this.servicio.dia(t.id, d.fecha))).subscribe({
          next: (detalles) => {
            this.ocupado.set(false);
            const log: OperativoActivityLogEntry[] = [];
            for (const d of detalles) {
              for (const a of d.actividades)
                log.push({
                  id: log.length + 1,
                  date: d.fecha.slice(0, 10),
                  startTime: a.horaInicio,
                  endTime: a.horaFin,
                  durationHours: a.duracionHoras,
                  detail: a.detalle,
                  author: a.autor.nombre,
                });
            }
            if (!log.length) {
              this.notify.warning('Sin actividades', 'La bitácora todavía no tiene actividades.');
              return;
            }
            const extras: ReporteJobExtras = {
              campoBloque: [t.campo, t.bloque].filter(Boolean).join(' / '),
              taladro: t.taladro ?? '',
              ordenContrato: t.numeroContrato ?? '',
              representanteCliente: this.representanteCliente() ?? '',
              cargoRepresentante: 'Representante de Campo',
            };
            this.pdf.abrir({
              titulo: 'Reporte de Trabajo',
              component: ReporteJobHoja,
              inputs: { header: this.encabezado(), log, extras },
              nombreArchivo: `Reporte diario de actividades ${this.encabezado().code}`,
              descargar,
            });
          },
          error: (err) => {
            this.ocupado.set(false);
            this.error.set(mensajeErrorTicket(err, 'No se pudo armar el Reporte de Trabajo.'));
          },
        });
      },
      error: (err) => {
        this.ocupado.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo leer la bitácora.'));
      },
    });
  }
}
