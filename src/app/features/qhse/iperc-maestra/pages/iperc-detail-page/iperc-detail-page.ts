import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, type Observable } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillTagComponent,
  DynadrillTextComponent,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import {
  MotivoDialog,
  type MotivoDialogData,
} from '../../../../../shared/components/motivo-dialog/motivo-dialog';
import { mensajeDeError } from '../../../../../shared/utils/mensaje-error.util';
import { IpercContenidoEditor } from '../../components/iperc-contenido-editor';
import {
  ESTADO_IPERC_ETIQUETA,
  ESTADO_IPERC_TONO,
  PERMISO_IPERC_APROBAR,
  PERMISO_IPERC_GESTIONAR,
  aBorrador,
  esEditable,
  pendientesDeGuardado,
  pendientesDeRevision,
  type CatalogosIperc,
  type ContenidoBorrador,
  type MatrizDetalle,
  type TipoCatalogo,
} from '../../models/iperc';
import { IpercMaestraService } from '../../services/iperc-maestra.service';

const VACIOS: CatalogosIperc = {
  procesos: [],
  zonas: [],
  clasificaciones: [],
  generadoEn: [],
  cargos: [],
};

/**
 * Una matriz IPERC (versión de una actividad): se edita en borrador o evaluación; en revisión la aprueba o rechaza el Gerente HSE; una
 * aprobada solo se lee (para revisarla se crea una versión nueva desde la lista). Aprobar exige adjuntar el procedimiento y el ATS base.
 */
@Component({
  selector: 'app-iperc-detail-page',
  imports: [
    DatePipe,
    PageHeader,
    IpercContenidoEditor,
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillTagComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './iperc-detail-page.html',
  styleUrl: './iperc-detail-page.scss',
})
export class IpercDetailPage {
  private readonly servicio = inject(IpercMaestraService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly dialogos = inject(DynadrillDialogService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly etiqueta = ESTADO_IPERC_ETIQUETA;
  protected readonly cargando = signal(true);
  protected readonly trabajando = signal(false);
  protected readonly matriz = signal<MatrizDetalle | null>(null);
  protected readonly catalogos = signal<CatalogosIperc>(VACIOS);
  protected readonly borrador = signal<ContenidoBorrador>({ tareas: [], evaluadorIds: [] });

  protected readonly puedeGestionar = computed(() => this.auth.can(PERMISO_IPERC_GESTIONAR));
  protected readonly puedeAprobar = computed(() => this.auth.can(PERMISO_IPERC_APROBAR));
  protected readonly editable = computed(() => {
    const m = this.matriz();
    return !!m && this.puedeGestionar() && esEditable(m.estado);
  });
  /** Hay cambios sin guardar respecto de lo que tiene el servidor. */
  protected readonly sucio = computed(() => {
    const m = this.matriz();
    return !!m && JSON.stringify(this.borrador()) !== JSON.stringify(aBorrador(m));
  });
  protected readonly faltaParaGuardar = computed(() => pendientesDeGuardado(this.borrador()));
  protected readonly faltaParaRevision = computed(() => pendientesDeRevision(this.borrador()));
  protected readonly tono = computed<DynadrillTagVariant>(() => {
    const m = this.matriz();
    return m ? (ESTADO_IPERC_TONO[m.estado] as DynadrillTagVariant) : 'neutral';
  });
  /** Avisos de arriba: vigencia de la aprobada, versión reemplazada o motivo del rechazo. */
  protected readonly avisos = computed<
    { variant: 'critical' | 'warning' | 'info'; message: string }[]
  >(() => {
    const m = this.matriz();
    if (!m) return [];
    const fecha = (d: string | null): string => (d ? d.split('-').reverse().join('/') : '');
    if (m.estado === 'aprobada') {
      const base = `Aprobada por ${m.aprobadaPor} el ${fecha(m.aprobadaEl)}. Vigente hasta el ${fecha(m.vigenteHasta)}.`;
      if (m.vencida)
        return [
          {
            variant: 'critical',
            message: `${base} Está vencida: el PTW que la necesita queda bloqueado hasta aprobar una versión nueva.`,
          },
        ];
      if (m.porVencer)
        return [
          {
            variant: 'warning',
            message: `${base} Vence en ${m.venceEnDias} día(s): cree la versión nueva desde la lista.`,
          },
        ];
      return [{ variant: 'info', message: base }];
    }
    if (m.estado === 'reemplazada')
      return [
        {
          variant: 'info',
          message:
            'Esta versión fue reemplazada por una más nueva; se conserva como historia y ya no se edita.',
        },
      ];
    if (m.estado === 'rechazada')
      return [
        { variant: 'critical', message: `Rechazada por ${m.rechazadaPor}: ${m.motivoRechazo}` },
      ];
    return [];
  });
  protected readonly faltanAdjuntos = computed(() => {
    const m = this.matriz();
    return m
      ? [
          ...(m.procedimientoArchivoId ? [] : ['el procedimiento']),
          ...(m.atsArchivoId ? [] : ['el ATS base']),
        ]
      : [];
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') as string;
    forkJoin({ m: this.servicio.matriz(id), c: this.servicio.catalogos() }).subscribe({
      next: ({ m, c }) => {
        this.catalogos.set(c);
        this.aplicar(m);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudo cargar la matriz.'));
      },
    });
  }

  private aplicar(m: MatrizDetalle): void {
    this.matriz.set(m);
    this.borrador.set(aBorrador(m));
  }

  protected volver(): void {
    void this.router.navigate(['/dashboard/qhse/iperc']);
  }

  /** Da de alta un elemento de catálogo pedido por el editor (p. ej. un cargo) y recarga las listas. */
  protected altaCatalogo(e: {
    tipo: TipoCatalogo;
    nombre: string;
    alTerminar: (id: string) => void;
  }): void {
    this.servicio.agregarCatalogo(e.tipo, e.nombre).subscribe({
      next: (r) => {
        this.servicio.catalogos().subscribe((c) => {
          this.catalogos.set(c);
          e.alTerminar(r.id);
        });
      },
      error: (err) =>
        this.notify.error(
          'No se pudo agregar',
          mensajeDeError(err, 'No se pudo agregar el elemento.'),
        ),
    });
  }

  protected guardar(): void {
    const m = this.matriz();
    if (!m || this.faltaParaGuardar().length) return;
    this.ejecutar(this.servicio.guardarContenido(m.id, this.borrador()), 'Matriz guardada.');
  }

  protected iniciarEvaluacion(): void {
    const m = this.matriz();
    if (m) this.ejecutar(this.servicio.iniciarEvaluacion(m.id), 'La matriz pasó a evaluación.');
  }

  /** Guarda primero lo que haya sin guardar y luego envía a revisión (para no perder cambios). */
  protected enviarARevision(): void {
    const m = this.matriz();
    if (!m || this.faltaParaRevision().length) return;
    const enviar = (): void =>
      this.ejecutar(this.servicio.enviarARevision(m.id), 'Enviada a revisión del Gerente HSE.');
    if (!this.sucio()) return enviar();
    this.trabajando.set(true);
    this.servicio.guardarContenido(m.id, this.borrador()).subscribe({
      next: (nueva) => {
        this.trabajando.set(false);
        this.aplicar(nueva);
        enviar();
      },
      error: (err) => {
        this.trabajando.set(false);
        this.notify.error(
          'No se pudo guardar',
          mensajeDeError(err, 'No se pudo guardar la matriz.'),
        );
      },
    });
  }

  protected adjuntar(tipo: 'procedimiento' | 'ats', evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    const m = this.matriz();
    if (!m || !archivo) return;
    this.ejecutar(
      this.servicio.adjuntar(m.id, tipo, archivo),
      tipo === 'ats' ? 'ATS base adjuntado.' : 'Procedimiento adjuntado.',
    );
  }

  protected verArchivo(archivoId: string | null): void {
    if (!archivoId) return;
    this.servicio.abrirArchivo(archivoId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (err) =>
        this.notify.error('No se pudo abrir', mensajeDeError(err, 'No se pudo abrir el archivo.')),
    });
  }

  protected aprobar(): void {
    const m = this.matriz();
    if (m) this.ejecutar(this.servicio.aprobar(m.id), 'Matriz aprobada: vale 12 meses desde hoy.');
  }

  protected rechazar(): void {
    const m = this.matriz();
    if (!m) return;
    const ref = this.dialogos.open<MotivoDialog, MotivoDialogData>({
      title: 'Rechazar la matriz',
      content: MotivoDialog,
      data: {
        mensaje: 'La matriz vuelve a quien la preparó. ¿Por qué se rechaza?',
        label: 'Motivo del rechazo',
      },
      footer: false,
      width: '480px',
    });
    ref.afterClose.subscribe((motivo: string | undefined) => {
      if (motivo) this.ejecutar(this.servicio.rechazar(m.id, motivo), 'Matriz rechazada.');
    });
  }

  private ejecutar(llamada: Observable<MatrizDetalle>, exito: string): void {
    if (this.trabajando()) return;
    this.trabajando.set(true);
    llamada.subscribe({
      next: (m) => {
        this.aplicar(m);
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
