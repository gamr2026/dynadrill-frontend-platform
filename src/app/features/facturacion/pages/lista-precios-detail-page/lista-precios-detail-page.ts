import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as XLSX from 'xlsx';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { ListaPrecios } from '../../models/lista-precios.model';
import { ListaPreciosService } from '../../services/pedido.service';

/** Fase 2 — detalle de una Lista de Precios: solo lectura (RN: la edición se retiró de la UI, ver listas-precios.controller.ts en el backend). */
@Component({
  selector: 'app-lista-precios-detail-page',
  imports: [DynadrillScreenHeaderComponent, DynadrillTagComponent, DynadrillButtonComponent, DynadrillSpinnerComponent, DynadrillBannerComponent],
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

  protected readonly items = computed(() => this.lista()?.items ?? []);
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
