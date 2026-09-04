import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  type DynadrillKpiRowItem,
} from '@digitec-it-projects/dynadrill-ui';
import { Pedido } from '../../models/pedido.model';
import { Prefactura } from '../../models/prefactura.model';
import { PedidoService, PrefacturaService } from '../../services/pedido.service';

const ESTADO_TONO: Record<Prefactura['estado'], 'neutral' | 'warning' | 'success' | 'error'> = {
  borrador: 'neutral',
  en_revision: 'warning',
  generada: 'warning',
  enviada_para_firmas: 'warning',
  firmada: 'success',
  rechazada: 'error',
};

/** Fase 4 — índice de prefacturas. */
@Component({
  selector: 'app-prefacturas-list-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillDataTableComponent,
    DynadrillButtonComponent,
    DynadrillSpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prefacturas-list-page.html',
  styleUrl: './prefacturas-list-page.scss',
})
export class PrefacturasListPage {
  private readonly prefacturaService = inject(PrefacturaService);
  private readonly pedidoService = inject(PedidoService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly prefacturas = signal<Prefactura[]>([]);
  private readonly pedidos = signal<Pedido[]>([]);

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Prefactura', sortable: true, searchable: true },
    { key: 'cliente', header: 'Cliente', sortable: true, searchable: true },
    { key: 'pedido', header: 'Pedido', searchable: true },
    { key: 'fecha', header: 'Generación', sortable: true },
    { key: 'subtotal', header: 'Subtotal' },
    { key: 'neto', header: 'Neto a cobrar' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  private pedidoDe(id: number): Pedido | undefined {
    return this.pedidos().find(p => p.id === id);
  }

  protected readonly rows = computed(() =>
    this.prefacturas().map(pf => {
      const p = this.pedidoDe(pf.pedidoId);
      return {
        id: pf.id,
        code: pf.code,
        cliente: p?.cliente ?? '—',
        pedido: p?.code ?? String(pf.pedidoId),
        fecha: new Date(pf.fechaGeneracion).toLocaleDateString('es-EC'),
        subtotal: '$' + pf.subtotal.toFixed(2),
        neto: '$' + pf.netoCobrar.toFixed(2),
        estadoBadge: { text: pf.estado.replace(/_/g, ' '), tone: ESTADO_TONO[pf.estado] },
      };
    }),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const pf = this.prefacturas();
    return [
      { label: 'Prefacturas', value: pf.length, tone: 'neutral' },
      { label: 'Firmadas', value: pf.filter(p => p.estado === 'firmada').length, tone: 'success' },
      { label: 'Esperando firma', value: pf.filter(p => p.estado === 'enviada_para_firmas' || p.estado === 'generada').length, tone: 'warning' },
      { label: 'Total neto', value: '$' + pf.reduce((s, p) => s + p.netoCobrar, 0).toFixed(2), tone: 'brand' },
    ];
  });

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    forkJoin({ prefacturas: this.prefacturaService.list(), pedidos: this.pedidoService.list() }).subscribe({
      next: ({ prefacturas, pedidos }) => {
        this.prefacturas.set(prefacturas);
        this.pedidos.set(pedidos);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar la lista de prefacturas.');
      },
    });
  }

  protected verDetalle(row: Record<string, unknown>): void {
    this.router.navigate(['/dashboard/facturacion/prefacturas', row['id']]);
  }
}
