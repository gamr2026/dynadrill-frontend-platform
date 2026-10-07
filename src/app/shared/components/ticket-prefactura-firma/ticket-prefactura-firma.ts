import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import type { NzUploadFile } from 'ng-zorro-antd/upload';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillUploadZoneComponent,
} from '@digitec-it-projects/dynadrill-ui';
import type { LineaTicketPrefactura, TicketPrefacturaVista } from '../../models/ticket-prefactura.model';
import { TicketPrefacturaService } from '../../services/ticket-prefactura.service';

/**
 * En la etapa final del ticket, el Supervisor carga acá el documento de la prefactura FIRMADO por el Company Man (un archivo:
 * PDF o foto). Al cargarlo, la prefactura queda firmada para Facturación. La prefactura se ve e imprime con el botón
 * «Ver prefactura» de la parte superior del ticket.
 */
@Component({
  selector: 'app-ticket-prefactura-firma',
  imports: [
    DatePipe,
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
    DynadrillUploadZoneComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tpf-firma">
      <h3 class="tpf-firma__titulo">Prefactura firmada por el Company Man</h3>

      @if (cargando()) {
        <dynadrill-spinner />
      } @else if (!vista()) {
        <dynadrill-banner variant="info" message="No se pudo consultar el estado de la prefactura de este ticket." />
      } @else {
        @let v = vista()!;
        @if (v.prefactura.estado === 'firmada' && v.firmaCompanyMan; as f) {
          <div class="tpf-firma__ok">
            <dynadrill-tag label="Firmada" variant="success" />
            <span>
              Firmada por {{ f.nombre }} ({{ f.cargo }}) el {{ f.firmadoAt | date: 'dd/MM/yyyy HH:mm' }}. Facturación ya la ve cargada y firmada.
            </span>
          </div>
        } @else if (v.puedeFirmar) {
          <p class="tpf-firma__nota">
            Imprime la prefactura con <strong>«Ver prefactura»</strong> (arriba), que el Company Man la firme y carga aquí el documento firmado. Al
            finalizar el ticket, Facturación la verá cargada y firmada.
          </p>
          <dynadrill-input label="Nombre de quien firma" [value]="nombre()" (valueChange)="nombre.set($event)" />
          <dynadrill-upload-zone [state]="archivo() ? 'uploaded' : 'idle'" [fileName]="archivo()?.name ?? ''" (fileSelected)="onArchivo($event)" />
          <div class="tpf-firma__acciones">
            <dynadrill-button [disabled]="!puedeCargar()" (clicked)="cargar()">
              {{ enviando() ? 'Cargando…' : 'Cargar prefactura firmada' }}
            </dynadrill-button>
          </div>
        } @else {
          <dynadrill-banner variant="info" [message]="v.motivoNoFirma ?? 'Todavía no se puede cargar la prefactura firmada.'" />
        }
      }
    </section>
  `,
  styles: `
    .tpf-firma {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 16px;
      padding: 16px;
      border: 1px solid var(--border, #e5e4ea);
      border-radius: 12px;
      background: var(--surface, #fff);
    }

    .tpf-firma__titulo {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
    }

    .tpf-firma__nota {
      margin: 0;
      font-size: 13px;
      line-height: 1.5;
      color: var(--text-muted, #5c5870);
    }

    .tpf-firma__ok {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      font-size: 14px;
    }

    .tpf-firma__acciones {
      display: flex;
      justify-content: flex-start;
    }
  `,
})
export class TicketPrefacturaFirma {
  private readonly service = inject(TicketPrefacturaService);
  private readonly notify = inject(DynadrillNotificationService);

  readonly linea = input.required<LineaTicketPrefactura>();
  readonly ticketId = input.required<number>();
  /** Se emite al quedar registrada la firma (para refrescar lo que dependa de ella). */
  readonly firmada = output<void>();

  protected readonly cargando = signal(true);
  protected readonly vista = signal<TicketPrefacturaVista | null>(null);
  protected readonly nombre = signal('');
  protected readonly archivo = signal<File | null>(null);
  protected readonly enviando = signal(false);
  protected readonly puedeCargar = computed(() => !!this.archivo() && this.nombre().trim().length > 0 && !this.enviando());

  constructor() {
    effect(() => {
      this.linea();
      this.ticketId();
      untracked(() => this.refrescar());
    });
  }

  private refrescar(): void {
    this.cargando.set(true);
    this.service.ver(this.linea(), this.ticketId()).subscribe({
      next: v => {
        this.vista.set(v);
        if (!this.nombre()) this.nombre.set(v.pedido.representanteCampo || 'Company Man');
        this.cargando.set(false);
      },
      error: () => {
        this.vista.set(null);
        this.cargando.set(false);
      },
    });
  }

  protected onArchivo(file: NzUploadFile): void {
    this.archivo.set((file.originFileObj as File | undefined) ?? (file as unknown as File));
  }

  protected cargar(): void {
    const archivo = this.archivo();
    if (!archivo || !this.puedeCargar()) return;
    this.enviando.set(true);
    this.service.firmar(this.linea(), this.ticketId(), { nombre: this.nombre().trim(), cargo: 'Company Man' }, archivo).subscribe({
      next: () => {
        this.enviando.set(false);
        this.archivo.set(null);
        this.notify.success('Prefactura firmada', 'Quedó cargada la prefactura firmada por el Company Man; Facturación ya la ve firmada.');
        this.refrescar();
        this.firmada.emit();
      },
      error: (err: { error?: { message?: string } }) => {
        this.enviando.set(false);
        this.notify.error('No se pudo cargar la prefactura firmada', err?.error?.message ?? 'Inténtalo de nuevo.');
      },
    });
  }
}
