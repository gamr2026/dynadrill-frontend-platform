import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { forkJoin, of, switchMap } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { ArchivosService } from '../../services/archivos.service';
import { GuiasComercialService } from '../../services/guias-comercial.service';
import { mensajeErrorArchivo } from '../../models/documentos-pedido';
import { MODULO_ARCHIVO_DESPACHO, mensajeErrorGuia, type DespachoEstado } from '../../models/guia-comercial';

export interface DespachoRealizarDialogData {
  pedidoId: string;
}

/** Bodega registra el despacho: documento de respaldo (obligatorio) y, si despachó químicos, la hoja MSDS (opcional). */
@Component({
  selector: 'app-despacho-realizar-dialog',
  imports: [DynadrillButtonComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <div class="dr">
      <dynadrill-text variant="body">
        Adjunte el documento de respaldo del despacho (PDF, PNG o JPEG, máximo 25 MB). Si despachó químicos, adjunte también la hoja MSDS.
      </dynadrill-text>
      <label class="dr__archivo">
        <span>Documento de respaldo (obligatorio)</span>
        <input type="file" accept=".pdf,.png,.jpg,.jpeg" [disabled]="enviando()" (change)="onRespaldo($event)" />
      </label>
      <label class="dr__archivo">
        <span>Hoja MSDS (opcional)</span>
        <input type="file" accept=".pdf,.png,.jpg,.jpeg" [disabled]="enviando()" (change)="onMsds($event)" />
      </label>
      @if (error(); as e) {
        <p class="dr__error" role="alert">{{ e }}</p>
      }
    </div>
    <footer class="dr__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button variant="primary" [disabled]="enviando()" (clicked)="confirmar()">{{ enviando() ? 'Enviando…' : 'Registrar despacho realizado' }}</dynadrill-button>
    </footer>
  `,
  styles: `
    .dr { display: flex; flex-direction: column; gap: 14px; }
    .dr__archivo { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted, #5c5870); }
    .dr__archivo input { font: inherit; color: var(--text, #2c2b35); }
    .dr__error { margin: 0; font-size: 13px; color: var(--error, #cf1322); }
    .dr__acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ecebf1; }
  `,
})
export class DespachoRealizarDialog {
  private readonly guias = inject(GuiasComercialService);
  private readonly archivos = inject(ArchivosService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<DespachoRealizarDialog, DespachoEstado | undefined>);
  protected readonly data = inject<DespachoRealizarDialogData>(NZ_MODAL_DATA);

  protected readonly respaldo = signal<File | null>(null);
  protected readonly msds = signal<File | null>(null);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected onRespaldo(e: Event): void {
    this.respaldo.set((e.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected onMsds(e: Event): void {
    this.msds.set((e.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected confirmar(): void {
    if (this.enviando()) return;
    const respaldo = this.respaldo();
    if (!respaldo) return void this.error.set('Adjunte el documento de respaldo del despacho.');
    this.error.set(null);
    this.enviando.set(true);
    const msds = this.msds();
    let subidos = false;
    forkJoin({
      respaldo: this.archivos.subir(respaldo, MODULO_ARCHIVO_DESPACHO),
      msds: msds ? this.archivos.subir(msds, MODULO_ARCHIVO_DESPACHO) : of(null),
    })
      .pipe(
        switchMap(({ respaldo: r, msds: m }) => {
          subidos = true;
          return this.guias.realizarDespacho(this.data.pedidoId, { archivoRespaldoId: r.id, archivoMsdsId: m?.id });
        }),
      )
      .subscribe({
        next: d => {
          this.notify.success('Despacho registrado');
          this.modalRef.close(d);
        },
        error: err => {
          this.enviando.set(false);
          this.error.set(subidos ? mensajeErrorGuia(err, 'Los archivos se subieron, pero no se pudo registrar el despacho.') : mensajeErrorArchivo(err));
        },
      });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
