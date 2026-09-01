import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
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
  imports: [DynadrillScreenHeaderComponent, DynadrillKpiRowComponent, DynadrillDataTableComponent, DynadrillButtonComponent, DynadrillSpinnerComponent],
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
  protected readonly docsSignal = signal<DocumentacionDiaria[]>([]);
  protected readonly excepcionesActivas = signal<Set<number>>(new Set());

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'numero', header: 'OTQ', sortable: true, searchable: true },
    { key: 'cliente', header: 'Cliente', sortable: true, searchable: true },
    { key: 'ubicacion', header: 'Campo / Pozo', searchable: true },
    { key: 'presupuesto', header: 'Presupuesto' },
    { key: 'acumulado', header: 'Acumulado' },
    { key: 'porcentajeBadge', header: '% Consumido', type: 'badge' },
    { key: 'excepcionBadge', header: 'Excepción', type: 'badge' },
  ];

  protected readonly rows = computed(() => {
    const docs = this.docsSignal();
    return this.otqs().map(otq => {
      const pre = calcularPrefactura(otq.pedidoId, presupuestoDe(otq), docs, otq.items);
      const tono: 'success' | 'warning' | 'error' = pre.porcentajeConsumido >= 100 ? 'error' : pre.porcentajeConsumido >= 80 ? 'warning' : 'success';
      return {
        id: otq.id,
        pedidoId: otq.pedidoId,
        numero: otq.numero,
        cliente: otq.cliente,
        ubicacion: `${otq.campo} — ${otq.pozo}`,
        presupuesto: '$' + presupuestoDe(otq).toFixed(2),
        acumulado: '$' + pre.acumulado.toFixed(2),
        porcentajeBadge: { text: pre.porcentajeConsumido + '%', tone: tono },
        excepcionBadge: this.excepcionesActivas().has(otq.pedidoId)
          ? { text: 'En negociación', tone: 'warning' as const }
          : { text: 'Sin excepción', tone: 'neutral' as const },
      };
    });
  });

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const rows = this.rows();
    return [
      { label: 'Pedidos con Prefactura activa', value: rows.length, tone: 'neutral' },
      { label: 'Cerca del límite (≥80%)', value: rows.filter(r => r.porcentajeBadge.tone === 'warning').length, tone: 'warning' },
      { label: 'Sobrepasados', value: rows.filter(r => r.porcentajeBadge.tone === 'error').length, tone: 'error' },
      { label: 'Con excepción activa', value: rows.filter(r => r.excepcionBadge.tone === 'warning').length, tone: 'brand' },
    ];
  });

  /** FACT-002 — alertas 80/95/100% de presupuesto consumido, vía la campanita ya existente. */
  private readonly notificationItems = computed<AppNotificationItem[]>(() =>
    this.rows()
      .filter(r => r.porcentajeBadge.tone !== 'success')
      .map(r => ({
        id: `facturacion-${r.id}`,
        title: r.porcentajeBadge.tone === 'error' ? `${r.numero} sobrepasó el presupuesto` : `${r.numero} cerca del límite de presupuesto`,
        description: `${r.cliente} — ${r.porcentajeBadge.text} consumido (${r.acumulado} de ${r.presupuesto})`,
        tone: r.porcentajeBadge.tone === 'error' ? 'error' : 'warning',
        link: '/dashboard/facturacion/pedidos/' + r.pedidoId,
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

  protected verDetalle(row: Record<string, unknown>): void {
    this.router.navigate(['/dashboard/facturacion/pedidos', row['pedidoId']]);
  }

  protected nuevaOtq(): void {
    const ref = this.dialog.open<OtqDialog>({ title: 'Nueva OTQ (Orden de Trabajo)', content: OtqDialog, footer: false, width: '720px' });
    ref.afterClose.subscribe(otq => {
      if (otq) this.reload();
    });
  }
}
