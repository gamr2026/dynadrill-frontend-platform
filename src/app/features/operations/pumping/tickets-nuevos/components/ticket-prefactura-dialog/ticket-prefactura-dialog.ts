import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import type { NzUploadFile } from 'ng-zorro-antd/upload';
import { switchMap } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillUploadZoneComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { ArchivosService } from '../../../../../facturacion/pedidos-comercial/services/archivos.service';
import { PrefacturasComercialService } from '../../../../../facturacion/pedidos-comercial/services/prefacturas-comercial.service';
import { mensajeErrorArchivo } from '../../../../../facturacion/pedidos-comercial/models/documentos-pedido';
import {
  MAX_BYTES_FIRMA,
  MODULO_ARCHIVO_COMPANY_MAN,
  estadoVerificacion,
  mensajeErrorPrefactura,
  type FirmaPrefactura,
  type VistaPrefacturaTicket,
} from '../../../../../facturacion/pedidos-comercial/models/prefactura-comercial';

export interface TicketPrefacturaDialogData {
  pedidoId: string;
  /** El Supervisor puede subir el documento firmado por el Company Man (solo antes de finalizar el ticket). */
  puedeFirmar: boolean;
  /** Encabezado del diálogo (ya los tiene el ticket; no se vuelven a pedir). */
  ticketCodigo: string;
  pedidoCodigo: string;
  cliente: string | null;
  pozo: string | null;
  campo: string | null;
  /** El Company Man del pedido: precarga el nombre de quien firma. */
  companyMan?: string | null;
}

/**
 * «Ver prefactura» desde el ticket, antes de finalizar: la vigente o una preliminar calculada con lo que el servicio lleva hasta ahora
 * (no guarda nada). El Supervisor sube aquí el documento que firmó el Company Man; eso genera o recalcula la prefactura y la deja
 * firmada. Con la documentación del pedido incompleta, la firma se rechaza y el diálogo dice qué falta.
 */
@Component({
  selector: 'app-ticket-prefactura-dialog',
  imports: [
    DatePipe,
    DecimalPipe,
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
    DynadrillUploadZoneComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  templateUrl: './ticket-prefactura-dialog.html',
  styleUrl: './ticket-prefactura-dialog.scss',
})
export class TicketPrefacturaDialog {
  private readonly prefacturas = inject(PrefacturasComercialService);
  private readonly archivos = inject(ArchivosService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<TicketPrefacturaDialog, boolean>);
  protected readonly data = inject<TicketPrefacturaDialogData>(NZ_MODAL_DATA);

  /** Solo saber si se detecta una firma o no (lectura automática: es una ayuda, no certifica nada). */
  protected readonly verif = (f: FirmaPrefactura) => estadoVerificacion(f, false);
  protected readonly vista = signal<VistaPrefacturaTicket | null>(null);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);

  // El Company Man del pedido llega precargado; el cargo propone el de siempre.
  protected readonly nombre = signal(this.data.companyMan ?? '');
  protected readonly cargo = signal('Company Man');
  protected readonly archivo = signal<File | null>(null);

  /** La firma solo se sube con la documentación completa y mientras la prefactura no esté firmada. */
  protected readonly puedeEnviar = computed(() => {
    const v = this.vista();
    return this.data.puedeFirmar && !!v && v.avance.completo && v.prefactura.estado !== 'firmada';
  });
  protected readonly problema = computed(() => {
    if (this.nombre().trim().length < 2) return 'Escriba el nombre del Company Man.';
    if (this.cargo().trim().length < 2) return 'Indique el cargo.';
    const a = this.archivo();
    if (!a) return 'Adjunte el documento firmado.';
    if (a.size > MAX_BYTES_FIRMA) return 'El documento supera los 25 MB.';
    return null;
  });

  constructor() {
    this.prefacturas.vistaDelTicket(this.data.pedidoId).subscribe({
      next: (v) => this.vista.set(v),
      error: (err) =>
        this.errorCarga.set(mensajeErrorPrefactura(err, 'No se pudo cargar la prefactura.')),
    });
  }

  protected alElegirArchivo(file: NzUploadFile): void {
    this.archivo.set((file.originFileObj as File | undefined) ?? (file as unknown as File));
  }

  protected firmar(): void {
    const archivo = this.archivo();
    if (this.problema() || !archivo || this.enviando()) return;
    this.error.set(null);
    this.enviando.set(true);
    let subido = false;
    this.archivos
      .subir(archivo, MODULO_ARCHIVO_COMPANY_MAN)
      .pipe(
        switchMap((a) => {
          subido = true;
          return this.prefacturas.firmarDesdeTicket(this.data.pedidoId, {
            nombre: this.nombre().trim(),
            cargo: this.cargo().trim() || undefined,
            firmadoAt: new Date().toISOString(),
            archivoId: a.id,
          });
        }),
      )
      .subscribe({
        next: () => {
          this.notify.success('Prefactura firmada', 'Quedó registrada la firma del Company Man.');
          this.modalRef.close(true);
        },
        error: (err) => {
          this.enviando.set(false);
          this.error.set(
            subido
              ? mensajeErrorPrefactura(
                  err,
                  'El documento se subió, pero no se pudo registrar la firma.',
                )
              : mensajeErrorArchivo(err),
          );
        },
      });
  }

  protected cerrar(): void {
    this.modalRef.close(false);
  }
}
