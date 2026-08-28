import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
  type DynadrillKpiRowItem,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import {
  ActaEntregaRecepcion,
  calcularPrefactura,
  DocumentacionDiaria,
  Excepcion,
  GuiaCampo,
  Otq,
  pedidoListoParaCierre,
  ticketSubtotales,
} from '../../models/facturacion.model';
import {
  ActaEntregaService,
  DocumentacionDiariaService,
  ExcepcionService,
  FacturacionTicketService,
  GuiaCampoService,
  OtqService,
} from '../../services/facturacion.service';
import { DocumentacionDiariaDialog, DocumentacionDiariaDialogData } from '../../components/documentacion-diaria-dialog';
import { ExcepcionDialog, ExcepcionDialogData } from '../../components/excepcion-dialog';

function presupuestoDe(otq: Otq): number {
  return otq.items.reduce((sum, i) => sum + i.total, 0);
}

@Component({
  selector: 'app-pedido-facturacion-detail-page',
  imports: [
    DecimalPipe,
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillTagComponent,
    DynadrillButtonComponent,
    DynadrillSpinnerComponent,
    DynadrillBannerComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pedido-facturacion-detail-page.html',
  styleUrl: './pedido-facturacion-detail-page.scss',
})
export class PedidoFacturacionDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly otqService = inject(OtqService);
  private readonly docService = inject(DocumentacionDiariaService);
  private readonly excepcionService = inject(ExcepcionService);
  private readonly actaService = inject(ActaEntregaService);
  private readonly guiaService = inject(GuiaCampoService);
  private readonly ticketService = inject(FacturacionTicketService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  protected readonly pedidoId = Number(this.route.snapshot.paramMap.get('id'));

  protected readonly loading = signal(true);
  protected readonly otq = signal<Otq | null>(null);
  protected readonly documentacion = signal<DocumentacionDiaria[]>([]);
  protected readonly excepciones = signal<Excepcion[]>([]);
  protected readonly acta = signal<ActaEntregaRecepcion | null>(null);
  protected readonly guias = signal<GuiaCampo[]>([]);
  protected readonly yaFacturado = signal(false);

  protected readonly prefactura = computed(() => {
    const otq = this.otq();
    if (!otq) return null;
    return calcularPrefactura(this.pedidoId, presupuestoDe(otq), this.documentacion(), otq.items);
  });

  protected readonly tono = computed<'success' | 'warning' | 'error'>(() => {
    const p = this.prefactura();
    if (!p) return 'success';
    return p.porcentajeConsumido >= 100 ? 'error' : p.porcentajeConsumido >= 80 ? 'warning' : 'success';
  });

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const p = this.prefactura();
    if (!p) return [];
    return [
      { label: 'Presupuesto aprobado', value: '$' + p.presupuestoAprobado.toFixed(2), tone: 'neutral' },
      { label: 'Acumulado a la fecha', value: '$' + p.acumulado.toFixed(2), tone: this.tono() },
      { label: 'Saldo disponible', value: '$' + Math.max(0, p.presupuestoAprobado - p.acumulado).toFixed(2), tone: 'brand' },
      { label: '% Consumido', value: p.porcentajeConsumido + '%', tone: this.tono() },
    ];
  });

  protected readonly pendientesHomologacion = computed(() => this.documentacion().filter(d => d.estado === 'pendiente'));
  protected readonly excepcionActiva = computed(() => this.excepciones().find(e => e.estado === 'en_negociacion') ?? null);

  protected readonly listoParaCierre = computed(() => pedidoListoParaCierre(this.acta() ?? undefined, this.documentacion(), this.pedidoId));

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    forkJoin({
      otqs: this.otqService.list(),
      documentacion: this.docService.list(),
      excepciones: this.excepcionService.list(),
      actas: this.actaService.list(),
      guias: this.guiaService.list(),
      tickets: this.ticketService.list(),
    }).subscribe({
      next: ({ otqs, documentacion, excepciones, actas, guias, tickets }) => {
        this.otq.set(otqs.find(o => o.pedidoId === this.pedidoId) ?? null);
        this.documentacion.set(documentacion.filter(d => d.pedidoId === this.pedidoId));
        this.excepciones.set(excepciones.filter(e => e.pedidoId === this.pedidoId));
        this.acta.set(actas.find(a => a.pedidoId === this.pedidoId) ?? null);
        this.guias.set(guias.filter(g => g.pedidoId === this.pedidoId));
        this.yaFacturado.set(tickets.some(t => t.pedidoId === this.pedidoId));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar el detalle del pedido.');
      },
    });
  }

  protected nuevaDocumentacion(): void {
    const otq = this.otq();
    if (!otq) return;
    const ref = this.dialog.open<DocumentacionDiariaDialog, DocumentacionDiariaDialogData>({
      title: 'Registrar documentación del día',
      content: DocumentacionDiariaDialog,
      data: { pedidoId: this.pedidoId, otqItems: otq.items },
      footer: false,
      width: '640px',
    });
    ref.afterClose.subscribe(result => {
      if (result) this.reload();
    });
  }

  protected homologar(doc: DocumentacionDiaria): void {
    const nombre = this.auth.currentUser()?.name ?? '';
    this.docService.homologar(doc.id, nombre).subscribe({
      next: () => {
        this.notify.success('Homologado', `Documentación del ${doc.fecha} homologada.`);
        this.reload();
      },
      error: () => this.notify.error('Error', 'No se pudo homologar la documentación.'),
    });
  }

  protected rechazar(doc: DocumentacionDiaria): void {
    this.docService.rechazar(doc.id, 'Datos inconsistentes contra la OTQ — revisar con supervisor de campo.').subscribe({
      next: () => {
        this.notify.info('Rechazado', `Documentación del ${doc.fecha} devuelta.`);
        this.reload();
      },
      error: () => this.notify.error('Error', 'No se pudo rechazar la documentación.'),
    });
  }

  protected registrarExcepcion(): void {
    const p = this.prefactura();
    if (!p) return;
    const ref = this.dialog.open<ExcepcionDialog, ExcepcionDialogData>({
      title: 'Registrar excepción de sobrepaso',
      content: ExcepcionDialog,
      data: { pedidoId: this.pedidoId, montoExcedenteSugerido: Math.max(0, p.acumulado - p.presupuestoAprobado) },
      footer: false,
      width: '520px',
    });
    ref.afterClose.subscribe(result => {
      if (result) this.reload();
    });
  }

  protected aprobarExcepcionCliente(e: Excepcion): void {
    this.excepcionService.aprobarCliente(e.id).subscribe({
      next: () => {
        this.notify.success('Aprobado', 'El cliente aprobó el excedente.');
        this.reload();
      },
      error: () => this.notify.error('Error', 'No se pudo registrar la aprobación.'),
    });
  }

  /** Company Man de demo — hasta que exista el vínculo real con AS2/Cliente, se usa el mismo contacto de ejemplo de la semilla. */
  private readonly companyManDemo = { nombre: 'Ing. Daniel Balseca', cedula: '1803906450', cargo: 'Company Man' };

  protected firmarActaSupervisor(): void {
    const nombre = this.auth.currentUser()?.name ?? '';
    const existente = this.acta();

    const firmar = (actaId: number): void => {
      this.actaService.firmar(actaId, nombre, this.companyManDemo).subscribe({
        next: () => {
          this.notify.success('Acta firmada', 'Acta de entrega-recepción firmada por ambas partes.');
          this.reload();
        },
        error: () => this.notify.error('Error', 'No se pudo firmar el acta.'),
      });
    };

    if (existente) {
      firmar(existente.id);
      return;
    }

    this.actaService
      .create({
        pedidoId: this.pedidoId,
        trabajosRealizados: 'Servicio completado según OTQ ' + (this.otq()?.numero ?? ''),
        fechaInicio: this.documentacion()[0]?.fecha ?? new Date().toISOString(),
        fechaFin: new Date().toISOString(),
      })
      .subscribe({
        next: creada => firmar(creada.id),
        error: () => this.notify.error('Error', 'No se pudo crear el acta.'),
      });
  }

  protected cerrarYGenerarTicket(): void {
    const otq = this.otq();
    if (!otq || !this.listoParaCierre()) return;

    const totalesPorCodigo = new Map<string, { descripcion: string; unidad: string; cantidad: number; tipo: 'Material' | 'Servicio' }>();
    for (const doc of this.documentacion()) {
      if (doc.estado !== 'homologado') continue;
      for (const item of doc.items) {
        const actual = totalesPorCodigo.get(item.codigo);
        if (actual) actual.cantidad += item.cantidad;
        else totalesPorCodigo.set(item.codigo, { descripcion: item.descripcion, unidad: item.unidad, cantidad: item.cantidad, tipo: item.tipo });
      }
    }

    const tarifaPorCodigo = new Map(otq.items.map(i => [i.codigo, i.tarifaUnitaria]));
    const items = [...totalesPorCodigo.entries()].map(([codigo, v], idx) => {
      const precioUnitario = tarifaPorCodigo.get(codigo) ?? 0;
      return {
        id: idx + 1,
        codigo,
        descripcion: v.descripcion,
        unidad: v.unidad,
        cantidad: v.cantidad,
        precioUnitario,
        precioTotal: Math.round(v.cantidad * precioUnitario * 100) / 100,
        tipo: v.tipo,
      };
    });

    this.ticketService.cerrar({ pedidoId: this.pedidoId, otqId: otq.id, items }).subscribe({
      next: ticket => {
        const { subtotal } = ticketSubtotales(items);
        this.notify.success('Ticket generado', `${ticket.code} generado por $${subtotal.toFixed(2)}.`);
        this.router.navigate(['/dashboard/facturacion/tickets', ticket.id]);
      },
      error: () => this.notify.error('Error', 'No se pudo cerrar el pedido.'),
    });
  }
}
