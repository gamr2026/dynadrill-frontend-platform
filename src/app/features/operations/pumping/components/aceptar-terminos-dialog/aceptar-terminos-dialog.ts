import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, computed, inject, signal, viewChild } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
} from '@digitec-it-projects/dynadrill-ui';
import { AceptacionTerminos, TerminosPumping, esCedulaValida } from '../../models/terminos.model';
import { TerminosPumpingService } from '../../services/terminos-pumping.service';

export interface AceptarTerminosDialogData {
  ticketId: number;
  operadorNombre: string;
}

/** Margen para dar por leído el texto aunque el scroll no llegue al píxel exacto (zoom, redondeos). */
const MARGEN_FIN_PX = 8;

/**
 * Términos y condiciones de uso de equipos — los acepta cada operador
 * asignado antes de solicitar su EPI (`traslado_salida`). La casilla solo se
 * habilita al llegar al final del texto; la constancia (versión, hash, fecha
 * del servidor) la arma el backend.
 */
@Component({
  selector: 'app-aceptar-terminos-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [DynadrillInputComponent, DynadrillCheckboxComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './aceptar-terminos-dialog.html',
  styleUrl: './aceptar-terminos-dialog.scss',
})
export class AceptarTerminosDialog {
  private readonly service = inject(TerminosPumpingService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<AceptarTerminosDialog, AceptacionTerminos | undefined>);
  protected readonly data = inject<AceptarTerminosDialogData>(NZ_MODAL_DATA);

  protected readonly terminos = signal<TerminosPumping | null>(null);
  protected readonly errorCarga = signal(false);
  protected readonly leido = signal(false);
  protected readonly cedula = signal('');
  protected readonly cedulaTocada = signal(false);
  protected readonly acepta = signal(false);
  protected readonly submitting = signal(false);

  protected readonly cedulaValida = computed(() => esCedulaValida(this.cedula()));
  protected readonly puedeAceptar = computed(() => this.leido() && this.cedulaValida() && this.acepta() && !this.submitting());

  private readonly texto = viewChild<ElementRef<HTMLElement>>('texto');

  constructor() {
    this.service.vigentes().subscribe({
      next: t => this.terminos.set(t),
      error: () => this.errorCarga.set(true),
    });
    // Si el texto entra completo sin scroll (pantallas altas), ya está leído.
    afterRenderEffect(() => {
      const el = this.texto()?.nativeElement;
      if (el) this.onScroll(el);
    });
  }

  protected onScroll(el: HTMLElement): void {
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - MARGEN_FIN_PX) this.leido.set(true);
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected aceptar(): void {
    if (!this.puedeAceptar()) return;
    this.submitting.set(true);
    this.service.aceptar(this.data.ticketId, { operadorNombre: this.data.operadorNombre, operadorCedula: this.cedula().trim() }).subscribe({
      next: aceptacion => {
        this.notify.success('Términos aceptados', `${aceptacion.operadorNombre} aceptó la versión ${aceptacion.version}.`);
        this.modalRef.close(aceptacion);
      },
      error: err => {
        this.submitting.set(false);
        this.notify.error('No se registró la aceptación', err?.error?.message ?? 'Intenta de nuevo.');
      },
    });
  }
}
