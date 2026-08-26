import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  type DynadrillKpiRowItem,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { ArticulosService } from '../../services/articulos.service';
import { Articulo } from '../../models/articulo.model';
import { ArticuloFormDialog, ArticuloFormDialogData } from '../../components/articulo-form-dialog';

@Component({
  selector: 'app-articulo-list-page',
  imports: [
    DynadrillScreenHeaderComponent,
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

  protected readonly loading = signal(true);
  protected readonly articulos = signal<Articulo[]>([]);
  protected readonly filtroCategoria = signal<string | null>(null);

  protected readonly categoriaOptions = computed<DynadrillSelectOption[]>(() => {
    const categorias = new Set(this.articulos().map(a => a.categoria));
    return [...categorias].sort().map(c => ({ label: c, value: c }));
  });

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
