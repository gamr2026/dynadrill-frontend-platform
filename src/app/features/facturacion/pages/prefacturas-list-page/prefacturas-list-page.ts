import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
} from '@digitec-it-projects/dynadrill-ui';
import {
  ESTADO_PREFACTURA_LABELS,
  type EstadoPrefactura,
  type PrefacturaFila,
} from '../../pedidos-comercial/models/prefactura-comercial';
import { PrefacturasComercialService } from '../../pedidos-comercial/services/prefacturas-comercial.service';
import { mensajeDeError } from '../../pedidos-comercial/models/pedido-comercial.model';
import {
  PrefacturasFiltros,
  PrefacturasFiltrosDialog,
} from '../../components/prefacturas-filtros-dialog';
import { SearchField } from '../../../../shared/components/search-field/search-field';
import { KpiStat, KpiStatTone } from '../../../../shared/components/kpi-stat/kpi-stat';

const ESTADO_TONO: Record<EstadoPrefactura, 'neutral' | 'warning' | 'success' | 'error'> = {
  generada: 'warning',
  enviada_para_firmas: 'warning',
  firmada: 'success',
  rechazada: 'error',
  anulada: 'neutral',
};

/** Fase 4 — índice de prefacturas (Figma "03 · Facturación › Prefacturas · Lista"). */
@Component({
  selector: 'app-prefacturas-list-page',
  imports: [
    SearchField,
    DynadrillScreenHeaderComponent,
    KpiStat,
    DynadrillDataTableComponent,
    DynadrillButtonComponent,
    DynadrillSpinnerComponent,
    DynadrillIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prefacturas-list-page.html',
  styleUrl: './prefacturas-list-page.scss',
})
export class PrefacturasListPage {
  private readonly servicio = inject(PrefacturasComercialService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);
  private readonly dialog = inject(DynadrillDialogService);

  protected readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 840px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly loading = signal(true);
  protected readonly prefacturas = signal<PrefacturaFila[]>([]);
  protected readonly busqueda = signal('');
  protected readonly filtroEstado = signal<EstadoPrefactura | null>(null);

  protected readonly hayFiltros = computed(() => !!this.filtroEstado());

  /** Chips de filtros activos (móvil) — tocar uno lo quita. */
  protected readonly filtrosActivos = computed(() => {
    const estado = this.filtroEstado();
    return estado
      ? [{ key: 'estado' as const, label: `Estado: ${ESTADO_PREFACTURA_LABELS[estado]}` }]
      : [];
  });

  protected quitarFiltro(): void {
    this.filtroEstado.set(null);
  }

  protected limpiarFiltros(): void {
    this.filtroEstado.set(null);
  }

  protected abrirFiltros(): void {
    const ref = this.dialog.open<PrefacturasFiltrosDialog, PrefacturasFiltros>({
      title: 'Filtros',
      content: PrefacturasFiltrosDialog,
      data: { estado: this.filtroEstado() },
      size: 'small',
      footer: false,
    });
    ref.afterClose.subscribe((f: PrefacturasFiltros | undefined) => {
      if (f) this.filtroEstado.set(f.estado);
    });
  }

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Prefactura', sortable: true },
    { key: 'cliente', header: 'Cliente', sortable: true },
    { key: 'pedido', header: 'Pedido' },
    { key: 'fecha', header: 'Generación', sortable: true },
    { key: 'subtotal', header: 'Subtotal' },
    { key: 'neto', header: 'Neto a cobrar' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  private readonly prefacturasFiltradas = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return this.prefacturas()
      .filter(
        (pf) =>
          (!this.filtroEstado() || pf.estado === this.filtroEstado()) &&
          (!q ||
            [this.codigo(pf), pf.clienteNombre ?? '', pf.pedidoCodigo ?? ''].some((v) =>
              v.toLowerCase().includes(q),
            )),
      )
      .sort((a, b) => b.generadaAt.localeCompare(a.generadaAt));
  });

  /** «PRC-<ticket>» cuando AS2 ya le dio número; si no, el pedido con la versión (V1, V2…). */
  private codigo(pf: PrefacturaFila): string {
    return pf.ticketNumero
      ? `PRC-${pf.ticketNumero}`
      : `${pf.pedidoCodigo ?? 'Prefactura'} V${pf.version}`;
  }

  protected readonly rows = computed(() =>
    this.prefacturasFiltradas().map((pf) => {
      return {
        id: pf.id,
        code: this.codigo(pf),
        cliente: pf.clienteNombre ?? '—',
        pedido: pf.pedidoCodigo ?? '—',
        fecha: new Date(pf.generadaAt).toLocaleDateString('es-EC'),
        subtotal: '$' + pf.subtotal.toFixed(2),
        neto: '$' + pf.netoCobrar.toFixed(2),
        estadoTexto: ESTADO_PREFACTURA_LABELS[pf.estado],
        estadoTono: ESTADO_TONO[pf.estado],
        estadoBadge: { text: ESTADO_PREFACTURA_LABELS[pf.estado], tone: ESTADO_TONO[pf.estado] },
      };
    }),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  protected readonly kpis = computed<
    { value: number | string; label: string; caption: string; tone: KpiStatTone }[]
  >(() => {
    const pf = this.prefacturas();
    return [
      { value: pf.length, label: 'Prefacturas', caption: 'Todas las versiones', tone: 'neutral' },
      {
        value: pf.filter((p) => p.estado === 'firmada').length,
        label: 'Firmadas',
        caption: 'Listas para OT',
        tone: 'success',
      },
      {
        value: pf.filter((p) => p.estado === 'enviada_para_firmas' || p.estado === 'generada')
          .length,
        label: 'Esperando firma',
        caption: 'Enviadas al cliente',
        tone: 'warning',
      },
      {
        value: '$' + pf.reduce((s, p) => s + p.netoCobrar, 0).toFixed(2),
        label: 'Total neto',
        caption: 'Neto a cobrar',
        tone: 'brand',
      },
    ];
  });

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.servicio.indice().subscribe({
      next: (prefacturas) => {
        this.prefacturas.set(prefacturas);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error(
          'Error',
          mensajeDeError(err, 'No se pudo cargar la lista de prefacturas.'),
        );
      },
    });
  }

  protected verDetalle(row: Record<string, unknown>): void {
    this.router.navigate(['/dashboard/facturacion/prefacturas', row['id']]);
  }
}
