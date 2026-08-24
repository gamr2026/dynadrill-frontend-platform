import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillDialogService, DynadrillIconComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { StopCardDialog } from '../../stop/components/stop-card-dialog';
import { SwaActivationDialog } from '../../swa/components/swa-activation-dialog';
import { InspeccionEquipoDialog } from '../../inspecciones/components/inspeccion-equipo-dialog';
import { DesechoDialog } from '../../desechos/components/desecho-dialog';
import { DerrameAlertDialog } from '../../derrames/components/derrame-alert-dialog';

/**
 * Acceso rápido universal "Reportar" (QHSE-PLAN-DESARROLLO.md, sección 7):
 * las acciones que la documentación asigna a "Cualquier Trabajador" —
 * Tarjeta STOP (HSE-SEGUIMIENTO-002), Stop Work Authority
 * (HSE-SEGUIMIENTO-003), Inspección pre-operacional (HSE-SEGUIMIENTO-001),
 * clasificación de desechos en campo (HSE-AMBIENTAL-001) y alerta de
 * derrame (HSE-AMBIENTAL-002) — sin pasar por el roleGuard de QHSE. Botón
 * de emergencia se agrega acá cuando exista (Fase 4 del plan de
 * desarrollo).
 */
@Component({
  selector: 'app-reportar-dialog',
  imports: [DynadrillTextComponent, DynadrillIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reportar-dialog.html',
  styleUrl: './reportar-dialog.scss',
})
export class ReportarDialog {
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly modalRef = inject(NzModalRef<ReportarDialog>);

  protected reportarStop(): void {
    this.modalRef.close();
    this.dialogService.open<StopCardDialog>({ title: 'Tarjeta STOP — HSE-SEGUIMIENTO-002', content: StopCardDialog, footer: false });
  }

  protected reportarSwa(): void {
    this.modalRef.close();
    this.dialogService.open<SwaActivationDialog>({ title: 'Stop Work Authority — HSE-SEGUIMIENTO-003', content: SwaActivationDialog, footer: false });
  }

  protected reportarInspeccion(): void {
    this.modalRef.close();
    this.dialogService.open<InspeccionEquipoDialog>({ title: 'Inspección pre-operacional — HSE-SEGUIMIENTO-001', content: InspeccionEquipoDialog, footer: false });
  }

  protected reportarDesecho(): void {
    this.modalRef.close();
    this.dialogService.open<DesechoDialog>({ title: 'Registrar desecho — HSE-AMBIENTAL-001', content: DesechoDialog, footer: false });
  }

  protected reportarDerrame(): void {
    this.modalRef.close();
    this.dialogService.open<DerrameAlertDialog>({ title: 'Alerta de derrame — HSE-AMBIENTAL-002', content: DerrameAlertDialog, footer: false });
  }
}
