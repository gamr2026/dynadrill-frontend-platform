import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import { DynadrillContextCardComponent, DynadrillTagComponent, DynadrillTextComponent, type DynadrillContextCardItem } from '@digitec-it-projects/dynadrill-ui';
import { StopCard, StopChecklistItem } from '../models/stop-card.model';

export interface StopCardDetailDialogData {
  card: StopCard;
}

/** Detalle de solo lectura de una Tarjeta STOP (DYN-SGI-RE-008) — igual patrón que VehicleInspectionDetailDialog en Mantenimiento. */
@Component({
  selector: 'app-stop-card-detail-dialog',
  imports: [DynadrillContextCardComponent, DynadrillTagComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stop-card-detail-dialog.html',
  styleUrl: './stop-card-detail-dialog.scss',
})
export class StopCardDetailDialog {
  private readonly data = inject<StopCardDetailDialogData>(NZ_MODAL_DATA);

  protected readonly card = this.data.card;

  protected readonly reporteItems = computed<DynadrillContextCardItem[]>(() => {
    const c = this.card;
    return [
      { label: 'Nombre', value: c.observadorNombre },
      { label: 'Fecha', value: c.fecha },
      { label: 'Locación', value: c.locacion },
      { label: 'Operadora', value: c.operadora },
      { label: 'Contacto', value: c.contacto || '—' },
    ];
  });

  /** Solo los ítems que el observador realmente marcó — el resto de los ~55 quedaron sin tocar y no aportan al detalle. */
  private marcados(bloque: StopChecklistItem['bloque']): StopChecklistItem[] {
    return this.card.checklist.filter(i => i.bloque === bloque && i.estado !== null);
  }

  protected readonly accionesMarcados = computed(() => this.marcados('acciones'));
  protected readonly condicionesMarcados = computed(() => this.marcados('condiciones'));
}
