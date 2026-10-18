import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { switchMap } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTagComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { ArchivosService } from '../../../../../facturacion/pedidos-comercial/services/archivos.service';
import { PrefacturasComercialService } from '../../../../../facturacion/pedidos-comercial/services/prefacturas-comercial.service';
import { mensajeErrorArchivo } from '../../../../../facturacion/pedidos-comercial/models/documentos-pedido';
import { formatoMoneda } from '../../../../../facturacion/pedidos-comercial/models/pedido-comercial.model';
import {
  MAX_BYTES_FIRMA,
  MODULO_ARCHIVO_COMPANY_MAN,
  mensajeErrorPrefactura,
  type VistaPrefacturaTicket,
} from '../../../../../facturacion/pedidos-comercial/models/prefactura-comercial';

export interface TicketPrefacturaDialogData {
  pedidoId: string;
  /** El Supervisor puede subir el documento firmado por el Company Man (solo antes de finalizar el ticket). */
  puedeFirmar: boolean;
}

const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * «Ver prefactura» desde el ticket, antes de finalizar: la vigente o una preliminar calculada con lo que el servicio lleva hasta ahora
 * (no guarda nada). El Supervisor sube aquí el documento que firmó el Company Man; eso genera o recalcula la prefactura y la deja
 * firmada. Con la documentación del pedido incompleta, la firma se rechaza y el diálogo dice qué falta.
 */
@Component({
  selector: 'app-ticket-prefactura-dialog',
  imports: [DynadrillButtonComponent, DynadrillInputComponent, DynadrillTagComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-fullscreen-mobile' },
  template: `
    @if (vista(); as v) {
      <div class="tp">
        <div class="tp__cabecera">
          <dynadrill-tag [label]="v.preliminar ? 'Preliminar (no guardada)' : 'Prefactura generada'" [variant]="v.preliminar ? 'warning' : 'info'" [uppercase]="false" />
          @if (v.prefactura.estado === 'firmada') {
            <dynadrill-tag label="Firmada" variant="success" [uppercase]="false" />
          }
        </div>

        @if (!v.avance.completo) {
          <div class="tp__aviso" role="status">
            <strong>Documentación del pedido incompleta.</strong> Falta: {{ v.avance.pendientes.join(', ') }}. Hasta completarla no se puede subir la firma del Company Man.
          </div>
        }
        @for (a of v.prefactura.advertencias; track $index) {
          <div class="tp__aviso" role="status">{{ a }}</div>
        }

        <table class="tp__tabla">
          <thead>
            <tr><th scope="col">Descripción</th><th scope="col">Cant.</th><th scope="col">P. unitario</th><th scope="col">Total</th></tr>
          </thead>
          <tbody>
            @for (i of v.prefactura.items; track i.orden) {
              <tr>
                <td>{{ i.descripcion }} <span class="tp__meta">{{ i.tipo }}</span></td>
                <td>{{ i.cantidad }}</td>
                <td>{{ dinero(i.precioUnitario) }}</td>
                <td>{{ dinero(i.precioTotal) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="tp__meta">Todavía no hay renglones para facturar.</td></tr>
            }
          </tbody>
        </table>

        <dl class="tp__totales">
          <div><dt>Subtotal</dt><dd>{{ dinero(v.prefactura.totales.subtotal) }}</dd></div>
          <div><dt>IVA ({{ v.prefactura.tasas.ivaPct }}%)</dt><dd>{{ dinero(v.prefactura.totales.iva) }}</dd></div>
          <div><dt>Retención IR ({{ v.prefactura.tasas.retencionIrPct }}%)</dt><dd>{{ dinero(v.prefactura.totales.retencionIr) }}</dd></div>
          <div><dt>Retención IVA ({{ v.prefactura.tasas.retencionIvaPct }}%)</dt><dd>{{ dinero(v.prefactura.totales.retencionIva) }}</dd></div>
          <div class="tp__neto"><dt>Neto a cobrar</dt><dd>{{ dinero(v.prefactura.totales.netoCobrar) }}</dd></div>
        </dl>

        @if (data.puedeFirmar && v.prefactura.estado !== 'firmada') {
          <fieldset class="tp__bloque">
            <legend>Firma del Company Man</legend>
            <dynadrill-text variant="caption">Suba el documento (PDF, PNG o JPEG, máximo 25 MB) firmado por el Company Man del cliente.</dynadrill-text>
            <dynadrill-input label="Nombre del Company Man" [value]="nombre()" [disabled]="enviando()" (valueChange)="nombre.set($event)" />
            <dynadrill-input label="Cargo (opcional)" [value]="cargo()" [disabled]="enviando()" (valueChange)="cargo.set($event)" />
            <label class="tp__campo"><span>Fecha de la firma</span><input type="date" [value]="fecha()" [max]="maxFecha" [disabled]="enviando()" (input)="fecha.set($any($event.target).value)" /></label>
            <label class="tp__campo"><span>Documento firmado</span><input type="file" accept=".pdf,.png,.jpg,.jpeg" [disabled]="enviando()" (change)="alElegirArchivo($event)" /></label>
          </fieldset>
        }
        @if (error(); as e) {
          <p class="tp__error" role="alert">{{ e }}</p>
        }
      </div>
    } @else if (errorCarga(); as e) {
      <p class="tp__error" role="alert">{{ e }}</p>
    } @else {
      <dynadrill-text variant="body">Cargando…</dynadrill-text>
    }
    <footer class="tp__acciones">
      <dynadrill-button variant="secondary" (clicked)="cerrar()">Cerrar</dynadrill-button>
      @if (puedeEnviar()) {
        <dynadrill-button [disabled]="!!problema() || enviando()" (clicked)="firmar()">{{ enviando() ? 'Subiendo…' : 'Subir firma del Company Man' }}</dynadrill-button>
      }
    </footer>
  `,
  styles: `
    .tp { display: flex; flex-direction: column; gap: 14px; }
    .tp__cabecera { display: flex; gap: 8px; }
    .tp__aviso { background: #fff7e6; border: 1px solid #ffd591; border-radius: 6px; padding: 8px 12px; font-size: 13px; }
    .tp__tabla { width: 100%; border-collapse: collapse; font-size: 14px; }
    .tp__tabla th, .tp__tabla td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ecebf1; }
    .tp__tabla th { font-weight: 600; color: #5c5870; }
    .tp__meta { font-size: 12px; color: #5c5870; }
    .tp__totales { margin: 0; display: flex; flex-direction: column; gap: 4px; max-width: 360px; margin-left: auto; }
    .tp__totales div { display: flex; justify-content: space-between; gap: 16px; }
    .tp__totales dt { color: #5c5870; }
    .tp__totales dd { margin: 0; }
    .tp__neto { font-weight: 700; border-top: 1px solid #ecebf1; padding-top: 4px; }
    .tp__bloque { border: 1px solid #ecebf1; border-radius: 8px; padding: 8px 12px 12px; display: flex; flex-direction: column; gap: 10px; }
    .tp__bloque legend { padding: 0 6px; font-weight: 600; }
    .tp__campo { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
    .tp__campo input { font: inherit; }
    .tp__error { margin: 0; font-size: 13px; color: #cf1322; }
    .tp__acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ecebf1; }
  `,
})
export class TicketPrefacturaDialog {
  private readonly prefacturas = inject(PrefacturasComercialService);
  private readonly archivos = inject(ArchivosService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<TicketPrefacturaDialog, boolean>);
  protected readonly data = inject<TicketPrefacturaDialogData>(NZ_MODAL_DATA);

  protected readonly vista = signal<VistaPrefacturaTicket | null>(null);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly dinero = formatoMoneda;
  protected readonly maxFecha = hoy();

  protected readonly nombre = signal('');
  protected readonly cargo = signal('');
  protected readonly fecha = signal(hoy());
  private readonly archivo = signal<File | null>(null);

  /** La firma solo se sube con la documentación completa y mientras la prefactura no esté firmada. */
  protected readonly puedeEnviar = computed(() => {
    const v = this.vista();
    return this.data.puedeFirmar && !!v && v.avance.completo && v.prefactura.estado !== 'firmada';
  });
  protected readonly problema = computed(() => {
    if (this.nombre().trim().length < 2) return 'Escriba el nombre del Company Man.';
    if (!this.fecha()) return 'Indique la fecha de la firma.';
    const a = this.archivo();
    if (!a) return 'Adjunte el documento firmado.';
    if (a.size > MAX_BYTES_FIRMA) return 'El documento supera los 25 MB.';
    return null;
  });

  constructor() {
    this.prefacturas.vistaDelTicket(this.data.pedidoId).subscribe({
      next: v => this.vista.set(v),
      error: err => this.errorCarga.set(mensajeErrorPrefactura(err, 'No se pudo cargar la prefactura.')),
    });
  }

  protected alElegirArchivo(e: Event): void {
    this.archivo.set((e.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected firmar(): void {
    const archivo = this.archivo();
    if (this.problema() || !archivo || this.enviando()) return;
    this.error.set(null);
    this.enviando.set(true);
    let subido = false;
    this.archivos
      .subir(archivo, MODULO_ARCHIVO_COMPANY_MAN)
      .pipe(
        switchMap(a => {
          subido = true;
          return this.prefacturas.firmarDesdeTicket(this.data.pedidoId, {
            nombre: this.nombre().trim(),
            cargo: this.cargo().trim() || undefined,
            firmadoAt: new Date(`${this.fecha()}T12:00:00`).toISOString(),
            archivoId: a.id,
          });
        }),
      )
      .subscribe({
        next: () => {
          this.notify.success('Prefactura firmada', 'Quedó registrada la firma del Company Man.');
          this.modalRef.close(true);
        },
        error: err => {
          this.enviando.set(false);
          this.error.set(subido ? mensajeErrorPrefactura(err, 'El documento se subió, pero no se pudo registrar la firma.') : mensajeErrorArchivo(err));
        },
      });
  }

  protected cerrar(): void {
    this.modalRef.close(false);
  }
}
