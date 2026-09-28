import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { ListaPrecios } from '../../models/lista-precios.model';
import { ListaPreciosService } from '../../services/pedido.service';
import { ListaPreciosCabeceraDialog } from '../../components/lista-precios-cabecera-dialog';
import { KpiStat, KpiStatTone } from '../../../../shared/components/kpi-stat/kpi-stat';

/**
 * Fase 2 — Lista de Precios multicliente. Índice de listas + alta. La edición
 * de ítems vive en el detalle.
 */
@Component({
  selector: 'app-lista-precios-page',
  imports: [
    DynadrillScreenHeaderComponent,
    KpiStat,
    DynadrillButtonComponent,
    DynadrillTagComponent,
    DynadrillTextComponent,
    DynadrillSpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lista-precios-page.html',
  styleUrl: './lista-precios-page.scss',
})
export class ListaPreciosPage {
  private readonly listaService = inject(ListaPreciosService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly listas = signal<ListaPrecios[]>([]);

  protected readonly kpis = computed<{ value: number; label: string; caption: string; tone: KpiStatTone }[]>(() => {
    const ls = this.listas();
    return [
      { value: ls.length, label: 'Listas', caption: 'Registradas', tone: 'neutral' },
      { value: ls.filter(l => l.activa).length, label: 'Activas', caption: 'Vigentes', tone: 'success' },
      { value: new Set(ls.map(l => l.cliente)).size, label: 'Clientes', caption: 'Con tarifario', tone: 'brand' },
      { value: ls.reduce((s, l) => s + l.items.length, 0), label: 'Ítems totales', caption: 'Servicios + materiales', tone: 'info' },
    ];
  });

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.listaService.list().subscribe({
      next: listas => {
        this.listas.set(listas);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar la lista de precios.');
      },
    });
  }

  protected nuevaLista(): void {
    const ref = this.dialog.open<ListaPreciosCabeceraDialog>({
      title: 'Nueva lista de precios',
      content: ListaPreciosCabeceraDialog,
      data: {},
      footer: false,
      width: '640px',
    });
    ref.afterClose.subscribe(lista => {
      if (lista) this.router.navigate(['/dashboard/facturacion/lista-precios', (lista as ListaPrecios).id]);
    });
  }

  protected abrir(id: number): void {
    this.router.navigate(['/dashboard/facturacion/lista-precios', id]);
  }

  /** Para el tag "X Servicio / Y Material" de cada card — a simple vista, sin entrar al detalle. */
  protected contarPorTipo(l: ListaPrecios, tipo: 'Servicio' | 'Material'): number {
    return l.items.filter(i => i.tipo === tipo).length;
  }
}
