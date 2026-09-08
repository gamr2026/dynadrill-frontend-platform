import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import {
  CreateStopCardInput,
  StopBloque,
  StopCard,
  StopChecklistItem,
  StopItemEstado,
  STOP_ACCIONES,
  STOP_CONDICIONES,
  crearStopChecklist,
} from '../models/stop-card.model';
import { StopCardService } from '../services/stop-card.service';
import { toLocalDateString } from '../../../../shared/utils';

interface StopGrupo {
  subcategoria: string;
  filas: { index: number; item: StopChecklistItem }[];
}

/**
 * "Cualquier Trabajador... tiene autoridad y obligación de observar"
 * (HSE-SEGUIMIENTO-002) — este diálogo se abre tanto desde la bandeja de
 * STOP (staff HSE) como desde "Reportar" en el header (cualquier usuario
 * autenticado), sin pasar por el roleGuard de QHSE.
 *
 * Checklist fiel al formato físico DYN-SGI-RE-008: ~55 ítems agrupados en
 * 10 subcategorías (5 de Acciones, 5 de Condiciones) — el observador solo
 * marca los que realmente vio, el resto queda sin marcar.
 */
@Component({
  selector: 'app-stop-card-dialog',
  imports: [DynadrillTextComponent, DynadrillInputComponent, DynadrillTextareaComponent, DynadrillDatetimePickerComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stop-card-dialog.html',
  styleUrl: './stop-card-dialog.scss',
})
export class StopCardDialog {
  private readonly stopService = inject(StopCardService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<StopCardDialog, StopCard | undefined>);

  protected readonly checklist = signal<StopChecklistItem[]>(crearStopChecklist());

  private agrupar(bloque: StopBloque): StopGrupo[] {
    const orden = Object.keys(bloque === 'acciones' ? STOP_ACCIONES : STOP_CONDICIONES);
    const list = this.checklist();
    return orden.map(subcategoria => ({
      subcategoria,
      filas: list.map((item, index) => ({ item, index })).filter(({ item }) => item.bloque === bloque && item.subcategoria === subcategoria),
    }));
  }

  protected readonly accionesGrupos = computed(() => this.agrupar('acciones'));
  protected readonly condicionesGrupos = computed(() => this.agrupar('condiciones'));

  /** Clic sobre el mismo estado ya marcado lo limpia — permite corregir sin un botón "quitar" aparte. */
  protected marcar(index: number, estado: Exclude<StopItemEstado, null>): void {
    this.checklist.update(list => list.map((item, i) => (i === index ? { ...item, estado: item.estado === estado ? null : estado } : item)));
  }

  protected readonly queObservaAcciones = signal('');
  protected readonly accionesAcciones = signal('');
  protected readonly queObservaCondiciones = signal('');
  protected readonly accionesCondiciones = signal('');

  protected readonly observadorNombre = signal(this.auth.currentUser()?.name ?? '');
  protected readonly fecha = signal<Date | null>(new Date());
  protected readonly locacion = signal('');
  protected readonly operadora = signal('');
  protected readonly contacto = signal('');
  protected readonly submitting = signal(false);

  protected readonly puedeGuardar = computed(() => {
    const algunItemMarcado = this.checklist().some(i => i.estado !== null);
    return (
      algunItemMarcado &&
      this.observadorNombre().trim().length > 0 &&
      this.fecha() !== null &&
      this.locacion().trim().length > 0 &&
      this.operadora().trim().length > 0
    );
  });

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    const input: CreateStopCardInput = {
      checklist: this.checklist(),
      queObservaAcciones: this.queObservaAcciones().trim() || undefined,
      accionesAcciones: this.accionesAcciones().trim() || undefined,
      queObservaCondiciones: this.queObservaCondiciones().trim() || undefined,
      accionesCondiciones: this.accionesCondiciones().trim() || undefined,
      observadorNombre: this.observadorNombre().trim(),
      fecha: toLocalDateString(this.fecha()!),
      locacion: this.locacion().trim(),
      operadora: this.operadora().trim(),
      contacto: this.contacto().trim() || undefined,
    };

    this.stopService.create(input).subscribe({
      next: card => {
        this.notify.success('Registrada', `Tarjeta STOP ${card.code} registrada.`);
        this.modalRef.close(card);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo registrar la tarjeta STOP.');
      },
    });
  }
}
