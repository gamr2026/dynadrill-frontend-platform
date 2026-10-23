import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of, type OperatorFunction } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillDialogService,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { parseLocalDateString, toLocalDateString } from '../../../../../shared/utils';
import { RolesService } from '../../../../users/services/users.service';
import type { UsuarioPorRol } from '../../../../users/models/user.model';
import { PedidosComercialService } from '../../services/pedidos-comercial.service';
import { CatalogosPlataformaService } from '../../services/catalogos-plataforma.service';
import {
  UbicacionPedidoSelector,
  type UbicacionInicial,
} from '../../components/ubicacion-pedido-selector/ubicacion-pedido-selector';
import {
  UBICACION_PEDIDO_VACIA,
  opcionesDeCatalogo,
  type BodegaPlataforma,
  type CondicionPagoPlataforma,
  type ClientePlataforma,
  type PersonaPlataforma,
  type UbicacionPedido,
} from '../../models/catalogos-plataforma.model';
import { DocumentosPedido } from '../../components/documentos-pedido/documentos-pedido';
import { ItemsEditor } from '../../components/items-editor/items-editor';
import {
  lineaDesdeItemPedido,
  lineasAItems,
  lineasValidas,
  type LineaEditable,
} from '../../models/lineas-pedido';
import {
  LINEA_SERVICIO_LABELS,
  PERMISOS_PEDIDOS,
  SOLICITUD_MEDIO_LABELS,
  errorCoherencia,
  esConflicto,
  faltantesParaAbrir,
  mensajeDeError,
  claveSubtipo,
  opcionesSubtipos,
  subtipoDesdeClave,
  subtiposVigentes,
  tiposCompatibles,
  tiposDeLinea,
  type ActualizarPedidoRequest,
  type CatalogoServicios,
  type CrearPedidoRequest,
  type DatosPedidoRequest,
  type LineaServicio,
  type PedidoDetalle,
  type SubtipoServicio,
  type CatalogoTipoOt,
  type TipoOt,
} from '../../models/pedido-comercial.model';

/** Un catálogo que falla no debe impedir abrir el formulario: se usa la lista vacía. */
const vacioSi = <T>(valor: T): OperatorFunction<T, T> => catchError(() => of(valor));

/** Alta y edición de un pedido contra el backend comercial. Sin analista: si falta, se notifica a la coordinadora. */
@Component({
  selector: 'app-pedido-comercial-form-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillButtonComponent,
    DynadrillBannerComponent,
    DynadrillDatetimePickerComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillSpinnerComponent,
    UbicacionPedidoSelector,
    ItemsEditor,
    DocumentosPedido,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pedido-comercial-form-page.html',
  styleUrl: './pedido-comercial-form-page.scss',
})
export class PedidoComercialFormPage {
  private readonly servicio = inject(PedidosComercialService);
  private readonly catalogos = inject(CatalogosPlataformaService);
  private readonly roles = inject(RolesService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly id = this.route.snapshot.paramMap.get('id');
  protected readonly esEdicion = this.id !== null;

  protected readonly cargando = signal(this.esEdicion);
  protected readonly guardando = signal(false);
  protected readonly pedido = signal<PedidoDetalle | null>(null);

  // ── Datos del formulario ──
  protected readonly clienteId = signal<string | null>(null);
  protected readonly subcliente = signal('');
  protected readonly lineaServicio = signal<LineaServicio | null>(null);
  protected readonly tipoOt = signal<TipoOt | null>(null);
  protected readonly tiposServicio = signal<string[]>([]);
  protected readonly subtiposServicio = signal<SubtipoServicio[]>([]);
  protected readonly numeroContrato = signal('');
  /** Por defecto "escrita": es el medio habitual; se puede cambiar. */
  protected readonly solicitudMedio = signal<'verbal' | 'escrita' | null>('escrita');
  protected readonly fechaInicio = signal<Date | null>(null);
  protected readonly fechaFin = signal<Date | null>(null);
  protected readonly ubicacion = signal<UbicacionPedido>(UBICACION_PEDIDO_VACIA);
  protected readonly ubicacionInicial = signal<UbicacionInicial | null>(null);
  protected readonly agenteId = signal<string | null>(null);
  protected readonly tecnicoHseId = signal<string | null>(null);
  protected readonly representanteCampoId = signal<string | null>(null);
  protected readonly representanteQuitoId = signal<string | null>(null);
  protected readonly bodegaId = signal<string | null>(null);
  protected readonly condicionPagoId = signal<string | null>(null);
  protected readonly zona = signal('');
  protected readonly lineas = signal<LineaEditable[]>([]);
  private lineasIniciales = '[]';

  /** El pedido tiene un pedido de AS2 detrás: lo que vino de allá no se edita (no hay API para escribirlo en AS2). */
  protected readonly deAs2 = computed(() => (this.pedido()?.as2.idPedidoCliente ?? null) !== null);
  /** Un cliente que AS2 trae y no está en el catálogo (sin id) sí se puede elegir. */
  protected readonly clienteBloqueado = computed(
    () => this.deAs2() && this.pedido()?.cliente.id != null,
  );

  /** Bodega y condición de pago de AS2 se bloquean solo si AS2 las trajo y existen en el catálogo (id lleno). */
  protected readonly bodegaBloqueada = computed(
    () => this.deAs2() && this.pedido()?.administrativo.bodegaId != null,
  );
  protected readonly condicionPagoBloqueada = computed(
    () => this.deAs2() && this.pedido()?.administrativo.condicionPagoId != null,
  );

  // ── Catálogos ──
  private readonly tiposOt = signal<CatalogoTipoOt[]>([]);
  private readonly bodegas = signal<BodegaPlataforma[]>([]);
  private readonly condicionesPago = signal<CondicionPagoPlataforma[]>([]);
  protected readonly catalogoServicios = signal<CatalogoServicios | null>(null);
  private readonly clientes = signal<ClientePlataforma[]>([]);
  private readonly agentes = signal<UsuarioPorRol[]>([]);
  private readonly tecnicos = signal<UsuarioPorRol[]>([]);
  private readonly personasCampo = signal<PersonaPlataforma[]>([]);
  private readonly personasQuito = signal<PersonaPlataforma[]>([]);

  protected readonly clienteOpciones = computed<DynadrillSelectOption[]>(() =>
    this.clientes()
      .filter((c) => c.activo || c.id === this.clienteId())
      .map((c) => ({ label: `${c.nombreComercial} (${c.identificacion})`, value: c.id })),
  );
  protected readonly lineaOpciones = computed<DynadrillSelectOption[]>(() =>
    (this.catalogoServicios()?.lineas ?? []).map((l) => ({
      label: LINEA_SERVICIO_LABELS[l.linea] ?? l.linea,
      value: l.linea,
    })),
  );
  protected readonly tipoOtOpciones = computed<DynadrillSelectOption[]>(() =>
    this.tiposOt().map((t) => ({ label: t.nombre, value: t.codigo })),
  );
  protected readonly bodegaOpciones = computed<DynadrillSelectOption[]>(() =>
    opcionesDeCatalogo(this.bodegas(), this.bodegaId()),
  );
  protected readonly condicionPagoOpciones = computed<DynadrillSelectOption[]>(() =>
    opcionesDeCatalogo(this.condicionesPago(), this.condicionPagoId()),
  );
  protected readonly medioOpciones: DynadrillSelectOption[] = (
    Object.entries(SOLICITUD_MEDIO_LABELS) as ['verbal' | 'escrita', string][]
  ).map(([value, label]) => ({ label, value }));
  protected readonly tipoServicioOpciones = computed<DynadrillSelectOption[]>(() =>
    tiposDeLinea(this.catalogoServicios(), this.lineaServicio()).map((t) => ({
      label: t.nombre,
      value: t.codigo,
    })),
  );
  protected readonly subtipoOpciones = computed<DynadrillSelectOption[]>(() =>
    opcionesSubtipos(this.catalogoServicios(), this.lineaServicio(), this.tiposServicio()),
  );
  /** Valores del select de subtipos (clave tipo::subtipo, porque el mismo nombre puede existir bajo varios tipos). */
  protected readonly subtiposClaves = computed(() => this.subtiposServicio().map(claveSubtipo));
  protected readonly agenteOpciones = computed<DynadrillSelectOption[]>(() =>
    this.agentes().map((u) => ({ label: u.name, value: u.id })),
  );
  protected readonly tecnicoOpciones = computed<DynadrillSelectOption[]>(() =>
    this.tecnicos().map((u) => ({ label: u.name, value: u.id })),
  );
  protected readonly repCampoOpciones = computed<DynadrillSelectOption[]>(() =>
    this.personasCampo()
      .filter((p) => p.activo || p.id === this.representanteCampoId())
      .map((p) => ({ label: p.nombre, value: p.id })),
  );
  protected readonly repQuitoOpciones = computed<DynadrillSelectOption[]>(() =>
    this.personasQuito()
      .filter((p) => p.activo || p.id === this.representanteQuitoId())
      .map((p) => ({ label: p.nombre, value: p.id })),
  );

  // ── Validación ──
  private readonly rigless = computed(() => this.ubicacion().rigless);
  private readonly taladroId = computed(() => this.ubicacion().taladroId);
  private readonly diaInicio = computed(() =>
    this.fechaInicio() ? toLocalDateString(this.fechaInicio() as Date) : null,
  );
  private readonly diaFin = computed(() =>
    this.fechaFin() ? toLocalDateString(this.fechaFin() as Date) : null,
  );

  protected readonly faltantes = computed(() =>
    faltantesParaAbrir({
      clienteId: this.clienteId(),
      lineaServicio: this.lineaServicio(),
      tipoOt: this.tipoOt(),
      tiposServicio: this.tiposServicio(),
      campoId: this.ubicacion().campoId,
      pozoId: this.ubicacion().pozoId,
      taladroId: this.taladroId(),
      rigless: this.rigless(),
      numeroContrato: this.numeroContrato(),
      fechaInicioServicio: this.diaInicio(),
      fechaFinServicio: this.diaFin(),
      tecnicoHseId: this.tecnicoHseId(),
      bodegaId: this.bodegaId(),
      cantidadItems: this.lineas().length,
    }),
  );
  protected readonly errorCoherencia = computed(() =>
    errorCoherencia({
      fechaInicioServicio: this.diaInicio(),
      fechaFinServicio: this.diaFin(),
      rigless: this.rigless(),
      taladroId: this.taladroId(),
    }),
  );
  protected readonly lineasOk = computed(() => lineasValidas(this.lineas()));
  protected readonly puedeGuardar = computed(
    () => !!this.clienteId() && !this.errorCoherencia() && this.lineasOk() && !this.guardando(),
  );
  protected readonly puedeAbrirAhora = computed(
    () =>
      this.puedeGuardar() &&
      this.faltantes().length === 0 &&
      (this.auth.can(PERMISOS_PEDIDOS.crear) || this.auth.can(PERMISOS_PEDIDOS.editar)),
  );
  protected readonly itemsSinLista = computed(
    () => (this.pedido()?.items ?? []).filter((i) => !i.listaPreciosItemId).length,
  );
  protected readonly titulo = computed(() =>
    this.esEdicion ? `Editar pedido ${this.pedido()?.codigo ?? 'por completar'}` : 'Nuevo pedido',
  );
  /** Se puede abrir desde la edición solo si el pedido está en borrador o corrección; en un pedido ya abierto solo se guardan cambios. */
  protected readonly ofreceAbrir = computed(
    () => !this.esEdicion || ['borrador', 'en_correccion'].includes(this.pedido()?.estado ?? ''),
  );

  constructor() {
    this.cargarCatalogos();
    if (this.id) this.cargarPedido(this.id);
  }

  private cargarCatalogos(): void {
    this.servicio
      .tiposOt()
      .pipe(vacioSi<CatalogoTipoOt[]>([]))
      .subscribe((t) => this.tiposOt.set(t));
    this.catalogos
      .bodegas()
      .pipe(vacioSi<BodegaPlataforma[]>([]))
      .subscribe((b) => this.bodegas.set(b));
    this.catalogos
      .condicionesPago()
      .pipe(vacioSi<CondicionPagoPlataforma[]>([]))
      .subscribe((c) => this.condicionesPago.set(c));
    this.servicio.catalogoServicios().subscribe({
      next: (c) => this.catalogoServicios.set(c),
      error: (err) =>
        this.notify.error(
          'Error',
          mensajeDeError(err, 'No se pudo cargar el catálogo de servicios.'),
        ),
    });
    this.catalogos
      .clientes()
      .pipe(vacioSi<ClientePlataforma[]>([]))
      .subscribe((c) => this.clientes.set(c));
    this.catalogos
      .personas('representante_campo')
      .pipe(vacioSi<PersonaPlataforma[]>([]))
      .subscribe((p) => this.personasCampo.set(p));
    this.catalogos
      .personas('representante_quito')
      .pipe(vacioSi<PersonaPlataforma[]>([]))
      .subscribe((p) => this.personasQuito.set(p));
    this.roles
      .usuariosPorRol('tecnico_hse')
      .pipe(vacioSi<UsuarioPorRol[]>([]))
      .subscribe((u) => this.tecnicos.set(u));
    this.roles
      .usuariosPorRol('ingenieria_ventas')
      .pipe(vacioSi<UsuarioPorRol[]>([]))
      .subscribe((u) => {
        this.agentes.set([...u].sort((x, y) => x.name.localeCompare(y.name, 'es')));
      });
  }

  private cargarPedido(id: string): void {
    this.servicio.detalle(id).subscribe({
      next: (p) => {
        if (!p.editable || !this.auth.can(PERMISOS_PEDIDOS.editar)) {
          this.notify.warning(
            'Pedido no editable',
            'Este pedido ya no admite cambios en su estado actual.',
          );
          void this.router.navigate(['/dashboard/facturacion/pedidos', id]);
          return;
        }
        this.aplicarDetalle(p);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudo cargar el pedido.'));
        void this.router.navigate(['/dashboard/facturacion/pedidos']);
      },
    });
  }

  private aplicarDetalle(p: PedidoDetalle): void {
    this.pedido.set(p);
    this.clienteId.set(p.cliente.id);
    this.subcliente.set(p.cliente.subcliente ?? '');
    this.lineaServicio.set(p.lineaServicio);
    this.tipoOt.set(p.tipoOt);
    this.tiposServicio.set([...p.tiposServicio]);
    this.subtiposServicio.set(p.subtiposServicio.map((x) => ({ ...x })));
    this.numeroContrato.set(p.numeroContrato ?? '');
    this.solicitudMedio.set(p.administrativo.solicitudMedio ?? 'escrita');
    this.fechaInicio.set(
      p.fechaInicioServicio ? parseLocalDateString(p.fechaInicioServicio) : null,
    );
    this.fechaFin.set(p.fechaFinServicio ? parseLocalDateString(p.fechaFinServicio) : null);
    this.agenteId.set(p.responsables.agenteComercial.id);
    this.tecnicoHseId.set(p.responsables.tecnicoHse.id);
    this.representanteCampoId.set(p.responsables.representanteCampo.id);
    this.representanteQuitoId.set(p.responsables.representanteQuito.id);
    this.bodegaId.set(p.administrativo.bodegaId);
    this.condicionPagoId.set(p.administrativo.condicionPagoId);
    this.zona.set(p.administrativo.zona ?? '');
    const lineas = p.items.map(lineaDesdeItemPedido).filter((l): l is LineaEditable => l !== null);
    this.lineas.set(lineas);
    this.lineasIniciales = JSON.stringify(lineasAItems(lineas));
    this.ubicacionInicial.set({
      pozoId: p.ubicacion.pozoId,
      taladroId: p.ubicacion.taladroId,
      rigless: p.ubicacion.rigless,
    });
  }

  // ── Cambios en campos con efecto en otros ──

  protected async onCliente(id: string | null): Promise<void> {
    if (id === this.clienteId()) return;
    if (this.lineas().length > 0) {
      const ok = await this.dialog.confirm({
        title: '¿Cambiar el cliente?',
        content:
          'Los ítems salen de la lista de precios del cliente: al cambiarlo se quitan los ítems elegidos.',
        okText: 'Cambiar cliente',
        danger: true,
      });
      if (!ok) return;
      this.lineas.set([]);
    }
    this.clienteId.set(id);
  }

  protected onLinea(linea: LineaServicio | null): void {
    this.lineaServicio.set(linea);
    this.tiposServicio.update((t) => tiposCompatibles(this.catalogoServicios(), linea, t));
    this.onTipos(this.tiposServicio());
  }

  /** Un ejemplo cargado fija la línea y el tipo de servicio del ticket del que salió. */
  protected onEjemplo(e: { linea: LineaServicio; tipoServicio: string }): void {
    this.onLinea(e.linea);
    this.onTipos([e.tipoServicio]);
  }

  protected onTipos(valor: unknown): void {
    const tipos = Array.isArray(valor) ? (valor as string[]) : [];
    this.tiposServicio.set(tipos);
    this.subtiposServicio.update((s) =>
      subtiposVigentes(this.catalogoServicios(), this.lineaServicio(), tipos, s),
    );
  }

  protected onSubtipos(valor: unknown): void {
    const claves = Array.isArray(valor) ? (valor as string[]) : [];
    this.subtiposServicio.set(
      claves.map(subtipoDesdeClave).filter((x): x is SubtipoServicio => x !== null),
    );
  }

  protected onUbicacion(sel: UbicacionPedido): void {
    this.ubicacion.set(sel);
    // La zona es la del campo elegido (como en la demo): se calcula, no se escribe.
    this.zona.set(sel.zona ?? '');
  }

  // ── Guardar ──

  private datos(): DatosPedidoRequest {
    const d: DatosPedidoRequest = {
      subtiposServicio: this.subtiposServicio(),
      tiposServicio: this.tiposServicio(),
      rigless: this.rigless(),
    };
    const poner = <K extends keyof DatosPedidoRequest>(
      clave: K,
      valor: DatosPedidoRequest[K] | null | undefined | '',
    ): void => {
      if (valor !== null && valor !== undefined && valor !== '')
        d[clave] = valor as DatosPedidoRequest[K];
    };
    if (!this.clienteBloqueado()) poner('clienteId', this.clienteId());
    poner('subcliente', this.subcliente().trim());
    poner('lineaServicio', this.lineaServicio());
    poner('tipoOt', this.tipoOt());
    poner('campoId', this.ubicacion().campoId);
    poner('bloqueId', this.ubicacion().bloqueId);
    poner('pozoId', this.ubicacion().pozoId);
    poner('taladroId', this.taladroId());
    poner('numeroContrato', this.numeroContrato().trim());
    poner('fechaInicioServicio', this.diaInicio());
    poner('fechaFinServicio', this.diaFin());
    poner('agenteComercialId', this.agenteId());
    poner('tecnicoHseId', this.tecnicoHseId());
    poner('representanteCampoId', this.representanteCampoId());
    poner('representanteQuitoId', this.representanteQuitoId());
    // Null limpia el valor en el backend; lo que AS2 trajo con id lleno no se envía.
    if (!this.condicionPagoBloqueada()) d.condicionPagoId = this.condicionPagoId();
    if (!this.bodegaBloqueada()) d.bodegaId = this.bodegaId();
    poner('solicitudMedio', this.solicitudMedio());
    const items = lineasAItems(this.lineas());
    // En edición solo se reemplazan los ítems si cambiaron (los que perdieron su vínculo con la lista se conservan así).
    if (!this.esEdicion ? items.length > 0 : JSON.stringify(items) !== this.lineasIniciales)
      d.items = items;
    return d;
  }

  protected guardar(abrir: boolean): void {
    if (!this.puedeGuardar() || this.guardando()) return;
    if (abrir && this.faltantes().length > 0) {
      this.notify.warning(
        'Pedido incompleto',
        `Para abrirlo falta: ${this.faltantes().join(', ')}.`,
      );
      return;
    }
    this.guardando.set(true);
    const datos = this.datos();
    const p = this.pedido();
    if (this.esEdicion && p) {
      const cuerpo: ActualizarPedidoRequest = { ...datos, version: p.version };
      this.servicio.editar(p.id, cuerpo).subscribe({
        next: (editado) =>
          abrir ? this.abrirTrasGuardar(editado) : this.terminar(editado, 'Cambios guardados'),
        error: (err) => this.fallo(err),
      });
      return;
    }
    const cuerpo: CrearPedidoRequest = { ...datos, abrir };
    this.servicio.crear(cuerpo).subscribe({
      next: (creado) =>
        this.terminar(creado, abrir ? 'Pedido abierto' : 'Pedido guardado por completar'),
      error: (err) => this.fallo(err),
    });
  }

  private abrirTrasGuardar(p: PedidoDetalle): void {
    this.servicio.abrir(p.id).subscribe({
      next: (abierto) => this.terminar(abierto, 'Pedido abierto'),
      error: (err) => {
        this.guardando.set(false);
        this.notify.warning(
          'Guardado, pero no se pudo abrir',
          mensajeDeError(err, 'Revise los datos faltantes y vuelva a intentarlo.'),
        );
        void this.router.navigate(['/dashboard/facturacion/pedidos', p.id, 'editar']);
      },
    });
  }

  private terminar(p: PedidoDetalle, titulo: string): void {
    this.guardando.set(false);
    this.notify.success(titulo, p.codigo ? `Código ${p.codigo}` : undefined);
    void this.router.navigate(['/dashboard/facturacion/pedidos', p.id]);
  }

  private fallo(err: unknown): void {
    this.guardando.set(false);
    if (esConflicto(err) && this.esEdicion) {
      this.notify.error(
        'El pedido cambió',
        'Otra persona lo modificó antes que usted. Se recarga con los datos actuales.',
      );
      if (this.id) this.cargarPedido(this.id);
      return;
    }
    this.notify.error('No se pudo guardar', mensajeDeError(err, 'No se pudo guardar el pedido.'));
  }

  /** Adjuntar o quitar devuelve el detalle: se actualiza el pedido (versión incluida) sin tocar lo que se está editando. */
  protected onDocumentos(p: PedidoDetalle): void {
    this.pedido.set(p);
  }

  protected cancelar(): void {
    void this.router.navigate(
      this.id ? ['/dashboard/facturacion/pedidos', this.id] : ['/dashboard/facturacion/pedidos'],
    );
  }
}
