import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { SearchField } from '../../../../../shared/components/search-field/search-field';
import { AuthService } from '../../../../../core/services/auth.service';
import { As2PedidosService } from '../../services/as2-pedidos.service';
import { PedidosComercialService } from '../../services/pedidos-comercial.service';
import { VincularAs2Dialog, type VincularAs2DialogData } from '../vincular-as2-dialog/vincular-as2-dialog';
import {
  LIMITE_POR_COMPLETAR,
  PERMISOS_PEDIDOS,
  formatoDia,
  formatoMoneda,
  haySiguiente,
  mensajeDeError,
  resumenPaginacion,
  totalFinalAs2,
  type As2PedidoResumen,
  type VinculoAs2,
} from '../../models/pedido-comercial.model';

type FiltroLineas = 'con' | 'sin';

/**
 * Pestaña "Por completar": pedidos de AS2 del año en curso (solo lectura, nada de AS2 se guarda), con filtro con/sin
 * líneas y páginas de 10. Desde aquí se crea el pedido en el portal, se vincula a uno existente o se importan las líneas.
 */
@Component({
  selector: 'app-por-completar-panel',
  imports: [
    SearchField,
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillIconButtonComponent,
    DynadrillSelectComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './por-completar-panel.html',
  styleUrl: './por-completar-panel.scss',
})
export class PorCompletarPanel {
  private readonly as2 = inject(As2PedidosService);
  private readonly pedidos = inject(PedidosComercialService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly limite = LIMITE_POR_COMPLETAR;
  protected readonly anio = new Date().getFullYear();

  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<As2PedidoResumen[]>([]);
  protected readonly vinculos = signal<Record<number, VinculoAs2>>({});
  protected readonly pagina = signal(1);
  protected readonly hayMas = signal(false);
  protected readonly total = signal<number | null>(null);
  /** Pedido de AS2 sobre el que hay una acción en curso. */
  protected readonly ocupado = signal<number | null>(null);

  protected readonly filtroLineas = signal<FiltroLineas | null>(null);
  protected readonly filtroEstado = signal<string | null>(null);
  protected readonly busqueda = signal('');
  protected readonly estadosAs2 = signal<string[]>([]);

  protected readonly puedeCrear = computed(() => this.auth.can(PERMISOS_PEDIDOS.crear));
  protected readonly puedeEditar = computed(() => this.auth.can(PERMISOS_PEDIDOS.editar));

  protected readonly lineasOpciones: DynadrillSelectOption[] = [
    { label: 'Con líneas', value: 'con' },
    { label: 'Sin líneas', value: 'sin' },
  ];
  protected readonly estadoOpciones = computed<DynadrillSelectOption[]>(() => this.estadosAs2().map(e => ({ label: e, value: e })));
  protected readonly resumen = computed(() => resumenPaginacion(this.pagina(), this.limite, this.items().length, this.total()));
  protected readonly hayAnterior = computed(() => this.pagina() > 1);
  protected readonly haySiguiente = computed(() => haySiguiente(this.pagina(), this.limite, this.total(), this.hayMas()));
  protected readonly hayFiltros = computed(() => !!this.filtroLineas() || !!this.filtroEstado() || !!this.busqueda().trim());

  private readonly texto$ = new Subject<string>();
  private vigente = 0;

  constructor() {
    this.texto$.pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(inject(DestroyRef))).subscribe(() => {
      this.pagina.set(1);
      this.cargar();
    });
    this.as2.resumen().subscribe({
      next: r => this.estadosAs2.set(Object.keys(r.porEstado).sort()),
      error: () => this.estadosAs2.set([]),
    });
    queueMicrotask(() => this.cargar());
  }

  protected cargar(): void {
    const peticion = ++this.vigente;
    this.cargando.set(true);
    this.error.set(null);
    this.as2
      .listar({ page: this.pagina(), limit: this.limite, estado: this.filtroEstado(), lineas: this.filtroLineas(), q: this.busqueda() })
      .subscribe({
        next: r => {
          if (peticion !== this.vigente) return;
          this.items.set(r.items);
          this.hayMas.set(r.hayMas);
          this.total.set(r.total);
          this.cargarVinculos(r.items, peticion);
        },
        error: err => {
          if (peticion !== this.vigente) return;
          this.cargando.set(false);
          this.items.set([]);
          this.error.set(mensajeDeError(err, 'No se pudo consultar AS2. Intente de nuevo en unos minutos.'));
        },
      });
  }

  /** Marca cuáles de la página ya están en el portal (no se guarda nada de AS2, solo se cruzan los ids). */
  private cargarVinculos(items: As2PedidoResumen[], peticion: number): void {
    this.pedidos.vinculosAs2(items.map(i => i.idPedidoCliente)).subscribe({
      next: v => {
        if (peticion !== this.vigente) return;
        this.vinculos.set(Object.fromEntries(v.map(x => [x.as2IdPedidoCliente, x])));
        this.cargando.set(false);
      },
      error: () => {
        if (peticion !== this.vigente) return;
        this.vinculos.set({});
        this.cargando.set(false);
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
    this.filtroLineas.set(null);
    this.onFiltro();
  }

  protected irA(delta: number): void {
    this.pagina.update(p => Math.max(1, p + delta));
    this.cargar();
  }

  // ── Acciones ──

  protected crearEnPortal(p: As2PedidoResumen): void {
    if (this.ocupado() !== null) return;
    this.ocupado.set(p.idPedidoCliente);
    this.pedidos.desdeAs2(p.idPedidoCliente).subscribe({
      next: nuevo => {
        this.ocupado.set(null);
        const l = nuevo.lineasAs2;
        if (!l) {
          this.notify.success('Pedido creado', 'Quedó "por completar". Complete los datos y ábralo.');
        } else {
          const faltan = l.sinCoincidencia.length ? ` No están en la lista de precios del cliente: ${l.sinCoincidencia.join(', ')}.` : '';
          if (l.importados > 0 && !faltan) this.notify.success('Pedido creado', `Se cargaron ${l.importados} línea(s) de AS2. Complete los datos y ábralo.`);
          else if (l.importados > 0) this.notify.warning('Pedido creado', `Se cargaron ${l.importados} línea(s) de AS2.${faltan}`);
          else this.notify.warning('Pedido creado sin líneas', `Ninguna línea de AS2 coincide con la lista de precios del cliente.${faltan}`);
        }
        void this.router.navigate(['/dashboard/facturacion/pedidos', nuevo.id, 'editar']);
      },
      error: err => {
        this.ocupado.set(null);
        this.notify.error('No se pudo crear', mensajeDeError(err, 'No se pudo crear el pedido desde AS2.'));
      },
    });
  }

  protected vincular(p: As2PedidoResumen): void {
    const ref = this.dialog.open<VincularAs2Dialog, VincularAs2DialogData>({
      title: 'Vincular con un pedido del portal',
      content: VincularAs2Dialog,
      data: { as2: p },
      footer: false,
      width: '560px',
    });
    ref.afterClose.subscribe((id: string | undefined) => {
      if (id) this.cargar();
    });
  }

  protected importarLineas(p: As2PedidoResumen): void {
    const v = this.vinculos()[p.idPedidoCliente];
    if (!v || this.ocupado() !== null) return;
    this.ocupado.set(p.idPedidoCliente);
    this.pedidos.importarLineasAs2(v.id).subscribe({
      next: r => {
        this.ocupado.set(null);
        const aviso = r.sinCoincidencia.length ? ` No están en la lista de precios del cliente: ${r.sinCoincidencia.join(', ')}.` : '';
        if (r.importados > 0) this.notify.success('Líneas importadas', `${r.importados} línea(s) importada(s).${aviso}`);
        else this.notify.warning('Sin líneas importadas', `Ninguna línea coincide con la lista de precios del cliente.${aviso}`);
      },
      error: err => {
        this.ocupado.set(null);
        this.notify.error('No se pudo importar', mensajeDeError(err, 'No se pudieron importar las líneas de AS2.'));
      },
    });
  }

  protected abrirPedido(v: VinculoAs2): void {
    void this.router.navigate(['/dashboard/facturacion/pedidos', v.id]);
  }

  protected readonly vinculoDe = (p: As2PedidoResumen): VinculoAs2 | undefined => this.vinculos()[p.idPedidoCliente];
  protected readonly dia = formatoDia;
  protected readonly moneda = formatoMoneda;
  protected readonly totalFinal = (p: As2PedidoResumen) => totalFinalAs2(p.total, p.descuento, p.impuesto);
  protected readonly conLineas = (p: As2PedidoResumen) => p.lineasEstado === 'con_lineas';
}
