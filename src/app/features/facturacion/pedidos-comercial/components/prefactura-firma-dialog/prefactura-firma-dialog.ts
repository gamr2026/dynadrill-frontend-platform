import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { switchMap } from 'rxjs';
import { DynadrillButtonComponent, DynadrillDatetimePickerComponent, DynadrillInputComponent, DynadrillNotificationService, DynadrillSelectComponent, DynadrillTextComponent, type DynadrillSelectOption } from '@digitec-it-projects/dynadrill-ui';
import { toLocalDateString } from '../../../../../shared/utils';
import { ArchivosService } from '../../services/archivos.service';
import { PrefacturasComercialService } from '../../services/prefacturas-comercial.service';
import {
  FIRMANTE_LABELS,
  MODULO_ARCHIVO_PREFACTURA,
  armarFirma,
  mensajeErrorPrefactura,
  validarFirma,
  type FirmanteTipo,
  type Prefactura,
} from '../../models/prefactura-comercial';
import { mensajeErrorArchivo } from '../../models/documentos-pedido';

export interface PrefacturaFirmaDialogData {
  prefacturaId: string;
  /** Representante de campo del pedido: el company man debe ser esa persona. */
  representanteCampo: { id: string | null; nombre: string | null };
}

/** Registra una firma: primero sube el archivo firmado y luego lo asocia a la prefactura. */
@Component({
  selector: 'app-prefactura-firma-dialog',
  imports: [DynadrillButtonComponent, DynadrillDatetimePickerComponent, DynadrillInputComponent, DynadrillSelectComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <div class="firma">
      <dynadrill-text variant="body">Registre una firma con su documento firmado (PDF, PNG o JPEG, máximo 25 MB). Puede registrar varias firmas.</dynadrill-text>
      <dynadrill-select label="Quién firma" placeholder="Elija quién firma" [options]="tipos" [value]="tipo()" (valueChange)="tipo.set($any($event))" />
      @if (usaRepresentante()) {
        <dynadrill-input label="Company man (representante de campo del pedido)" [disabled]="true" [value]="data.representanteCampo.nombre ?? ''" />
      } @else {
        <dynadrill-input label="Nombre de quien firma" [value]="nombre()" (valueChange)="nombre.set($event)" />
      }
      <dynadrill-input label="Cargo (opcional)" [value]="cargo()" (valueChange)="cargo.set($event)" />
      <dynadrill-datetime-picker mode="date" label="Fecha de la firma" [value]="fecha()!" (valueChange)="fecha.set($event)" />
      <label class="firma__archivo">
        <span>Documento firmado</span>
        <input type="file" accept=".pdf,.png,.jpg,.jpeg" [disabled]="enviando()" (change)="onArchivo($event)" />
      </label>
      @if (error(); as e) {
        <p class="firma__error" role="alert">{{ e }}</p>
      }
    </div>
    <footer class="firma__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button [disabled]="enviando()" (clicked)="registrar()">{{ enviando() ? 'Registrando…' : 'Registrar firma' }}</dynadrill-button>
    </footer>
  `,
  styles: `
    .firma { display: flex; flex-direction: column; gap: 12px; }
    .firma__archivo { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted, #5c5870); }
    .firma__archivo input { font: inherit; color: var(--text, #2c2b35); }
    .firma__error { margin: 0; font-size: 13px; color: var(--error, #cf1322); }
    .firma__acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ecebf1; }
  `,
})
export class PrefacturaFirmaDialog {
  private readonly archivos = inject(ArchivosService);
  private readonly servicio = inject(PrefacturasComercialService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<PrefacturaFirmaDialog, Prefactura | undefined>);
  protected readonly data = inject<PrefacturaFirmaDialogData>(NZ_MODAL_DATA);

  protected readonly tipos: DynadrillSelectOption[] = (Object.entries(FIRMANTE_LABELS) as [FirmanteTipo, string][]).map(([value, label]) => ({ label, value }));
  protected readonly tipo = signal<FirmanteTipo | null>(null);
  protected readonly nombre = signal('');
  protected readonly cargo = signal('');
  protected readonly fecha = signal<Date | null>(new Date());
  protected readonly archivo = signal<File | null>(null);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly usaRepresentante = computed(() => this.tipo() === 'company_man' && !!this.data.representanteCampo.id);

  protected onArchivo(e: Event): void {
    this.archivo.set((e.target as HTMLInputElement).files?.[0] ?? null);
  }

  private borrador() {
    const f = this.fecha();
    return {
      firmanteTipo: this.tipo(),
      personaIdRepresentante: this.data.representanteCampo.id,
      nombre: this.nombre(),
      cargo: this.cargo(),
      firmadoAt: f ? toLocalDateString(f) : null,
      archivo: this.archivo(),
    };
  }

  protected registrar(): void {
    if (this.enviando()) return;
    const b = this.borrador();
    const problema = validarFirma(b, toLocalDateString(new Date()));
    if (problema) return void this.error.set(problema);
    this.error.set(null);
    this.enviando.set(true);
    let subido = false;
    // Secuencia: subir el archivo firmado y, con su id, registrar la firma.
    this.archivos
      .subir(b.archivo as File, MODULO_ARCHIVO_PREFACTURA)
      .pipe(
        switchMap(a => {
          subido = true;
          return this.servicio.registrarFirma(this.data.prefacturaId, armarFirma(b, a.id));
        }),
      )
      .subscribe({
        next: p => {
          this.notify.success('Firma registrada');
          this.modalRef.close(p);
        },
        error: err => {
          this.enviando.set(false);
          this.error.set(subido ? mensajeErrorPrefactura(err, 'El archivo se subió, pero no se pudo registrar la firma.') : mensajeErrorArchivo(err));
        },
      });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
