import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillKpiCardComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { DocumentoPdfService } from '../../../../../shared/documentos';
import { PrefacturaHoja } from '../../../../../shared/documentos/formatos/prefactura-hoja';
import {
  OrdenTrabajoDialog,
  type OrdenTrabajoDialogData,
} from '../../components/orden-trabajo-dialog/orden-trabajo-dialog';
import {
  PrefacturaAccionDialog,
  type PrefacturaAccionDialogData,
  type TipoAccionPrefactura,
} from '../../components/prefactura-accion-dialog/prefactura-accion-dialog';
import {
  PrefacturaFirmaDialog,
  type PrefacturaFirmaDialogData,
} from '../../components/prefactura-firma-dialog/prefactura-firma-dialog';
import { PERMISOS_ORDENES, csvAs2, type OrdenTrabajo } from '../../models/orden-trabajo';
import {
  PERMISOS_PEDIDOS,
  formatoDia,
  formatoMoneda,
  type PedidoDetalle,
} from '../../models/pedido-comercial.model';
import {
  ESTADO_PREFACTURA_TONO,
  accionesDisponibles,
  aHojaPrefactura,
  estadoVerificacion,
  etiquetaDevueltoA,
  etiquetaEstadoPrefactura,
  etiquetaFirmante,
  etiquetaFuente,
  etiquetaMedio,
  mensajeErrorPrefactura,
  type AccionPrefactura,
  type FirmaPrefactura,
  type Prefactura,
} from '../../models/prefactura-comercial';
import { ArchivosService } from '../../services/archivos.service';
import { OrdenesTrabajoComercialService } from '../../services/ordenes-trabajo-comercial.service';
import { PedidosComercialService } from '../../services/pedidos-comercial.service';
import { PrefacturasComercialService } from '../../services/prefacturas-comercial.service';

/** Revisión previa al envío (FACT-003): ayuda de quien revisa; el servidor no la exige. */
const CHECKLIST: { key: string; label: string }[] = [
  { key: 'datos', label: 'Datos generales del servicio, orden de trabajo y contrato' },
  { key: 'tarifas', label: 'Horas de servicio, transporte, totales y tarifas' },
  { key: 'cantidades', label: 'Cantidades y series contra el Reporte de Herramientas' },
  { key: 'materiales', label: 'Materiales utilizados y herramientas empleadas' },
  {
    key: 'correspondencia',
    label: 'Correspondencia entre el ticket y la documentación de respaldo',
  },
  { key: 'integridad', label: 'Integridad de los archivos del paquete' },
];

/**
 * Detalle de una prefactura con la presentación de la demo (Ítems, Comercial y responsables, revisión y envío, enviada al cliente, firma o
 * rechazo, y la liquidación a un lado). Los estados y las acciones los dicta el backend nuevo: generada → enviada para firmas → firmada o
 * rechazada, con las firmas y su lectura automática.
 */
@Component({
  selector: 'app-prefactura-comercial-detail-page',
  imports: [
    DatePipe,
    DecimalPipe,
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillKpiCardComponent,
    DynadrillScreenHeaderComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prefactura-comercial-detail-page.html',
  styleUrl: './prefactura-comercial-detail-page.scss',
})
export class PrefacturaComercialDetailPage {
  private readonly servicio = inject(PrefacturasComercialService);
  private readonly pedidos = inject(PedidosComercialService);
  private readonly ordenes = inject(OrdenesTrabajoComercialService);
  private readonly archivos = inject(ArchivosService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly pdf = inject(DocumentoPdfService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly loading = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errorAccion = signal<string | null>(null);
  protected readonly prefactura = signal<Prefactura | null>(null);
  protected readonly pedido = signal<PedidoDetalle | null>(null);
  protected readonly orden = signal<OrdenTrabajo | null>(null);
  protected readonly verificando = signal<string | null>(null);

  protected readonly checklistItems = CHECKLIST;
  protected readonly checklist = signal<Record<string, boolean>>(
    Object.fromEntries(CHECKLIST.map((c) => [c.key, false])),
  );
  protected readonly checklistCompleto = computed(() =>
    Object.values(this.checklist()).every(Boolean),
  );

  protected readonly acciones = computed(() =>
    accionesDisponibles(this.prefactura(), (p) => this.auth.can(p)),
  );
  /** La guía de remisión debe estar emitida antes de enviar la prefactura a firmas (el servidor lo exige). */
  protected readonly guiaEmitida = signal<boolean | null>(null);
  protected readonly puedeEnviar = computed(
    () =>
      this.acciones().includes('enviar') &&
      this.checklistCompleto() &&
      this.guiaEmitida() === true &&
      !this.ocupado(),
  );
  protected readonly puedeGenerarOrden = computed(
    () =>
      this.prefactura()?.estado === 'firmada' &&
      !this.orden() &&
      this.auth.can(PERMISOS_ORDENES.emitir),
  );
  protected readonly puedeEditarRepresentantes = computed(
    () =>
      this.prefactura()?.estado !== 'firmada' &&
      !!this.pedido()?.editable &&
      this.auth.can(PERMISOS_PEDIDOS.editar),
  );
  protected readonly esperandoFirma = computed(
    () => this.prefactura()?.estado === 'enviada_para_firmas',
  );

  protected readonly estadoChip = computed(() => {
    const p = this.prefactura();
    return {
      label: p ? etiquetaEstadoPrefactura(p.estado) : '',
      tone: p ? (ESTADO_PREFACTURA_TONO[p.estado] ?? 'neutral') : 'neutral',
    };
  });
  protected readonly titulo = computed(() => {
    const p = this.prefactura();
    return p ? `Prefactura ${p.ticketNumero ?? `v${p.version}`}` : 'Prefactura';
  });
  protected readonly subtitulo = computed(() => {
    const ped = this.pedido();
    return ped ? `${ped.cliente.nombre ?? ''} — Pedido ${ped.codigo ?? ''}` : '';
  });
  protected readonly datosComercial = computed(() => {
    const p = this.pedido();
    if (!p) return [];
    const d = (label: string, value: string | null) => ({
      label,
      value: value?.trim() ? value : '—',
    });
    return [
      d('Agente comercial', p.responsables.agenteComercial.nombre),
      d('Representante en campo', p.responsables.representanteCampo.nombre),
      d('Representante en Quito (PEC)', p.responsables.representanteQuito.nombre),
      d('Analista de facturación', p.responsables.analistaFacturacion.nombre),
    ];
  });
  protected readonly netoFmt = computed(() =>
    this.prefactura() ? formatoMoneda(this.prefactura()!.totales.netoCobrar) : '',
  );

  protected readonly dia = formatoDia;
  protected readonly moneda = formatoMoneda;
  protected readonly medio = etiquetaMedio;
  protected readonly firmante = etiquetaFirmante;
  protected readonly fuente = etiquetaFuente;
  protected readonly devueltoA = etiquetaDevueltoA;
  protected readonly verif = (f: FirmaPrefactura) => estadoVerificacion(f, false);

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.loading.set(true);
    this.servicio.detalle(this.id).subscribe({
      next: (pf) => {
        this.prefactura.set(pf);
        this.error.set(null);
        this.pedidos.avanceDocumental(pf.pedidoId).subscribe({
          next: (a) => this.guiaEmitida.set(a.guiaRegistrada),
          error: () => this.guiaEmitida.set(null),
        });
        this.pedidos
          .detalle(pf.pedidoId)
          .subscribe({ next: (p) => this.pedido.set(p), error: () => this.pedido.set(null) });
        if (this.auth.can(PERMISOS_ORDENES.ver)) {
          this.ordenes
            .delPedido(pf.pedidoId)
            .subscribe({ next: (d) => this.orden.set(d.orden), error: () => this.orden.set(null) });
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(mensajeErrorPrefactura(err, 'No se encontró la prefactura.'));
      },
    });
  }

  // ── Navegación y formatos ──
  protected irAlPedido(): void {
    const pf = this.prefactura();
    if (pf) void this.router.navigate(['/dashboard/facturacion/pedidos', pf.pedidoId]);
  }

  protected editarRepresentantes(): void {
    const pf = this.prefactura();
    if (pf) void this.router.navigate(['/dashboard/facturacion/pedidos', pf.pedidoId, 'editar']);
  }

  protected verPdf(): void {
    const pf = this.prefactura();
    const p = this.pedido();
    if (!pf || !p) return;
    this.pdf.abrir({
      titulo: 'Prefactura — Vista de impresión',
      component: PrefacturaHoja,
      inputs: aHojaPrefactura(pf, p),
      nombreArchivo: `Prefactura ${pf.ticketNumero ?? pf.version}`,
    });
  }

  protected verOrden(): void {
    const pf = this.prefactura();
    if (pf)
      void this.router.navigate(['/dashboard/facturacion/pedidos', pf.pedidoId, 'orden-trabajo']);
  }

  protected generarOrden(): void {
    const pf = this.prefactura();
    if (!pf) return;
    const ref = this.dialog.open<OrdenTrabajoDialog, OrdenTrabajoDialogData>({
      title: 'Generar orden de trabajo',
      content: OrdenTrabajoDialog,
      data: { tipo: 'emitir', pedidoId: pf.pedidoId },
      footer: false,
      width: '520px',
    });
    ref.afterClose.subscribe((r: unknown) => {
      if (r) this.cargar();
    });
  }

  /** Plantilla de carga a AS2: descarga las líneas de la prefactura firmada como CSV. */
  protected exportarAs2(): void {
    const pf = this.prefactura();
    if (!pf || this.ocupado()) return;
    this.ocupado.set(true);
    this.ordenes.exportacionAs2(pf.id).subscribe({
      next: (e) => {
        this.ocupado.set(false);
        this.archivos.guardarComo(
          new Blob([csvAs2(e.filas)], { type: 'text/csv;charset=utf-8' }),
          `AS2-carga-${e.ticketNumero ?? 'prefactura'}.csv`,
        );
        if (e.advertencias.length)
          this.notify.warning('Exportado con avisos', e.advertencias.join(' '));
        else this.notify.success('Exportado', 'Plantilla de carga a AS2 descargada.');
      },
      error: (err) => {
        this.ocupado.set(false);
        this.errorAccion.set(mensajeErrorPrefactura(err, 'No se pudo exportar a AS2.'));
      },
    });
  }

  // ── Revisión y acciones del flujo ──
  protected toggleChecklist(clave: string): void {
    this.checklist.update((c) => ({ ...c, [clave]: !c[clave] }));
  }
  protected marcarTodoRevisado(): void {
    this.checklist.set(Object.fromEntries(CHECKLIST.map((c) => [c.key, true])));
  }

  protected rotulo(a: AccionPrefactura): string {
    return {
      generar: 'Generar prefactura',
      recalcular: 'Recalcular',
      ticket: 'Registrar número de ticket de AS2',
      enviar: 'Enviar al cliente',
      firma: 'Registrar firma',
      firmada: 'Dar por firmada',
      rechazar: 'Registrar rechazo',
    }[a];
  }

  protected ejecutar(a: AccionPrefactura): void {
    const p = this.prefactura();
    if (!p) return;
    this.errorAccion.set(null);
    switch (a) {
      case 'recalcular':
        return this.llamar(this.servicio.recalcular(p.id), 'Prefactura recalculada');
      case 'ticket':
        return this.abrirAccion('ticket', 'Número de ticket de AS2', p);
      case 'enviar':
        return this.abrirAccion('enviar', 'Enviar al cliente', p);
      case 'firmada':
        return this.abrirAccion('firmada', 'Dar por firmada', p);
      case 'rechazar':
        return this.abrirAccion('rechazar', 'Registrar rechazo', p);
      case 'firma':
        return this.abrirFirma(p);
      case 'generar':
        return;
    }
  }

  private llamar(obs: ReturnType<PrefacturasComercialService['recalcular']>, titulo: string): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    obs.subscribe({
      next: () => {
        this.ocupado.set(false);
        this.notify.success(titulo);
        this.cargar();
      },
      error: (err) => {
        this.ocupado.set(false);
        this.errorAccion.set(
          mensajeErrorPrefactura(err, 'No se pudo completar la acción. Intente de nuevo.'),
        );
      },
    });
  }

  private abrirAccion(tipo: TipoAccionPrefactura, titulo: string, p: Prefactura): void {
    const ref = this.dialog.open<PrefacturaAccionDialog, PrefacturaAccionDialogData>({
      title: titulo,
      content: PrefacturaAccionDialog,
      data: { tipo, prefacturaId: p.id, ticketActual: p.ticketNumero },
      footer: false,
      width: '480px',
    });
    ref.afterClose.subscribe((r: Prefactura | undefined) => {
      if (r) this.cargar();
    });
  }

  private abrirFirma(p: Prefactura): void {
    const rep = this.pedido()?.responsables.representanteCampo;
    const ref = this.dialog.open<PrefacturaFirmaDialog, PrefacturaFirmaDialogData>({
      title: 'Registrar firma',
      content: PrefacturaFirmaDialog,
      data: {
        prefacturaId: p.id,
        representanteCampo: { id: rep?.id ?? null, nombre: rep?.nombre ?? null },
      },
      footer: false,
      width: '520px',
    });
    ref.afterClose.subscribe((r: Prefactura | undefined) => {
      if (r) this.cargar();
    });
  }

  protected volverAVerificar(f: FirmaPrefactura): void {
    const p = this.prefactura();
    if (!p || this.verificando()) return;
    this.verificando.set(f.id);
    this.servicio.verificarFirma(p.id, f.id).subscribe({
      next: (n) => {
        this.verificando.set(null);
        this.prefactura.set(n);
      },
      error: (err) => {
        this.verificando.set(null);
        this.notify.error(
          'No se pudo verificar',
          mensajeErrorPrefactura(err, 'No se pudo volver a verificar la firma.'),
        );
      },
    });
  }

  protected descargar(f: FirmaPrefactura): void {
    this.archivos.contenido(f.archivoId).subscribe({
      next: (blob) => this.archivos.guardarComo(blob, f.archivoNombre ?? `firma-${f.firmanteTipo}`),
      error: () =>
        this.notify.error(
          'No se pudo descargar',
          'No se pudo descargar el documento firmado. Intente de nuevo.',
        ),
    });
  }
}
