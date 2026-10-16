import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { switchMap } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { ArchivosService } from '../../services/archivos.service';
import { GuiasComercialService } from '../../services/guias-comercial.service';
import { mensajeErrorArchivo } from '../../models/documentos-pedido';
import { MODULO_ARCHIVO_GUIA, mensajeErrorGuia, type AccionGuia, type Guia } from '../../models/guia-comercial';

export interface GuiaAccionDialogData {
  accion: AccionGuia;
  guia: Guia;
}

/** Reasignar el número (con motivo), anular (con motivo) o registrar la guía firmada electrónicamente. */
@Component({
  selector: 'app-guia-accion-dialog',
  imports: [DynadrillButtonComponent, DynadrillInputComponent, DynadrillTextComponent, DynadrillTextareaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <div class="ga">
      @switch (data.accion) {
        @case ('reasignar') {
          <dynadrill-text variant="body">La guía {{ data.guia.codigo }} cambia de número. El número anterior queda anulado y no se vuelve a usar.</dynadrill-text>
          <dynadrill-input label="Número nuevo (hasta 7 dígitos)" [value]="numero()" (valueChange)="numero.set($event)" />
          <dynadrill-textarea label="Motivo" placeholder="Por qué cambia el número…" [rows]="3" [value]="motivo()" (valueChange)="motivo.set($event)" />
        }
        @case ('anular') {
          <dynadrill-text variant="body">La guía {{ data.guia.codigo }} se anula y su número no se reutiliza. Después puede emitir otra en su lugar.</dynadrill-text>
          <dynadrill-textarea label="Motivo de la anulación" placeholder="Explique por qué se anula…" [rows]="3" [value]="motivo()" (valueChange)="motivo.set($event)" />
        }
        @case ('firmada') {
          <dynadrill-text variant="body">Suba la guía ya firmada electrónicamente (PDF, PNG o JPEG, máximo 25 MB). Una guía firmada ya no se anula ni cambia de número.</dynadrill-text>
          <label class="ga__archivo">
            <span>Guía firmada</span>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" [disabled]="enviando()" (change)="onArchivo($event)" />
          </label>
        }
      }
      @if (error(); as e) {
        <p class="ga__error" role="alert">{{ e }}</p>
      }
    </div>
    <footer class="ga__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button [variant]="data.accion === 'anular' ? 'error' : 'primary'" [disabled]="enviando()" (clicked)="confirmar()">{{ enviando() ? 'Enviando…' : boton() }}</dynadrill-button>
    </footer>
  `,
  styles: `
    .ga { display: flex; flex-direction: column; gap: 14px; }
    .ga__archivo { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted, #5c5870); }
    .ga__archivo input { font: inherit; color: var(--text, #2c2b35); }
    .ga__error { margin: 0; font-size: 13px; color: var(--error, #cf1322); }
    .ga__acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ecebf1; }
  `,
})
export class GuiaAccionDialog {
  private readonly guias = inject(GuiasComercialService);
  private readonly archivos = inject(ArchivosService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<GuiaAccionDialog, Guia | undefined>);
  protected readonly data = inject<GuiaAccionDialogData>(NZ_MODAL_DATA);

  protected readonly numero = signal('');
  protected readonly motivo = signal('');
  protected readonly archivo = signal<File | null>(null);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected boton(): string {
    return { reasignar: 'Cambiar número', anular: 'Anular guía', firmada: 'Registrar guía firmada' }[this.data.accion];
  }

  protected onArchivo(e: Event): void {
    this.archivo.set((e.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected confirmar(): void {
    if (this.enviando()) return;
    const id = this.data.guia.id;
    const motivo = this.motivo().trim();
    this.error.set(null);
    switch (this.data.accion) {
      case 'reasignar': {
        const n = this.numero().trim();
        if (!/^[1-9]\d{0,6}$/.test(n)) return void this.error.set('El número debe tener hasta 7 dígitos.');
        if (motivo.length < 3) return void this.error.set('Indique el motivo del cambio.');
        return this.enviar(this.guias.reasignarNumero(id, Number(n), motivo), 'Número de la guía cambiado');
      }
      case 'anular':
        if (motivo.length < 3) return void this.error.set('Indique el motivo de la anulación.');
        return this.enviar(this.guias.anular(id, motivo), 'Guía anulada');
      case 'firmada': {
        const a = this.archivo();
        if (!a) return void this.error.set('Elija el archivo de la guía firmada.');
        this.enviando.set(true);
        let subido = false;
        this.archivos
          .subir(a, MODULO_ARCHIVO_GUIA)
          .pipe(
            switchMap(s => {
              subido = true;
              return this.guias.registrarFirmada(id, s.id);
            }),
          )
          .subscribe({
            next: g => {
              this.notify.success('Guía firmada registrada');
              this.modalRef.close(g);
            },
            error: err => {
              this.enviando.set(false);
              this.error.set(subido ? mensajeErrorGuia(err, 'El archivo se subió, pero no se pudo registrar.') : mensajeErrorArchivo(err));
            },
          });
      }
    }
  }

  private enviar(obs: ReturnType<GuiasComercialService['anular']>, titulo: string): void {
    this.enviando.set(true);
    obs.subscribe({
      next: g => {
        this.notify.success(titulo);
        this.modalRef.close(g);
      },
      error: err => {
        this.enviando.set(false);
        this.error.set(mensajeErrorGuia(err, 'No se pudo completar la acción. Intente de nuevo.'));
      },
    });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
