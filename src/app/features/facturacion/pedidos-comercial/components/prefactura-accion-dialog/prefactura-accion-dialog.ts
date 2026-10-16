import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { Observable } from 'rxjs';
import { DynadrillButtonComponent, DynadrillInputComponent, DynadrillNotificationService, DynadrillSelectComponent, DynadrillTextComponent, DynadrillTextareaComponent, type DynadrillSelectOption } from '@digitec-it-projects/dynadrill-ui';
import { PrefacturasComercialService } from '../../services/prefacturas-comercial.service';
import {
  DEVUELTO_A_LABELS,
  MEDIO_ENVIO_LABELS,
  mensajeErrorPrefactura,
  validarMotivoRechazo,
  validarNumeroTicket,
  type DevueltoA,
  type MedioEnvio,
  type Prefactura,
} from '../../models/prefactura-comercial';

export type TipoAccionPrefactura = 'ticket' | 'enviar' | 'firmada' | 'rechazar';

export interface PrefacturaAccionDialogData {
  tipo: TipoAccionPrefactura;
  prefacturaId: string;
  /** Número ya registrado (para mostrarlo al corregir). */
  ticketActual?: number | null;
}

/** Diálogo único para las acciones con un dato: número de ticket, medio de envío, razón de retraso y rechazo. */
@Component({
  selector: 'app-prefactura-accion-dialog',
  imports: [DynadrillButtonComponent, DynadrillInputComponent, DynadrillSelectComponent, DynadrillTextComponent, DynadrillTextareaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <div class="accion">
      @switch (data.tipo) {
        @case ('ticket') {
          <dynadrill-text variant="body">Escriba el número que AS2 asignó a esta prefactura (PRC-), solo el número. Es el número de ticket.</dynadrill-text>
          <dynadrill-input label="Número de ticket" type="text" [value]="texto()" (valueChange)="texto.set($event)" />
        }
        @case ('enviar') {
          <dynadrill-text variant="body">Elija cómo se envía la prefactura al cliente para sus firmas.</dynadrill-text>
          <dynadrill-select label="Medio de envío" placeholder="Elija el medio" [options]="medios" [value]="medio()" (valueChange)="medio.set($any($event))" />
        }
        @case ('firmada') {
          <dynadrill-text variant="body">La prefactura se da por firmada con las firmas registradas. Si se firmó con retraso, puede indicar la razón.</dynadrill-text>
          <dynadrill-textarea label="Razón del retraso (opcional)" [rows]="3" [value]="texto()" (valueChange)="texto.set($event)" />
        }
        @case ('rechazar') {
          <dynadrill-text variant="body">El pedido pasa a corrección. La prefactura rechazada se conserva y después se puede generar una versión nueva.</dynadrill-text>
          <dynadrill-select label="Se devuelve a" placeholder="Elija a quién" [options]="destinos" [value]="devueltoA()" (valueChange)="devueltoA.set($any($event))" />
          <dynadrill-textarea label="Motivo del rechazo" placeholder="Explique por qué se rechaza…" [rows]="3" [value]="texto()" (valueChange)="texto.set($event)" />
        }
      }
      @if (error(); as e) {
        <p class="accion__error" role="alert">{{ e }}</p>
      }
    </div>
    <footer class="accion__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button [variant]="data.tipo === 'rechazar' ? 'error' : 'primary'" [disabled]="enviando()" (clicked)="confirmar()">{{ enviando() ? 'Enviando…' : textoBoton() }}</dynadrill-button>
    </footer>
  `,
  styles: `
    .accion { display: flex; flex-direction: column; gap: 14px; }
    .accion__error { margin: 0; font-size: 13px; color: var(--error, #cf1322); }
    .accion__acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ecebf1; }
  `,
})
export class PrefacturaAccionDialog {
  private readonly servicio = inject(PrefacturasComercialService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<PrefacturaAccionDialog, Prefactura | undefined>);
  protected readonly data = inject<PrefacturaAccionDialogData>(NZ_MODAL_DATA);

  protected readonly medios: DynadrillSelectOption[] = (Object.entries(MEDIO_ENVIO_LABELS) as [MedioEnvio, string][]).map(([value, label]) => ({ label, value }));
  protected readonly destinos: DynadrillSelectOption[] = (Object.entries(DEVUELTO_A_LABELS) as [DevueltoA, string][]).map(([value, label]) => ({ label, value }));

  protected readonly texto = signal(this.data.tipo === 'ticket' && this.data.ticketActual ? String(this.data.ticketActual) : '');
  protected readonly medio = signal<MedioEnvio | null>(null);
  protected readonly devueltoA = signal<DevueltoA | null>(null);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly textoBoton = computed(() => ({ ticket: 'Registrar número', enviar: 'Enviar al cliente', firmada: 'Dar por firmada', rechazar: 'Registrar rechazo' })[this.data.tipo]);

  protected confirmar(): void {
    if (this.enviando()) return;
    const id = this.data.prefacturaId;
    let llamada: Observable<Prefactura>;
    let titulo: string;
    switch (this.data.tipo) {
      case 'ticket': {
        const { valor, error } = validarNumeroTicket(this.texto());
        if (error || valor === null) return void this.error.set(error);
        llamada = this.servicio.registrarTicket(id, valor);
        titulo = 'Número de ticket registrado';
        break;
      }
      case 'enviar': {
        const medio = this.medio();
        if (!medio) return void this.error.set('Elija el medio de envío.');
        llamada = this.servicio.enviar(id, medio);
        titulo = 'Prefactura enviada';
        break;
      }
      case 'firmada':
        llamada = this.servicio.darPorFirmada(id, this.texto());
        titulo = 'Prefactura firmada';
        break;
      default: {
        const error = validarMotivoRechazo(this.texto(), this.devueltoA());
        if (error) return void this.error.set(error);
        llamada = this.servicio.rechazar(id, this.texto(), this.devueltoA() as DevueltoA);
        titulo = 'Rechazo registrado';
      }
    }
    this.error.set(null);
    this.enviando.set(true);
    llamada.subscribe({
      next: p => {
        this.notify.success(titulo);
        this.modalRef.close(p);
      },
      error: err => {
        this.enviando.set(false);
        this.error.set(mensajeErrorPrefactura(err, 'No se pudo completar la acción. Intente de nuevo.'));
      },
    });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
