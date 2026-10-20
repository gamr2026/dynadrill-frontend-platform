import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillBannerComponent,
  DynadrillDialogService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { DocumentoPdfService } from '../../../../../shared/documentos';
import { AotHoja } from '../../../../../shared/documentos/formatos/aot-hoja';
import {
  OrdenTrabajoDialog,
  type OrdenTrabajoDialogData,
} from '../../components/orden-trabajo-dialog/orden-trabajo-dialog';
import {
  PERMISOS_ORDENES,
  aHojaAot,
  mensajeErrorOrden,
  type OrdenTrabajo,
} from '../../models/orden-trabajo';
import { formatoDia } from '../../models/pedido-comercial.model';
import { OrdenesTrabajoComercialService } from '../../services/ordenes-trabajo-comercial.service';

/**
 * Orden de trabajo (OT) del pedido con la presentación de la demo: el documento (estado, ir al pedido, ver e imprimir el formato, marcar
 * como firmada), sus datos y el detalle de costos. La OT sale de la prefactura firmada; su firma es física.
 */
@Component({
  selector: 'app-orden-trabajo-comercial-detail-page',
  imports: [
    DatePipe,
    DecimalPipe,
    DynadrillBannerComponent,
    DynadrillScreenHeaderComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orden-trabajo-comercial-detail-page.html',
  styleUrl: './orden-trabajo-comercial-detail-page.scss',
})
export class OrdenTrabajoComercialDetailPage {
  private readonly servicio = inject(OrdenesTrabajoComercialService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly pdf = inject(DocumentoPdfService);
  private readonly auth = inject(AuthService);

  private readonly pedidoId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly requiere = signal(false);
  protected readonly orden = signal<OrdenTrabajo | null>(null);

  protected readonly puedeFirmar = computed(() => this.auth.can(PERMISOS_ORDENES.firmar));
  protected readonly dia = formatoDia;

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.loading.set(true);
    this.servicio.delPedido(this.pedidoId).subscribe({
      next: (d) => {
        this.orden.set(d.orden);
        this.requiere.set(d.requiere);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(mensajeErrorOrden(err, 'No se pudo cargar la orden de trabajo.'));
      },
    });
  }

  protected irAlPedido(): void {
    void this.router.navigate(['/dashboard/facturacion/pedidos', this.pedidoId]);
  }

  protected verPdf(): void {
    const o = this.orden();
    if (!o) return;
    this.pdf.abrir({
      titulo: `Orden de trabajo ${o.codigo} — Vista de impresión`,
      component: AotHoja,
      inputs: { aot: aHojaAot(o) },
      nombreArchivo: `Orden de trabajo ${o.codigo}`,
    });
  }

  protected marcarFirmada(): void {
    const o = this.orden();
    if (!o) return;
    const ref = this.dialog.open<OrdenTrabajoDialog, OrdenTrabajoDialogData>({
      title: 'Marcar la orden de trabajo como firmada',
      content: OrdenTrabajoDialog,
      data: { tipo: 'firmada', pedidoId: this.pedidoId, ordenId: o.id },
      footer: false,
      width: '520px',
    });
    ref.afterClose.subscribe((r: unknown) => {
      if (r) this.cargar();
    });
  }
}
