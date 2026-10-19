import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillTagComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';
import { RESULTADO_ETIQUETA, type InspeccionDetalle } from '../models/inspeccion';
import { InspeccionesService } from '../services/inspecciones.service';

export interface InspeccionDetalleDialogData {
  inspeccionId: string;
}

/** Una inspección ya registrada (es historia: no se edita): criterios evaluados, resultado y vigencia. */
@Component({
  selector: 'app-inspeccion-detalle-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [DatePipe, DynadrillButtonComponent, DynadrillTagComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (i(); as x) {
      <header class="id__cab">
        <div>
          <strong>{{ x.codigo }}</strong> · {{ x.tipo.nombre }} · {{ x.equipoCodigo }}
          <div class="id__meta">
            Inspector: {{ x.inspector }} · {{ x.fecha | date: 'dd/MM/yyyy' }} · Vale hasta el
            {{ x.vigenteHasta | date: 'dd/MM/yyyy' }}
          </div>
          @if (x.unidadCodigo) {
            <div class="id__meta">Unidad de Flota: {{ x.unidadCodigo }}</div>
          }
          @if (x.bumpTestRealizado !== null) {
            <div class="id__meta">Bump test: {{ x.bumpTestRealizado ? 'sí' : 'no' }}</div>
          }
        </div>
        <dynadrill-tag [variant]="x.resultado === 'aprobado' ? 'success' : 'error'">{{
          resultados[x.resultado]
        }}</dynadrill-tag>
      </header>
      <ul class="id__lista">
        @for (c of x.criterios; track c.criterio) {
          <li>
            <span>{{ c.criterio }}</span>
            <dynadrill-tag [variant]="c.cumple ? 'success' : 'error'">{{
              c.cumple ? 'Cumple' : 'Falla'
            }}</dynadrill-tag>
          </li>
        }
      </ul>
      @if (x.observaciones) {
        <p class="id__txt"><strong>Observaciones:</strong> {{ x.observaciones }}</p>
      }
      <footer class="id__pie">
        <dynadrill-button variant="secondary" (clicked)="cerrar()">Cerrar</dynadrill-button>
      </footer>
    } @else {
      <dynadrill-text variant="caption">Consultando…</dynadrill-text>
    }
  `,
  styles: `
    .id__cab {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .id__meta {
      font-size: 12px;
      color: #6b6a77;
      margin-top: 2px;
    }
    .id__lista {
      list-style: none;
      margin: 0 0 8px;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .id__lista li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      font-size: 13.5px;
    }
    .id__txt {
      font-size: 13.5px;
    }
    .id__pie {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #ecebf1;
    }
  `,
})
export class InspeccionDetalleDialog {
  private readonly data = inject<InspeccionDetalleDialogData>(NZ_MODAL_DATA);
  private readonly servicio = inject(InspeccionesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<InspeccionDetalleDialog>);

  protected readonly resultados = RESULTADO_ETIQUETA;
  protected readonly i = signal<InspeccionDetalle | null>(null);

  constructor() {
    this.servicio.detalle(this.data.inspeccionId).subscribe({
      next: (x) => this.i.set(x),
      error: (err) => {
        this.notify.error('Error', mensajeDeError(err, 'No se pudo cargar la inspección.'));
        this.modalRef.close();
      },
    });
  }

  protected cerrar(): void {
    this.modalRef.close();
  }
}
