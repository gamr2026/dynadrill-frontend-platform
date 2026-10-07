import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import type { NzUploadFile } from 'ng-zorro-antd/upload';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillUploadZoneComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { DocumentoPdfService } from '../../documentos';
import { PrefacturaHoja } from '../../documentos/formatos/prefactura-hoja';
import { ReporteHerramientasHoja } from '../../documentos/formatos/reporte-herramientas-hoja';
import { ReporteJobHoja, type ReporteJobExtras } from '../../documentos/formatos/reporte-job-hoja';
import type { DocumentoRealPedido } from '../../../features/facturacion/models/documento-operativo.model';
import { PumpingService } from '../../../features/operations/pumping/services/pumping.service';
import type { LineaTicketPrefactura, TicketPrefacturaVista } from '../../models/ticket-prefactura.model';
import { TicketPrefacturaService } from '../../services/ticket-prefactura.service';

export interface TicketPrefacturaDialogData {
  linea: LineaTicketPrefactura;
  ticketId: number;
  ticketCode: string;
}

const NOMBRE_DOCUMENTO: Record<DocumentoRealPedido['tipo'], string> = {
  monitoreo: 'Documento de monitoreo',
  mezcla: 'Documento de mezcla de químicos',
  reporte_job: 'Reporte Job (consolidado)',
  reporte_herramientas: 'Reporte de Herramientas (consolidado)',
  prefactura: 'Prefactura',
  despacho_bodega: 'Despacho de Bodega',
  msds: 'Hoja de seguridad (MSDS)',
};

/**
 * "Ver prefactura" desde el ticket: el detalle completo de la prefactura (la vigente o una preliminar calculada con lo
 * cotizado y los documentos generados hasta el momento), los documentos de respaldo y, al terminar el servicio, el registro
 * de la firma del Company Man — que deja la prefactura FIRMADA para Facturación.
 */
@Component({
  selector: 'app-ticket-prefactura-dialog',
  imports: [
    DecimalPipe,
    DatePipe,
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
    DynadrillUploadZoneComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-prefactura-dialog.html',
  styleUrl: './ticket-prefactura-dialog.scss',
  host: { class: 'app-dialog-sheet-mobile' },
})
export class TicketPrefacturaDialog {
  private readonly data = inject<TicketPrefacturaDialogData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<TicketPrefacturaDialog>);
  private readonly service = inject(TicketPrefacturaService);
  private readonly pumpingService = inject(PumpingService);
  private readonly documentoPdf = inject(DocumentoPdfService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly ticketCode = this.data.ticketCode;
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly vista = signal<TicketPrefacturaVista | null>(null);

  // ── Firma del Company Man ──
  protected readonly firmaNombre = signal('');
  protected readonly firmaCargo = signal('Company Man');
  protected readonly firmaArchivo = signal<File | null>(null);
  protected readonly firmando = signal(false);
  protected readonly puedeRegistrar = computed(
    () => !!this.vista()?.puedeFirmar && this.firmaNombre().trim().length > 0 && this.firmaCargo().trim().length > 0 && !!this.firmaArchivo() && !this.firmando(),
  );

  /** Documentos de respaldo (sin la prefactura, que es lo que se está viendo). */
  protected readonly respaldo = computed(() =>
    (this.vista()?.documentosReales ?? []).filter(d => d.tipo !== 'prefactura').map(d => ({ doc: d, nombre: this.nombreDe(d), abrible: this.sePuedeAbrir(d) })),
  );

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.loading.set(true);
    this.service.ver(this.data.linea, this.data.ticketId).subscribe({
      next: v => {
        this.vista.set(v);
        if (!this.firmaNombre()) this.firmaNombre.set(v.pedido.representanteCampo ?? '');
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  protected cerrar(): void {
    this.modalRef.close();
  }

  // ── Prefactura ──

  /** Vista de impresión (la misma hoja DYN-AFN-RE-11) con el recuadro de firma del Company Man: se imprime, se firma y se sube. */
  protected verHoja(): void {
    const v = this.vista();
    if (!v) return;
    this.documentoPdf.abrir({
      titulo: v.preliminar ? 'Prefactura preliminar — vista de impresión' : `Prefactura ${v.prefactura.code} — vista de impresión`,
      component: PrefacturaHoja,
      inputs: { prefactura: v.prefactura, pedido: v.pedido },
      nombreArchivo: v.preliminar ? `Prefactura preliminar ${v.pedido.code}` : `Prefactura ${v.prefactura.code}`,
    });
  }

  // ── Documentos de respaldo ──

  private nombreDe(d: DocumentoRealPedido): string {
    return d.tipo === 'despacho_bodega' || d.tipo === 'msds' ? d.nombreOriginal : (NOMBRE_DOCUMENTO[d.tipo] ?? d.nombreOriginal);
  }

  /** Se pueden abrir desde el ticket: las hojas generadas y los archivos subidos en Pumping (monitoreo / mezcla). El resto se consulta en Facturación. */
  private sePuedeAbrir(d: DocumentoRealPedido): boolean {
    return d.tipo === 'reporte_job' || d.tipo === 'reporte_herramientas' || (d.origen === 'pumping' && !!d.ticketId && !!d.campo);
  }

  private extrasReporteJob(): ReporteJobExtras {
    const p = this.vista()?.pedido;
    if (!p) return {};
    return {
      campoBloque: `${p.campo} / ${p.bloque}`,
      taladro: p.taladroRig,
      ordenContrato: p.numeroContrato,
      representanteCliente: p.representanteCampo,
    };
  }

  protected abrir(doc: DocumentoRealPedido): void {
    const v = this.vista();
    if (!v) return;
    if (doc.tipo === 'reporte_job') {
      const docs = v.documentosOperativos.filter(d => d.tipo === 'reporte_job');
      if (!docs.length || !docs[0].header) return;
      this.documentoPdf.abrir({
        titulo: 'Reporte Job (consolidado)',
        component: ReporteJobHoja,
        inputs: { header: docs[0].header, log: docs.flatMap(d => d.actividades ?? []), extras: this.extrasReporteJob() },
        nombreArchivo: `Reporte diario de actividades ${docs[0].header.code}`,
      });
      return;
    }
    if (doc.tipo === 'reporte_herramientas') {
      const docs = v.documentosOperativos.filter(d => d.tipo === 'reporte_herramientas');
      if (!docs.length || !docs[0].header) return;
      this.documentoPdf.abrir({
        titulo: 'Reporte de Herramientas',
        component: ReporteHerramientasHoja,
        inputs: {
          header: docs[0].header,
          tools: docs.flatMap(d => d.herramientas ?? []),
          usageLog: docs.flatMap(d => d.usoHerramientas ?? []),
        },
        orientacion: 'landscape',
        nombreArchivo: `Reporte de Herramientas ${docs[0].header.code}`,
      });
      return;
    }
    if (doc.origen === 'pumping' && doc.ticketId && doc.campo) {
      this.pumpingService.descargarDocumento(doc.ticketId, doc.campo).subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = doc.nombreOriginal;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        },
        error: () => this.notify.error('Error', 'No se pudo descargar el documento.'),
      });
    }
  }

  // ── Firma ──

  protected onArchivo(file: NzUploadFile): void {
    this.firmaArchivo.set((file.originFileObj as File | undefined) ?? (file as unknown as File));
  }

  protected registrarFirma(): void {
    const archivo = this.firmaArchivo();
    if (!this.puedeRegistrar() || !archivo) return;
    this.firmando.set(true);
    this.service.firmar(this.data.linea, this.data.ticketId, { nombre: this.firmaNombre().trim(), cargo: this.firmaCargo().trim() }, archivo).subscribe({
      next: () => {
        this.firmando.set(false);
        this.firmaArchivo.set(null);
        this.notify.success('Prefactura firmada', 'Quedó registrada la firma del Company Man y Facturación ya la ve como firmada.');
        this.cargar();
      },
      error: (err: { error?: { message?: string } }) => {
        this.firmando.set(false);
        this.notify.error('No se pudo registrar la firma', err?.error?.message ?? 'Inténtalo de nuevo.');
      },
    });
  }
}
