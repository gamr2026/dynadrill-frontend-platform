import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillButtonComponent,
  DynadrillContextCardComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillIconButtonComponent,
  DynadrillIconComponent,
  DynadrillTagComponent,
  DynadrillTagVariant,
  type DynadrillContextCardItem,
} from '@digitec-it-projects/dynadrill-ui';
import { ArticulosService } from '../../services/articulos.service';
import { MovimientosInventarioService } from '../../services/movimientos-inventario.service';
import { ArticuloPartesService } from '../../services/articulo-partes.service';
import { Articulo, MOVIMIENTO_TIPO_LABELS, MovimientoInventario } from '../../models/articulo.model';
import { ArticuloParte } from '../../models/articulo-parte.model';
import { ArticuloFormDialog, ArticuloFormDialogData } from '../../components/articulo-form-dialog';
import { MovimientoDialog, MovimientoDialogData } from '../../components/movimiento-dialog';
import { ArticuloParteFormDialog, ArticuloParteFormDialogData } from '../../components/articulo-parte-form-dialog';
import { injectNarrowViewport } from '../../../../core/utils/narrow-viewport.util';
import { useDetailChrome } from '../../../../layout/page-chrome.service';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

const TIPO_TONE: Record<MovimientoInventario['tipo'], DynadrillTagVariant> = {
  entrada: 'success',
  salida: 'warning',
};

/**
 * Categorías de `Articulo` que tienen BOM/partes (sección "Partes" de esta pantalla, y el
 * checklist de inspección de FCR que lo consume vía `ArticuloParte.findByArticulo`).
 * Incluye tanto `HERRAMIENTAS` (catálogo de prueba, 51 ítems) como `FISHING & TOOLS`
 * (catálogo real importado, 151 ítems, el que usa FCR para agregar herramientas a un ticket).
 */
const CATEGORIAS_CON_PARTES = new Set(['HERRAMIENTAS', 'FISHING & TOOLS']);

@Component({
  selector: 'app-articulo-detail-page',
  imports: [
    NgTemplateOutlet,
    PageHeader,
    DynadrillIconButtonComponent,
    DynadrillIconComponent,
    DynadrillTagComponent,
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
  private readonly partesService = inject(ArticuloPartesService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  private readonly articuloId = Number(this.route.snapshot.paramMap.get('id'));

  /** Móvil: kardex y partes como listas en vez de tablas (M · Artículos · Detalle en Figma). */
  protected readonly isMobile = injectNarrowViewport();

  protected readonly loading = signal(true);
  protected readonly articulo = signal<Articulo | null>(null);
  protected readonly movimientos = signal<MovimientoInventario[]>([]);
  protected readonly partes = signal<ArticuloParte[]>([]);
  protected readonly loadingPartes = signal(false);

  protected readonly esHerramienta = computed(() => CATEGORIAS_CON_PARTES.has(this.articulo()?.categoria ?? ''));

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

  protected readonly partesColumns: DynadrillDataTableColumn[] = [
    { key: 'item', header: 'Ítem', sortable: true },
    { key: 'codigo', header: 'Código', searchable: true },
    { key: 'descripcion', header: 'Descripción', searchable: true },
    { key: 'cantidadEsperada', header: 'Cantidad esperada' },
  ];

  protected readonly partesRows = computed(() =>
    [...this.partes()]
      .sort((a, b) => a.orden - b.orden)
      .map(p => ({
        id: p.id,
        item: p.item,
        codigo: p.codigo,
        descripcion: p.descripcion,
        cantidadEsperada: p.cantidadEsperada,
      })),
  );

  protected readonly partesRowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    // Móvil: barra "← código" (Nav/TopAppBar Type=Detail) en vez de hamburguesa + logo.
    useDetailChrome(() => this.articulo()?.codigo ?? 'Artículo', '/dashboard/inventario/articulos');
    if (Number.isNaN(this.articuloId)) {
      this.notify.error('Error', 'El artículo solicitado no es válido.');
      this.router.navigate(['/dashboard/inventario/articulos']);
      return;
    }
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.articulosService.get(this.articuloId).subscribe({
      next: articulo => {
        this.articulo.set(articulo);
        this.loading.set(false);
        if (CATEGORIAS_CON_PARTES.has(articulo.categoria)) this.reloadPartes();
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar el artículo.');
      },
    });
    this.movimientosService.list(this.articuloId).subscribe({
      next: movimientos => this.movimientos.set(movimientos),
      error: () => this.notify.error('Error', 'No se pudo cargar el historial de movimientos.'),
    });
  }

  private reloadPartes(): void {
    this.loadingPartes.set(true);
    this.partesService.list(this.articuloId).subscribe({
      next: partes => {
        this.partes.set(partes);
        this.loadingPartes.set(false);
      },
      error: () => {
        this.loadingPartes.set(false);
        this.notify.error('Error', 'No se pudo cargar el catálogo de partes.');
      },
    });
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

  protected nuevaParte(): void {
    const ref = this.dialog.open<ArticuloParteFormDialog, ArticuloParteFormDialogData>({
      title: 'Nueva parte',
      content: ArticuloParteFormDialog,
      data: { articuloId: this.articuloId },
      footer: false,
    });
    ref.afterClose.subscribe(created => {
      if (created) this.reloadPartes();
    });
  }

  protected editarParte(row: Record<string, unknown>): void {
    const parte = this.partes().find(p => p.id === row['id']);
    if (!parte) return;
    const ref = this.dialog.open<ArticuloParteFormDialog, ArticuloParteFormDialogData>({
      title: 'Editar parte',
      content: ArticuloParteFormDialog,
      data: { articuloId: this.articuloId, parte },
      footer: false,
    });
    ref.afterClose.subscribe(updated => {
      if (updated) this.reloadPartes();
    });
  }

  protected async eliminarParte(row: Record<string, unknown>): Promise<void> {
    const parte = this.partes().find(p => p.id === row['id']);
    if (!parte) return;
    const confirmed = await this.dialog.confirm({
      title: `¿Eliminar la parte "${parte.descripcion}"?`,
      content: 'Esta acción no se puede deshacer.',
      okText: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;

    this.partesService.delete(this.articuloId, parte.id).subscribe({
      next: () => {
        this.notify.success('Eliminada', 'Parte eliminada del catálogo.');
        this.reloadPartes();
      },
      error: () => this.notify.error('Error', 'No se pudo eliminar la parte.'),
    });
  }
}
