import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DynadrillButtonComponent,
  DynadrillChipGroupComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillIconComponent,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  type DynadrillKpiRowItem,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { ArticulosService } from '../../services/articulos.service';
import { Articulo } from '../../models/articulo.model';
import { ArticuloFormDialog, ArticuloFormDialogData } from '../../components/articulo-form-dialog';
import { injectNarrowViewport } from '../../../../core/utils/narrow-viewport.util';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { RecordCard, type RecordCardData } from '../../../../shared/components/record-card/record-card';
import { SearchField } from '../../../../shared/components/search-field/search-field';
import { ListPager } from '../../../../shared/components/list-pager/list-pager';
import { createPagination } from '../../../../shared/utils/pagination.util';

/** Chip de "sin filtro" en móvil. */
const TODAS = 'Todas';
const PAGE_SIZE = 10;

@Component({
  selector: 'app-articulo-list-page',
  imports: [
    PageHeader,
    RecordCard,
    SearchField,
    ListPager,
    DynadrillChipGroupComponent,
    DynadrillIconComponent,
    DynadrillKpiRowComponent,
    DynadrillDataTableComponent,
    DynadrillButtonComponent,
    DynadrillSelectComponent,
    DynadrillSpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './articulo-list-page.html',
  styleUrl: './articulo-list-page.scss',
})
export class ArticuloListPage {
  private readonly articulosService = inject(ArticulosService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);

  /** Móvil: chips de categoría + buscador + tarjetas paginadas (M · Artículos · Lista en Figma). */
  protected readonly isMobile = injectNarrowViewport();

  protected readonly loading = signal(true);
  protected readonly articulos = signal<Articulo[]>([]);
  protected readonly filtroCategoria = signal<string | null>(null);

  protected readonly categoriaOptions = computed<DynadrillSelectOption[]>(() => {
    const categorias = new Set(this.articulos().map(a => a.categoria));
    return [...categorias].sort().map(c => ({ label: c, value: c }));
  });

  protected readonly categoriaChips = computed(() => [TODAS, ...this.categoriaOptions().map(o => String(o.value))]);
  /** Búsqueda por código o nombre — solo móvil; en escritorio la tabla ya busca por columna. */
  protected readonly query = signal('');

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.articulos();
    return [
      { label: 'Artículos', value: all.length },
      { label: 'Activos', value: all.filter(a => a.activo).length },
      { label: 'Sin stock', value: all.filter(a => a.stockActual <= 0).length },
    ];
  });

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'codigo', header: 'Código', sortable: true, searchable: true },
    { key: 'nombre', header: 'Nombre', searchable: true },
    { key: 'categoria', header: 'Categoría', sortable: true },
    { key: 'subcategoria', header: 'Subcategoría' },
    { key: 'stockLabel', header: 'Stock', sortable: true },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  protected readonly rows = computed(() => {
    const filtro = this.filtroCategoria();
    return this.articulos()
      .filter(a => !filtro || a.categoria === filtro)
      .map(a => ({
        id: a.id,
        codigo: a.codigo,
        nombre: a.nombre,
        categoria: a.categoria,
        subcategoria: a.subcategoria,
        stockLabel: `${a.stockActual} ${a.unidadStock}`,
        estadoBadge: a.activo ? { text: 'Activo', tone: 'success' as const } : { text: 'Inactivo', tone: 'neutral' as const },
      }));
  });

  protected readonly cards = computed<(RecordCardData & { id: number })[]>(() => {
    const filtro = this.filtroCategoria();
    const q = this.query().trim().toLocaleLowerCase('es');
    return this.articulos()
      .filter(a => !filtro || a.categoria === filtro)
      .filter(a => !q || a.codigo.toLocaleLowerCase('es').includes(q) || a.nombre.toLocaleLowerCase('es').includes(q))
      .map(a => ({
        id: a.id,
        eyebrow: a.codigo,
        title: a.nombre,
        subtitle: `${a.categoria} · ${a.subcategoria}`,
        status: a.activo ? { text: 'Activo', tone: 'success' } : { text: 'Inactivo', tone: 'neutral' },
        fields: [
          { label: 'Categoría', value: a.categoria },
          { label: 'Stock', value: `${a.stockActual} ${a.unidadStock}` },
          { label: 'Subcategoría', value: a.subcategoria },
        ],
        actions: [{ icon: 'eye', label: 'Ver detalle', run: () => this.viewDetail({ id: a.id }) }],
      }));
  });
  protected readonly pagination = createPagination(this.cards, PAGE_SIZE);

  protected onCategoriaChip(selected: string[]): void {
    const value = selected[0];
    if (!value) return;
    this.filtroCategoria.set(value === TODAS ? null : value);
    this.pagination.reset();
  }

  protected onQueryChange(query: string): void {
    this.query.set(query);
    this.pagination.reset();
  }

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.articulosService.list().subscribe({
      next: articulos => {
        this.articulos.set(articulos);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar el listado de artículos.');
      },
    });
  }

  protected viewDetail(row: Record<string, unknown>): void {
    this.router.navigate(['/dashboard/inventario/articulos', row['id']]);
  }

  protected nuevoArticulo(): void {
    const ref = this.dialog.open<ArticuloFormDialog, ArticuloFormDialogData>({
      title: 'Nuevo artículo',
      content: ArticuloFormDialog,
      data: {},
      footer: false,
    });
    ref.afterClose.subscribe(created => {
      if (created) this.reload();
    });
  }
}
