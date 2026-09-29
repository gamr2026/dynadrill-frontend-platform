import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
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
import { ListaPrecios } from '../../models/lista-precios.model';
import { ListaPreciosService } from '../../services/pedido.service';
import { useDetailChrome } from '../../../../layout/page-chrome.service';

const TODOS = 'Todos';
/** Ítems por página: el catálogo de un cliente puede pasar de mil filas. */
const ITEMS_POR_PAGINA = 25;

/** Fase 2 — detalle de una Lista de Precios: solo lectura (RN: la edición se retiró de la UI, ver listas-precios.controller.ts en el backend). */
@Component({
  selector: 'app-lista-precios-detail-page',
  imports: [
    DecimalPipe,
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
  private readonly listaService = inject(ListaPreciosService);
  private readonly notify = inject(DynadrillNotificationService);

  private readonly listaId = Number(this.route.snapshot.paramMap.get('id'));

  protected readonly loading = signal(true);
  protected readonly lista = signal<ListaPrecios | null>(null);

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

  // ── Paginación ──
  private readonly pagina = signal(1);
  protected readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.items().length / ITEMS_POR_PAGINA)));
  protected readonly paginaActual = computed(() => Math.min(this.pagina(), this.totalPaginas()));
  protected readonly itemsPagina = computed(() => {
    const desde = (this.paginaActual() - 1) * ITEMS_POR_PAGINA;
    return this.items().slice(desde, desde + ITEMS_POR_PAGINA);
  });
  /** "Mostrando 1–25 de 1355 ítems" (Figma: pie de tabla). */
  protected readonly rangoTexto = computed(() => {
    const total = this.items().length;
    if (!total) return '';
    const desde = (this.paginaActual() - 1) * ITEMS_POR_PAGINA + 1;
    const hasta = Math.min(desde + ITEMS_POR_PAGINA - 1, total);
    return `Mostrando ${desde}–${hasta} de ${total} ítems`;
  });

  protected irAPagina(delta: number): void {
    this.pagina.set(Math.min(Math.max(1, this.paginaActual() + delta), this.totalPaginas()));
  }

  private readonly todosLosItems = computed(() => this.lista()?.items ?? []);

  protected readonly items = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const tipo = this.tipoFiltro();
    return this.todosLosItems().filter(
      i => (!tipo || i.tipo === tipo) && (!q || i.codigo.toLowerCase().includes(q) || i.descripcion.toLowerCase().includes(q)),
    );
  });
  /**
   * Totales por tipo — de la lista COMPLETA, no de lo filtrado por búsqueda/chip
   * (Figma: el contador "N items" del encabezado sí sigue al filtro, los
   * "Totales" del pie son del catálogo entero). Catálogo sin cantidad por
   * ítem, así que esto es lo que sí se puede contar.
   */
  protected readonly totalServicio = computed(() => this.todosLosItems().filter(i => i.tipo === 'Servicio').length);
  protected readonly totalMaterial = computed(() => this.todosLosItems().filter(i => i.tipo === 'Material').length);
  /** Suma de precios por tipo — no es un "total a cobrar" (esto es catálogo, no un pedido con cantidades), solo la suma de precios unitarios de cada tipo. */
  protected readonly sumaServicio = computed(() => this.todosLosItems().filter(i => i.tipo === 'Servicio').reduce((s, i) => s + i.precio, 0));
  protected readonly sumaMaterial = computed(() => this.todosLosItems().filter(i => i.tipo === 'Material').reduce((s, i) => s + i.precio, 0));

  constructor() {
    this.reload();

    // Barra "Detail" del header (Figma Nav/TopAppBar, solo móvil).
    useDetailChrome(
      () => this.lista()?.cliente ?? 'Lista de precios',
      '/dashboard/facturacion/lista-precios',
      () => this.lista()?.items.length ? [{ label: 'Descargar Excel', action: () => this.descargarExcel() }] : [],
    );
  }

  private reload(): void {
    this.loading.set(true);
    this.listaService.get(this.listaId).subscribe({
      next: l => {
        this.lista.set(l);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar la lista de precios.');
      },
    });
  }

  protected descargarExcel(): void {
    const l = this.lista();
    if (!l) return;
    const filas = l.items.map(i => ({
      Código: i.codigo,
      Descripción: i.descripcion,
      Unidad: i.unidad,
      Precio: i.precio,
      Tipo: i.tipo,
    }));
    const sheet = XLSX.utils.json_to_sheet(filas);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Lista de precios');
    XLSX.writeFile(book, `Lista-de-precios-${l.cliente}-${l.numeroContrato}.xlsx`);
  }
}
