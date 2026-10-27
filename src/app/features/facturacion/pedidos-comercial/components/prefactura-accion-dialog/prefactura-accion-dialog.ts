import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { Observable } from 'rxjs';
import { DynadrillButtonComponent, DynadrillCheckboxComponent, DynadrillInputComponent, DynadrillNotificationService, DynadrillSelectComponent, DynadrillTextComponent, DynadrillTextareaComponent, type DynadrillSelectOption } from '@digitec-it-projects/dynadrill-ui';
import { PrefacturasComercialService } from '../../services/prefacturas-comercial.service';
import {
  DEVUELTO_A_LABELS,
  MEDIO_ENVIO_LABELS,
  mensajeErrorPrefactura,
  validarMotivoRechazo,
  validarNumeroTicket,
  type DevueltoA,
  type ItemPrefactura,
  type MedioEnvio,
  type Prefactura,
} from '../../models/prefactura-comercial';

export type TipoAccionPrefactura = 'ticket' | 'enviar' | 'firmada' | 'rechazar' | 'seguimiento';

export interface PrefacturaAccionDialogData {
  tipo: TipoAccionPrefactura;
  prefacturaId: string;
  /** Número ya registrado (para mostrarlo al corregir). */
  ticketActual?: number | null;
  /** Al rechazar: los ítems de la prefactura, para marcar los que el cliente observó. */
  items?: ItemPrefactura[];
}

/** Diálogo único para las acciones con un dato: número de ticket, medio de envío, razón de retraso y rechazo. */
@Component({
  selector: 'app-prefactura-accion-dialog',
  imports: [DynadrillButtonComponent, DynadrillCheckboxComponent, DynadrillInputComponent, DynadrillSelectComponent, DynadrillTextComponent, DynadrillTextareaComponent],
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
          @if (data.items?.length) {
            <dynadrill-text variant="caption">Marque los ítems que el cliente observó y escriba qué observó de cada uno (opcional).</dynadrill-text>
            <div class="accion__items">
              @for (i of data.items; track i.id) {
                <div class="accion__item">
                  <dynadrill-checkbox [label]="(i.codigo ?? 'Sin código') + ' · ' + i.descripcion" [checked]="i.id in observaciones()" (checkedChange)="marcar(i.id, $event)" />
                  @if (i.id in observaciones()) {
                    <dynadrill-input label="Observación" [value]="observaciones()[i.id]" (valueChange)="escribir(i.id, $event)" />
                  }
                </div>
              }
            </div>
          }
        }
        @case ('seguimiento') {
          <dynadrill-text variant="body">Anote qué se hizo para corregir la prefactura rechazada. Queda con su nombre y la fecha, y no se edita.</dynadrill-text>
          <dynadrill-textarea label="Nota de seguimiento" placeholder="Qué se corrigió o qué falta…" [rows]="3" [value]="texto()" (valueChange)="texto.set($event)" />
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
    .accion__items { display: flex; flex-direction: column; gap: 10px; max-height: 260px; overflow-y: auto; }
    .accion__item { display: flex; flex-direction: column; gap: 6px; }
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
  protected readonly textoBoton = computed(() => ({ ticket: 'Registrar número', enviar: 'Enviar al cliente', firmada: 'Dar por firmada', rechazar: 'Registrar rechazo', seguimiento: 'Anotar seguimiento' })[this.data.tipo]);

  /** Ítems observados: id del ítem → observación escrita (el ítem está marcado mientras tenga entrada). */
  protected readonly observaciones = signal<Record<string, string>>({});

  protected marcar(id: string, marcado: boolean): void {
    this.observaciones.update(o => {
      const { [id]: _quitado, ...resto } = o;
      return marcado ? { ...resto, [id]: o[id] ?? '' } : resto;
    });
  }

  protected escribir(id: string, texto: string): void {
    this.observaciones.update(o => ({ ...o, [id]: texto }));
  }

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
      case 'seguimiento':
        if (!this.texto().trim()) return void this.error.set('Escriba la nota de seguimiento.');
        llamada = this.servicio.anotarSeguimiento(id, this.texto());
        titulo = 'Seguimiento anotado';
        break;
      default: {
        const error = validarMotivoRechazo(this.texto(), this.devueltoA());
        if (error) return void this.error.set(error);
        const observados = Object.entries(this.observaciones());
        if (observados.some(([, o]) => !o.trim())) return void this.error.set('Escriba la observación de cada ítem marcado.');
        llamada = this.servicio.rechazar(
          id,
          this.texto(),
          this.devueltoA() as DevueltoA,
          observados.map(([itemId, observacion]) => ({ itemId, observacion: observacion.trim() })),
        );
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
