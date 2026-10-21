import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { MACRO_ESTADO_TONE } from '../../../../../shared/models/timeline.model';
import {
  MotivoDialog,
  type MotivoDialogData,
} from '../../../../../shared/components/motivo-dialog/motivo-dialog';
import { AuthService } from '../../../../../core/services/auth.service';
import {
  PERMISO_FCR_VER,
  PASOS_FCR,
} from '../../../../operations/fcr/tickets-nuevos/models/ticket-fcr';
import {
  PERMISO_PUMPING_DOCUMENTOS_VER,
  PERMISO_PUMPING_OPERAR,
  nombrePaso as nombrePasoPumping,
} from '../../../../operations/pumping/tickets-nuevos/models/ticket-pumping';
import { PedidosComercialService } from '../../services/pedidos-comercial.service';
import { GuiasSeccion } from '../../components/guias-seccion/guias-seccion';
import { OrdenTrabajoSeccion } from '../../components/orden-trabajo-seccion/orden-trabajo-seccion';
import { PERMISOS_ORDENES, muestraOrdenYCierre } from '../../models/orden-trabajo';
import { PrefacturaResumen } from '../../components/prefactura-resumen/prefactura-resumen';
import { PERMISOS_GUIAS } from '../../models/guia-comercial';
import { PERMISOS_PREFACTURAS } from '../../models/prefactura-comercial';
import { DocumentosRespaldo } from '../../components/documentos-respaldo/documentos-respaldo';
import { PERMISOS_DOCUMENTOS_OPERATIVOS } from '../../models/documentos-operativos';
import {
  AsignarAnalistaDialog,
  type AsignarAnalistaDialogData,
} from '../../components/asignar-analista-dialog/asignar-analista-dialog';
import {
  ForzarEstadoDialog,
  type ForzarEstadoDialogData,
  type ForzarEstadoResultado,
} from '../../components/forzar-estado-dialog/forzar-estado-dialog';
import {
  ESTADOS_ABRIBLES,
  LINEA_SERVICIO_LABELS,
  ORIGEN_CAMBIO_LABELS,
  PERMISOS_PEDIDOS,
  SOLICITUD_MEDIO_LABELS,
  SYNC_AS2_LABELS,
  etiquetaTipoOt,
  etiquetasSubtipos,
  etiquetasTiposServicio,
  formatoDia,
  formatoMoneda,
  mensajeDeError,
  pasosDeFlujo,
  puedeDarPaso,
  type CatalogoServicios,
  type CatalogoTipoOt,
  type EstadoCatalogo,
  type PedidoDetalle,
  type TransicionDisponible,
} from '../../models/pedido-comercial.model';

/** Detalle de un pedido del backend comercial: datos, ítems, bloque AS2, historial y los pasos que el backend permite. */
@Component({
  selector: 'app-pedido-comercial-detail-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillButtonComponent,
    DynadrillBannerComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
    DocumentosRespaldo,
    PrefacturaResumen,
    GuiasSeccion,
    OrdenTrabajoSeccion,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pedido-comercial-detail-page.html',
  styleUrl: './pedido-comercial-detail-page.scss',
})
export class PedidoComercialDetailPage {
  private readonly servicio = inject(PedidosComercialService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  private readonly estadosCatalogo = signal<EstadoCatalogo[]>([]);
  protected readonly catalogo = signal<CatalogoServicios | null>(null);
  private readonly tiposOt = signal<CatalogoTipoOt[]>([]);

  protected readonly pedido = signal<PedidoDetalle | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly ocupado = signal(false);

  // ── Permisos y pasos (el flujo lo dicta el backend en `siguientes`; aquí no se hardcodea) ──
  private readonly puede = (permiso: string) => this.auth.can(permiso);
  protected readonly anulado = computed(() => this.pedido()?.estado === 'anulado');
  protected readonly puedeEditar = computed(
    () => !!this.pedido()?.editable && this.puede(PERMISOS_PEDIDOS.editar),
  );
  protected readonly puedeAbrir = computed(() => {
    const p = this.pedido();
    return (
      !!p &&
      ESTADOS_ABRIBLES.includes(p.estado) &&
      (this.puede(PERMISOS_PEDIDOS.crear) || this.puede(PERMISOS_PEDIDOS.editar))
    );
  });
  protected readonly pasos = computed<TransicionDisponible[]>(() =>
    pasosDeFlujo(this.pedido()?.siguientes ?? []).filter((s) => s.estado !== 'abierto'),
  );
  protected readonly pasoRechazar = computed(() =>
    puedeDarPaso(this.pedido()?.siguientes ?? [], 'en_correccion'),
  );
  protected readonly pasoAnular = computed(() =>
    puedeDarPaso(this.pedido()?.siguientes ?? [], 'anulado'),
  );
  protected readonly puedeVerOrdenes = computed(
    () => this.puede(PERMISOS_ORDENES.ver) && muestraOrdenYCierre(this.pedido()?.estado ?? ''),
  );
  protected readonly puedeVerGuias = computed(() => this.puede(PERMISOS_GUIAS.ver));
  protected readonly puedeVerPrefactura = computed(() => this.puede(PERMISOS_PREFACTURAS.ver));
  protected readonly puedeVerOperativos = computed(() =>
    this.puede(PERMISOS_DOCUMENTOS_OPERATIVOS.ver),
  );
  protected readonly puedeCargarFirmado = computed(() => this.puede(PERMISOS_PREFACTURAS.firmar));
  protected readonly puedeVerRespaldoTicket = computed(() =>
    this.puede(PERMISO_PUMPING_DOCUMENTOS_VER),
  );
  protected readonly puedeCorregirOperativos = computed(() =>
    this.puede(PERMISOS_DOCUMENTOS_OPERATIVOS.corregir),
  );
  protected readonly puedeAdjuntar = computed(
    () => !!this.pedido()?.editable && this.puede(PERMISOS_PEDIDOS.editar),
  );
  protected readonly puedeAsignar = computed(
    () => !!this.pedido() && !this.anulado() && this.puede(PERMISOS_PEDIDOS.asignarAnalista),
  );
  protected readonly puedeForzar = computed(() => !!this.pedido()?.puedeForzar && !this.anulado());
  protected readonly puedeImportar = computed(() => {
    const p = this.pedido();
    return (
      !!p && p.editable && p.as2.idPedidoCliente !== null && this.puede(PERMISOS_PEDIDOS.editar)
    );
  });
  protected readonly pendienteDeAs2 = computed(() => {
    const p = this.pedido();
    return !!p && p.as2.idPedidoCliente === null && !this.anulado();
  });

  protected readonly tono = computed(
    () => MACRO_ESTADO_TONE[this.pedido()?.macroEstado ?? 'pendiente'] ?? 'neutral',
  );
  protected readonly titulo = computed(() => {
    const p = this.pedido();
    return p ? `Pedido ${p.codigo ?? 'por completar'}` : 'Pedido';
  });
  protected readonly subtitulo = computed(() => {
    const p = this.pedido();
    if (!p) return '';
    const sitio = [p.ubicacion.campo, p.ubicacion.pozo].filter(Boolean).join(' / ');
    return [p.cliente.nombre, sitio].filter(Boolean).join(' — ');
  });

  // ── Ticket de Operaciones asociado: número, fase y acceso (si la cuenta puede abrirlo) ──
  protected readonly ticketOperativo = computed(() => this.pedido()?.ticketOperativo ?? null);
  protected readonly lineaTicket = computed(() =>
    this.ticketOperativo()?.origen === 'fcr' ? 'FCR' : 'Pumping',
  );
  protected readonly faseTicket = computed(() => {
    const t = this.ticketOperativo();
    if (!t) return '—';
    return t.origen === 'fcr'
      ? (PASOS_FCR.find((p) => p.codigo === t.pasoCodigo)?.nombre ?? t.pasoCodigo)
      : nombrePasoPumping(t.pasoCodigo);
  });
  protected readonly puedeAbrirTicket = computed(() => {
    const t = this.ticketOperativo();
    return !!t && this.puede(t.origen === 'fcr' ? PERMISO_FCR_VER : PERMISO_PUMPING_OPERAR);
  });
  protected irAlTicket(): void {
    const t = this.ticketOperativo();
    if (!t) return;
    void this.router.navigate([`/modulos/operativo/${t.origen}/pedidos`, t.ticketId]);
  }

  // ── Datos en rejilla (mismos bloques de la demo: Cliente, Servicio, Comercial y responsables, Administrativos) ──
  private readonly dato = (label: string, value: string | null | undefined) => ({
    label,
    value: value && value.trim() ? value : '—',
  });
  protected readonly datosCliente = computed(() => {
    const p = this.pedido();
    if (!p) return [];
    return [
      this.dato('Cliente', p.cliente.nombre),
      this.dato('RUC', p.cliente.ruc),
      this.dato('Subcliente', p.cliente.subcliente),
      this.dato('Contrato', p.numeroContrato),
    ];
  });
  protected readonly datosServicio = computed(() => {
    const p = this.pedido();
    if (!p) return [];
    return [
      this.dato('Línea de servicio', this.linea(p)),
      this.dato('Tipo de servicio', this.tipos(p)),
      this.dato('Sub-tipo de servicio', this.subtipos(p)),
      this.dato('Campo', p.ubicacion.campo),
      this.dato('Bloque', p.ubicacion.bloque),
      this.dato('Pozo', p.ubicacion.pozo),
      this.dato('Taladro / Rig', this.taladro(p)),
      this.dato(
        'Inicio de servicio',
        p.fechaInicioServicio ? p.fechaInicioServicio.slice(0, 10) : null,
      ),
      this.dato('Fin de servicio', p.fechaFinServicio ? p.fechaFinServicio.slice(0, 10) : null),
    ];
  });
  protected readonly datosComercial = computed(() => {
    const p = this.pedido();
    if (!p) return [];
    return [
      this.dato('Agente comercial', p.responsables.agenteComercial.nombre),
      this.dato('Representante en campo', p.responsables.representanteCampo.nombre),
      this.dato('Representante en Quito (PEC)', p.responsables.representanteQuito.nombre),
      this.dato('Técnico HSE', p.responsables.tecnicoHse.nombre),
      this.dato(
        'Analista de facturación',
        p.responsables.analistaFacturacion.nombre ?? 'Sin analista',
      ),
    ];
  });
  protected readonly datosAdministrativos = computed(() => {
    const p = this.pedido();
    if (!p) return [];
    return [
      this.dato('Condición de pago', p.administrativo.condicionPago),
      this.dato('Zona', p.administrativo.zona),
      this.dato('Bodega', p.administrativo.bodega),
      this.dato('Origen', p.origen === 'as2' ? 'AS2' : 'Portal'),
      this.dato('Referencia AS2', p.as2.numero ?? 'Sin vincular'),
      this.dato('Estado en AS2', p.as2.estado),
      this.dato('Sincronización', this.sync(p)),
      this.dato('Solicitud', this.medio(p)),
    ];
  });

  // ── Línea de estados: lo ya recorrido (con su fecha y quién), el actual y lo que sigue en el camino de la prefactura ──
  /** Estados que nombran un hecho ya cumplido (firmado, generada, facturado): al llegar a ellos el paso sale completado, no «en curso». */
  private static readonly HECHOS = ['ticket_firmado', 'aot_generada', 'facturado'];
  private static readonly CAMINO = [
    'documentos_completos',
    'en_revision_prefacturacion',
    'prefactura_generada',
    'enviado_para_firmas',
    'ticket_firmado',
    'aot_generada',
  ];
  protected readonly pasosTimeline = computed(() => {
    const p = this.pedido();
    if (!p) return [];
    const corto = (iso: string) => {
      const d = new Date(iso);
      return Number.isNaN(d.getTime())
        ? '—'
        : d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const hechos = p.historial.map((h, i, todos) => ({
      label: h.nombreEstado,
      state:
        i === todos.length - 1 && !PedidoComercialDetailPage.HECHOS.includes(p.estado)
          ? ('current' as const)
          : ('done' as const),
      fecha: corto(h.fecha),
      actor: h.actorNombre ?? 'Sistema',
      motivo: h.motivo,
    }));
    const alcanzados = new Set(p.historial.map((h) => h.estadoNuevo));
    const iActual = PedidoComercialDetailPage.CAMINO.indexOf(p.estado);
    const nombres = new Map(this.estadosCatalogo().map((e) => [e.codigo, e.nombre]));
    const faltan =
      iActual < 0 || p.terminal
        ? []
        : PedidoComercialDetailPage.CAMINO.slice(iActual + 1)
            .filter((c) => !alcanzados.has(c))
            .map((c) => ({
              label: nombres.get(c) ?? c,
              state: 'pending' as const,
              fecha: '',
              actor: '',
              motivo: null as string | null,
            }));
    return [...hechos, ...faltan];
  });

  constructor() {
    this.servicio
      .tiposOt()
      .subscribe({ next: (t) => this.tiposOt.set(t), error: () => this.tiposOt.set([]) });
    this.servicio
      .catalogoServicios()
      .subscribe({ next: (c) => this.catalogo.set(c), error: () => this.catalogo.set(null) });
    this.servicio.estados().subscribe({
      next: (e) => this.estadosCatalogo.set(e),
      error: () => this.estadosCatalogo.set([]),
    });
    this.cargar();
  }

  /** Recarga el pedido completo (estado, historial, pasos) sin la pantalla de carga completa. */
  protected refrescar(): void {
    this.servicio.detalle(this.id).subscribe({
      next: (p) => this.pedido.set(p),
      error: (err) =>
        this.notify.error(
          'No se pudo actualizar',
          mensajeDeError(err, 'No se pudo actualizar el pedido.'),
        ),
    });
  }

  private cargar(): void {
    this.cargando.set(true);
    this.servicio.detalle(this.id).subscribe({
      next: (p) => {
        this.pedido.set(p);
        this.error.set(null);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeDeError(err, 'No se pudo cargar el pedido.'));
      },
    });
  }

  private aplicar(p: PedidoDetalle, titulo: string, detalle?: string): void {
    this.pedido.set(p);
    this.ocupado.set(false);
    this.notify.success(titulo, detalle);
  }

  private fallo(titulo: string, err: unknown, porDefecto: string): void {
    this.ocupado.set(false);
    this.notify.error(titulo, mensajeDeError(err, porDefecto));
  }

  // ── Acciones ──

  protected editar(): void {
    void this.router.navigate(['/dashboard/facturacion/pedidos', this.id, 'editar']);
  }

  protected onDocumentos(p: PedidoDetalle): void {
    this.pedido.set(p);
  }

  protected volver(): void {
    void this.router.navigate(['/dashboard/facturacion/pedidos']);
  }

  protected buscarEnAs2(): void {
    void this.router.navigate(['/dashboard/facturacion/pedidos'], {
      queryParams: { pestana: 'por-completar' },
    });
  }

  protected abrir(): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.servicio.abrir(this.id).subscribe({
      next: (p) => this.aplicar(p, 'Pedido abierto', `Código ${p.codigo ?? ''}`.trim()),
      error: (err) =>
        this.fallo('No se pudo abrir', err, 'El pedido está incompleto o no se puede abrir.'),
    });
  }

  /** Paso del flujo: pide motivo si el backend lo exige; si no, confirma. */
  protected async dar(paso: TransicionDisponible): Promise<void> {
    if (this.ocupado()) return;
    let motivo: string | undefined;
    if (paso.requiereMotivo) {
      motivo = await this.pedirMotivo(`Indique el motivo para pasar el pedido a "${paso.nombre}".`);
      if (!motivo) return;
    } else {
      const ok = await this.dialog.confirm({
        title: `¿Pasar a "${paso.nombre}"?`,
        content: 'El cambio queda registrado en el historial del pedido.',
        okText: 'Confirmar',
      });
      if (!ok) return;
    }
    this.ocupado.set(true);
    this.servicio.transicionar(this.id, paso.estado, motivo).subscribe({
      next: (p) => this.aplicar(p, 'Estado actualizado', `El pedido pasó a "${p.estadoNombre}".`),
      error: (err) =>
        this.fallo('No se pudo cambiar el estado', err, 'No se pudo cambiar el estado del pedido.'),
    });
  }

  protected async rechazar(): Promise<void> {
    const motivo = await this.pedirMotivo(
      'Indique por qué se devuelve el pedido a Ventas para corrección.',
    );
    if (!motivo || this.ocupado()) return;
    this.ocupado.set(true);
    const llamada = this.puede(PERMISOS_PEDIDOS.rechazar)
      ? this.servicio.rechazar(this.id, motivo)
      : this.servicio.transicionar(this.id, 'en_correccion', motivo);
    llamada.subscribe({
      next: (p) => this.aplicar(p, 'Pedido devuelto a Ventas', 'Quedó "En corrección".'),
      error: (err) => this.fallo('No se pudo rechazar', err, 'No se pudo devolver el pedido.'),
    });
  }

  protected async anular(): Promise<void> {
    const motivo = await this.pedirMotivo(
      'El pedido queda cerrado como "Anulado" y no se puede retomar. Indique el motivo de la anulación.',
    );
    if (!motivo || this.ocupado()) return;
    this.ocupado.set(true);
    const llamada = this.puede(PERMISOS_PEDIDOS.anular)
      ? this.servicio.anular(this.id, motivo)
      : this.servicio.transicionar(this.id, 'anulado', motivo);
    llamada.subscribe({
      next: (p) => this.aplicar(p, 'Pedido anulado'),
      error: (err) => this.fallo('No se pudo anular', err, 'No se pudo anular el pedido.'),
    });
  }

  protected asignarAnalista(): void {
    const p = this.pedido();
    if (!p) return;
    const ref = this.dialog.open<AsignarAnalistaDialog, AsignarAnalistaDialogData>({
      title: p.responsables.analistaFacturacion.nombre
        ? 'Reasignar analista de facturación'
        : 'Asignar analista de facturación',
      content: AsignarAnalistaDialog,
      data: {
        pedidoId: p.id,
        codigo: p.codigo,
        analistaActual: p.responsables.analistaFacturacion.nombre,
      },
      footer: false,
      width: '480px',
    });
    ref.afterClose.subscribe((nuevo: PedidoDetalle | undefined) => {
      if (nuevo) this.pedido.set(nuevo);
    });
  }

  protected forzar(): void {
    const p = this.pedido();
    if (!p) return;
    const ref = this.dialog.open<ForzarEstadoDialog, ForzarEstadoDialogData>({
      title: 'Forzar estado',
      content: ForzarEstadoDialog,
      data: { estados: this.estadosCatalogo(), estadoActual: p.estado },
      footer: false,
      width: '480px',
    });
    ref.afterClose.subscribe((r: ForzarEstadoResultado | undefined) => {
      if (!r) return;
      this.ocupado.set(true);
      this.servicio.transicionar(this.id, r.estado, r.motivo, true).subscribe({
        next: (nuevo) =>
          this.aplicar(nuevo, 'Estado forzado', `El pedido pasó a "${nuevo.estadoNombre}".`),
        error: (err) => this.fallo('No se pudo forzar', err, 'No se pudo forzar el estado.'),
      });
    });
  }

  protected importarLineas(): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.servicio.importarLineasAs2(this.id).subscribe({
      next: (r) => {
        const aviso = r.sinCoincidencia.length
          ? ` No están en la lista de precios del cliente: ${r.sinCoincidencia.join(', ')}.`
          : '';
        this.pedido.set(r.pedido);
        this.ocupado.set(false);
        if (r.importados > 0)
          this.notify.success(
            'Líneas importadas',
            `${r.importados} línea(s) importada(s).${aviso}`,
          );
        else
          this.notify.warning(
            'Sin líneas importadas',
            `Ninguna línea coincide con la lista de precios del cliente.${aviso}`,
          );
      },
      error: (err) =>
        this.fallo('No se pudo importar', err, 'No se pudieron importar las líneas de AS2.'),
    });
  }

  private pedirMotivo(mensaje: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      const ref = this.dialog.open<MotivoDialog, MotivoDialogData>({
        title: 'Motivo',
        content: MotivoDialog,
        data: { mensaje },
        size: 'small',
        footer: false,
      });
      ref.afterClose.subscribe((m: string | undefined) => resolve(m?.trim() || undefined));
    });
  }

  // ── Presentación ──
  protected readonly dia = formatoDia;
  protected readonly moneda = formatoMoneda;
  protected readonly tipos = (p: PedidoDetalle) =>
    etiquetasTiposServicio(this.catalogo(), p.tiposServicio);
  protected readonly subtipos = (p: PedidoDetalle) =>
    etiquetasSubtipos(this.catalogo(), p.subtiposServicio);
  protected readonly linea = (p: PedidoDetalle) =>
    p.lineaServicio ? LINEA_SERVICIO_LABELS[p.lineaServicio] : '—';
  protected readonly tipoOt = (p: PedidoDetalle) => etiquetaTipoOt(this.tiposOt(), p.tipoOt);
  protected readonly medio = (p: PedidoDetalle) =>
    p.administrativo.solicitudMedio ? SOLICITUD_MEDIO_LABELS[p.administrativo.solicitudMedio] : '—';
  protected readonly sync = (p: PedidoDetalle) =>
    SYNC_AS2_LABELS[p.as2.syncEstado] ?? p.as2.syncEstado;
  protected readonly origenCambio = (o: keyof typeof ORIGEN_CAMBIO_LABELS) =>
    ORIGEN_CAMBIO_LABELS[o] ?? o;
  protected readonly taladro = (p: PedidoDetalle) =>
    p.ubicacion.rigless ? 'Rigless (sin taladro)' : (p.ubicacion.taladro ?? '—');
  protected readonly tonoHistorial = (macro: string) =>
    MACRO_ESTADO_TONE[macro as keyof typeof MACRO_ESTADO_TONE] ?? 'neutral';
  protected fechaHora(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' });
  }
}
