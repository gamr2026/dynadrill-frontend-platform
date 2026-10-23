import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillSkeletonComponent,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../core/services/auth.service';
import { mensajeError } from '../../roles-permisos/models/roles-permisos.model';
import {
  METODO_ETIQUETA,
  PERMISOS_FIRMAS,
  estadoDeVerificacion,
  huellaCorta,
  ordenarEvidencia,
  sePuedeVerificar,
  type FirmaEvidencia,
} from '../models/firmas.model';
import { FirmasService } from '../services/firmas.service';

/**
 * Evidencia de firma de un documento: quién firmó en cada papel, cuándo (hora del servidor), cómo y con qué huella; la historia de
 * correcciones y, en las firmas manuscritas, la lectura del archivo firmado. Se incrusta en la pantalla del documento (PTW, IPERC,
 * inspección...) y solo la ve quien tiene `firmas.evidencia.ver`: para los demás no muestra nada.
 */
@Component({
  selector: 'app-evidencia-firmas',
  imports: [DatePipe, DynadrillButtonComponent, DynadrillSkeletonComponent, DynadrillTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (puedeVer()) {
      <section class="evidencia" aria-label="Evidencia de firma">
        @if (cargando()) {
          <dynadrill-skeleton variant="block" height="64px" />
        } @else if (error(); as e) {
          <p class="evidencia__error" role="alert">{{ e }}</p>
          <dynadrill-button variant="secondary" size="small" (clicked)="cargar()"
            >Reintentar</dynadrill-button
          >
        } @else if (firmas().length === 0) {
          <p class="evidencia__vacio">Este documento todavía no tiene firmas registradas.</p>
        } @else {
          <ul class="evidencia__lista">
            @for (f of firmas(); track f.id) {
              <li class="evidencia__item" [class.evidencia__item--historia]="!f.vigente">
                <div class="evidencia__cabecera">
                  <strong>{{ f.rolFirmante.descripcion }}</strong>
                  <dynadrill-tag
                    [label]="f.vigente ? 'Vigente' : 'Reemplazada'"
                    [variant]="f.vigente ? 'success' : 'neutral'"
                    [uppercase]="false"
                  />
                  <dynadrill-tag [label]="metodo(f)" variant="neutral" [uppercase]="false" />
                </div>
                <span class="evidencia__meta">
                  {{ f.firmante.nombre }} ·
                  {{ f.firmadaAt | date: 'dd/MM/yyyy HH:mm:ss' : '' : 'es' }}
                </span>
                @if (f.hashDocumento) {
                  <span class="evidencia__huella" [title]="f.hashDocumento"
                    >Huella del texto firmado: <code>{{ corta(f.hashDocumento) }}</code></span
                  >
                }
                @if (f.archivo; as a) {
                  <span class="evidencia__huella" [title]="a.sha256">
                    Archivo: {{ a.nombre }} · huella <code>{{ corta(a.sha256) }}</code>
                  </span>
                  <div class="evidencia__lectura">
                    <dynadrill-tag
                      [label]="estado(f).texto"
                      [variant]="estado(f).tono"
                      [uppercase]="false"
                    />
                    @if (f.verificacion; as v) {
                      <span class="evidencia__meta">
                        {{ v.verificadaAt | date: 'dd/MM/yyyy HH:mm' : '' : 'es' }} ·
                        {{ v.solicitadaPor.nombre }}
                      </span>
                    }
                    @if (puedeVerificar() && verificable(f)) {
                      <dynadrill-button
                        variant="secondary"
                        size="small"
                        [disabled]="verificando() === f.id"
                        (clicked)="verificar(f)"
                      >
                        {{ f.verificacion ? 'Volver a leer la firma' : 'Leer la firma' }}
                      </dynadrill-button>
                    }
                  </div>
                }
              </li>
            }
          </ul>
        }
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .evidencia__lista {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .evidencia__item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px;
      border: var(--border-width, 1px) solid var(--border, #e5e4ea);
      border-left: 4px solid var(--dynadrill-purple, #662e9b);
      border-radius: var(--radius-sm, 8px);
    }
    .evidencia__item--historia {
      border-left-color: var(--border, #e5e4ea);
      opacity: 0.8;
    }
    .evidencia__cabecera {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .evidencia__meta,
    .evidencia__huella,
    .evidencia__vacio {
      color: var(--text-muted, #5c5870);
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    .evidencia__vacio {
      margin: 0;
    }
    .evidencia__error {
      margin: 0 0 8px;
      color: var(--error, #cf1322);
      font-size: 14px;
    }
    .evidencia__lectura {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
  `,
})
export class EvidenciaFirmas {
  private readonly servicio = inject(FirmasService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);

  /** Código del documento en el catálogo de Firmas (`qhse_ptw`, `fcr_inspeccion`...). */
  readonly documentoTipo = input.required<string>();
  readonly documentoId = input.required<string>();

  protected readonly puedeVer = computed(() => this.auth.can(PERMISOS_FIRMAS.ver));
  protected readonly puedeVerificar = computed(() => this.auth.can(PERMISOS_FIRMAS.verificar));
  protected readonly firmas = signal<FirmaEvidencia[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly verificando = signal<string | null>(null);

  protected readonly metodo = (f: FirmaEvidencia) => METODO_ETIQUETA[f.metodo];
  protected readonly estado = (f: FirmaEvidencia) => estadoDeVerificacion(f.verificacion);
  protected readonly verificable = sePuedeVerificar;
  protected readonly corta = huellaCorta;

  constructor() {
    effect(() => {
      this.documentoTipo();
      this.documentoId();
      if (this.puedeVer()) untracked(() => this.cargar());
    });
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.servicio.deDocumento(this.documentoTipo(), this.documentoId()).subscribe({
      next: (r) => {
        this.firmas.set(ordenarEvidencia(r.firmas));
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(
          mensajeError(err, 'No se pudo cargar la evidencia de firma. Intente de nuevo.'),
        );
      },
    });
  }

  protected verificar(f: FirmaEvidencia): void {
    if (this.verificando()) return;
    this.verificando.set(f.id);
    this.servicio.verificar(f.id).subscribe({
      next: (v) => {
        this.verificando.set(null);
        this.firmas.update((lista) =>
          lista.map((x) => (x.id === f.id ? { ...x, verificacion: v } : x)),
        );
      },
      error: (err) => {
        this.verificando.set(null);
        this.notify.error(
          'No se pudo leer la firma',
          mensajeError(err, 'La lectura de firmas no está disponible. Intente de nuevo.'),
        );
      },
    });
  }
}
