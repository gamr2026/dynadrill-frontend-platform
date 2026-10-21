import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { mensajeDeError } from '../../../../../shared/utils/mensaje-error.util';
import type { VersionTerminos } from '../../models/terminos';
import { TerminosQhseService } from '../../services/terminos-qhse.service';

/**
 * Términos y condiciones de uso de equipos (Pumping): QHSE valida el texto o publica una versión nueva. Las versiones ya aceptadas no se
 * editan nunca: lo que cada operador leyó queda como constancia. Una versión sin validar es un borrador.
 */
@Component({
  selector: 'app-terminos-page',
  imports: [
    DatePipe,
    PageHeader,
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="terminos">
      <app-page-header
        eyebrow="QHSE"
        title="Términos y condiciones"
        subtitle="QHSE valida el texto que aceptan los operadores antes de salir. Una versión sin validar es un borrador"
      />
      <dynadrill-spinner mode="overlay" [spinning]="cargando()" tip="Cargando…">
        @if (hayBorrador()) {
          <dynadrill-banner
            variant="warning"
            message="La versión vigente es un borrador: QHSE todavía no validó su texto. Valídela tal como está o publique una versión nueva."
          />
        }
        <section class="terminos__lista">
          @for (v of versiones(); track v.codigo) {
            <article class="terminos__version">
              <header class="terminos__cab">
                <strong>{{ v.titulo }}</strong>
                <span class="terminos__codigo">{{ v.codigo }}</span>
                @if (v.vigente) {
                  <dynadrill-tag label="Vigente" variant="brand" [uppercase]="false" />
                }
                <dynadrill-tag
                  [label]="v.validada ? 'Validada por ' + v.validadoPor : 'Borrador sin validar'"
                  [variant]="v.validada ? 'success' : 'warning'"
                  [uppercase]="false"
                />
                <span class="terminos__meta"
                  >Publicada el {{ v.publicadoAt | date: 'dd/MM/yyyy HH:mm' }}</span
                >
              </header>
              <pre class="terminos__texto">{{ v.texto }}</pre>
              @if (!v.validada) {
                <dynadrill-button [disabled]="trabajando()" (clicked)="validar(v)"
                  >Validar este texto</dynadrill-button
                >
              }
            </article>
          }
        </section>
        <section class="terminos__nueva">
          <h2>Publicar una versión nueva</h2>
          <p class="terminos__meta">
            Queda validada por usted y pasa a ser la vigente. La versión anterior se conserva con
            sus aceptaciones.
          </p>
          <dynadrill-input label="Título" [value]="titulo()" (valueChange)="titulo.set($event)" />
          <label class="terminos__area">
            <span>Texto</span>
            <textarea
              rows="12"
              [value]="texto()"
              (input)="texto.set($any($event.target).value)"
            ></textarea>
          </label>
          <dynadrill-button [disabled]="!puedePublicar() || trabajando()" (clicked)="publicar()"
            >Publicar versión</dynadrill-button
          >
        </section>
      </dynadrill-spinner>
    </div>
  `,
  styles: `
    .terminos {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .terminos__lista {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .terminos__version,
    .terminos__nueva {
      background: var(--surface, #fff);
      border: 1px solid #ecebf1;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .terminos__cab {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .terminos__codigo,
    .terminos__meta {
      font-size: 12px;
      color: #6b6a77;
    }
    .terminos__texto {
      margin: 0;
      white-space: pre-wrap;
      font: inherit;
      font-size: 13px;
      max-height: 220px;
      overflow: auto;
    }
    .terminos__area {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
    }
    .terminos__area textarea {
      font: inherit;
      padding: 8px;
      border: 1px solid #d8d4e0;
      border-radius: 8px;
    }
  `,
})
export class TerminosPage {
  private readonly servicio = inject(TerminosQhseService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly dialog = inject(DynadrillDialogService);

  protected readonly cargando = signal(true);
  protected readonly trabajando = signal(false);
  protected readonly versiones = signal<VersionTerminos[]>([]);
  protected readonly titulo = signal('');
  protected readonly texto = signal('');
  protected readonly hayBorrador = computed(() =>
    this.versiones().some((v) => v.vigente && !v.validada),
  );
  protected readonly puedePublicar = computed(
    () => this.titulo().trim().length >= 5 && this.texto().trim().length >= 50,
  );

  constructor() {
    this.servicio.versiones().subscribe({
      next: (v) => {
        this.versiones.set(v);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudieron cargar los términos.'));
      },
    });
  }

  protected async validar(v: VersionTerminos): Promise<void> {
    const ok = await this.dialog.confirm({
      title: `¿Validar ${v.codigo}?`,
      content: 'Queda registrado que QHSE validó este texto tal como está. No se podrá editar.',
      okText: 'Validar',
    });
    if (!ok) return;
    this.trabajando.set(true);
    this.servicio.validar(v.codigo).subscribe({
      next: (lista) => this.terminar(lista, 'Texto validado'),
      error: (err) => this.fallar(err, 'No se pudo validar el texto.'),
    });
  }

  protected async publicar(): Promise<void> {
    const ok = await this.dialog.confirm({
      title: '¿Publicar la versión nueva?',
      content: 'Pasará a ser la vigente y quedará validada por usted. La anterior se conserva.',
      okText: 'Publicar',
    });
    if (!ok) return;
    this.trabajando.set(true);
    this.servicio.publicar(this.titulo().trim(), this.texto().trim()).subscribe({
      next: (lista) => {
        this.titulo.set('');
        this.texto.set('');
        this.terminar(lista, 'Versión publicada');
      },
      error: (err) => this.fallar(err, 'No se pudo publicar la versión.'),
    });
  }

  private terminar(lista: VersionTerminos[], mensaje: string): void {
    this.trabajando.set(false);
    this.versiones.set(lista);
    this.notify.success(mensaje);
  }

  private fallar(err: unknown, porDefecto: string): void {
    this.trabajando.set(false);
    this.notify.error('Error', mensajeDeError(err, porDefecto));
  }
}
