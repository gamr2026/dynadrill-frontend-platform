import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillCardComponent,
  DynadrillKpiRowComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  type DynadrillKpiRowItem,
} from '@digitec-it-projects/dynadrill-ui';
import { calcularPrefactura, DocumentacionDiaria, Otq } from '../../models/facturacion.model';
import { OtqService, DocumentacionDiariaService, ExcepcionService } from '../../services/facturacion.service';
import { OtqDialog } from '../../components/otq-dialog';
import { NotificationsService, AppNotificationItem } from '../../../../core/services/notifications.service';

/** Presupuesto aprobado simulado — hasta que la OTQ real venga de AS2, se usa el total de sus propios ítems como aproximación. */
function presupuestoDe(otq: Otq): number {
  return otq.items.reduce((sum, i) => sum + i.total, 0);
}

@Component({
  selector: 'app-pedido-facturacion-list-page',
  imports: [
    DecimalPipe,
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillCardComponent,
    DynadrillTagComponent,
    DynadrillButtonComponent,
    DynadrillSpinnerComponent,
    DynadrillBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pedido-facturacion-list-page.html',
  styleUrl: './pedido-facturacion-list-page.scss',
})
export class PedidoFacturacionListPage {
  private readonly otqService = inject(OtqService);
  private readonly docService = inject(DocumentacionDiariaService);
  private readonly excepcionService = inject(ExcepcionService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notifications = inject(NotificationsService);

  protected readonly loading = signal(true);
  protected readonly otqs = signal<Otq[]>([]);
  protected readonly excepcionesActivas = signal<Set<number>>(new Set());

  protected readonly viewCards = computed(() => {
    const docs = this.docsSignal();
    return this.otqs().map(otq => {
      const pre = calcularPrefactura(otq.pedidoId, presupuestoDe(otq), docs, otq.items);
      const tono: 'success' | 'warning' | 'error' = pre.porcentajeConsumido >= 100 ? 'error' : pre.porcentajeConsumido >= 80 ? 'warning' : 'success';
      return {
        otqId: otq.id,
        pedidoId: otq.pedidoId,
        numero: otq.numero,
        cliente: otq.cliente,
        pozo: otq.pozo,
        campo: otq.campo,
        presupuesto: presupuestoDe(otq),
        acumulado: pre.acumulado,
        porcentaje: pre.porcentajeConsumido,
        tono,
        conExcepcion: this.excepcionesActivas().has(otq.pedidoId),
      };
    });
  });

  private readonly docsSignal = signal<DocumentacionDiaria[]>([]);

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const cards = this.viewCards();
    return [
      { label: 'Pedidos con Prefactura activa', value: cards.length, tone: 'neutral' },
      { label: 'Cerca del límite (≥80%)', value: cards.filter(c => c.tono === 'warning').length, tone: 'warning' },
      { label: 'Sobrepasados', value: cards.filter(c => c.tono === 'error').length, tone: 'error' },
      { label: 'Con excepción activa', value: cards.filter(c => c.conExcepcion).length, tone: 'brand' },
    ];
  });

  /** FACT-002 — alertas 80/95/100% de presupuesto consumido, vía la campanita ya existente. */
  private readonly notificationItems = computed<AppNotificationItem[]>(() =>
    this.viewCards()
      .filter(c => c.porcentaje >= 80)
      .map(c => ({
        id: `facturacion-${c.otqId}`,
        title: c.porcentaje >= 100 ? `${c.numero} sobrepasó el presupuesto` : `${c.numero} cerca del límite de presupuesto`,
        description: `${c.cliente} — ${c.porcentaje}% consumido ($${c.acumulado.toFixed(2)} de $${c.presupuesto.toFixed(2)})`,
        tone: c.porcentaje >= 100 ? 'error' : 'warning',
        link: '/dashboard/facturacion/pedidos/' + c.pedidoId,
      })),
  );

  constructor() {
    this.reload();

    effect(() => this.notifications.setSource('facturacion', this.notificationItems()));
    inject(DestroyRef).onDestroy(() => this.notifications.clearSource('facturacion'));
  }

  private reload(): void {
    this.loading.set(true);
    forkJoin({ otqs: this.otqService.list(), documentacion: this.docService.list(), excepciones: this.excepcionService.list() }).subscribe({
      next: ({ otqs, documentacion, excepciones }) => {
        this.otqs.set(otqs);
        this.docsSignal.set(documentacion);
        this.excepcionesActivas.set(new Set(excepciones.filter(e => e.estado === 'en_negociacion').map(e => e.pedidoId)));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar la lista de pedidos en facturación.');
      },
    });
  }

  protected verDetalle(pedidoId: number): void {
    this.router.navigate(['/dashboard/facturacion/pedidos', pedidoId]);
  }

  protected nuevaOtq(): void {
    const ref = this.dialog.open<OtqDialog>({ title: 'Nueva OTQ (Orden de Trabajo)', content: OtqDialog, footer: false, width: '720px' });
    ref.afterClose.subscribe(otq => {
      if (otq) this.reload();
    });
  }
}
