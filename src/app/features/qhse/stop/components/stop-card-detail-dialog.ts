import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillContextCardComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTagComponent,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
  type DynadrillContextCardItem,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { StopCard, StopChecklistItem, STOP_ESTADO_LABELS } from '../models/stop-card.model';
import { StopCardService } from '../services/stop-card.service';

export interface StopCardDetailDialogData {
  card: StopCard;
}

const DESTINO_OPCIONES: DynadrillSelectOption[] = [
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'qhse', label: 'QHSE (se resuelve internamente)' },
  { value: 'otro', label: 'Otro departamento' },
];

/**
 * Detalle de una Tarjeta STOP (DYN-SGI-RE-008) — solo lectura del checklist,
 * más el ciclo de vida (Fase 4, PLAN-QHSE-FASE2-PTW-STOP-EPI-DESECHOS):
 * derivar (a Mantenimiento/QHSE/otro) o cerrar. Backend gatea estas dos
 * acciones a solo QHSE (class-level `@Roles`) — esta pantalla ya solo la ve
 * staff HSE, así que no hace falta repetir el chequeo acá.
 */
import { DocumentoPdfService } from '../../../../shared/documentos';
import { TarjetaStopHoja } from '../../../../shared/documentos/formatos/tarjeta-stop-hoja';

@Component({
  selector: 'app-stop-card-detail-dialog',
  imports: [
    DatePipe,
    DynadrillContextCardComponent,
    DynadrillTagComponent,
    DynadrillTextComponent,
    DynadrillButtonComponent,
    DynadrillSelectComponent,
    DynadrillTextareaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stop-card-detail-dialog.html',
  styleUrl: './stop-card-detail-dialog.scss',
})
export class StopCardDetailDialog {
  private readonly data = inject<StopCardDetailDialogData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<StopCardDetailDialog, StopCard | undefined>);
  private readonly stopService = inject(StopCardService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly documentoPdf = inject(DocumentoPdfService);

  protected readonly card = signal(this.data.card);
  protected readonly estadoLabels = STOP_ESTADO_LABELS;
  protected readonly destinoOpciones = DESTINO_OPCIONES;

  protected readonly destino = signal<'mantenimiento' | 'qhse' | 'otro'>('mantenimiento');
  protected readonly observacion = signal('');
  protected readonly submitting = signal(false);

  protected readonly reporteItems = computed<DynadrillContextCardItem[]>(() => {
    const c = this.card();
    return [
      { label: 'Nombre', value: c.observadorNombre },
      { label: 'Fecha', value: c.fecha },
      { label: 'Locación', value: c.locacion },
      { label: 'Operadora', value: c.operadora },
      { label: 'Contacto', value: c.contacto || '—' },
      { label: 'Equipo/unidad relacionado', value: c.equipoCodigo || '—' },
    ];
  });

  /** Solo los ítems que el observador realmente marcó — el resto de los ~55 quedaron sin tocar y no aportan al detalle. */
  private marcados(bloque: StopChecklistItem['bloque']): StopChecklistItem[] {
    return this.card().checklist.filter(i => i.bloque === bloque && i.estado !== null);
  }

  protected readonly accionesMarcados = computed(() => this.marcados('acciones'));
  protected readonly condicionesMarcados = computed(() => this.marcados('condiciones'));

  protected onDestinoChange(value: string | number | (string | number)[] | null): void {
    if (typeof value === 'string') this.destino.set(value as 'mantenimiento' | 'qhse' | 'otro');
  }

  protected derivar(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.stopService.derivar(this.card().id, this.destino(), this.observacion().trim() || undefined).subscribe({
      next: actualizada => {
        this.submitting.set(false);
        this.card.set(actualizada);
        this.notify.success('Derivada', `Tarjeta STOP ${actualizada.code} derivada.`);
        this.modalRef.close(actualizada);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo derivar la tarjeta STOP.');
      },
    });
  }

  protected cerrar(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.stopService.cerrar(this.card().id).subscribe({
      next: actualizada => {
        this.submitting.set(false);
        this.card.set(actualizada);
        this.notify.success('Cerrada', `Tarjeta STOP ${actualizada.code} cerrada.`);
        this.modalRef.close(actualizada);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo cerrar la tarjeta STOP.');
      },
    });
  }

  /** Formato DYN-SGI-RE-008 (2 páginas, sin sección de firmas). */
  protected verPdf(): void {
    const tarjeta = this.card();
    this.documentoPdf.abrir({
      titulo: `Tarjeta de observación — ${tarjeta.code}`,
      component: TarjetaStopHoja,
      inputs: { tarjeta },
      nombreArchivo: `Tarjeta de observación ${tarjeta.code}`,
    });
  }
}
