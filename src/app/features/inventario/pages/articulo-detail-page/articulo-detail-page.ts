import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillButtonComponent,
  DynadrillContextCardComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillTagVariant,
  type DynadrillContextCardItem,
} from '@digitec-it-projects/dynadrill-ui';
import { ArticulosService } from '../../services/articulos.service';
import { MovimientosInventarioService } from '../../services/movimientos-inventario.service';
import { Articulo, MOVIMIENTO_TIPO_LABELS, MovimientoInventario } from '../../models/articulo.model';
import { ArticuloFormDialog, ArticuloFormDialogData } from '../../components/articulo-form-dialog';
import { MovimientoDialog, MovimientoDialogData } from '../../components/movimiento-dialog';

const TIPO_TONE: Record<MovimientoInventario['tipo'], DynadrillTagVariant> = {
  entrada: 'success',
  salida: 'warning',
};

@Component({
  selector: 'app-articulo-detail-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillButtonComponent,
    DynadrillContextCardComponent,
    DynadrillDataTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './articulo-detail-page.html',
  styleUrl: './articulo-detail-page.scss',
})
export class ArticuloDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly articulosService = inject(ArticulosService);
  private readonly movimientosService = inject(MovimientosInventarioService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  private readonly articuloId = Number(this.route.snapshot.paramMap.get('id'));

  protected readonly loading = signal(true);
  protected readonly articulo = signal<Articulo | null>(null);
  protected readonly movimientos = signal<MovimientoInventario[]>([]);

  protected readonly contextItems = computed<DynadrillContextCardItem[]>(() => {
    const a = this.articulo();
    if (!a) return [];
    return [
      { label: 'Código', value: a.codigo },
      { label: 'Código alterno', value: a.codigoAlterno ?? '—' },
      { label: 'Categoría', value: a.categoria },
      { label: 'Subcategoría', value: a.subcategoria },
      { label: 'Unidad de stock', value: a.unidadStock },
      { label: 'Stock actual', value: `${a.stockActual} ${a.unidadStock}` },
    ];
  });

  protected readonly kardexColumns: DynadrillDataTableColumn[] = [
    { key: 'fecha', header: 'Fecha', sortable: true },
    { key: 'tipoBadge', header: 'Tipo', type: 'badge' },
    { key: 'cantidad', header: 'Cantidad' },
    { key: 'motivo', header: 'Motivo' },
    { key: 'responsable', header: 'Responsable' },
    { key: 'saldoResultante', header: 'Saldo' },
  ];

  protected readonly kardexRows = computed(() =>
    [...this.movimientos()]
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id)
      .map(m => ({
        id: m.id,
        fecha: m.fecha,
        tipoBadge: { text: MOVIMIENTO_TIPO_LABELS[m.tipo], tone: TIPO_TONE[m.tipo] },
        cantidad: `${m.tipo === 'salida' ? '-' : '+'}${m.cantidad}`,
        motivo: m.motivo,
        responsable: m.responsable,
        saldoResultante: `${m.saldoResultante} ${this.articulo()?.unidadStock ?? ''}`,
      })),
  );

  protected readonly kardexRowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.articulosService.get(this.articuloId).subscribe({
      next: articulo => {
        this.articulo.set(articulo);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar el artículo.');
      },
    });
    this.movimientosService.list(this.articuloId).subscribe(movimientos => this.movimientos.set(movimientos));
  }

  protected back(): void {
    this.router.navigate(['/dashboard/inventario/articulos']);
  }

  protected editar(): void {
    const current = this.articulo();
    if (!current) return;
    const ref = this.dialog.open<ArticuloFormDialog, ArticuloFormDialogData>({
      title: 'Editar artículo',
      content: ArticuloFormDialog,
      data: { articulo: current },
      footer: false,
    });
    ref.afterClose.subscribe(updated => {
      if (updated) this.articulo.set(updated);
    });
  }

  protected registrarMovimiento(): void {
    const current = this.articulo();
    if (!current) return;
    const ref = this.dialog.open<MovimientoDialog, MovimientoDialogData>({
      title: 'Registrar movimiento',
      content: MovimientoDialog,
      data: { articulo: current },
      footer: false,
    });
    ref.afterClose.subscribe(created => {
      if (created) this.reload();
    });
  }
}
