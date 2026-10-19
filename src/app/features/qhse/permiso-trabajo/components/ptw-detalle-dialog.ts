import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillStepperComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import {
  MotivoDialog,
  type MotivoDialogData,
} from '../../../../shared/components/motivo-dialog/motivo-dialog';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';
import { DocumentosPedidoService } from '../../documentos-pedido/services/documentos-pedido.service';
import {
  ACCION_PTW_ETIQUETA,
  CONFIRMACION_ETIQUETA,
  CONFIRMACIONES,
  FASE_PTW_ETIQUETA,
  PASOS_PTW,
  PERMISO_PTW_APROBAR,
  PERMISO_PTW_GESTIONAR,
  faltantesDeGabinete,
  pasoDe,
  type PtwDetalle,
  type TipoConfirmacion,
} from '../models/permiso-trabajo';
import { PermisoTrabajoService } from '../services/permiso-trabajo.service';

export interface PtwDetalleDialogData {
  ptwId: string;
}

/** Detalle de un PTW: documentos de la gabinete, confirmaciones de la formalización, aprobación de QHSE, anulación e historial. */
@Component({
  selector: 'app-ptw-detalle-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [
    DatePipe,
    DynadrillButtonComponent,
    DynadrillStepperComponent,
    DynadrillTagComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ptw(); as p) {
      <header class="pd__cab">
        <div>
          <strong>{{ p.codigo }}</strong> · {{ p.pedidoCodigo }} · Ticket
          {{ p.ticketNumero ?? '—' }}
          <div class="pd__meta">
            {{ p.cliente ?? '—' }} · {{ p.campo ?? '—' }} / {{ p.pozo ?? '—' }}
          </div>
          <div class="pd__meta">
            Día de operación: {{ p.diaOperacion | date: 'dd/MM/yyyy' }} · Supervisor:
            {{ p.supervisor?.nombre ?? 'sin asignar' }}
          </div>
        </div>
        @if (p.anulado) {
          <dynadrill-tag variant="neutral">Anulado</dynadrill-tag>
        } @else {
          <dynadrill-tag [variant]="p.fase === 'aprobado' ? 'success' : 'brand'">{{
            faseEtiqueta[p.fase]
          }}</dynadrill-tag>
        }
      </header>

      @if (p.anulado) {
        <p class="pd__aviso">Anulado por {{ p.anuladoPor }}: {{ p.motivoAnulacion }}</p>
      }

      <dynadrill-stepper [steps]="pasos" [currentIndex]="paso()" />

      <h4 class="pd__tit">1. Gabinete: documentos del pedido</h4>
      <ul class="pd__lista">
        @for (r of p.requisitos; track r.tipo) {
          <li>
            <span>{{ r.documentoId ? '✔' : '✘' }} {{ r.nombre }}</span>
            @if (r.archivoId) {
              <dynadrill-button variant="secondary" (clicked)="abrirArchivo(r.archivoId)"
                >Ver</dynadrill-button
              >
            } @else {
              <span class="pd__falta">{{ r.falta }}</span>
            }
          </li>
        }
      </ul>
      @if (p.fase === 'gabinete' && !p.anulado && puedeGestionar()) {
        <dynadrill-button [disabled]="faltantes().length > 0 || trabajando()" (clicked)="validar()"
          >Validar documentos y pasar a formalización</dynadrill-button
        >
      }

      @if (p.matricesIperc.length) {
        <h4 class="pd__tit">Matrices IPERC de las actividades del servicio</h4>
        <ul class="pd__lista">
          @for (m of p.matricesIperc; track m.actividadId) {
            <li>
              <span>{{ m.matrizId ? '✔' : '✘' }} {{ m.actividad }}</span>
              @if (m.matrizId) {
                <span class="pd__meta"
                  >{{ m.codigo }} · vale hasta {{ m.vigenteHasta | date: 'dd/MM/yyyy' }}</span
                >
              } @else {
                <span class="pd__falta">{{ m.falta }}</span>
              }
            </li>
          }
        </ul>
      }

      <h4 class="pd__tit">2. Formalización</h4>
      <ul class="pd__lista">
        @for (c of confirmaciones; track c) {
          <li>
            <span>{{ firmaDe(c) ? '✔' : '○' }} {{ etiqueta[c] }}</span>
            @if (firmaDe(c); as f) {
              <span class="pd__meta"
                >{{ f.nombre }} · {{ f.firmadoAt | date: 'dd/MM/yyyy HH:mm' }}</span
              >
            } @else if (p.fase === 'formalizacion' && !p.anulado && puedeGestionar()) {
              <dynadrill-button
                variant="secondary"
                [disabled]="trabajando()"
                (clicked)="confirmar(c)"
                >Confirmar</dynadrill-button
              >
            }
          </li>
        }
      </ul>

      <h4 class="pd__tit">3. Aprobación de QHSE</h4>
      @if (firmaDe('aprobacion'); as f) {
        <p class="pd__meta">
          ✔ Aprobado por {{ f.nombre }} · {{ f.firmadoAt | date: 'dd/MM/yyyy HH:mm' }}
        </p>
      } @else if (p.fase === 'aprobacion' && !p.anulado && puedeAprobar()) {
        <dynadrill-button [disabled]="trabajando()" (clicked)="aprobar()"
          >Aprobar PTW</dynadrill-button
        >
      } @else {
        <p class="pd__meta">Se habilita cuando la formalización está completa.</p>
      }

      <h4 class="pd__tit">Historial</h4>
      <ul class="pd__hist">
        @for (h of p.historial; track h.at) {
          <li>
            {{ h.at | date: 'dd/MM/yyyy HH:mm' }} · {{ acciones[h.accion] }} · {{ h.actor }}
            @if (h.motivo) {
              — {{ h.motivo }}
            }
          </li>
        }
      </ul>

      <footer class="pd__pie">
        @if (!p.anulado && puedeAprobar()) {
          <dynadrill-button variant="secondary" (clicked)="anular()">Anular PTW</dynadrill-button>
        }
        <dynadrill-button variant="secondary" (clicked)="cerrar()">Cerrar</dynadrill-button>
      </footer>
    } @else {
      <dynadrill-text variant="caption">Consultando…</dynadrill-text>
    }
  `,
  styles: `
    .pd__cab {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .pd__meta {
      font-size: 12px;
      color: #6b6a77;
      margin-top: 2px;
    }
    .pd__aviso {
      background: #fff4e5;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 13px;
    }
    .pd__tit {
      margin: 16px 0 6px;
      font-size: 14px;
    }
    .pd__lista {
      list-style: none;
      margin: 0 0 8px;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .pd__lista li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .pd__falta {
      font-size: 12px;
      color: #b42318;
      text-align: right;
      max-width: 60%;
    }
    .pd__hist {
      margin: 0;
      padding-left: 18px;
      font-size: 12px;
      color: #6b6a77;
    }
    .pd__pie {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #ecebf1;
    }
  `,
})
export class PtwDetalleDialog {
  private readonly data = inject<PtwDetalleDialogData>(NZ_MODAL_DATA);
  private readonly servicio = inject(PermisoTrabajoService);
  private readonly documentos = inject(DocumentosPedidoService);
  private readonly dialogos = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<PtwDetalleDialog, boolean | undefined>);

  protected readonly pasos = PASOS_PTW;
  protected readonly confirmaciones = CONFIRMACIONES;
  protected readonly etiqueta = CONFIRMACION_ETIQUETA;
  protected readonly faseEtiqueta = FASE_PTW_ETIQUETA;
  protected readonly acciones = ACCION_PTW_ETIQUETA;
  protected readonly ptw = signal<PtwDetalle | null>(null);
  protected readonly trabajando = signal(false);
  protected readonly puedeGestionar = computed(() => this.auth.can(PERMISO_PTW_GESTIONAR));
  protected readonly puedeAprobar = computed(() => this.auth.can(PERMISO_PTW_APROBAR));
  protected readonly paso = computed(() => {
    const p = this.ptw();
    return p ? pasoDe(p.fase) : 0;
  });
  protected readonly faltantes = computed(() => {
    const p = this.ptw();
    return p ? faltantesDeGabinete(p) : [];
  });
  private huboCambio = false;

  constructor() {
    this.servicio.detalle(this.data.ptwId).subscribe({
      next: (p) => this.ptw.set(p),
      error: (err) => {
        this.notify.error('Error', mensajeDeError(err, 'No se pudo cargar el PTW.'));
        this.modalRef.close();
      },
    });
  }

  protected firmaDe(tipo: TipoConfirmacion | 'aprobacion') {
    return this.ptw()?.firmas.find((f) => f.tipo === tipo) ?? null;
  }

  protected validar(): void {
    this.ejecutar(
      this.servicio.validarDocumentos(this.data.ptwId),
      'Documentos validados. El PTW pasó a formalización.',
    );
  }

  protected confirmar(tipo: TipoConfirmacion): void {
    this.ejecutar(this.servicio.confirmar(this.data.ptwId, tipo), 'Confirmación registrada.');
  }

  protected aprobar(): void {
    this.ejecutar(this.servicio.aprobar(this.data.ptwId), 'PTW aprobado.');
  }

  protected anular(): void {
    const ref = this.dialogos.open<MotivoDialog, MotivoDialogData>({
      title: 'Anular PTW',
      content: MotivoDialog,
      data: {
        mensaje:
          'El día queda libre para abrir otro PTW y sus documentos pueden anularse. ¿Por qué se anula?',
        label: 'Motivo de la anulación',
      },
      footer: false,
      width: '480px',
    });
    ref.afterClose.subscribe((motivo: string | undefined) => {
      if (motivo) this.ejecutar(this.servicio.anular(this.data.ptwId, motivo), 'PTW anulado.');
    });
  }

  protected abrirArchivo(archivoId: string): void {
    this.documentos.abrir(archivoId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (err) =>
        this.notify.error(
          'No se pudo abrir',
          mensajeDeError(err, 'No se pudo abrir el documento.'),
        ),
    });
  }

  protected cerrar(): void {
    this.modalRef.close(this.huboCambio);
  }

  private ejecutar(llamada: ReturnType<PermisoTrabajoService['aprobar']>, exito: string): void {
    if (this.trabajando()) return;
    this.trabajando.set(true);
    llamada.subscribe({
      next: (p) => {
        this.ptw.set(p);
        this.huboCambio = true;
        this.trabajando.set(false);
        this.notify.success('Listo', exito);
      },
      error: (err) => {
        this.trabajando.set(false);
        this.notify.error('No se pudo', mensajeDeError(err, 'No se pudo completar la acción.'));
      },
    });
  }
}
