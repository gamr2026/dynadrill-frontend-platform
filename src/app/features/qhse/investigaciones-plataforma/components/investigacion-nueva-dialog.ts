import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';
import type { InvestigacionDetalle, ResultadoIncidente } from '../models/investigacion';
import { InvestigacionPlataformaService } from '../services/investigacion.service';

/**
 * HSE-TRIAGE-002: la investigación puede abrirse directo por daño material significativo o Near Miss con alto potencial, sin haber pasado por una
 * emergencia formal. La abre el staff HSE desde la bandeja; el plazo para iniciarla y para el informe final salen del resultado elegido.
 */
@Component({
  selector: 'app-investigacion-nueva-dialog',
  host: { class: 'app-dialog-fullscreen-mobile' },
  imports: [
    DynadrillSelectComponent,
    DynadrillTextareaComponent,
    DynadrillInputComponent,
    DynadrillDatetimePickerComponent,
    DynadrillButtonComponent,
    DynadrillBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './investigacion-nueva-dialog.html',
  styleUrl: './investigacion-nueva-dialog.scss',
})
export class InvestigacionNuevaDialog {
  private readonly service = inject(InvestigacionPlataformaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(
    NzModalRef<InvestigacionNuevaDialog, InvestigacionDetalle | undefined>,
  );

  private readonly resultados = signal<ResultadoIncidente[]>([]);
  protected readonly resultadoOptions = computed<DynadrillSelectOption[]>(() =>
    this.resultados().map((r) => ({ label: r.nombre, value: r.id })),
  );

  protected readonly resultadoId = signal('');
  protected readonly descripcionEvento = signal('');
  protected readonly fechaIncidente = signal<Date | null>(new Date());
  protected readonly ubicacion = signal('');
  protected readonly submitting = signal(false);

  /** El resultado elegido, para avisar de sus plazos (y de si son un supuesto). */
  protected readonly elegido = computed(
    () => this.resultados().find((r) => r.id === this.resultadoId()) ?? null,
  );
  protected readonly plazosTexto = computed(() => {
    const r = this.elegido();
    if (!r) return '';
    const inicio = r.inicioHoras === 0 ? 'de inmediato' : `en ${r.inicioHoras} h`;
    return `Debe iniciarse ${inicio} y el informe final entregarse en ${r.finalDias} días.`;
  });

  protected readonly puedeGuardar = computed(
    () =>
      this.resultadoId() !== '' &&
      this.descripcionEvento().trim().length > 0 &&
      this.fechaIncidente() !== null &&
      this.ubicacion().trim().length > 0,
  );

  constructor() {
    this.service.resultados().subscribe({
      next: (r) => this.resultados.set(r),
      error: (e) =>
        this.notify.error('Error', mensajeDeError(e, 'No se pudieron cargar las clasificaciones.')),
    });
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    const fecha = this.fechaIncidente();
    if (!this.puedeGuardar() || this.submitting() || !fecha) return;
    this.submitting.set(true);
    this.service
      .abrir({
        resultadoId: this.resultadoId(),
        descripcionEvento: this.descripcionEvento().trim(),
        fechaIncidente: fecha.toISOString(),
        ubicacion: this.ubicacion().trim(),
      })
      .subscribe({
        next: (inv) => {
          this.notify.success('Investigación abierta', `Investigación ${inv.codigo} abierta.`);
          this.modalRef.close(inv);
        },
        error: (e) => {
          this.submitting.set(false);
          this.notify.error('Error', mensajeDeError(e, 'No se pudo abrir la investigación.'));
        },
      });
  }
}
