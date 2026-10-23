import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillTextareaComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import {
  ESTADO_VERSION_LABEL,
  PREGUNTA_NUEVA,
  TIPOS_RESPUESTA,
  TIPO_RESPUESTA_LABEL,
  aEditables,
  aEntrada,
  llevaOpciones,
  mensajeErrorEncuesta,
  validarPreguntas,
  type EscalaEncuesta,
  type PreguntaEditable,
  type TipoRespuesta,
  type VersionDetalle,
} from '../models/encuestas.model';
import { EncuestasService } from '../services/encuestas.service';

/**
 * Editor de una versión de la encuesta: el título, la introducción y las preguntas con su tipo de respuesta. Solo el borrador se edita;
 * una versión publicada se ve en solo lectura. Al publicar, la versión anterior queda archivada con lo que ya se respondió.
 */
@Component({
  selector: 'app-encuesta-editor-page',
  imports: [
    DatePipe,
    PageHeader,
    DynadrillButtonComponent,
    DynadrillCheckboxComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
    DynadrillTextareaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './encuesta-editor-page.html',
  styleUrl: './encuesta-editor-page.scss',
})
export class EncuestaEditorPage {
  private readonly servicio = inject(EncuestasService);
  private readonly router = inject(Router);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly versionId = inject(ActivatedRoute).snapshot.paramMap.get('versionId') ?? '';

  protected readonly cargando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly version = signal<VersionDetalle | null>(null);
  protected readonly escalas = signal<EscalaEncuesta[]>([]);

  protected readonly titulo = signal('');
  protected readonly introduccion = signal('');
  protected readonly preguntas = signal<PreguntaEditable[]>([]);
  /** Hay cambios sin guardar en el título, la introducción o las preguntas. */
  protected readonly sucio = signal(false);

  protected readonly editable = computed(() => this.version()?.estado === 'borrador');
  protected readonly estadoTexto = computed(() => {
    const v = this.version();
    return v ? ESTADO_VERSION_LABEL[v.estado] : '';
  });
  protected readonly problema = computed(() => {
    if (!this.titulo().trim()) return 'Escriba el título de la encuesta.';
    if (this.preguntas().length === 0) return 'Agregue al menos una pregunta.';
    return validarPreguntas(this.preguntas());
  });

  protected readonly tipoOpciones: DynadrillSelectOption[] = TIPOS_RESPUESTA.map((t) => ({
    label: TIPO_RESPUESTA_LABEL[t],
    value: t,
  }));
  protected readonly escalaOpciones = computed<DynadrillSelectOption[]>(() =>
    this.escalas().map((e) => ({
      label: `${e.nombre} (${e.valores.map((v) => v.valor).join(', ')})`,
      value: e.id,
    })),
  );
  protected readonly llevaOpciones = llevaOpciones;
  protected readonly tipoTexto = (t: TipoRespuesta): string => TIPO_RESPUESTA_LABEL[t];

  constructor() {
    this.servicio.escalas().subscribe({
      next: (e) => this.escalas.set(e),
      error: (err) =>
        this.error.set(mensajeErrorEncuesta(err, 'No se pudieron cargar las escalas.')),
    });
    this.recargar();
  }

  private recargar(): void {
    this.cargando.set(true);
    this.servicio.version(this.versionId).subscribe({
      next: (v) => {
        this.version.set(v);
        this.titulo.set(v.titulo);
        this.introduccion.set(v.introduccion ?? '');
        this.preguntas.set(aEditables(v.preguntas));
        this.sucio.set(false);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorEncuesta(err, 'No se pudo cargar la versión de la encuesta.'));
      },
    });
  }

  protected volver(): void {
    void this.router.navigate(['/encuestas']);
  }

  protected ponerTitulo(v: string): void {
    this.titulo.set(v);
    this.sucio.set(true);
  }

  protected ponerIntroduccion(v: string): void {
    this.introduccion.set(v);
    this.sucio.set(true);
  }

  private cambiar(i: number, cambio: Partial<PreguntaEditable>): void {
    this.preguntas.update((l) => l.map((p, k) => (k === i ? { ...p, ...cambio } : p)));
    this.sucio.set(true);
  }

  protected ponerTexto(i: number, texto: string): void {
    this.cambiar(i, { texto });
  }

  protected ponerObligatoria(i: number, obligatoria: boolean): void {
    this.cambiar(i, { obligatoria });
  }

  protected ponerTipo(i: number, valor: unknown): void {
    const tipo = valor as TipoRespuesta;
    if (!TIPOS_RESPUESTA.includes(tipo)) return;
    const actual = this.preguntas()[i];
    this.cambiar(i, {
      tipo,
      escalaId: tipo === 'escala' ? (actual.escalaId ?? this.escalas()[0]?.id ?? null) : null,
      opciones: llevaOpciones(tipo) ? (actual.opciones.length ? actual.opciones : ['', '']) : [],
    });
  }

  protected ponerEscala(i: number, valor: unknown): void {
    this.cambiar(i, { escalaId: typeof valor === 'string' && valor ? valor : null });
  }

  protected ponerOpcion(i: number, k: number, etiqueta: string): void {
    this.cambiar(i, {
      opciones: this.preguntas()[i].opciones.map((o, n) => (n === k ? etiqueta : o)),
    });
  }

  protected agregarOpcion(i: number): void {
    this.cambiar(i, { opciones: [...this.preguntas()[i].opciones, ''] });
  }

  protected quitarOpcion(i: number, k: number): void {
    this.cambiar(i, { opciones: this.preguntas()[i].opciones.filter((_, n) => n !== k) });
  }

  protected agregarPregunta(): void {
    this.preguntas.update((l) => [
      ...l,
      { ...PREGUNTA_NUEVA, escalaId: this.escalas()[0]?.id ?? null },
    ]);
    this.sucio.set(true);
  }

  protected quitarPregunta(i: number): void {
    this.preguntas.update((l) => l.filter((_, k) => k !== i));
    this.sucio.set(true);
  }

  protected moverPregunta(i: number, delta: -1 | 1): void {
    const j = i + delta;
    this.preguntas.update((l) => {
      if (j < 0 || j >= l.length) return l;
      const copia = [...l];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });
    this.sucio.set(true);
  }

  /** Guarda el título, la introducción y la lista completa de preguntas. */
  protected guardar(despues?: () => void): void {
    if (!this.editable() || this.ocupado()) return;
    if (!this.titulo().trim()) {
      this.error.set('Escriba el título de la encuesta.');
      return;
    }
    const falla = validarPreguntas(this.preguntas());
    if (falla) {
      this.error.set(falla);
      return;
    }
    this.ocupado.set(true);
    this.error.set(null);
    this.servicio
      .editarBorrador(this.versionId, {
        titulo: this.titulo().trim(),
        introduccion: this.introduccion().trim() || null,
      })
      .subscribe({
        next: () =>
          this.servicio.reemplazarPreguntas(this.versionId, aEntrada(this.preguntas())).subscribe({
            next: (v) => {
              this.ocupado.set(false);
              this.version.set(v);
              this.preguntas.set(aEditables(v.preguntas));
              this.sucio.set(false);
              this.notify.success('Borrador guardado', '');
              despues?.();
            },
            error: (err) => this.falloGuardado(err),
          }),
        error: (err) => this.falloGuardado(err),
      });
  }

  private falloGuardado(err: unknown): void {
    this.ocupado.set(false);
    this.error.set(mensajeErrorEncuesta(err, 'No se pudo guardar el borrador. Intente de nuevo.'));
  }

  /** Publica la versión: guarda primero lo pendiente. Desde ese momento es la que se envía a los clientes. */
  protected publicar(): void {
    if (!this.editable() || this.ocupado() || this.problema()) return;
    const publicar = () => {
      this.ocupado.set(true);
      this.servicio.publicar(this.versionId).subscribe({
        next: () => {
          this.ocupado.set(false);
          this.notify.success(
            'Encuesta publicada',
            'Es la versión que se envía a los clientes desde ahora.',
          );
          this.recargar();
        },
        error: (err) => {
          this.ocupado.set(false);
          this.error.set(mensajeErrorEncuesta(err, 'No se pudo publicar. Intente de nuevo.'));
        },
      });
    };
    if (this.sucio()) this.guardar(publicar);
    else publicar();
  }
}
