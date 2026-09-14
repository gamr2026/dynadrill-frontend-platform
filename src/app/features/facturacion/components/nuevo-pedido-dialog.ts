import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../core/services/auth.service';
import { LINEA_SERVICIO_LABELS, LineaServicio, Pedido, TIPO_OT_LABELS, TipoOt } from '../models/pedido.model';
import { ListaPrecios } from '../models/lista-precios.model';
import { ListaPreciosService, PedidoService } from '../services/pedido.service';
import { RolesService } from '../../users/services/users.service';
import { UBICACION_VACIA, UbicacionSelectorComponent, type UbicacionSeleccion } from '../../../shared/index';

/** Clientes conocidos — hasta que exista el catálogo real de AS2. */
const CLIENTES: { nombre: string; ruc: string }[] = [
  { nombre: 'EP Petroecuador', ruc: '1768153530001' },
  { nombre: 'Petroandina', ruc: '1792060346001' },
  { nombre: 'Schlumberger', ruc: '1791251237001' },
  { nombre: 'Baker Hughes', ruc: '1790008959001' },
];

/** Condición de pago — dos categorías a pedido del cliente: normal vs. "SIN CRÉDITO" (plazos largos, sin línea de crédito). */
const CONDICION_PAGO_OPTIONS: DynadrillSelectOption[] = [
  { label: '1 día', value: '1 día', group: 'Con crédito' },
  { label: '15 días', value: '15 días', group: 'Con crédito' },
  { label: '30 días', value: '30 días', group: 'Con crédito' },
  { label: '45 días', value: '45 días', group: 'Con crédito' },
  { label: '60 días', value: '60 días', group: 'SIN CRÉDITO' },
  { label: '90 días', value: '90 días', group: 'SIN CRÉDITO' },
  { label: '120 días', value: '120 días', group: 'SIN CRÉDITO' },
  { label: '150 días', value: '150 días', group: 'SIN CRÉDITO' },
  { label: '180 días', value: '180 días', group: 'SIN CRÉDITO' },
  { label: '210 días', value: '210 días', group: 'SIN CRÉDITO' },
];

/** Se pasa al abrir el diálogo en modo edición (ver pedido-detail-page). Sin `data`/`data.pedido`, arranca en modo alta. */
export interface NuevoPedidoDialogData {
  pedido?: Pedido;
}

/**
 * FACT-001 — alta de Pedido desde el Portal (rol Ventas). El gateway lo
 * empuja a AS2 (mock). La cabecera completa + una sola línea estimada.
 *
 * También sirve para editar un pedido existente (Ventas y Facturación, ver
 * `ModuleRoles.pedidos` en el backend) — se abre con `data: { pedido }` desde
 * `pedido-detail-page`; la sección Administrativos queda oculta para
 * Facturación en ese modo (a pedido del cliente: solo Ventas la gestiona).
 */
@Component({
  selector: 'app-nuevo-pedido-dialog',
  imports: [
    DecimalPipe,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillDatetimePickerComponent,
    DynadrillButtonComponent,
    DynadrillTextComponent,
    UbicacionSelectorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nuevo-pedido-dialog.html',
  styleUrl: './nuevo-pedido-dialog.scss',
})
export class NuevoPedidoDialog {
  private readonly pedidoService = inject(PedidoService);
  private readonly listaService = inject(ListaPreciosService);
  private readonly rolesService = inject(RolesService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<NuevoPedidoDialog, Pedido | undefined>);
  private readonly data = inject<NuevoPedidoDialogData | null>(NZ_MODAL_DATA, { optional: true });

  /** Modo edición — se abrió con `data: { pedido }` desde el detalle de un pedido ya creado. */
  protected readonly editando = computed(() => !!this.data?.pedido);
  /** A pedido del cliente: en edición, Facturación no gestiona Administrativos (solo Ventas). En alta, solo Ventas llega acá igual. */
  protected readonly puedeVerAdministrativos = computed(
    () => !this.editando() || this.auth.currentUser()?.roleName !== 'Facturación',
  );

  // ── Cliente ──
  protected readonly cliente = signal<string | null>(null);
  protected readonly subcliente = signal('');
  protected readonly numeroContrato = signal('2025201');

  protected readonly clienteOptions: DynadrillSelectOption[] = CLIENTES.map(c => ({ label: c.nombre, value: c.nombre }));
  protected readonly clienteRuc = computed(() => CLIENTES.find(c => c.nombre === this.cliente())?.ruc ?? '');

  // ── Servicio ──
  protected readonly lineaServicio = signal<LineaServicio | null>(null);
  protected readonly lineaOptions: DynadrillSelectOption[] = (Object.entries(LINEA_SERVICIO_LABELS) as [LineaServicio, string][]).map(
    ([value, label]) => ({ label, value }),
  );
  /** Decide qué entrada del FcrTicket derivado usa este pedido — la elige Ventas, no Operaciones. */
  protected readonly tipoOt = signal<TipoOt | null>(null);
  protected readonly tipoOtOptions: DynadrillSelectOption[] = (Object.entries(TIPO_OT_LABELS) as [TipoOt, string][]).map(
    ([value, label]) => ({ label, value }),
  );
  /** Campo / Bloque / Pozo / Taladro — del catálogo, vía <app-ubicacion-selector>. */
  protected readonly ubicacion = signal<UbicacionSeleccion>(UBICACION_VACIA);
  protected readonly fechaInicioServicio = signal<Date | null>(null);
  protected readonly fechaFinServicio = signal<Date | null>(null);

  // ── Comercial / responsables ──
  protected readonly agenteComercial = signal('');
  protected readonly representanteCampo = signal('');
  protected readonly representanteQuito = signal('');
  protected readonly analistaFacturacion = signal('');
  /**
   * FACT-001 Fase 2/3: "Asignar Técnico HSE responsable" — el sistema no
   * activa/distribuye el ticket sin uno con rol activo. El backend
   * re-valida contra el usuario real; acá solo se lista para elegir.
   */
  protected readonly tecnicoHseResponsableId = signal<number | null>(null);
  protected readonly tecnicoHseOptions = signal<DynadrillSelectOption[]>([]);

  // ── Administrativos ──
  protected readonly condicionPago = signal('30 días');
  protected readonly condicionPagoOptions = CONDICION_PAGO_OPTIONS;
  protected readonly zona = signal('Zona Centro');
  protected readonly bodega = signal('BODEGA ORION');
  protected readonly solicitudMedio = signal<'verbal' | 'escrita'>('escrita');
  protected readonly solicitudMedioOptions: DynadrillSelectOption[] = [
    { label: 'Escrita', value: 'escrita' },
    { label: 'Verbal', value: 'verbal' },
  ];

  // ── Estimado (1 o varias líneas, desde la Lista de Precios del cliente) ──
  protected readonly listaCliente = signal<ListaPrecios | null>(null);
  protected readonly itemOptions = computed<DynadrillSelectOption[]>(() =>
    (this.listaCliente()?.items ?? []).map(i => ({ label: `${i.codigo} — ${i.descripcion}`, value: i.codigo })),
  );

  /**
   * Líneas estimadas. Cantidad/valor como string (mismo patrón que
   * unit-report-dialog): bindear un number a [value] de un <input type="number">
   * hace que el valor tipeado "no pegue" y quede en el default.
   */
  protected readonly lineasEstimadas = signal<{ codigo: string | null; cantidad: string; valorUnitario: string }[]>([
    { codigo: null, cantidad: '1', valorUnitario: '0' },
  ]);

  protected itemDeLinea(codigo: string | null) {
    return this.listaCliente()?.items.find(i => i.codigo === codigo) ?? null;
  }

  protected agregarLinea(): void {
    this.lineasEstimadas.update(ls => [...ls, { codigo: null, cantidad: '1', valorUnitario: '0' }]);
  }

  protected quitarLinea(index: number): void {
    this.lineasEstimadas.update(ls => (ls.length > 1 ? ls.filter((_, i) => i !== index) : ls));
  }

  protected onLineaCodigoChange(index: number, codigo: string): void {
    const precio = this.itemDeLinea(codigo)?.precio;
    this.lineasEstimadas.update(ls =>
      ls.map((l, i) => (i === index ? { ...l, codigo, valorUnitario: precio != null ? String(precio) : l.valorUnitario } : l)),
    );
  }

  protected onLineaCampoChange(index: number, campo: 'cantidad' | 'valorUnitario', valor: string): void {
    this.lineasEstimadas.update(ls => ls.map((l, i) => (i === index ? { ...l, [campo]: valor } : l)));
  }

  private lineaValida(l: { codigo: string | null; cantidad: string; valorUnitario: string }): boolean {
    return !!l.codigo && Number(l.cantidad) > 0 && Number(l.valorUnitario) > 0;
  }

  protected readonly lineasTodasValidas = computed(() => this.lineasEstimadas().every(l => this.lineaValida(l)));
  protected readonly valorEstimadoTotal = computed(() =>
    Math.round(this.lineasEstimadas().reduce((s, l) => s + Number(l.cantidad) * Number(l.valorUnitario), 0) * 100) / 100,
  );

  protected readonly submitting = signal(false);

  protected readonly puedeGuardar = computed(
    () =>
      !!this.cliente() &&
      !!this.lineaServicio() &&
      !!this.tipoOt() &&
      this.ubicacion().pozoId !== null &&
      this.ubicacion().taladroId !== null &&
      this.agenteComercial().trim().length > 0 &&
      this.representanteCampo().trim().length > 0 &&
      this.representanteQuito().trim().length > 0 &&
      this.tecnicoHseResponsableId() !== null &&
      this.lineasTodasValidas(),
  );

  /** Prefill de <app-ubicacion-selector> en modo edición — el propio componente resuelve ids contra el catálogo. */
  protected readonly ubicacionInicial = computed<Partial<UbicacionSeleccion> | null>(() => {
    const p = this.data?.pedido;
    if (!p) return null;
    return {
      pozoId: p.pozoId ?? null,
      pozo: p.pozo,
      nombreCompletoPozo: p.nombreCompletoPozo ?? '',
      campoId: p.campoId ?? null,
      campo: p.campo,
      bloqueId: p.bloqueId ?? null,
      bloque: p.bloque,
      taladroId: p.taladroId ?? null,
      taladro: p.taladroRig,
    };
  });

  constructor() {
    this.listaService.list().subscribe(listas => {
      this.actualizarListaCliente(listas);
    });
    this.rolesService.usuariosPorRol('tecnico_hse').subscribe(usuarios => {
      this.tecnicoHseOptions.set(usuarios.map(u => ({ label: u.name, value: u.id })));
    });

    const p = this.data?.pedido;
    if (p) this.prefillDesdePedido(p);
  }

  /** Modo edición — vuelca el pedido ya creado a las señales del formulario. `ubicacion`/`ubicacionInicial` los resuelve <app-ubicacion-selector>. */
  private prefillDesdePedido(p: Pedido): void {
    this.cliente.set(p.cliente);
    this.subcliente.set(p.subcliente ?? '');
    this.numeroContrato.set(p.numeroContrato ?? '');
    this.lineaServicio.set(p.lineaServicio);
    this.tipoOt.set(p.tipoOt);
    this.fechaInicioServicio.set(p.fechaInicioServicio ? new Date(p.fechaInicioServicio) : null);
    this.fechaFinServicio.set(p.fechaFinServicio ? new Date(p.fechaFinServicio) : null);
    this.agenteComercial.set(p.agenteComercial ?? '');
    this.representanteCampo.set(p.representanteCampo ?? '');
    this.representanteQuito.set(p.representanteQuito ?? '');
    this.analistaFacturacion.set(p.analistaFacturacion ?? '');
    this.tecnicoHseResponsableId.set(p.tecnicoHseResponsableId ?? null);
    this.condicionPago.set(p.condicionPago ?? '30 días');
    this.zona.set(p.zona ?? '');
    this.bodega.set(p.bodega ?? '');
    this.solicitudMedio.set(p.solicitudMedio ?? 'escrita');
    if (p.itemsEstimados?.length) {
      this.lineasPrefill = p.itemsEstimados.map(it => ({
        codigo: it.codigo,
        cantidad: String(it.cantidad),
        valorUnitario: String(it.valorUnitario),
      }));
    }
  }

  private todasLasListas: ListaPrecios[] = [];
  /**
   * Líneas del pedido en edición, fijadas por `prefillDesdePedido` ANTES de
   * que la lista de precios cargue (async) — sin esto, el primer
   * `emparejarLista()` automático (dispara al llegar `listaService.list()`)
   * las pisaría con el default en blanco. Se consume una sola vez.
   */
  private lineasPrefill: { codigo: string | null; cantidad: string; valorUnitario: string }[] | null = null;

  private actualizarListaCliente(listas: ListaPrecios[]): void {
    this.todasLasListas = listas;
    this.emparejarLista();
  }

  private emparejarLista(): void {
    const match =
      this.todasLasListas.find(l => l.cliente === this.cliente() && l.numeroContrato === this.numeroContrato() && l.activa) ??
      this.todasLasListas.find(l => l.cliente === this.cliente() && l.activa) ??
      null;
    this.listaCliente.set(match);
    // Al cambiar de lista se limpian los códigos elegidos (pueden no existir en la nueva) — salvo el prefill de edición, que se consume una sola vez.
    this.lineasEstimadas.set(this.lineasPrefill ?? [{ codigo: null, cantidad: '1', valorUnitario: '0' }]);
    this.lineasPrefill = null;
  }

  protected onClienteChange(value: string): void {
    this.cliente.set(value);
    this.emparejarLista();
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    const nombre = this.auth.currentUser()?.name ?? 'Ventas';
    const itemsEstimados = this.lineasEstimadas().map(l => {
      const it = this.itemDeLinea(l.codigo)!;
      return {
        codigo: it.codigo,
        descripcion: it.descripcion,
        unidad: it.unidad,
        cantidad: Number(l.cantidad),
        valorUnitario: Number(l.valorUnitario),
      };
    });

    const payload = {
      origen: 'portal' as const,
      cliente: this.cliente()!,
      clienteRuc: this.clienteRuc() || undefined,
      subcliente: this.subcliente().trim() || undefined,
      lineaServicio: this.lineaServicio()!,
      tipoOt: this.tipoOt()!,
      campo: this.ubicacion().campo,
      bloque: this.ubicacion().bloque,
      pozo: this.ubicacion().pozo,
      taladroRig: this.ubicacion().taladro,
      campoId: this.ubicacion().campoId ?? undefined,
      bloqueId: this.ubicacion().bloqueId ?? undefined,
      pozoId: this.ubicacion().pozoId ?? undefined,
      nombreCompletoPozo: this.ubicacion().nombreCompletoPozo || undefined,
      taladroId: this.ubicacion().taladroId ?? undefined,
      numeroContrato: this.numeroContrato().trim(),
      agenteComercial: this.agenteComercial().trim(),
      representanteCampo: this.representanteCampo().trim(),
      representanteQuito: this.representanteQuito().trim(),
      analistaFacturacion: this.analistaFacturacion().trim() || undefined,
      tecnicoHseResponsableId: this.tecnicoHseResponsableId()!,
      condicionPago: this.condicionPago().trim() || undefined,
      solicitudMedio: this.solicitudMedio(),
      zona: this.zona().trim() || undefined,
      bodega: this.bodega().trim() || undefined,
      itemsEstimados,
      fechaInicioServicio: this.fechaInicioServicio()?.toISOString().slice(0, 10),
      fechaFinServicio: this.fechaFinServicio()?.toISOString().slice(0, 10),
      createdBy: nombre,
    };

    const pedidoExistente = this.data?.pedido;
    const request = pedidoExistente
      ? this.pedidoService.update(pedidoExistente.id, payload)
      : this.pedidoService.create(payload);

    request.subscribe({
      next: pedido => {
        this.notify.success(
          pedidoExistente ? 'Pedido actualizado' : 'Pedido creado',
          pedidoExistente
            ? `Pedido ${pedido.code} actualizado.`
            : `Pedido ${pedido.code} registrado y sincronizado con AS2.`,
        );
        this.modalRef.close(pedido);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', pedidoExistente ? 'No se pudo actualizar el pedido.' : 'No se pudo crear el pedido.');
      },
    });
  }
}
