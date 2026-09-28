import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { Pedido } from '../../models/pedido.model';
import { Prefactura } from '../../models/prefactura.model';
import { PedidoService, PrefacturaService } from '../../services/pedido.service';
import { KpiStat, KpiStatTone } from '../../../../shared/components/kpi-stat/kpi-stat';

const ESTADO_TONO: Record<Prefactura['estado'], 'neutral' | 'warning' | 'success' | 'error'> = {
  borrador: 'neutral',
  en_revision: 'warning',
  generada: 'warning',
  enviada_para_firmas: 'warning',
  firmada: 'success',
  rechazada: 'error',
};

const ESTADO_LABEL: Record<Prefactura['estado'], string> = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  generada: 'Generada',
  enviada_para_firmas: 'Enviada para firmas',
  firmada: 'Firmada',
  rechazada: 'Rechazada',
};

/** Fase 4 — índice de prefacturas (Figma "03 · Facturación › Prefacturas · Lista"). */
@Component({
  selector: 'app-prefacturas-list-page',
  imports: [
    DynadrillScreenHeaderComponent,
    KpiStat,
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

  protected readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 840px)')
      .pipe(map(state => state.matches)),
    { initialValue: false },
  );

  protected readonly loading = signal(true);
  protected readonly prefacturas = signal<Prefactura[]>([]);
  private readonly pedidos = signal<Pedido[]>([]);
  protected readonly busqueda = signal('');

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Prefactura', sortable: true },
    { key: 'cliente', header: 'Cliente', sortable: true },
    { key: 'pedido', header: 'Pedido' },
    { key: 'fecha', header: 'Generación', sortable: true },
    { key: 'subtotal', header: 'Subtotal' },
    { key: 'neto', header: 'Neto a cobrar' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  private pedidoDe(id: number): Pedido | undefined {
    return this.pedidos().find(p => p.id === id);
  }

  private readonly prefacturasFiltradas = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return this.prefacturas()
      .filter(pf => !q || [pf.code, this.pedidoDe(pf.pedidoId)?.cliente ?? '', this.pedidoDe(pf.pedidoId)?.code ?? ''].some(v => v.toLowerCase().includes(q)))
      .sort((a, b) => b.code.localeCompare(a.code, undefined, { numeric: true }));
  });

  protected readonly rows = computed(() =>
    this.prefacturasFiltradas().map(pf => {
      const p = this.pedidoDe(pf.pedidoId);
      return {
        id: pf.id,
        code: pf.code,
        cliente: p?.cliente ?? '—',
        pedido: p?.code ?? String(pf.pedidoId),
        fecha: new Date(pf.fechaGeneracion).toLocaleDateString('es-EC'),
        subtotal: '$' + pf.subtotal.toFixed(2),
        neto: '$' + pf.netoCobrar.toFixed(2),
        estadoTexto: ESTADO_LABEL[pf.estado],
        estadoTono: ESTADO_TONO[pf.estado],
        estadoBadge: { text: pf.estado.replace(/_/g, ' '), tone: ESTADO_TONO[pf.estado] },
      };
    }),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  protected readonly kpis = computed<{ value: number | string; label: string; caption: string; tone: KpiStatTone }[]>(() => {
    const pf = this.prefacturas();
    return [
      { value: pf.length, label: 'Prefacturas', caption: 'Generadas este mes', tone: 'neutral' },
      { value: pf.filter(p => p.estado === 'firmada').length, label: 'Firmadas', caption: 'Listas para OT', tone: 'success' },
      {
        value: pf.filter(p => p.estado === 'enviada_para_firmas' || p.estado === 'generada').length,
        label: 'Esperando firma',
        caption: 'Enviadas al cliente',
        tone: 'brand',
      },
      { value: '$' + pf.reduce((s, p) => s + p.netoCobrar, 0).toFixed(2), label: 'Total neto', caption: 'Acumulado', tone: 'info' },
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
