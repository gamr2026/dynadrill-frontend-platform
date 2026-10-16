import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillIconButtonComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { MACRO_ESTADO_TONE } from '../../../../../shared/models/timeline.model';
import { SearchField } from '../../../../../shared/components/search-field/search-field';
import { AuthService } from '../../../../../core/services/auth.service';
import { PedidosComercialService } from '../../services/pedidos-comercial.service';
import {
  LINEA_SERVICIO_LABELS,
  LIMITE_PEDIDOS,
  ORIGEN_LABELS,
  PERMISOS_PEDIDOS,
  SYNC_AS2_LABELS,
  etiquetasTiposServicio,
  formatoDia,
  haySiguiente,
  mensajeDeError,
  resumenPaginacion,
  type CatalogoServicios,
  type EstadoCatalogo,
  type LineaServicio,
  type OrigenPedido,
  type PedidoResumen,
} from '../../models/pedido-comercial.model';

/**
 * Tabla de pedidos del portal con filtros y paginación en el servidor. Con `sinAnalista` es la bandeja de la jefa de
 * Facturación (pedidos sin analista asignado).
 */
@Component({
  selector: 'app-pedidos-lista-panel',
  imports: [
    SearchField,
    DynadrillSelectComponent,
    DynadrillButtonComponent,
    DynadrillIconButtonComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pedidos-lista-panel.html',
  styleUrl: './pedidos-lista-panel.scss',
})
export class PedidosListaPanel {
  private readonly servicio = inject(PedidosComercialService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  /** Catálogo de estados (lo carga la página una sola vez). */
  readonly estados = input<EstadoCatalogo[]>([]);
  /** Catálogo de servicios, para mostrar el nombre de cada tipo. */
  readonly catalogo = input<CatalogoServicios | null>(null);
  /** Bandeja "sin analista". */
  readonly sinAnalista = input(false);

  protected readonly limite = LIMITE_PEDIDOS;
  protected readonly cargando = signal(false);
  protected readonly items = signal<PedidoResumen[]>([]);
  protected readonly total = signal(0);
  protected readonly pagina = signal(1);

  protected readonly busqueda = signal('');
  protected readonly filtroEstado = signal<string | null>(null);
  protected readonly filtroLinea = signal<LineaServicio | null>(null);
  protected readonly filtroOrigen = signal<OrigenPedido | null>(null);

  protected readonly puedeAsignar = computed(() => this.auth.can(PERMISOS_PEDIDOS.asignarAnalista));
  protected readonly puedeEditar = computed(() => this.auth.can(PERMISOS_PEDIDOS.editar));

  protected readonly estadoOpciones = computed<DynadrillSelectOption[]>(() => this.estados().map(e => ({ label: e.nombre, value: e.codigo })));
  protected readonly lineaOpciones: DynadrillSelectOption[] = (Object.entries(LINEA_SERVICIO_LABELS) as [LineaServicio, string][]).map(([value, label]) => ({ label, value }));
  protected readonly origenOpciones: DynadrillSelectOption[] = (Object.entries(ORIGEN_LABELS) as [OrigenPedido, string][]).map(([value, label]) => ({ label, value }));

  protected readonly resumen = computed(() => resumenPaginacion(this.pagina(), this.limite, this.items().length, this.total()));
  protected readonly hayAnterior = computed(() => this.pagina() > 1);
  protected readonly haySiguiente = computed(() => haySiguiente(this.pagina(), this.limite, this.total(), false));
  protected readonly hayFiltros = computed(() => !!this.busqueda().trim() || !!this.filtroEstado() || !!this.filtroLinea() || !!this.filtroOrigen());

  private readonly texto$ = new Subject<string>();
  private cargaVigente = 0;

  constructor() {
    this.texto$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(inject(DestroyRef))).subscribe(() => {
      this.pagina.set(1);
      this.cargar();
    });
    // Primera carga y recargas pedidas por la página.
    queueMicrotask(() => this.cargar());
  }

  /** Recarga desde la página (por ejemplo tras crear o asignar). */
  recargar(): void {
    this.cargar();
  }

  protected cargar(): void {
    const peticion = ++this.cargaVigente;
    this.cargando.set(true);
    this.servicio
      .listar({
        q: this.busqueda(),
        estado: this.filtroEstado(),
        linea: this.filtroLinea(),
        origen: this.filtroOrigen(),
        sinAnalista: this.sinAnalista(),
        page: this.pagina(),
        limit: this.limite,
      })
      .subscribe({
        next: r => {
          if (peticion !== this.cargaVigente) return;
          this.items.set(r.items);
          this.total.set(r.total);
          this.cargando.set(false);
        },
        error: err => {
          if (peticion !== this.cargaVigente) return;
          this.cargando.set(false);
          this.notify.error('Error', mensajeDeError(err, 'No se pudo cargar la lista de pedidos.'));
        },
      });
  }

  protected onBusqueda(valor: string): void {
    this.busqueda.set(valor);
    this.texto$.next(valor.trim());
  }

  protected onFiltro(): void {
    this.pagina.set(1);
    this.cargar();
  }

  protected limpiar(): void {
    this.busqueda.set('');
    this.filtroEstado.set(null);
    this.filtroLinea.set(null);
    this.filtroOrigen.set(null);
    this.onFiltro();
  }

  protected irA(delta: number): void {
    this.pagina.update(p => Math.max(1, p + delta));
    this.cargar();
  }

  protected ver(p: PedidoResumen): void {
    void this.router.navigate(['/dashboard/facturacion/pedidos', p.id]);
  }

  protected editar(p: PedidoResumen): void {
    void this.router.navigate(['/dashboard/facturacion/pedidos', p.id, 'editar']);
  }

  protected readonly tono = (p: PedidoResumen) => MACRO_ESTADO_TONE[p.macroEstado] ?? 'neutral';
  protected readonly tipos = (p: PedidoResumen) => etiquetasTiposServicio(this.catalogo(), p.tiposServicio);
  protected readonly linea = (p: PedidoResumen) => (p.lineaServicio ? LINEA_SERVICIO_LABELS[p.lineaServicio] : '—');
  protected readonly ubicacion = (p: PedidoResumen) => [p.campoNombre, p.pozoNombre].filter(Boolean).join(' — ') || '—';
  protected readonly dia = formatoDia;
  protected readonly sync = (p: PedidoResumen) => SYNC_AS2_LABELS[p.as2SyncEstado] ?? p.as2SyncEstado;
  protected readonly etiquetaOrigen = (p: PedidoResumen) => ORIGEN_LABELS[p.origen] ?? p.origen;
  protected readonly editable = (p: PedidoResumen) => this.puedeEditar() && p.estado !== 'anulado' && p.estado !== 'facturado';
}
