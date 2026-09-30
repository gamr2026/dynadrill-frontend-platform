import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillChecklistComponent,
  type DynadrillChecklistItem,
  DynadrillCheckboxComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTagComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import {
  CRITERIOS_RECHAZO,
  CreateInspeccionInput,
  InspeccionEquipo,
  TIPO_EQUIPO_LABELS,
  TipoEquipoInspeccion,
} from '../models/inspeccion-equipo.model';
import { InspeccionEquipoService } from '../services/inspeccion-equipo.service';

const TIPO_OPTIONS: DynadrillSelectOption[] = (Object.entries(TIPO_EQUIPO_LABELS) as [TipoEquipoInspeccion, string][]).map(
  ([value, label]) => ({ label, value }),
);

/**
 * "Personal Operativo: Realiza inspecciones pre-operacionales diarias"
 * (HSE-SEGUIMIENTO-001) — se abre desde "Reportar" en el header, sin pasar
 * por el roleGuard de QHSE. El resultado se calcula solo: cualquier
 * criterio sin cumplir rechaza el equipo completo y lo manda a cuarentena.
 */
@Component({
  selector: 'app-inspeccion-equipo-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [
    DynadrillSelectComponent,
    DynadrillInputComponent,
    DynadrillDatetimePickerComponent,
    DynadrillChecklistComponent,
    DynadrillCheckboxComponent,
    DynadrillTagComponent,
    DynadrillButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inspeccion-equipo-dialog.html',
  styleUrl: './inspeccion-equipo-dialog.scss',
})
export class InspeccionEquipoDialog {
  private readonly inspeccionService = inject(InspeccionEquipoService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<InspeccionEquipoDialog, InspeccionEquipo | undefined>);

  protected readonly tipoOptions = TIPO_OPTIONS;
  protected readonly tipo = signal<TipoEquipoInspeccion>('eslinga_cable');
  protected readonly equipoCodigo = signal('');
  protected readonly inspectorNombre = signal(this.auth.currentUser()?.name ?? '');
  protected readonly fecha = signal<Date | null>(new Date());
  protected readonly bumpTestRealizado = signal(false);
  protected readonly submitting = signal(false);

  protected readonly criterios = signal<DynadrillChecklistItem[]>(this.criteriosParaTipo('eslinga_cable'));

  protected readonly resultado = computed<'aprobado' | 'rechazado'>(() =>
    this.criterios().every(c => c.checked) ? 'aprobado' : 'rechazado',
  );

  protected onTipoChange(value: unknown): void {
    const tipo = value as TipoEquipoInspeccion;
    this.tipo.set(tipo);
    this.criterios.set(this.criteriosParaTipo(tipo));
  }

  private criteriosParaTipo(tipo: TipoEquipoInspeccion): DynadrillChecklistItem[] {
    return CRITERIOS_RECHAZO[tipo].map(label => ({ label, checked: false }));
  }

  protected onCriterioToggle(index: number): void {
    this.criterios.update(items => items.map((c, i) => (i === index ? { ...c, checked: !c.checked } : c)));
  }

  protected readonly puedeGuardar = computed(() => this.equipoCodigo().trim().length > 0 && !!this.fecha());

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    const input: CreateInspeccionInput = {
      tipo: this.tipo(),
      equipoCodigo: this.equipoCodigo().trim(),
      inspectorNombre: this.inspectorNombre(),
      fecha: this.fecha()!.toISOString(),
      criterios: this.criterios(),
      resultado: this.resultado(),
      bumpTestRealizado: this.tipo() === 'detector_gas' ? this.bumpTestRealizado() : undefined,
    };

    this.inspeccionService.create(input).subscribe({
      next: inspeccion => {
        this.notify.success(
          inspeccion.resultado === 'aprobado' ? 'Aprobado' : 'Rechazado — en cuarentena',
          `Inspección ${inspeccion.code} registrada.`,
        );
        this.modalRef.close(inspeccion);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo registrar la inspección.');
      },
    });
  }
}
