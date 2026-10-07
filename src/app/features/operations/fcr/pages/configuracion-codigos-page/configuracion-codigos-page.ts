import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map, of } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillChipGroupComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { CatalogosService } from '../../../../../shared/services/catalogos.service';
import { ArticulosService } from '../../../../inventario/services/articulos.service';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { SearchField } from '../../../../../shared/components/search-field/search-field';
import { ListPager } from '../../../../../shared/components/list-pager/list-pager';
import { createPagination } from '../../../../../shared/utils/pagination.util';
import {
  CLASE_OPERATIVA_LABELS,
  filtrarCodigos,
  resumenKit,
  type CodigoClienteFcr,
  type FiltroCodigos,
} from '../../models/fcr-configuracion-codigos';
import { FcrConfiguracionCodigosService, type ConfiguracionCodigoGuardada } from '../../services/fcr-configuracion-codigos.service';
import { ConfigurarCodigoDialog, type ConfigurarCodigoDialogData } from '../../components/configurar-codigo-dialog';

/** Una Lista de Precios puede pasar de mil códigos. */
const CODIGOS_POR_PAGINA = 25;

/** Chips de filtro, en orden. "Huérfanos" solo se muestra si hay alguno. */
const FILTROS: { label: string; value: FiltroCodigos }[] = [
  { label: 'Todos', value: 'todos' },
  { label: 'Sin configurar', value: 'sin_configurar' },
  { label: CLASE_OPERATIVA_LABELS.herramienta, value: 'herramienta' },
  { label: CLASE_OPERATIVA_LABELS.servicio, value: 'servicio' },
  { label: 'Huérfanos', value: 'huerfanos' },
];

/**
 * Configuración por cliente de qué hace FCR con cada código de su Lista de
 * Precios (specs/fcr-precarga-herramientas): herramientas con su kit (se
 * piden a Bodega al crear el ticket) o servicio (nada). La movilización la
 * marca el Pedido. El cliente elegido queda en la URL (`?cliente=`).
 */
@Component({
  selector: 'app-fcr-configuracion-codigos-page',
  imports: [
    PageHeader,
    SearchField,
    ListPager,
    DynadrillSelectComponent,
    DynadrillChipGroupComponent,
    DynadrillTagComponent,
    DynadrillIconButtonComponent,
    DynadrillSpinnerComponent,
    DynadrillBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './configuracion-codigos-page.html',
  styleUrl: './configuracion-codigos-page.scss',
})
export class FcrConfiguracionCodigosPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly service = inject(FcrConfiguracionCodigosService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly roleName = computed(() => this.auth.currentUser()?.roleName ?? '');
  protected readonly claseLabels = CLASE_OPERATIVA_LABELS;

  // ── Cliente (estado en la URL) ──

  protected readonly clienteOptions = toSignal(
    inject(CatalogosService)
      .clientes()
      .pipe(map((clientes): DynadrillSelectOption[] => clientes.filter(c => c.activo).map(c => ({ label: c.nombreComercial, value: c.id })))),
    { initialValue: [] },
  );

  protected readonly clienteId = toSignal(
    this.route.queryParamMap.pipe(
      map(params => {
        const id = Number(params.get('cliente'));
        return Number.isInteger(id) && id > 0 ? id : null;
      }),
    ),
    { initialValue: null },
  );

  protected onClienteChange(value: unknown): void {
    // Un filtro de otro cliente (ej. "Huérfanos") puede no existir en este: dejaría la tabla vacía.
    this.filtro.set('todos');
    this.busqueda.set('');
    this.pagination.reset();
    this.router.navigate([], { relativeTo: this.route, queryParams: { cliente: value ?? null }, replaceUrl: true });
  }

  // ── Códigos del cliente ──

  /** Cancela la petición anterior si se cambia de cliente antes de que responda. */
  protected readonly codigos = rxResource({
    params: () => this.clienteId(),
    stream: ({ params: clienteId }) => (clienteId ? this.service.codigosDeCliente(clienteId) : of([] as CodigoClienteFcr[])),
  });

  private readonly filas = computed(() => (this.codigos.hasValue() ? this.codigos.value() : []));
  protected readonly hayHuerfanos = computed(() => this.filas().some(f => !f.enListaPrecios));
  protected readonly sinConfigurar = computed(() => this.filas().filter(f => f.clase === null).length);

  // ── Búsqueda y filtro ──

  protected readonly busqueda = signal('');
  private readonly filtro = signal<FiltroCodigos>('todos');
  protected readonly filtroLabels = computed(() =>
    FILTROS.filter(f => f.value !== 'huerfanos' || this.hayHuerfanos()).map(f => f.label),
  );
  protected readonly filtroSeleccionado = computed(() => [FILTROS.find(f => f.value === this.filtro())!.label]);

  protected onFiltroChange(selected: string[]): void {
    this.filtro.set(FILTROS.find(f => f.label === selected[0])?.value ?? 'todos');
    this.pagination.reset();
  }

  protected onBusqueda(valor: string): void {
    this.busqueda.set(valor);
    this.pagination.reset();
  }

  protected readonly filtradas = computed(() => filtrarCodigos(this.filas(), this.filtro(), this.busqueda()));
  protected readonly pagination = createPagination(this.filtradas, CODIGOS_POR_PAGINA);
  protected readonly mensajeVacio = computed(() => {
    if (this.codigos.isLoading()) return 'Cargando…';
    return this.filas().length ? 'Ningún código coincide con el filtro.' : 'Este cliente no tiene una Lista de Precios activa.';
  });

  // ── Catálogo de herramientas (nombres del kit y opciones del diálogo) ──

  private readonly herramientas = toSignal(inject(ArticulosService).list({ categoria: 'HERRAMIENTAS', activo: true }), {
    initialValue: [],
  });
  private readonly herramientaOptions = computed<DynadrillSelectOption[]>(() =>
    this.herramientas().map(a => ({ label: `${a.codigo} — ${a.nombre}`, value: a.id })),
  );
  private readonly nombresHerramientas = computed(() => new Map(this.herramientas().map(a => [a.id, a.nombre])));

  protected readonly resumenKit = (fila: CodigoClienteFcr): string => resumenKit(fila.kit, this.nombresHerramientas());

  // ── Acciones ──

  protected configurar(fila: CodigoClienteFcr): void {
    const clienteId = this.clienteId();
    if (!clienteId) return;
    this.dialog
      .open<ConfigurarCodigoDialog, ConfigurarCodigoDialogData>({
        title: `Configurar ${fila.codigo}`,
        content: ConfigurarCodigoDialog,
        data: { clienteId, fila, herramientas: this.herramientaOptions() },
        footer: false,
      })
      .afterClose.subscribe((guardada: ConfiguracionCodigoGuardada | undefined) => {
        if (!guardada) return;
        this.notify.success('Código configurado', `${fila.codigo}: ${CLASE_OPERATIVA_LABELS[guardada.clase]}.`);
        this.codigos.reload();
      });
  }

  protected async quitarConfiguracion(fila: CodigoClienteFcr): Promise<void> {
    if (fila.id === null) return;
    const ok = await this.dialog.confirm({
      title: 'Quitar configuración',
      content: `${fila.codigo} quedará sin configurar y los tickets nuevos lo tratarán como servicio (no genera nada). ¿Continuar?`,
      okText: 'Quitar',
      cancelText: 'Cancelar',
      danger: true,
    });
    if (!ok) return;
    this.service.eliminar(fila.id).subscribe({
      next: () => {
        this.notify.success('Configuración quitada', fila.codigo);
        this.codigos.reload();
      },
      error: () => this.notify.error('Error', 'No se pudo quitar la configuración.'),
    });
  }
}
