import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DynadrillButtonComponent } from '@digitec-it-projects/dynadrill-ui';
import {
  armarEnvio,
  faltaPorResponder,
  mensajeErrorEncuesta,
  type EncuestaPublica,
  type PreguntaPublica,
  type RespuestasEnCurso,
} from '../models/encuestas.model';
import { EncuestasService } from '../services/encuestas.service';

type Estado = 'cargando' | 'lista' | 'enviada' | 'no_disponible';

/**
 * Formulario de la encuesta de satisfacción: el cliente lo abre con el enlace de su correo, sin iniciar sesión. El enlace sirve una sola
 * vez y vence al día; si ya no sirve se explica con el mensaje del servidor. Lo contestado se guarda en la base.
 */
@Component({
  selector: 'app-encuesta-publica-page',
  imports: [DatePipe, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'enc' },
  template: `
    <main class="enc__hoja">
      <header class="enc__encabezado">
        <span class="enc__marca">Dynadrill</span>
        <h1 class="enc__titulo">{{ encuesta()?.titulo ?? 'Encuesta de satisfacción' }}</h1>
      </header>

      @switch (estado()) {
        @case ('cargando') {
          <p class="enc__aviso" role="status">Cargando la encuesta…</p>
        }
        @case ('no_disponible') {
          <p class="enc__aviso enc__aviso--error" role="alert">{{ mensajeNoDisponible() }}</p>
        }
        @case ('enviada') {
          <p class="enc__aviso enc__aviso--ok" role="status">
            Gracias por responder la encuesta. Su opinión nos ayuda a mejorar el servicio.
          </p>
        }
        @case ('lista') {
          @if (encuesta(); as e) {
            @if (e.introduccion) {
              <p class="enc__intro">{{ e.introduccion }}</p>
            }
            <p class="enc__vence">
              Este enlace es de un solo uso y vale hasta el
              {{ e.venceAt | date: 'dd/MM/yyyy HH:mm' }}.
            </p>

            <form class="enc__form" (submit)="enviar($event)" novalidate>
              <div class="enc__datos">
                <label class="enc__campo">
                  <span>Su nombre <abbr title="obligatorio">*</abbr></span>
                  <input
                    type="text"
                    maxlength="120"
                    autocomplete="name"
                    [value]="nombre()"
                    (input)="nombre.set($any($event.target).value)"
                  />
                </label>
                <label class="enc__campo">
                  <span>Su cargo</span>
                  <input
                    type="text"
                    maxlength="120"
                    autocomplete="organization-title"
                    [value]="cargo()"
                    (input)="cargo.set($any($event.target).value)"
                  />
                </label>
              </div>

              @for (p of e.preguntas; track p.id; let i = $index) {
                <fieldset class="enc__pregunta">
                  <legend>
                    {{ i + 1 }}. {{ p.texto }}
                    @if (p.obligatoria) {
                      <abbr title="obligatoria">*</abbr>
                    }
                  </legend>

                  @switch (p.tipo) {
                    @case ('escala') {
                      <div class="enc__opciones enc__opciones--escala">
                        @for (v of p.escala ?? []; track v.valor) {
                          <label class="enc__opcion">
                            <input
                              type="radio"
                              [name]="p.id"
                              [checked]="respuestas()[p.id] === v.valor"
                              (change)="poner(p.id, v.valor)"
                            />
                            <span>{{ v.valor }} — {{ v.etiqueta }}</span>
                          </label>
                        }
                      </div>
                    }
                    @case ('texto') {
                      <textarea
                        rows="3"
                        maxlength="2000"
                        [attr.aria-label]="p.texto"
                        [value]="textoDe(p)"
                        (input)="poner(p.id, $any($event.target).value)"
                      ></textarea>
                    }
                    @case ('si_no') {
                      <div class="enc__opciones">
                        <label class="enc__opcion">
                          <input
                            type="radio"
                            [name]="p.id"
                            [checked]="respuestas()[p.id] === true"
                            (change)="poner(p.id, true)"
                          />
                          <span>Sí</span>
                        </label>
                        <label class="enc__opcion">
                          <input
                            type="radio"
                            [name]="p.id"
                            [checked]="respuestas()[p.id] === false"
                            (change)="poner(p.id, false)"
                          />
                          <span>No</span>
                        </label>
                      </div>
                    }
                    @case ('opcion_unica') {
                      <div class="enc__opciones">
                        @for (o of p.opciones; track o.id) {
                          <label class="enc__opcion">
                            <input
                              type="radio"
                              [name]="p.id"
                              [checked]="respuestas()[p.id] === o.id"
                              (change)="poner(p.id, o.id)"
                            />
                            <span>{{ o.etiqueta }}</span>
                          </label>
                        }
                      </div>
                    }
                    @case ('opcion_multiple') {
                      <div class="enc__opciones">
                        @for (o of p.opciones; track o.id) {
                          <label class="enc__opcion">
                            <input
                              type="checkbox"
                              [checked]="elegida(p, o.id)"
                              (change)="alternar(p.id, o.id, $any($event.target).checked)"
                            />
                            <span>{{ o.etiqueta }}</span>
                          </label>
                        }
                      </div>
                    }
                  }
                </fieldset>
              }

              @if (error(); as m) {
                <p class="enc__aviso enc__aviso--error" role="alert">{{ m }}</p>
              }

              <div class="enc__acciones">
                <dynadrill-button [disabled]="enviando()" (clicked)="enviar()">{{
                  enviando() ? 'Enviando…' : 'Enviar respuestas'
                }}</dynadrill-button>
              </div>
            </form>
          }
        }
      }
    </main>
  `,
  styleUrl: './encuesta-publica-page.scss',
})
export class EncuestaPublicaPage {
  private readonly servicio = inject(EncuestasService);
  private readonly token = inject(ActivatedRoute).snapshot.paramMap.get('token') ?? '';

  protected readonly estado = signal<Estado>('cargando');
  protected readonly encuesta = signal<EncuestaPublica | null>(null);
  protected readonly mensajeNoDisponible = signal('');
  protected readonly nombre = signal('');
  protected readonly cargo = signal('');
  protected readonly respuestas = signal<RespuestasEnCurso>({});
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly falta = computed(() => {
    const e = this.encuesta();
    return e ? faltaPorResponder(this.nombre(), e.preguntas, this.respuestas()) : null;
  });

  constructor() {
    this.servicio.publica(this.token).subscribe({
      next: (e) => {
        this.encuesta.set(e);
        this.estado.set('lista');
      },
      error: (err) => {
        this.mensajeNoDisponible.set(
          mensajeErrorEncuesta(err, 'No se pudo abrir la encuesta. Intente de nuevo más tarde.'),
        );
        this.estado.set('no_disponible');
      },
    });
  }

  protected poner(preguntaId: string, valor: RespuestasEnCurso[string]): void {
    this.respuestas.update((r) => ({ ...r, [preguntaId]: valor }));
    this.error.set(null);
  }

  protected textoDe(p: PreguntaPublica): string {
    const v = this.respuestas()[p.id];
    return typeof v === 'string' ? v : '';
  }

  protected elegida(p: PreguntaPublica, opcionId: string): boolean {
    const v = this.respuestas()[p.id];
    return Array.isArray(v) && v.includes(opcionId);
  }

  protected alternar(preguntaId: string, opcionId: string, marcada: boolean): void {
    const actual = this.respuestas()[preguntaId];
    const lista = Array.isArray(actual) ? actual : [];
    this.poner(preguntaId, marcada ? [...lista, opcionId] : lista.filter((x) => x !== opcionId));
  }

  protected enviar(evento?: Event): void {
    evento?.preventDefault();
    const e = this.encuesta();
    if (!e || this.enviando()) return;
    const falta = this.falta();
    if (falta) {
      this.error.set(falta);
      return;
    }
    this.enviando.set(true);
    this.error.set(null);
    this.servicio
      .responder(
        this.token,
        armarEnvio(this.nombre(), this.cargo(), e.preguntas, this.respuestas()),
      )
      .subscribe({
        next: () => this.estado.set('enviada'),
        error: (err) => {
          this.enviando.set(false);
          // 410: ya respondida o vencida; el enlace ya no sirve
          if ((err as { status?: number }).status === 410) {
            this.mensajeNoDisponible.set(
              mensajeErrorEncuesta(err, 'Este enlace ya no está disponible.'),
            );
            this.estado.set('no_disponible');
            return;
          }
          this.error.set(
            mensajeErrorEncuesta(err, 'No se pudo enviar la encuesta. Intente de nuevo.'),
          );
        },
      });
  }
}
