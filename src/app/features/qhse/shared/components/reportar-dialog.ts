import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillIconComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { StopRegistrarDialog } from '../../stop-plataforma/components/stop-registrar-dialog';
import { SwaActivarDialog } from '../../swa-plataforma/components/swa-activar-dialog';
import { DesechoDialog } from '../../desechos/components/desecho-dialog';
import { DerrameAlertDialog } from '../../derrames/components/derrame-alert-dialog';

/**
 * Acceso rápido universal "Reportar": las acciones que la documentación
 * asigna a "Cualquier Trabajador" — Tarjeta STOP (HSE-SEGUIMIENTO-002),
 * Stop Work Authority (HSE-SEGUIMIENTO-003), clasificación de desechos en
 * campo (HSE-AMBIENTAL-001) y alerta de derrame (HSE-AMBIENTAL-002) — sin
 * pasar por el roleGuard de QHSE. Inspección pre-operacional y activación
 * de emergencia se quitaron de este acceso rápido a pedido del usuario.
 */
@Component({
  selector: 'app-reportar-dialog',
  /** Bottom sheet en móvil (M · Reportar en Figma) — ver styles.scss. */
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [DynadrillButtonComponent, DynadrillTextComponent, DynadrillIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reportar-dialog.html',
  styleUrl: './reportar-dialog.scss',
})
export class ReportarDialog {
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly modalRef = inject(NzModalRef<ReportarDialog>);

  protected cerrar(): void {
    this.modalRef.close();
  }

  protected reportarStop(): void {
    this.modalRef.close();
    this.dialogService.open<StopRegistrarDialog>({
      title: 'Tarjeta STOP — HSE-SEGUIMIENTO-002',
      content: StopRegistrarDialog,
      footer: false,
      width: '760px',
    });
  }

  protected reportarSwa(): void {
    this.modalRef.close();
    this.dialogService.open<SwaActivarDialog>({
      title: 'Stop Work Authority — HSE-SEGUIMIENTO-003',
      content: SwaActivarDialog,
      footer: false,
      width: '560px',
    });
  }

  protected reportarDesecho(): void {
    this.modalRef.close();
    this.dialogService.open<DesechoDialog>({
      title: 'Registrar desecho — HSE-AMBIENTAL-001',
      content: DesechoDialog,
      footer: false,
    });
  }

  protected reportarDerrame(): void {
    this.modalRef.close();
    this.dialogService.open<DerrameAlertDialog>({
      title: 'Alerta de derrame — HSE-AMBIENTAL-002',
      content: DerrameAlertDialog,
      footer: false,
    });
  }
}
