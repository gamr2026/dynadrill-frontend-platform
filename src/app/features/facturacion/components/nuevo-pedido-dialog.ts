import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
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
import { LINEA_SERVICIO_LABELS, LineaServicio, Pedido } from '../models/pedido.model';
import { ListaPrecios } from '../models/lista-precios.model';
import { ListaPreciosService, PedidoService } from '../services/pedido.service';
import { UBICACION_VACIA, UbicacionSelectorComponent, type UbicacionSeleccion } from '../../../shared/index';

/** Clientes conocidos — hasta que exista el catálogo real de AS2. */
const CLIENTES: { nombre: string; ruc: string }[] = [
  { nombre: 'EP Petroecuador', ruc: '1768153530001' },
  { nombre: 'Petroandina', ruc: '1792060346001' },
  { nombre: 'Schlumberger', ruc: '1791251237001' },
  { nombre: 'Baker Hughes', ruc: '1790008959001' },
];

/**
 * FACT-001 — alta de Pedido desde el Portal (rol Ventas). El gateway lo
 * empuja a AS2 (mock). La cabecera completa + una sola línea estimada.
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
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<NuevoPedidoDialog, Pedido | undefined>);

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
  /** Campo / Bloque / Pozo / Taladro — del catálogo, vía <app-ubicacion-selector>. */
  protected readonly ubicacion = signal<UbicacionSeleccion>(UBICACION_VACIA);
  protected readonly fechaInicioServicio = signal<Date | null>(null);
  protected readonly fechaFinServicio = signal<Date | null>(null);

  // ── Comercial / responsables ──
  protected readonly agenteComercial = signal('');
  protected readonly representanteCampo = signal('');
  protected readonly representanteQuito = signal('');
  protected readonly analistaFacturacion = signal('');

  // ── Administrativos ──
  protected readonly condicionPago = signal('30 días');
  protected readonly zona = signal('Zona Centro');
  protected readonly canal = signal('');
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
      this.ubicacion().pozoId !== null &&
      this.ubicacion().taladroId !== null &&
      this.agenteComercial().trim().length > 0 &&
      this.representanteCampo().trim().length > 0 &&
      this.representanteQuito().trim().length > 0 &&
      this.lineasTodasValidas(),
  );

  constructor() {
    this.listaService.list().subscribe(listas => {
      this.actualizarListaCliente(listas);
    });
  }

  private todasLasListas: ListaPrecios[] = [];

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
    // Al cambiar de lista se limpian los códigos elegidos (pueden no existir en la nueva).
    this.lineasEstimadas.set([{ codigo: null, cantidad: '1', valorUnitario: '0' }]);
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

    this.pedidoService
      .create({
        origen: 'portal',
        cliente: this.cliente()!,
        clienteRuc: this.clienteRuc() || undefined,
        subcliente: this.subcliente().trim() || undefined,
        lineaServicio: this.lineaServicio()!,
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
        condicionPago: this.condicionPago().trim() || undefined,
        solicitudMedio: this.solicitudMedio(),
        zona: this.zona().trim() || undefined,
        canal: this.canal().trim() || undefined,
        bodega: this.bodega().trim() || undefined,
        itemsEstimados,
        fechaInicioServicio: this.fechaInicioServicio()?.toISOString().slice(0, 10),
        fechaFinServicio: this.fechaFinServicio()?.toISOString().slice(0, 10),
        createdBy: nombre,
      })
      .subscribe({
        next: pedido => {
          this.notify.success('Pedido creado', `Pedido ${pedido.code} registrado y sincronizado con AS2.`);
          this.modalRef.close(pedido);
        },
        error: () => {
          this.submitting.set(false);
          this.notify.error('Error', 'No se pudo crear el pedido.');
        },
      });
  }
}
