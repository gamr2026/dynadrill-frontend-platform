import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillChecklistComponent,
  DynadrillContextCardComponent,
  DynadrillDialogService,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillTagComponent,
  type DynadrillChecklistItem,
  type DynadrillContextCardItem,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { mensajeDeError } from '../../../../../shared/utils/mensaje-error.util';
import {
  DerrameDesechoDialog,
  type DerrameDesechoDialogData,
} from '../../components/derrame-desecho-dialog';
import {
  ESTADO_DERRAME_ETIQUETA,
  PERMISO_DERRAMES_GESTIONAR,
  formatoBarriles,
  leerBarriles,
  puedeContener,
  textoPlazoContencion,
  type DerrameDetalle,
} from '../../models/derrame';
import { ESCALAR_DERRAME_A_EMERGENCIA } from '../../services/escalar-emergencia';
import { DerrameService } from '../../services/derrame.service';

/**
 * HSE-AMBIENTAL-002: checklist de contención de 5 pasos, volumen real, notificación obligatoria al MAE, cierre y desecho del suelo
 * contaminado. Mismo diseño que la demo; las reglas las decide el backend y aquí solo se muestran y se guían.
 */
@Component({
  selector: 'app-derrame-detail-page',
  imports: [
    DatePipe,
    DynadrillScreenHeaderComponent,
    DynadrillContextCardComponent,
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillChecklistComponent,
    DynadrillTagComponent,
    DynadrillInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './derrame-detail-page.html',
  styleUrl: './derrame-detail-page.scss',
})
export class DerrameDetailPage {
  private readonly servicio = inject(DerrameService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly dialogos = inject(DynadrillDialogService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly escalar = inject(ESCALAR_DERRAME_A_EMERGENCIA, { optional: true });

  protected readonly estadoLabels = ESTADO_DERRAME_ETIQUETA;
  protected readonly cargando = signal(true);
  protected readonly derrame = signal<DerrameDetalle | null>(null);
  protected readonly trabajando = signal(false);
  protected readonly volumenInput = signal('');
  protected readonly referenciaMae = signal('');

  protected readonly puedeGestionar = computed(() => this.auth.can(PERMISO_DERRAMES_GESTIONAR));

  /** Escalar a emergencia se ofrece si el backend lo permite y quien arma las rutas conectó el diálogo de Emergencias. */
  protected readonly puedeEscalar = computed(
    () => !!this.escalar && (this.derrame()?.puedeEscalarAEmergencia ?? false),
  );

  protected readonly contenible = computed(() => {
    const d = this.derrame();
    return !!d && puedeContener(d);
  });

  protected readonly plazoTexto = computed(() => {
    const d = this.derrame();
    return d ? textoPlazoContencion(d) : null;
  });

  protected readonly contextItems = computed<DynadrillContextCardItem[]>(() => {
    const e = this.derrame();
    if (!e) return [];
    return [
      { label: 'Evento', value: e.codigo },
      { label: 'Volumen (banda reportada)', value: e.banda.nombre },
      { label: 'Volumen real (barriles)', value: formatoBarriles(e.volumenRealBarriles) },
      { label: 'Ubicación', value: e.ubicacion.nombre },
      ...(e.ubicacionFisica ? [{ label: 'Sitio', value: e.ubicacionFisica }] : []),
      ...(e.ticketId
        ? [
            {
              label: 'Servicio',
              value: `Ticket ${e.ticketNumero ?? '—'} · ${e.pedidoCodigo ?? ''}${e.cliente ? ` · ${e.cliente}` : ''}`,
            },
          ]
        : []),
      { label: 'Activado por', value: e.activadoPor ?? '—' },
      { label: 'Estado', value: ESTADO_DERRAME_ETIQUETA[e.estado] },
    ];
  });

  protected readonly checklistItems = computed<DynadrillChecklistItem[]>(() =>
    (this.derrame()?.checklist ?? []).map((p) => ({
      label: p.confirmadoAt && p.confirmadoPor ? `${p.nombre} — ${p.confirmadoPor}` : p.nombre,
      checked: !!p.confirmadoAt,
    })),
  );

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.servicio.detalle(id).subscribe({
      next: (d) => this.mostrar(d),
      error: (err) => {
        this.cargando.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudo cargar el derrame.'));
      },
    });
  }

  /** Cada paso confirmado queda registrado con quién y cuándo: no se desmarca. */
  protected alternarPaso(indice: number): void {
    const d = this.derrame();
    const paso = d?.checklist[indice];
    if (!d || !paso || !this.puedeGestionar()) return;
    if (paso.confirmadoAt) {
      this.notify.info('Ya confirmado', 'Un paso confirmado queda registrado y no se desmarca.');
      return;
    }
    this.ejecutar(this.servicio.confirmarPaso(d.id, paso.itemId));
  }

  protected marcarContenido(): void {
    const d = this.derrame();
    if (!d || !this.contenible()) return;
    this.ejecutar(this.servicio.contener(d.id), 'Derrame marcado como contenido.');
  }

  /** Volumen en barriles escrito en el campo, o nulo si no es un número válido. */
  protected leerVolumen(): number | null {
    return leerBarriles(this.volumenInput());
  }

  /** HSE-MASTER-001: alimenta «Volumen total derramado (barriles/año)». Solo QHSE lo confirma, tras la contención. */
  protected guardarVolumen(): void {
    const d = this.derrame();
    const barriles = this.leerVolumen();
    if (!d || barriles === null) return;
    this.ejecutar(
      this.servicio.confirmarVolumen(d.id, barriles),
      'Volumen real del derrame actualizado.',
    );
  }

  protected notificarMae(): void {
    const d = this.derrame();
    if (!d) return;
    this.ejecutar(
      this.servicio.notificarMae(d.id, this.referenciaMae()),
      'Notificación al MAE registrada.',
    );
  }

  protected generarDesecho(): void {
    const d = this.derrame();
    if (!d) return;
    const ref = this.dialogos.open<DerrameDesechoDialog, DerrameDesechoDialogData>({
      title: 'Registrar desecho peligroso — suelo contaminado',
      content: DerrameDesechoDialog,
      data: { derrameId: d.id },
      footer: false,
      width: '640px',
    });
    ref.afterClose.subscribe((actualizado) => {
      if (actualizado) this.mostrar(actualizado as DerrameDetalle);
    });
  }

  protected cerrar(): void {
    const d = this.derrame();
    if (!d || !d.puedeCerrar) return;
    this.ejecutar(this.servicio.cerrar(d.id), 'Evento cerrado.');
  }

  /** HSE-MASTER-001: derrame mayor escala a Emergencia Mayor (HSE-TRIAGE-001). El diálogo lo conecta quien arma las rutas. */
  protected escalarAEmergencia(): void {
    const d = this.derrame();
    if (!d || !this.escalar) return;
    this.trabajando.set(true);
    this.escalar({
      derrameId: d.id,
      codigo: d.codigo,
      descripcion: d.descripcion,
      ubicacionFisica: d.ubicacionFisica,
      ticketId: d.ticketId,
    }).subscribe({
      next: (activada) => {
        this.trabajando.set(false);
        if (activada) this.recargar();
      },
      error: (err) => {
        this.trabajando.set(false);
        this.notify.error(
          'No se pudo escalar',
          mensajeDeError(err, 'No se pudo escalar el derrame.'),
        );
      },
    });
  }

  protected volver(): void {
    void this.router.navigate(['/dashboard/qhse/derrames']);
  }

  private mostrar(d: DerrameDetalle): void {
    this.derrame.set(d);
    if (d.volumenRealBarriles !== null && !this.volumenInput()) {
      this.volumenInput.set(String(d.volumenRealBarriles));
    }
    this.cargando.set(false);
  }

  private recargar(): void {
    const d = this.derrame();
    if (!d) return;
    this.servicio.detalle(d.id).subscribe({
      next: (nuevo) => this.mostrar(nuevo),
      error: (err) =>
        this.notify.error('Error', mensajeDeError(err, 'No se pudo actualizar el derrame.')),
    });
  }

  private ejecutar(llamada: ReturnType<DerrameService['detalle']>, exito?: string): void {
    if (this.trabajando()) return;
    this.trabajando.set(true);
    llamada.subscribe({
      next: (d) => {
        this.trabajando.set(false);
        this.mostrar(d);
        if (exito) this.notify.success('Listo', exito);
      },
      error: (err) => {
        this.trabajando.set(false);
        this.notify.error('No se pudo', mensajeDeError(err, 'No se pudo completar la acción.'));
      },
    });
  }
}
