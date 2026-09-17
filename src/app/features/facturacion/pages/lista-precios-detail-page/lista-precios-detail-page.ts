import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as XLSX from 'xlsx';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { ListaPrecios, ListaPreciosItemDraft, TipoItem } from '../../models/lista-precios.model';
import { ListaPreciosService } from '../../services/pedido.service';
import { ListaPreciosCabeceraDialog } from '../../components/lista-precios-cabecera-dialog';

const TIPO_OPTIONS: DynadrillSelectOption[] = [
  { label: 'Servicio', value: 'Servicio' },
  { label: 'Material', value: 'Material' },
];

/** Fase 2 — detalle de una Lista de Precios: cabecera + edición de ítems. */
@Component({
  selector: 'app-lista-precios-detail-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillTagComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillSpinnerComponent,
    DynadrillBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lista-precios-detail-page.html',
  styleUrl: './lista-precios-detail-page.scss',
})
export class ListaPreciosDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly listaService = inject(ListaPreciosService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  private readonly listaId = Number(this.route.snapshot.paramMap.get('id'));

  protected readonly tipoOptions = TIPO_OPTIONS;
  protected readonly loading = signal(true);
  protected readonly guardando = signal(false);
  protected readonly lista = signal<ListaPrecios | null>(null);
  protected readonly editando = signal(false);
  protected readonly borrador = signal<ListaPreciosItemDraft[]>([]);
  protected readonly nuevo = signal<ListaPreciosItemDraft>({ codigo: '', descripcion: '', unidad: '', precio: 0, tipo: 'Servicio' });

  protected readonly items = computed(() => (this.editando() ? this.borrador() : (this.lista()?.items ?? [])));
  /** Totales por tipo — la Lista de Precios es un catálogo (código/descripción/unidad/precio/tipo), sin cantidad por ítem; esto es lo que sí se puede contar. */
  protected readonly totalServicio = computed(() => this.items().filter(i => i.tipo === 'Servicio').length);
  protected readonly totalMaterial = computed(() => this.items().filter(i => i.tipo === 'Material').length);
  /** Suma de precios por tipo — no es un "total a cobrar" (esto es catálogo, no un pedido con cantidades), solo la suma de precios unitarios de cada tipo. */
  protected readonly sumaServicio = computed(() => this.items().filter(i => i.tipo === 'Servicio').reduce((s, i) => s + i.precio, 0));
  protected readonly sumaMaterial = computed(() => this.items().filter(i => i.tipo === 'Material').reduce((s, i) => s + i.precio, 0));

  constructor() {
    this.reload();
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

  protected editarCabecera(): void {
    const l = this.lista();
    if (!l) return;
    const ref = this.dialog.open<ListaPreciosCabeceraDialog>({
      title: 'Editar lista de precios',
      content: ListaPreciosCabeceraDialog,
      data: { lista: l },
      footer: false,
      width: '640px',
    });
    ref.afterClose.subscribe(updated => {
      if (updated) this.lista.set(updated as ListaPrecios);
    });
  }

  protected iniciarEdicionItems(): void {
    this.borrador.set((this.lista()?.items ?? []).map(i => ({ codigo: i.codigo, descripcion: i.descripcion, unidad: i.unidad, precio: i.precio, tipo: i.tipo })));
    this.editando.set(true);
  }

  protected cancelarEdicionItems(): void {
    this.editando.set(false);
    this.borrador.set([]);
  }

  protected updateNuevo<K extends keyof ListaPreciosItemDraft>(field: K, value: ListaPreciosItemDraft[K]): void {
    this.nuevo.update(n => ({ ...n, [field]: value }));
  }

  protected agregarItem(): void {
    const n = this.nuevo();
    if (!n.codigo.trim() || !n.descripcion.trim() || n.precio <= 0) return;
    this.borrador.update(list => [...list, { ...n, codigo: n.codigo.trim(), descripcion: n.descripcion.trim(), unidad: n.unidad.trim() }]);
    this.nuevo.set({ codigo: '', descripcion: '', unidad: '', precio: 0, tipo: 'Servicio' });
  }

  protected quitarItem(index: number): void {
    this.borrador.update(list => list.filter((_, i) => i !== index));
  }

  protected updateItem<K extends keyof ListaPreciosItemDraft>(index: number, field: K, value: ListaPreciosItemDraft[K]): void {
    this.borrador.update(list => list.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  }

  protected guardarItems(): void {
    if (this.guardando()) return;
    this.guardando.set(true);
    this.listaService.reemplazarItems(this.listaId, this.borrador()).subscribe({
      next: l => {
        this.lista.set(l);
        this.editando.set(false);
        this.guardando.set(false);
        this.notify.success('Guardado', 'Ítems de la lista de precios actualizados.');
      },
      error: () => {
        this.guardando.set(false);
        this.notify.error('Error', 'No se pudieron guardar los ítems.');
      },
    });
  }

  protected asTipo(value: unknown): TipoItem {
    return value === 'Material' ? 'Material' : 'Servicio';
  }

  /** Excel con los ítems de la lista tal como está guardada (no el borrador en edición). */
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
