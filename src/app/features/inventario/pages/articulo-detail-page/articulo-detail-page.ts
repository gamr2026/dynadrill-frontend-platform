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
import { AuthService } from '../../../../core/services/auth.service';
import { InventarioPlataformaService } from '../../services/inventario-plataforma.service';
import {
  formatearCantidad,
  mensajeErrorInventario,
  MOVIMIENTO_TIPO_LABELS,
  type ArticuloInventarioDetalle,
  type MinimoStock,
  type MovimientoKardex,
  type ParteArticulo,
} from '../../models/inventario-plataforma.model';
import { ArticuloFormDialog, ArticuloFormDialogData } from '../../components/articulo-form-dialog';
import { MovimientoDialog, MovimientoDialogData } from '../../components/movimiento-dialog';
import { MinimoStockDialog, MinimoStockDialogData } from '../../components/minimo-stock-dialog';
import {
  ArticuloParteFormDialog,
  ArticuloParteFormDialogData,
} from '../../components/articulo-parte-form-dialog';
import { injectNarrowViewport } from '../../../../core/utils/narrow-viewport.util';
import { useDetailChrome } from '../../../../layout/page-chrome.service';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

const TIPO_TONE: Record<MovimientoKardex['tipo'], DynadrillTagVariant> = {
  entrada: 'success',
  salida: 'warning',
};

/** El kardex muestra los últimos movimientos; el saldo de cada renglón ya trae el acumulado. */
const KARDEX_LIMITE = 200;

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
  private readonly inventario = inject(InventarioPlataformaService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  private readonly articuloId = this.route.snapshot.paramMap.get('id') ?? '';

  /** Móvil: kardex y partes como listas en vez de tablas (M · Artículos · Detalle en Figma). */
  protected readonly isMobile = injectNarrowViewport();

  protected readonly loading = signal(true);
  protected readonly articulo = signal<ArticuloInventarioDetalle | null>(null);
  protected readonly movimientos = signal<MovimientoKardex[]>([]);
  protected readonly partes = signal<ParteArticulo[]>([]);
  protected readonly minimos = signal<MinimoStock[]>([]);
  protected readonly puedeGestionarMinimos = computed(() =>
    this.auth.can('inventario.articulos.gestionar'),
  );
  protected readonly hayBajoMinimo = computed(() => this.minimos().some((m) => m.bajoMinimo));
  protected readonly loadingPartes = signal(false);

  /** La categoría del artículo dice si lleva lista de partes (herramientas). */
  protected readonly esHerramienta = computed(
    () => this.articulo()?.categoria.llevaPartes ?? false,
  );

  protected readonly contextItems = computed<DynadrillContextCardItem[]>(() => {
    const a = this.articulo();
    if (!a) return [];
    const unidad = a.unidadStock.simbolo;
    return [
      { label: 'Código', value: a.codigo },
      { label: 'Código alterno', value: a.codigos.alterno ?? '—' },
      { label: 'Categoría', value: a.categoria.nombre },
      { label: 'Subcategoría', value: a.subcategoria?.nombre ?? '—' },
      { label: 'Unidad de stock', value: a.unidadStock.nombre },
      { label: 'Stock total', value: `${formatearCantidad(a.stockActual)} ${unidad}` },
      ...a.stockPorBodega.map((s) => ({
        label: s.bodega,
        value: `${formatearCantidad(s.stock)} ${unidad}`,
      })),
      {
        label: 'Costo unitario (interno)',
        value: a.costoUnitario === null ? '—' : `$ ${formatearCantidad(a.costoUnitario)}`,
      },
      {
        label: 'Descuento sugerido',
        value: a.descuentoSugerido === null ? '—' : `${formatearCantidad(a.descuentoSugerido)} %`,
      },
    ];
  });

  protected readonly kardexColumns: DynadrillDataTableColumn[] = [
    { key: 'fecha', header: 'Fecha', sortable: true },
    { key: 'tipoBadge', header: 'Tipo', type: 'badge' },
    { key: 'cantidad', header: 'Cantidad' },
    { key: 'bodega', header: 'Bodega' },
    { key: 'motivo', header: 'Motivo' },
    { key: 'responsable', header: 'Responsable' },
    { key: 'saldoResultante', header: 'Saldo en bodega' },
  ];

  protected readonly kardexRows = computed(() => {
    const unidad = this.articulo()?.unidadStock.simbolo ?? '';
    // más reciente primero (el orden estricto del kardex es la secuencia, no la fecha)
    return [...this.movimientos()]
      .sort((a, b) => b.secuencia - a.secuencia)
      .map((m) => ({
        id: m.id,
        fecha: this.fechaCorta(m.fecha),
        tipoBadge: { text: MOVIMIENTO_TIPO_LABELS[m.tipo], tone: TIPO_TONE[m.tipo] },
        cantidad: `${m.tipo === 'salida' ? '-' : '+'}${formatearCantidad(m.cantidad)}`,
        bodega: m.bodega.nombre,
        motivo: m.observacion ? `${m.motivo.nombre} — ${m.observacion}` : m.motivo.nombre,
        responsable: m.responsable.nombre,
        saldoResultante: `${formatearCantidad(m.saldoResultante)} ${unidad}`,
      }));
  });

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
      .map((p) => ({
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
    if (!this.articuloId) {
      this.notify.error('Error', 'El artículo solicitado no es válido.');
      this.router.navigate(['/dashboard/inventario/articulos']);
      return;
    }
    this.reload();
  }

  private fechaCorta(iso: string): string {
    return new Intl.DateTimeFormat('es-EC', { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(iso),
    );
  }

  private reload(): void {
    this.loading.set(true);
    this.inventario.articulo(this.articuloId).subscribe({
      next: (articulo) => {
        this.articulo.set(articulo);
        this.loading.set(false);
        if (articulo.categoria.llevaPartes) this.reloadPartes();
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Error', mensajeErrorInventario(err, 'No se pudo cargar el artículo.'));
      },
    });
    this.reloadKardex();
    this.reloadMinimos();
  }

  private reloadMinimos(): void {
    this.inventario.minimos({ articuloId: this.articuloId }).subscribe({
      next: (minimos) => this.minimos.set(minimos),
      error: (err) =>
        this.notify.error(
          'Error',
          mensajeErrorInventario(err, 'No se pudieron cargar los mínimos de stock.'),
        ),
    });
  }

  private reloadKardex(): void {
    this.inventario.kardex(this.articuloId, { limite: KARDEX_LIMITE }).subscribe({
      next: (movimientos) => this.movimientos.set(movimientos),
      error: (err) =>
        this.notify.error(
          'Error',
          mensajeErrorInventario(err, 'No se pudo cargar el historial de movimientos.'),
        ),
    });
  }

  private reloadPartes(): void {
    this.loadingPartes.set(true);
    this.inventario.partes(this.articuloId).subscribe({
      next: (partes) => {
        this.partes.set(partes);
        this.loadingPartes.set(false);
      },
      error: (err) => {
        this.loadingPartes.set(false);
        this.notify.error(
          'Error',
          mensajeErrorInventario(err, 'No se pudo cargar el catálogo de partes.'),
        );
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
    ref.afterClose.subscribe((updated) => {
      if (updated) {
        this.articulo.set(updated as ArticuloInventarioDetalle);
        // si cambió de categoría, puede haber pasado a llevar (o dejar de llevar) partes
        if ((updated as ArticuloInventarioDetalle).categoria.llevaPartes) this.reloadPartes();
      }
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
    ref.afterClose.subscribe((created) => {
      if (created) this.reload();
    });
  }

  protected textoCantidad(n: number): string {
    return `${formatearCantidad(n)} ${this.articulo()?.unidadStock.simbolo ?? ''}`.trim();
  }

  protected definirMinimos(): void {
    const current = this.articulo();
    if (!current) return;
    const ref = this.dialog.open<MinimoStockDialog, MinimoStockDialogData>({
      title: 'Mínimo de stock',
      content: MinimoStockDialog,
      data: {
        articuloId: this.articuloId,
        unidad: current.unidadStock.simbolo,
        minimos: this.minimos(),
      },
      footer: false,
    });
    ref.afterClose.subscribe((cambio) => {
      if (cambio) this.reloadMinimos();
    });
  }

  protected nuevaParte(): void {
    const ref = this.dialog.open<ArticuloParteFormDialog, ArticuloParteFormDialogData>({
      title: 'Nueva parte',
      content: ArticuloParteFormDialog,
      data: { articuloId: this.articuloId },
      footer: false,
    });
    ref.afterClose.subscribe((created) => {
      if (created) this.reloadPartes();
    });
  }

  protected editarParte(row: Record<string, unknown>): void {
    const parte = this.partes().find((p) => p.id === row['id']);
    if (!parte) return;
    const ref = this.dialog.open<ArticuloParteFormDialog, ArticuloParteFormDialogData>({
      title: 'Editar parte',
      content: ArticuloParteFormDialog,
      data: { articuloId: this.articuloId, parte },
      footer: false,
    });
    ref.afterClose.subscribe((updated) => {
      if (updated) this.reloadPartes();
    });
  }

  protected async eliminarParte(row: Record<string, unknown>): Promise<void> {
    const parte = this.partes().find((p) => p.id === row['id']);
    if (!parte) return;
    const confirmed = await this.dialog.confirm({
      title: `¿Eliminar la parte "${parte.descripcion}"?`,
      content: 'Esta acción no se puede deshacer.',
      okText: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;

    this.inventario.eliminarParte(parte.id).subscribe({
      next: () => {
        this.notify.success('Eliminada', 'Parte eliminada del catálogo.');
        this.reloadPartes();
      },
      error: (err) =>
        this.notify.error('Error', mensajeErrorInventario(err, 'No se pudo eliminar la parte.')),
    });
  }
}
