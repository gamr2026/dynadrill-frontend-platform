import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import {
  mensajeDeError,
  type ListaPreciosResumen,
} from '../../pedidos-comercial/models/pedido-comercial.model';
import { ListasPreciosComercialService } from '../../pedidos-comercial/services/listas-precios-comercial.service';
import { KpiStat, KpiStatTone } from '../../../../shared/components/kpi-stat/kpi-stat';

/**
 * Listas de precios por cliente y contrato, del backend nuevo. Son de consulta: los códigos y precios llegan de AS2.
 */
@Component({
  selector: 'app-lista-precios-page',
  imports: [
    DynadrillScreenHeaderComponent,
    KpiStat,
    DynadrillTagComponent,
    DynadrillTextComponent,
    DynadrillSpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lista-precios-page.html',
  styleUrl: './lista-precios-page.scss',
})
export class ListaPreciosPage {
  private readonly servicio = inject(ListasPreciosComercialService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly listas = signal<ListaPreciosResumen[]>([]);

  protected readonly kpis = computed<
    { value: number; label: string; caption: string; tone: KpiStatTone }[]
  >(() => {
    const ls = this.listas();
    return [
      { value: ls.length, label: 'Listas', caption: 'Registradas', tone: 'neutral' },
      {
        value: ls.filter((l) => l.activa).length,
        label: 'Activas',
        caption: 'Vigentes',
        tone: 'success',
      },
      {
        value: new Set(ls.map((l) => l.clienteId)).size,
        label: 'Clientes',
        caption: 'Con tarifario',
        tone: 'brand',
      },
      {
        value: ls.reduce((s, l) => s + l.items, 0),
        label: 'Ítems totales',
        caption: 'Servicios + materiales',
        tone: 'info',
      },
    ];
  });

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.servicio.listar().subscribe({
      next: (listas) => {
        this.listas.set(listas);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudo cargar las listas de precios.'));
      },
    });
  }

  protected abrir(id: string): void {
    this.router.navigate(['/dashboard/facturacion/lista-precios', id]);
  }

  /** Para el tag "X Servicio / Y Material" de cada card — a simple vista, sin entrar al detalle. */
  protected contarPorTipo(l: ListaPreciosResumen, tipo: 'Servicio' | 'Material'): number {
    return (tipo === 'Servicio' ? l.servicios : l.materiales)?.cantidad ?? 0;
  }
}
