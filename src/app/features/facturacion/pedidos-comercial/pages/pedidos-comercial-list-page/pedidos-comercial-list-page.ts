import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillButtonComponent,
  DynadrillIconComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillTabsComponent,
  type DynadrillTab,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { PedidosListaPanel } from '../../components/pedidos-lista-panel/pedidos-lista-panel';
import { PorCompletarPanel } from '../../components/por-completar-panel/por-completar-panel';
import { PedidosComercialService } from '../../services/pedidos-comercial.service';
import {
  PERMISOS_PEDIDOS,
  type CatalogoServicios,
  type EstadoCatalogo,
} from '../../models/pedido-comercial.model';

type ClavePestana = 'pedidos' | 'por-completar';

/** Pestañas visibles según los permisos de quien consulta (puro, para probarlo sin montar la pantalla). */
export function pestanasVisibles(
  can: (permiso: string) => boolean,
): { clave: ClavePestana; label: string }[] {
  const lista: { clave: ClavePestana; label: string }[] = [
    { clave: 'pedidos', label: 'Todos los pedidos' },
  ];
  if (can(PERMISOS_PEDIDOS.as2PedidosVer))
    lista.push({ clave: 'por-completar', label: 'Pedidos de AS2 por completar' });
  return lista;
}

/** Pedidos del backend comercial: lista del portal y pedidos de AS2 por completar. */
@Component({
  selector: 'app-pedidos-comercial-list-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillButtonComponent,
    DynadrillIconComponent,
    DynadrillTabsComponent,
    PedidosListaPanel,
    PorCompletarPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pedidos-comercial-list-page.html',
  styleUrl: './pedidos-comercial-list-page.scss',
})
export class PedidosComercialListPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly pedidos = inject(PedidosComercialService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly estados = signal<EstadoCatalogo[]>([]);
  protected readonly catalogo = signal<CatalogoServicios | null>(null);
  protected readonly activa = signal(0);

  private readonly pestanas = computed(() => pestanasVisibles((c) => this.auth.can(c)));
  protected readonly tabs = computed<DynadrillTab[]>(() =>
    this.pestanas().map((p) => ({ label: p.label })),
  );
  protected readonly claveActiva = computed<ClavePestana>(
    () => this.pestanas()[this.activa()]?.clave ?? 'pedidos',
  );
  protected readonly puedeCrear = computed(() => this.auth.can(PERMISOS_PEDIDOS.crear));

  constructor() {
    // ?pestana=por-completar abre directamente esa pestaña (por ejemplo desde el detalle, para vincular con AS2).
    const pedida = this.route.snapshot.queryParamMap.get('pestana');
    const indice = this.pestanas().findIndex((p) => p.clave === pedida);
    if (indice > 0) this.activa.set(indice);
    this.pedidos
      .catalogoServicios()
      .subscribe({ next: (c) => this.catalogo.set(c), error: () => this.catalogo.set(null) });
    this.pedidos.estados().subscribe({
      next: (e) => this.estados.set(e),
      error: () => this.notify.error('Error', 'No se pudo cargar el catálogo de estados.'),
    });
  }

  protected nuevo(): void {
    void this.router.navigate(['/dashboard/facturacion/pedidos/nuevo']);
  }
}
