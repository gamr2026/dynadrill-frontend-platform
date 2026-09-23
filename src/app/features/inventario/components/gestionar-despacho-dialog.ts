import { SlicePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillInputComponent, DynadrillNotificationService, DynadrillTextareaComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { SolicitudDespachoBodega } from '../../facturacion/models/solicitud-despacho-bodega.model';
import { SolicitudesDespachoBodegaService } from '../../facturacion/services/pedido.service';
import { AuthService } from '../../../core/services/auth.service';

export interface GestionarDespachoDialogData {
  solicitud: SolicitudDespachoBodega;
}

/**
 * Bodega resuelve la Solicitud de Despacho — despacha adjuntando el
 * documento de respaldo (obligatorio, ver `SolicitudesDespachoBodegaController.despachar`)
 * o rechaza con motivo. Ambos casos devuelven el pedido a `prefactura_generada`.
 */
@Component({
  selector: 'app-gestionar-despacho-dialog',
  imports: [DynadrillTextComponent, DynadrillInputComponent, DynadrillTextareaComponent, DynadrillButtonComponent, SlicePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gestionar-despacho-dialog.html',
  styleUrl: './gestionar-despacho-dialog.scss',
})
export class GestionarDespachoDialog {
  private readonly solicitudesService = inject(SolicitudesDespachoBodegaService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<GestionarDespachoDialog, boolean | undefined>);
  protected readonly data = inject<GestionarDespachoDialogData>(NZ_MODAL_DATA);

  protected readonly esPendiente = this.data.solicitud.estado === 'pendiente';

  protected readonly archivo = signal<File | null>(null);
  protected readonly notaBodega = signal('');
  protected readonly referenciaAs2 = signal('');
  protected readonly motivoRechazo = signal('');
  protected readonly submitting = signal(false);

  protected readonly puedeDespachar = computed(() => !!this.archivo());
  protected readonly puedeRechazar = computed(() => this.motivoRechazo().trim().length > 0);

  protected seleccionarArchivo(files: FileList | null): void {
    this.archivo.set(files?.[0] ?? null);
  }

  protected despachar(): void {
    if (!this.puedeDespachar() || this.submitting()) return;
    const archivo = this.archivo();
    if (!archivo) return;
    this.submitting.set(true);
    const usuario = this.auth.currentUser()?.name ?? 'Bodega';
    this.solicitudesService
      .despachar(this.data.solicitud.id, usuario, archivo, {
        notaBodega: this.notaBodega().trim() || undefined,
        referenciaAs2: this.referenciaAs2().trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.notify.success('Despacho registrado', `Solicitud ${this.data.solicitud.numero} despachada.`);
          this.modalRef.close(true);
        },
        error: () => {
          this.submitting.set(false);
          this.notify.error('Error', 'No se pudo registrar el despacho.');
        },
      });
  }

  protected rechazar(): void {
    if (!this.puedeRechazar() || this.submitting()) return;
    this.submitting.set(true);
    const usuario = this.auth.currentUser()?.name ?? 'Bodega';
    this.solicitudesService.rechazar(this.data.solicitud.id, usuario, this.motivoRechazo().trim()).subscribe({
      next: () => {
        this.notify.success('Solicitud rechazada', `Se devolvió el pedido a Facturación.`);
        this.modalRef.close(true);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo rechazar la solicitud.');
      },
    });
  }

  protected cerrar(): void {
    this.modalRef.close(undefined);
  }
}
