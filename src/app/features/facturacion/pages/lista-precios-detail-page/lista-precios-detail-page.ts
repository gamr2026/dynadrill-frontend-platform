import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, debounceTime, EMPTY, firstValueFrom, switchMap, tap } from 'rxjs';
import * as XLSX from 'xlsx';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillChipGroupComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import {
  mensajeDeError,
  type ItemLista,
  type ListaPreciosResumen,
  type Pagina,
} from '../../pedidos-comercial/models/pedido-comercial.model';
import { ListasPreciosComercialService } from '../../pedidos-comercial/services/listas-precios-comercial.service';
import { ListPager } from '../../../../shared/components/list-pager/list-pager';
import { SearchField } from '../../../../shared/components/search-field/search-field';
import type { Pagination } from '../../../../shared/utils/pagination.util';
import { useDetailChrome } from '../../../../layout/page-chrome.service';

const TODOS = 'Todos';
/** Ítems por página: el catálogo de un cliente puede pasar de mil filas. */
const ITEMS_POR_PAGINA = 25;

/** Detalle de una lista de precios, de solo lectura: la cabecera con sus totales y los ítems, que se buscan y paginan en el servidor (una lista puede pasar de dos mil). */
@Component({
  selector: 'app-lista-precios-detail-page',
  imports: [
    DecimalPipe,
    ListPager,
    SearchField,
    DynadrillScreenHeaderComponent,
    DynadrillTagComponent,
    DynadrillButtonComponent,
    DynadrillSpinnerComponent,
    DynadrillBannerComponent,
    DynadrillChipGroupComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lista-precios-detail-page.html',
  styleUrl: './lista-precios-detail-page.scss',
})
export class ListaPreciosDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly servicio = inject(ListasPreciosComercialService);
  private readonly notify = inject(DynadrillNotificationService);

  private readonly listaId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly loading = signal(true);
  protected readonly lista = signal<ListaPreciosResumen | null>(null);
  /** Los ítems de la página que se está viendo. */
  private readonly itemsPagina = signal<ItemLista[]>([]);
  private readonly totalFiltrado = signal(0);
  private readonly pagina = signal(1);

  // ── Búsqueda + filtro por tipo (Figma "D · Listas de precios · Detalle") ──
  protected readonly busqueda = signal('');
  protected readonly tipoChips = [TODOS, 'Servicio', 'Material'];
  protected readonly tipoFiltro = signal<'Servicio' | 'Material' | null>(null);
  protected readonly tipoSeleccionado = computed(() => [this.tipoFiltro() ?? TODOS]);

  protected onTipoChip(selected: string[]): void {
    const v = selected[0];
    this.tipoFiltro.set(v === 'Servicio' || v === 'Material' ? v : null);
    this.pagina.set(1);
  }

  protected onBusqueda(valor: string): void {
    this.busqueda.set(valor);
    this.pagina.set(1);
  }

  protected readonly items = computed(() => this.itemsPagina());

  /** Paginación contra el servidor: cambiar de página vuelve a consultar (la búsqueda y el tipo reinician en la primera). */
  protected readonly pagination: Pagination<ItemLista> = {
    page: this.pagina.asReadonly(),
    totalPages: computed(() => Math.max(1, Math.ceil(this.totalFiltrado() / ITEMS_POR_PAGINA))),
    pageItems: this.itemsPagina.asReadonly(),
    total: this.totalFiltrado.asReadonly(),
    range: computed(() => {
      const total = this.totalFiltrado();
      if (!total) return { from: 0, to: 0 };
      const from = (this.pagina() - 1) * ITEMS_POR_PAGINA + 1;
      return { from, to: Math.min(from + ITEMS_POR_PAGINA - 1, total) };
    }),
    goTo: (page) => this.pagina.set(page),
    reset: () => this.pagina.set(1),
  };

  /**
   * Totales por tipo de la lista COMPLETA, no de lo filtrado por la búsqueda o el chip (Figma: el contador "N ítems" del
   * encabezado sigue al filtro; los "Totales" del pie son del catálogo entero). La suma es de precios unitarios, no un total a cobrar.
   */
  protected readonly totalServicio = computed(() => this.lista()?.servicios?.cantidad ?? 0);
  protected readonly totalMaterial = computed(() => this.lista()?.materiales?.cantidad ?? 0);
  protected readonly sumaServicio = computed(() => this.lista()?.servicios?.suma ?? 0);
  protected readonly sumaMaterial = computed(() => this.lista()?.materiales?.suma ?? 0);

  constructor() {
    this.cargarCabecera();

    // Los ítems se piden al servidor cuando cambia la búsqueda, el tipo o la página (la búsqueda espera a que se deje de escribir).
    toObservable(
      computed(() => ({ q: this.busqueda().trim(), tipo: this.tipoFiltro(), page: this.pagina() })),
    )
      .pipe(
        debounceTime(250),
        tap(() => this.cargandoItems.set(true)),
        switchMap((c) =>
          this.servicio
            .items(this.listaId, {
              q: c.q || undefined,
              tipo: c.tipo,
              page: c.page,
              limit: ITEMS_POR_PAGINA,
            })
            .pipe(
              catchError((err) => {
                this.cargandoItems.set(false);
                this.notify.error(
                  'Error',
                  mensajeDeError(err, 'No se pudieron cargar los ítems de la lista.'),
                );
                return EMPTY;
              }),
            ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((pagina) => {
        this.itemsPagina.set(pagina.items);
        this.totalFiltrado.set(pagina.total);
        this.cargandoItems.set(false);
      });

    // Barra "Detail" del header (Figma Nav/TopAppBar, solo móvil).
    useDetailChrome(
      () => this.lista()?.clienteNombre ?? 'Lista de precios',
      '/dashboard/facturacion/lista-precios',
      () =>
        this.lista()?.items
          ? [{ label: 'Descargar Excel', action: () => void this.descargarExcel() }]
          : [],
    );
  }

  protected readonly cargandoItems = signal(true);

  private cargarCabecera(): void {
    this.loading.set(true);
    this.servicio.detalle(this.listaId).subscribe({
      next: (l) => {
        this.lista.set(l);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudo cargar la lista de precios.'));
      },
    });
  }

  /** El Excel lleva la lista completa, no solo la página: se pide por tandas de 200. */
  protected async descargarExcel(): Promise<void> {
    const l = this.lista();
    if (!l) return;
    try {
      const todos: ItemLista[] = [];
      let respuesta: Pagina<ItemLista>;
      let page = 1;
      do {
        respuesta = await firstValueFrom(this.servicio.items(this.listaId, { page, limit: 200 }));
        todos.push(...respuesta.items);
        page++;
      } while (todos.length < respuesta.total && respuesta.items.length);
      const filas = todos.map((i) => ({
        Código: i.codigo,
        Descripción: i.descripcion,
        Unidad: i.unidad ?? '',
        Precio: i.precio,
        Tipo: i.tipo,
      }));
      const sheet = XLSX.utils.json_to_sheet(filas);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Lista de precios');
      XLSX.writeFile(
        book,
        `Lista-de-precios-${l.clienteNombre ?? 'cliente'}-${l.numeroContrato ?? l.id}.xlsx`,
      );
    } catch (err) {
      this.notify.error(
        'No se pudo descargar',
        mensajeDeError(err, 'No se pudo armar el Excel de la lista. Intente de nuevo.'),
      );
    }
  }
}
