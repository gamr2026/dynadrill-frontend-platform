import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillEmptyStateComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  type DynadrillSelectOption,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import {
  ESTADO_INVITACION_LABEL,
  mensajeErrorEncuesta,
  type EncuestaResumen,
  type EstadoInvitacion,
  type InvitacionResumen,
  type ModuloEncuesta,
} from '../models/encuestas.model';
import { EncuestasService } from '../services/encuestas.service';
import {
  InvitacionDetalleDialog,
  type InvitacionDetalleDialogData,
} from '../components/invitacion-detalle-dialog';

const TONO: Record<EstadoInvitacion, DynadrillTagVariant> = {
  pendiente: 'warning',
  respondida: 'success',
  vencida: 'neutral',
};

const CODIGO = /^[a-z][a-z0-9_]*$/;
const PAGINA = 25;

/**
 * Administración de las encuestas (solo Superadmin): las plantillas por módulo con su versión vigente y su borrador, y lo que se envió
 * a los clientes con su estado. Las preguntas se editan en el borrador; una versión publicada no se modifica.
 */
@Component({
  selector: 'app-encuestas-page',
  imports: [
    DatePipe,
    PageHeader,
    DynadrillButtonComponent,
    DynadrillEmptyStateComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './encuestas-page.html',
  styleUrl: './encuestas-page.scss',
})
export class EncuestasPage {
  private readonly servicio = inject(EncuestasService);
  private readonly router = inject(Router);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly cargando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly encuestas = signal<EncuestaResumen[]>([]);
  protected readonly modulos = signal<ModuloEncuesta[]>([]);

  // nueva encuesta
  protected readonly creando = signal(false);
  protected readonly nuevoCodigo = signal('');
  protected readonly nuevoNombre = signal('');
  protected readonly nuevoModulo = signal<string | null>(null);
  protected readonly moduloOpciones = computed<DynadrillSelectOption[]>(() =>
    this.modulos().map((m) => ({ label: m.nombre, value: m.codigo })),
  );
  protected readonly problemaNueva = computed(() => {
    if (!CODIGO.test(this.nuevoCodigo().trim()))
      return 'El código usa minúsculas, números y guion bajo, y empieza con una letra.';
    if (!this.nuevoNombre().trim()) return 'Escriba el nombre de la encuesta.';
    if (!this.nuevoModulo()) return 'Elija el módulo al que pertenece.';
    return null;
  });

  // enviadas
  protected readonly invitaciones = signal<InvitacionResumen[]>([]);
  protected readonly total = signal(0);
  protected readonly filtroEstado = signal<EstadoInvitacion | null>(null);
  protected readonly estadoOpciones: DynadrillSelectOption[] = (
    Object.keys(ESTADO_INVITACION_LABEL) as EstadoInvitacion[]
  ).map((e) => ({ label: ESTADO_INVITACION_LABEL[e], value: e }));
  protected readonly hayMas = computed(() => this.invitaciones().length < this.total());

  protected readonly etiqueta = (e: EstadoInvitacion): string => ESTADO_INVITACION_LABEL[e];
  protected readonly tono = (e: EstadoInvitacion): DynadrillTagVariant => TONO[e];

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.servicio.modulos().subscribe({
      next: (m) => this.modulos.set(m),
      error: (err) =>
        this.error.set(mensajeErrorEncuesta(err, 'No se pudieron cargar los módulos.')),
    });
    this.servicio.listar().subscribe({
      next: (e) => {
        this.encuestas.set(e);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorEncuesta(err, 'No se pudieron cargar las encuestas.'));
      },
    });
    this.cargarInvitaciones(true);
  }

  protected cargarInvitaciones(desdeCero: boolean): void {
    const desplazamiento = desdeCero ? 0 : this.invitaciones().length;
    this.servicio
      .invitaciones({
        estado: this.filtroEstado() ?? undefined,
        limite: PAGINA,
        desplazamiento,
      })
      .subscribe({
        next: (p) => {
          this.total.set(p.total);
          this.invitaciones.update((l) => (desdeCero ? p.items : [...l, ...p.items]));
        },
        error: (err) =>
          this.notify.error(
            'Error',
            mensajeErrorEncuesta(err, 'No se pudieron cargar las encuestas enviadas.'),
          ),
      });
  }

  protected filtrar(estado: unknown): void {
    this.filtroEstado.set(
      typeof estado === 'string' && estado ? (estado as EstadoInvitacion) : null,
    );
    this.cargarInvitaciones(true);
  }

  protected crear(): void {
    const modulo = this.nuevoModulo();
    if (this.problemaNueva() || !modulo || this.ocupado()) return;
    this.ocupado.set(true);
    this.servicio
      .crear({
        codigo: this.nuevoCodigo().trim(),
        nombre: this.nuevoNombre().trim(),
        moduloCodigo: modulo,
      })
      .subscribe({
        next: () => {
          this.ocupado.set(false);
          this.creando.set(false);
          this.nuevoCodigo.set('');
          this.nuevoNombre.set('');
          this.nuevoModulo.set(null);
          this.notify.success(
            'Encuesta creada',
            'Agregue sus preguntas en el borrador y publíquela.',
          );
          this.cargar();
        },
        error: (err) => {
          this.ocupado.set(false);
          this.notify.error(
            'No se pudo crear',
            mensajeErrorEncuesta(err, 'No se pudo crear la encuesta. Intente de nuevo.'),
          );
        },
      });
  }

  protected editarBorrador(e: EncuestaResumen): void {
    if (e.borrador) void this.router.navigate(['/encuestas/versiones', e.borrador.id]);
  }

  protected abrirBorrador(e: EncuestaResumen): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.servicio.crearBorrador(e.id).subscribe({
      next: (v) => {
        this.ocupado.set(false);
        void this.router.navigate(['/encuestas/versiones', v.id]);
      },
      error: (err) => {
        this.ocupado.set(false);
        this.notify.error(
          'No se pudo abrir el borrador',
          mensajeErrorEncuesta(err, 'No se pudo abrir el borrador. Intente de nuevo.'),
        );
      },
    });
  }

  protected verVigente(e: EncuestaResumen): void {
    if (e.vigente) void this.router.navigate(['/encuestas/versiones', e.vigente.id]);
  }

  protected alternarActiva(e: EncuestaResumen): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.servicio.actualizar(e.id, { activa: !e.activa }).subscribe({
      next: () => {
        this.ocupado.set(false);
        this.notify.success(
          e.activa ? 'Encuesta desactivada' : 'Encuesta activada',
          e.activa ? 'Ya no se envía a los clientes.' : 'Vuelve a enviarse a los clientes.',
        );
        this.cargar();
      },
      error: (err) => {
        this.ocupado.set(false);
        this.notify.error(
          'No se pudo cambiar',
          mensajeErrorEncuesta(err, 'No se pudo cambiar el estado. Intente de nuevo.'),
        );
      },
    });
  }

  protected verDetalle(i: InvitacionResumen): void {
    this.dialog.open<InvitacionDetalleDialog, InvitacionDetalleDialogData>({
      title: `Encuesta ${i.encuesta.nombre}`,
      content: InvitacionDetalleDialog,
      data: { invitacionId: i.id },
      footer: false,
      width: '640px',
    });
  }

  protected reenviar(i: InvitacionResumen): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.servicio.reenviar(i.id).subscribe({
      next: (r) => {
        this.ocupado.set(false);
        if (r.enviada) {
          this.notify.success(
            'Encuesta reenviada',
            `Se envió un enlace nuevo a ${r.correoDestino}.`,
          );
        } else {
          this.notify.error(
            'No se pudo enviar el correo',
            'El enlace se creó pero el correo no salió. Intente reenviarla de nuevo.',
          );
        }
        this.cargarInvitaciones(true);
      },
      error: (err) => {
        this.ocupado.set(false);
        this.notify.error(
          'No se pudo reenviar',
          mensajeErrorEncuesta(err, 'No se pudo reenviar la encuesta. Intente de nuevo.'),
        );
      },
    });
  }
}
