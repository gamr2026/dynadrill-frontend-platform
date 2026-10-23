import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillContextCardComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSelectComponent,
  DynadrillTagComponent,
  DynadrillTextareaComponent,
  type DynadrillContextCardItem,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { toLocalDateString } from '../../../../../shared/utils';
import { mensajeDeError } from '../../../../../shared/utils/mensaje-error.util';
import type { ActividadResumen } from '../../../iperc-maestra/models/iperc';
import { IpercMaestraService } from '../../../iperc-maestra/services/iperc-maestra.service';
import {
  PersonasQhseService,
  type PersonaQhse,
} from '../../../shared/services/personas-qhse.service';
import {
  CONCLUSION_ETIQUETA,
  ESTADO_ACCION_ETIQUETA,
  ESTADO_INVESTIGACION_ETIQUETA,
  NIVELES_CONTROL,
  NIVEL_CONTROL_ETIQUETA,
  PERMISO_INVESTIGACIONES_APROBAR,
  PERMISO_INVESTIGACIONES_GESTIONAR,
  TIPOS_CAUSA,
  TIPO_ACCION_ETIQUETA,
  TIPO_CAUSA_ETIQUETA,
  causasDe,
  decimalNoNegativo,
  diaDeIso,
  enteroNoNegativo,
  esEditable,
  horaDeBackend,
  numeroATexto,
  type AccionInvestigacion,
  type CategoriaIshikawa,
  type Conclusion,
  type InvestigacionDetalle,
  type NivelControl,
  type Sexo,
  type TipoAccion,
  type TipoCausa,
} from '../../models/investigacion';
import { InvestigacionPlataformaService } from '../../services/investigacion.service';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Formulario del trabajador involucrado (todo texto, como lo escribe la persona). */
interface FormTrabajador {
  usuarioId: string;
  apellidosNombres: string;
  cedula: string;
  cargo: string;
  direccion: string;
  telefono: string;
  sexo: Sexo | '';
  tipoVinculacion: string;
  oficioDesempenaba: string;
  jornadaHabitual: string;
  tiempoExperienciaMeses: string;
}
const TRABAJADOR_VACIO: FormTrabajador = {
  usuarioId: '',
  apellidosNombres: '',
  cedula: '',
  cargo: '',
  direccion: '',
  telefono: '',
  sexo: '',
  tipoVinculacion: '',
  oficioDesempenaba: '',
  jornadaHabitual: '',
  tiempoExperienciaMeses: '',
};

/** Formulario de la información del incidente. */
interface FormIncidente {
  empresaDondeOcurrio: string;
  direccionOcurrencia: string;
  jornadaSuceso: string;
  zona: string;
  horaInicioJornada: string;
  tiempoAtencionMedica: string;
  centroMedico: string;
  parteCuerpoAfectada: string;
  tipoLesionSufrida: string;
  factorQueOrigino: string;
  totalDiasIncapacidad: string;
  danosMateriales: string;
  totalPerdidasEconomicas: string;
  danosMedioAmbiente: string;
  causoMuerte: boolean;
  fechaMuerte: string;
  oficioEraPropioDelCargo: boolean;
  seInformoOportunamente: boolean;
  continuaIncapacitado: boolean;
  sucesosSimilaresPrevios: boolean;
  sucesosSimilaresDetalle: string;
}
const INCIDENTE_VACIO: FormIncidente = {
  empresaDondeOcurrio: '',
  direccionOcurrencia: '',
  jornadaSuceso: '',
  zona: '',
  horaInicioJornada: '',
  tiempoAtencionMedica: '',
  centroMedico: '',
  parteCuerpoAfectada: '',
  tipoLesionSufrida: '',
  factorQueOrigino: '',
  totalDiasIncapacidad: '',
  danosMateriales: '',
  totalPerdidasEconomicas: '',
  danosMedioAmbiente: '',
  causoMuerte: false,
  fechaMuerte: '',
  oficioEraPropioDelCargo: false,
  seInformoOportunamente: false,
  continuaIncapacitado: false,
  sucesosSimilaresPrevios: false,
  sucesosSimilaresDetalle: '',
};

/**
 * HSE-TRIAGE-002 — investigación completa, alineada al formato físico DYN-SGI-RE-034: datos del trabajador, información del incidente,
 * testigos, entorno de trabajo, 5 Porqués, Ishikawa, causas (inmediatas/básicas/fuente), acciones con jerarquía de control (P/D-F-M-T) y
 * verificación de eficacia, notificación legal, conclusión (incidente/accidente) y vínculo con la matriz IPERC. Cada sección se guarda en el
 * backend; el cierre pasa por la revisión del Gerente HSE.
 */
@Component({
  selector: 'app-investigacion-plataforma-detail-page',
  imports: [
    DatePipe,
    DynadrillScreenHeaderComponent,
    DynadrillContextCardComponent,
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillTextareaComponent,
    DynadrillSelectComponent,
    DynadrillTagComponent,
    DynadrillCheckboxComponent,
    DynadrillDatetimePickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './investigacion-detail-page.html',
  styleUrl: './investigacion-detail-page.scss',
})
export class InvestigacionPlataformaDetailPage {
  private readonly service = inject(InvestigacionPlataformaService);
  private readonly ipercService = inject(IpercMaestraService);
  private readonly personasService = inject(PersonasQhseService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly tipoAccionEtiqueta = TIPO_ACCION_ETIQUETA;
  protected readonly estadoAccionEtiqueta = ESTADO_ACCION_ETIQUETA;
  protected readonly nivelEtiqueta = NIVEL_CONTROL_ETIQUETA;
  protected readonly nivelesControl = NIVELES_CONTROL;
  protected readonly conclusionEtiqueta = CONCLUSION_ETIQUETA;
  protected readonly tiposCausa = TIPOS_CAUSA;
  protected readonly tipoCausaEtiqueta = TIPO_CAUSA_ETIQUETA;
  protected readonly estadoEtiqueta = ESTADO_INVESTIGACION_ETIQUETA;

  protected readonly tipoAccionOptions: DynadrillSelectOption[] = (
    ['correctiva', 'preventiva'] as TipoAccion[]
  ).map((t) => ({
    label: TIPO_ACCION_ETIQUETA[t],
    value: t,
  }));
  protected readonly conclusionOptions: DynadrillSelectOption[] = (
    ['incidente', 'accidente'] as Conclusion[]
  ).map((c) => ({
    label: CONCLUSION_ETIQUETA[c],
    value: c,
  }));
  protected readonly jornadaOptions: DynadrillSelectOption[] = [
    { label: 'Ordinaria', value: 'ordinaria' },
    { label: 'Extra', value: 'extra' },
    { label: 'Suplementaria', value: 'suplementaria' },
  ];
  protected readonly zonaOptions: DynadrillSelectOption[] = [
    { label: 'Rural', value: 'rural' },
    { label: 'Urbana', value: 'urbana' },
  ];
  protected readonly sexoOptions: DynadrillSelectOption[] = [
    { label: 'Masculino', value: 'masculino' },
    { label: 'Femenino', value: 'femenino' },
  ];

  protected readonly loading = signal(true);
  protected readonly investigacion = signal<InvestigacionDetalle | null>(null);
  protected readonly enviando = signal(false);
  protected readonly categorias = signal<CategoriaIshikawa[]>([]);
  private readonly personas = signal<PersonaQhse[]>([]);
  private readonly actividades = signal<ActividadResumen[]>([]);

  protected readonly opcionesPersonas = computed<DynadrillSelectOption[]>(() =>
    this.personas().map((p) => ({ label: p.nombre, value: p.id })),
  );
  protected readonly opcionesIperc = computed<DynadrillSelectOption[]>(() =>
    this.actividades().map((a) => ({ label: `${a.proceso.nombre} — ${a.nombre}`, value: a.id })),
  );

  // ── Permisos y qué se puede hacer según el estado ──
  protected readonly puedeGestionar = computed(() =>
    this.auth.can(PERMISO_INVESTIGACIONES_GESTIONAR),
  );
  protected readonly puedeAprobar = computed(() => this.auth.can(PERMISO_INVESTIGACIONES_APROBAR));
  /** Las secciones del formato se llenan con la investigación abierta o en investigación. */
  protected readonly editable = computed(() => {
    const i = this.investigacion();
    return this.puedeGestionar() && !!i && esEditable(i.estado);
  });
  /** Las acciones se registran con la investigación en curso; implementarlas o verificarlas sigue posible después. */
  protected readonly puedeRegistrarAccion = computed(
    () => this.puedeGestionar() && this.investigacion()?.estado === 'en_investigacion',
  );

  // ── Formularios locales ──
  protected readonly liderId = signal('');
  protected readonly escenaFecha = signal<Date | null>(null);
  protected readonly miembroPersonaId = signal('');
  protected readonly miembroExterno = signal('');
  protected readonly mostrarTrabajador = signal(false);
  protected readonly trabajador = signal<FormTrabajador>(TRABAJADOR_VACIO);
  protected readonly incidente = signal<FormIncidente>(INCIDENTE_VACIO);
  protected readonly evidencias = signal('');
  protected readonly testimonios = signal('');
  protected readonly nuevoTestigo = signal({ nombresApellidos: '', cedula: '', version: '' });
  protected readonly nuevoFactor = signal({
    tipo: '',
    fuente: '',
    existeControl: false,
    contribuyoAlSuceso: false,
  });
  protected readonly nuevaPregunta = signal('');
  protected readonly nuevaRespuesta = signal('');
  protected readonly nuevaIshikawa = signal<Record<string, string | undefined>>({});
  protected readonly nuevaCausa = signal<Record<string, string | undefined>>({});
  protected readonly leccionesAprendidas = signal('');
  protected readonly nuevaAccionDescripcion = signal('');
  protected readonly nuevaAccionTipo = signal<TipoAccion>('correctiva');
  protected readonly nuevaAccionResponsable = signal('');
  protected readonly nuevaAccionPlazo = signal<Date | null>(null);
  protected readonly nuevaAccionControles = signal<NivelControl[]>([]);
  protected readonly observacionVerificacion = signal<Record<string, string | undefined>>({});
  protected readonly accionCancelando = signal<string | null>(null);
  protected readonly motivoCancelacion = signal('');
  protected readonly observacionDevolucion = signal('');

  // ── Lo que se muestra ──
  protected readonly contextItems = computed<DynadrillContextCardItem[]>(() => {
    const i = this.investigacion();
    if (!i) return [];
    return [
      { label: 'Investigación', value: i.codigo },
      { label: 'Clasificación', value: i.resultado.nombre },
      { label: 'Ubicación', value: i.ubicacion || '—' },
      {
        label: 'Fecha del incidente',
        value: new Date(i.fechaIncidente).toLocaleDateString('es-EC'),
      },
      { label: 'Estado', value: ESTADO_INVESTIGACION_ETIQUETA[i.estado] },
      { label: 'Líder de la investigación', value: i.lider?.nombre ?? '—' },
      {
        label: 'Informe final hasta',
        value: new Date(i.plazos.finalLimite).toLocaleDateString('es-EC'),
      },
    ];
  });

  protected readonly inicioVencido = computed(() => {
    const i = this.investigacion();
    return !!i && i.estado === 'abierta' && i.plazos.inicioVencido;
  });
  protected readonly finalVencido = computed(() => {
    const i = this.investigacion();
    return !!i && i.estado !== 'cerrada' && i.plazos.finalVencido;
  });
  protected readonly porquesCompleto = computed(
    () => (this.investigacion()?.porques.length ?? 0) >= 5,
  );
  /** Persona que lidera: opciones para iniciar. */
  protected readonly puedeIniciar = computed(() => this.liderId() !== '');
  protected readonly puedeAgregarMiembro = computed(
    () => this.miembroPersonaId() !== '' || this.miembroExterno().trim().length > 0,
  );
  protected readonly puedeAgregarTestigo = computed(
    () =>
      this.nuevoTestigo().nombresApellidos.trim().length > 0 &&
      this.nuevoTestigo().version.trim().length > 0 &&
      (this.investigacion()?.testigos.length ?? 0) < 3,
  );
  protected readonly puedeAgregarFactor = computed(
    () => this.nuevoFactor().tipo.trim().length > 0 && this.nuevoFactor().fuente.trim().length > 0,
  );
  protected readonly puedeAgregarPorque = computed(
    () => this.nuevaPregunta().trim().length > 0 && this.nuevaRespuesta().trim().length > 0,
  );
  protected readonly puedeAgregarAccion = computed(
    () =>
      this.nuevaAccionDescripcion().trim().length > 0 &&
      this.nuevaAccionResponsable() !== '' &&
      this.nuevaAccionPlazo() !== null,
  );
  protected readonly sugiereLegal = computed(
    () => !!this.investigacion()?.resultado.sugiereNotificacionLegal,
  );
  protected readonly involucraLesionado = computed(
    () => !!this.investigacion()?.resultado.involucraLesionado,
  );
  /** Con cuenta del portal, el nombre, la cédula y el cargo salen de su perfil: no se escriben. */
  protected readonly trabajadorConCuenta = computed(() => this.trabajador().usuarioId !== '');

  /** Lectura (sin edición) del trabajador y del incidente, para cuando la investigación ya no se puede llenar. */
  protected readonly trabajadorItems = computed<DynadrillContextCardItem[]>(() => {
    const t = this.investigacion()?.trabajador;
    if (!t) return [];
    return [
      { label: 'Apellidos y nombres', value: t.apellidosNombres || '—' },
      { label: 'N° de cédula', value: t.cedula || '—' },
      { label: 'Cargo', value: t.cargo || '—' },
      { label: 'Dirección', value: t.direccion || '—' },
      { label: 'Teléfono', value: t.telefono || '—' },
      { label: 'Sexo', value: t.sexo ?? '—' },
      { label: 'Tipo de vinculación', value: t.tipoVinculacion || '—' },
      { label: 'Oficio que desempeñaba', value: t.oficioDesempenaba || '—' },
      { label: 'Jornada habitual', value: t.jornadaHabitual || '—' },
      {
        label: 'Experiencia en el oficio (meses)',
        value: numeroATexto(t.tiempoExperienciaMeses) || '—',
      },
    ];
  });
  protected readonly incidenteItems = computed<DynadrillContextCardItem[]>(() => {
    const d = this.investigacion()?.incidente;
    if (!d) return [];
    const si = (v: boolean | null) => (v === null ? '—' : v ? 'Sí' : 'No');
    return [
      { label: 'Empresa donde ocurrió', value: d.empresaDondeOcurrio || '—' },
      { label: 'Dirección donde ocurrió', value: d.direccionOcurrencia || '—' },
      { label: 'Jornada en que sucede', value: d.jornadaSuceso ?? '—' },
      { label: 'Zona', value: d.zona ?? '—' },
      { label: 'Hora de inicio de la jornada', value: horaDeBackend(d.horaInicioJornada) || '—' },
      { label: 'Atención médica', value: d.tiempoAtencionMedica || '—' },
      { label: 'Centro médico', value: d.centroMedico || '—' },
      { label: 'Parte del cuerpo afectada', value: d.parteCuerpoAfectada || '—' },
      { label: 'Tipo de lesión', value: d.tipoLesionSufrida || '—' },
      { label: 'Factor que originó el suceso', value: d.factorQueOrigino || '—' },
      { label: 'Días de incapacidad', value: numeroATexto(d.totalDiasIncapacidad) || '—' },
      { label: 'Causó muerte', value: d.causoMuerte ? `Sí (${diaDeIso(d.fechaMuerte)})` : 'No' },
      { label: 'Oficio propio del cargo', value: si(d.oficioEraPropioDelCargo) },
      { label: 'Se informó oportunamente', value: si(d.seInformoOportunamente) },
      { label: 'Continúa incapacitado', value: si(d.continuaIncapacitado) },
      { label: 'Sucesos similares previos', value: si(d.sucesosSimilaresPrevios) },
      { label: 'Daños materiales', value: d.danosMateriales || '—' },
      { label: 'Pérdidas económicas ($)', value: numeroATexto(d.totalPerdidasEconomicas) || '—' },
      { label: 'Daños al medio ambiente', value: d.danosMedioAmbiente || '—' },
    ];
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.service.detalle(id).subscribe({
      next: (inv) => {
        this.investigacion.set(inv);
        this.sincronizarTodo(inv);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error('Error', mensajeDeError(e, 'No se pudo cargar la investigación.'));
      },
    });
    // las listas auxiliares se ofrecen solo si la cuenta puede leerlas
    this.service
      .categoriasIshikawa()
      .pipe(catchError(() => of([])))
      .subscribe((c) => this.categorias.set(c));
    this.personasService.responsables().subscribe((p) => this.personas.set(p));
    this.ipercService
      .actividades()
      .pipe(catchError(() => of([])))
      .subscribe((a) => this.actividades.set(a));
  }

  // ── Sincronización de los formularios con lo guardado ──
  private sincronizarTodo(i: InvestigacionDetalle): void {
    this.sincronizarTrabajador(i);
    this.sincronizarIncidente(i);
    this.sincronizarEvidencias(i);
    this.leccionesAprendidas.set(i.leccionesAprendidas ?? '');
  }

  private sincronizarTrabajador(i: InvestigacionDetalle): void {
    const t = i.trabajador;
    if (!t) return;
    this.mostrarTrabajador.set(true);
    this.trabajador.set({
      usuarioId: t.usuarioId ?? '',
      apellidosNombres: t.apellidosNombres ?? '',
      cedula: t.cedula ?? '',
      cargo: t.cargo ?? '',
      direccion: t.direccion ?? '',
      telefono: t.telefono ?? '',
      sexo: t.sexo ?? '',
      tipoVinculacion: t.tipoVinculacion ?? '',
      oficioDesempenaba: t.oficioDesempenaba ?? '',
      jornadaHabitual: t.jornadaHabitual ?? '',
      tiempoExperienciaMeses: numeroATexto(t.tiempoExperienciaMeses),
    });
  }

  private sincronizarIncidente(i: InvestigacionDetalle): void {
    const d = i.incidente;
    if (!d) return;
    this.incidente.set({
      empresaDondeOcurrio: d.empresaDondeOcurrio ?? '',
      direccionOcurrencia: d.direccionOcurrencia ?? '',
      jornadaSuceso: d.jornadaSuceso ?? '',
      zona: d.zona ?? '',
      horaInicioJornada: horaDeBackend(d.horaInicioJornada),
      tiempoAtencionMedica: d.tiempoAtencionMedica ?? '',
      centroMedico: d.centroMedico ?? '',
      parteCuerpoAfectada: d.parteCuerpoAfectada ?? '',
      tipoLesionSufrida: d.tipoLesionSufrida ?? '',
      factorQueOrigino: d.factorQueOrigino ?? '',
      totalDiasIncapacidad: numeroATexto(d.totalDiasIncapacidad),
      danosMateriales: d.danosMateriales ?? '',
      totalPerdidasEconomicas: numeroATexto(d.totalPerdidasEconomicas),
      danosMedioAmbiente: d.danosMedioAmbiente ?? '',
      causoMuerte: d.causoMuerte,
      fechaMuerte: diaDeIso(d.fechaMuerte),
      oficioEraPropioDelCargo: !!d.oficioEraPropioDelCargo,
      seInformoOportunamente: !!d.seInformoOportunamente,
      continuaIncapacitado: !!d.continuaIncapacitado,
      sucesosSimilaresPrevios: !!d.sucesosSimilaresPrevios,
      sucesosSimilaresDetalle: d.sucesosSimilaresDetalle ?? '',
    });
  }

  private sincronizarEvidencias(i: InvestigacionDetalle): void {
    this.evidencias.set(i.evidenciasRecopiladas ?? '');
    this.testimonios.set(i.testimoniosResumen ?? '');
  }

  /**
   * Ejecuta una llamada que devuelve la investigación actualizada: la muestra, y tras guardar sincroniza solo el formulario de esa sección (para
   * no pisar lo que la persona esté escribiendo en otra). Cualquier rechazo del backend se explica tal cual.
   */
  private aplicar(
    llamada: Observable<InvestigacionDetalle>,
    exito: string,
    tras?: (i: InvestigacionDetalle) => void,
  ): void {
    if (this.enviando()) return;
    this.enviando.set(true);
    llamada.subscribe({
      next: (inv) => {
        this.investigacion.set(inv);
        tras?.(inv);
        this.enviando.set(false);
        if (exito) this.notify.success('Guardado', exito);
      },
      error: (e) => {
        this.enviando.set(false);
        this.notify.error('Error', mensajeDeError(e, 'No se pudo guardar el cambio.'));
      },
    });
  }

  private con<T extends object, K extends keyof T>(signalValor: () => T, campo: K, valor: T[K]): T {
    return { ...signalValor(), [campo]: valor };
  }

  // ── 1. Inicio, escena y equipo ──

  protected iniciar(): void {
    const i = this.investigacion();
    if (!i || !this.puedeIniciar()) return;
    const escena = this.escenaFecha();
    this.aplicar(
      this.service.iniciar(i.id, this.liderId(), escena ? escena.toISOString() : undefined),
      'La investigación quedó en curso: escena asegurada y líder nombrado.',
    );
  }

  private miembrosActuales(
    i: InvestigacionDetalle,
  ): Array<{ usuarioId?: string; nombreExterno?: string }> {
    return i.equipo.map((m) =>
      m.usuarioId ? { usuarioId: m.usuarioId } : { nombreExterno: m.nombre ?? '' },
    );
  }

  protected agregarIntegrante(): void {
    const i = this.investigacion();
    if (!i || !this.puedeAgregarMiembro()) return;
    const nuevo = this.miembroPersonaId()
      ? { usuarioId: this.miembroPersonaId() }
      : { nombreExterno: this.miembroExterno().trim() };
    this.aplicar(this.service.guardarEquipo(i.id, [...this.miembrosActuales(i), nuevo]), '', () => {
      this.miembroPersonaId.set('');
      this.miembroExterno.set('');
    });
  }

  protected quitarIntegrante(indice: number): void {
    const i = this.investigacion();
    if (!i) return;
    this.aplicar(
      this.service.guardarEquipo(
        i.id,
        this.miembrosActuales(i).filter((_, k) => k !== indice),
      ),
      '',
    );
  }

  // ── 2. Datos del trabajador involucrado ──

  protected setTrabajador<K extends keyof FormTrabajador>(
    campo: K,
    valor: FormTrabajador[K],
  ): void {
    this.trabajador.set(this.con(this.trabajador, campo, valor));
  }

  protected guardarTrabajador(): void {
    const i = this.investigacion();
    const t = this.trabajador();
    if (!i) return;
    const experiencia = enteroNoNegativo(t.tiempoExperienciaMeses);
    if (experiencia === null) {
      this.notify.error(
        'Dato inválido',
        'La experiencia en el oficio se escribe en meses, con un número entero.',
      );
      return;
    }
    if (!t.usuarioId && (!t.apellidosNombres.trim() || !t.cedula.trim())) {
      this.notify.error(
        'Faltan datos',
        'Elija la cuenta del trabajador o escriba sus apellidos, nombres y cédula.',
      );
      return;
    }
    const texto = (s: string) => s.trim() || undefined;
    const cuerpo: Record<string, unknown> = {
      ...(t.usuarioId
        ? { usuarioId: t.usuarioId }
        : {
            apellidosNombres: t.apellidosNombres.trim(),
            cedula: t.cedula.trim(),
            cargo: texto(t.cargo),
          }),
      direccion: texto(t.direccion),
      telefono: texto(t.telefono),
      sexo: t.sexo || undefined,
      tipoVinculacion: texto(t.tipoVinculacion),
      oficioDesempenaba: texto(t.oficioDesempenaba),
      jornadaHabitual: texto(t.jornadaHabitual),
      tiempoExperienciaMeses: experiencia,
    };
    this.aplicar(
      this.service.guardarTrabajador(i.id, cuerpo),
      'Datos del trabajador involucrado actualizados.',
      (inv) => this.sincronizarTrabajador(inv),
    );
  }

  // ── 3. Información sobre el incidente ──

  protected setIncidente<K extends keyof FormIncidente>(campo: K, valor: FormIncidente[K]): void {
    this.incidente.set(this.con(this.incidente, campo, valor));
  }

  protected guardarIncidente(): void {
    const i = this.investigacion();
    const d = this.incidente();
    if (!i) return;
    const dias = enteroNoNegativo(d.totalDiasIncapacidad);
    const perdidas = decimalNoNegativo(d.totalPerdidasEconomicas);
    if (dias === null || perdidas === null) {
      this.notify.error(
        'Dato inválido',
        'Los días de incapacidad y las pérdidas son números positivos.',
      );
      return;
    }
    if (d.horaInicioJornada && !HORA.test(d.horaInicioJornada)) {
      this.notify.error(
        'Dato inválido',
        'La hora de inicio de la jornada se escribe como HH:mm (por ejemplo, 06:30).',
      );
      return;
    }
    if (d.causoMuerte && !d.fechaMuerte) {
      this.notify.error('Falta la fecha', 'Indique la fecha de la muerte.');
      return;
    }
    const texto = (s: string) => s.trim() || undefined;
    const lesion = this.involucraLesionado();
    const cuerpo: Record<string, unknown> = {
      empresaDondeOcurrio: texto(d.empresaDondeOcurrio),
      direccionOcurrencia: texto(d.direccionOcurrencia),
      jornadaSuceso: d.jornadaSuceso || undefined,
      zona: d.zona || undefined,
      horaInicioJornada: d.horaInicioJornada || undefined,
      oficioEraPropioDelCargo: d.oficioEraPropioDelCargo,
      seInformoOportunamente: d.seInformoOportunamente,
      sucesosSimilaresPrevios: d.sucesosSimilaresPrevios,
      sucesosSimilaresDetalle: d.sucesosSimilaresPrevios
        ? texto(d.sucesosSimilaresDetalle)
        : undefined,
      danosMateriales: texto(d.danosMateriales),
      totalPerdidasEconomicas: perdidas,
      danosMedioAmbiente: texto(d.danosMedioAmbiente),
      factorQueOrigino: texto(d.factorQueOrigino),
      // los datos de la lesión solo existen si el resultado del incidente involucra a un lesionado
      ...(lesion
        ? {
            tiempoAtencionMedica: texto(d.tiempoAtencionMedica),
            centroMedico: texto(d.centroMedico),
            causoMuerte: d.causoMuerte,
            fechaMuerte: d.causoMuerte ? d.fechaMuerte : undefined,
            parteCuerpoAfectada: texto(d.parteCuerpoAfectada),
            tipoLesionSufrida: texto(d.tipoLesionSufrida),
            totalDiasIncapacidad: dias,
            continuaIncapacitado: d.continuaIncapacitado,
          }
        : {}),
    };
    this.aplicar(
      this.service.guardarIncidente(i.id, cuerpo),
      'Información del incidente actualizada.',
      (inv) => this.sincronizarIncidente(inv),
    );
  }

  // ── 4. Evidencias, testimonios y testigos ──

  protected guardarEvidencias(): void {
    const i = this.investigacion();
    if (!i) return;
    this.aplicar(
      this.service.guardarEvidencias(i.id, {
        evidenciasRecopiladas: this.evidencias().trim() || undefined,
        testimoniosResumen: this.testimonios().trim() || undefined,
      }),
      'Evidencias y testimonios actualizados.',
      (inv) => this.sincronizarEvidencias(inv),
    );
  }

  private testigosActuales(i: InvestigacionDetalle) {
    return i.testigos.map((t) => ({
      nombresApellidos: t.nombresApellidos,
      ...(t.cedula ? { cedula: t.cedula } : {}),
      version: t.version,
    }));
  }

  protected agregarTestigo(): void {
    const i = this.investigacion();
    if (!i || !this.puedeAgregarTestigo()) return;
    const t = this.nuevoTestigo();
    const nuevo = {
      nombresApellidos: t.nombresApellidos.trim(),
      ...(t.cedula.trim() ? { cedula: t.cedula.trim() } : {}),
      version: t.version.trim(),
    };
    this.aplicar(this.service.guardarTestigos(i.id, [...this.testigosActuales(i), nuevo]), '', () =>
      this.nuevoTestigo.set({ nombresApellidos: '', cedula: '', version: '' }),
    );
  }

  protected quitarTestigo(indice: number): void {
    const i = this.investigacion();
    if (!i) return;
    this.aplicar(
      this.service.guardarTestigos(
        i.id,
        this.testigosActuales(i).filter((_, k) => k !== indice),
      ),
      '',
    );
  }

  // ── 5. Entorno de trabajo ──

  private factoresActuales(i: InvestigacionDetalle) {
    return i.entorno.map((f) => ({
      tipo: f.tipo,
      fuente: f.fuente,
      existeControl: f.existeControl,
      contribuyoAlSuceso: f.contribuyoAlSuceso,
    }));
  }

  protected agregarFactor(): void {
    const i = this.investigacion();
    if (!i || !this.puedeAgregarFactor()) return;
    const f = this.nuevoFactor();
    const nuevo = {
      tipo: f.tipo.trim(),
      fuente: f.fuente.trim(),
      existeControl: f.existeControl,
      contribuyoAlSuceso: f.contribuyoAlSuceso,
    };
    this.aplicar(this.service.guardarEntorno(i.id, [...this.factoresActuales(i), nuevo]), '', () =>
      this.nuevoFactor.set({
        tipo: '',
        fuente: '',
        existeControl: false,
        contribuyoAlSuceso: false,
      }),
    );
  }

  protected quitarFactor(indice: number): void {
    const i = this.investigacion();
    if (!i) return;
    this.aplicar(
      this.service.guardarEntorno(
        i.id,
        this.factoresActuales(i).filter((_, k) => k !== indice),
      ),
      '',
    );
  }

  // ── 6. 5 Porqués ──

  private porquesActuales(i: InvestigacionDetalle) {
    return i.porques.map((p) => ({ pregunta: p.pregunta, respuesta: p.respuesta }));
  }

  protected agregarPorque(): void {
    const i = this.investigacion();
    if (!i || !this.puedeAgregarPorque()) return;
    const nuevo = {
      pregunta: this.nuevaPregunta().trim(),
      respuesta: this.nuevaRespuesta().trim(),
    };
    this.aplicar(this.service.guardarPorques(i.id, [...this.porquesActuales(i), nuevo]), '', () => {
      this.nuevaPregunta.set('');
      this.nuevaRespuesta.set('');
    });
  }

  protected quitarPorque(indice: number): void {
    const i = this.investigacion();
    if (!i) return;
    this.aplicar(
      this.service.guardarPorques(
        i.id,
        this.porquesActuales(i).filter((_, k) => k !== indice),
      ),
      '',
    );
  }

  // ── 7. Ishikawa (varias causas por categoría) ──

  protected causasIshikawaDe(categoriaId: string) {
    return (this.investigacion()?.ishikawa ?? []).filter((c) => c.categoriaId === categoriaId);
  }

  private ishikawaActual(i: InvestigacionDetalle) {
    return i.ishikawa.map((c) => ({ categoriaId: c.categoriaId, descripcion: c.descripcion }));
  }

  protected setNuevaIshikawa(categoriaId: string, valor: string): void {
    this.nuevaIshikawa.update((m) => ({ ...m, [categoriaId]: valor }));
  }

  protected agregarIshikawa(categoriaId: string): void {
    const i = this.investigacion();
    const texto = (this.nuevaIshikawa()[categoriaId] ?? '').trim();
    if (!i || !texto) return;
    this.aplicar(
      this.service.guardarIshikawa(i.id, [
        ...this.ishikawaActual(i),
        { categoriaId, descripcion: texto },
      ]),
      '',
      () => this.setNuevaIshikawa(categoriaId, ''),
    );
  }

  protected quitarIshikawa(orden: number): void {
    const i = this.investigacion();
    if (!i) return;
    this.aplicar(
      this.service.guardarIshikawa(
        i.id,
        this.ishikawaActual(i).filter((_, k) => k + 1 !== orden),
      ),
      '',
    );
  }

  // ── 8. Causas (inmediatas, básicas y fuente de gestión) y lecciones aprendidas ──

  protected causasDeTipo(tipo: TipoCausa) {
    return causasDe(this.investigacion()?.causas ?? [], tipo);
  }

  private causasActuales(i: InvestigacionDetalle) {
    return i.causas.map((c) => ({ tipo: c.tipo, descripcion: c.descripcion }));
  }

  protected setNuevaCausa(tipo: TipoCausa, valor: string): void {
    this.nuevaCausa.update((m) => ({ ...m, [tipo]: valor }));
  }

  protected agregarCausa(tipo: TipoCausa): void {
    const i = this.investigacion();
    const texto = (this.nuevaCausa()[tipo] ?? '').trim();
    if (!i || !texto) return;
    this.aplicar(
      this.service.guardarCausas(i.id, [...this.causasActuales(i), { tipo, descripcion: texto }]),
      '',
      () => this.setNuevaCausa(tipo, ''),
    );
  }

  protected quitarCausa(tipo: TipoCausa, orden: number): void {
    const i = this.investigacion();
    if (!i) return;
    const sinEsa = i.causas.filter((c) => !(c.tipo === tipo && c.orden === orden));
    this.aplicar(
      this.service.guardarCausas(
        i.id,
        sinEsa.map((c) => ({ tipo: c.tipo, descripcion: c.descripcion })),
      ),
      '',
    );
  }

  /** Conclusión, lecciones aprendidas y vínculo con IPERC se guardan juntos: el backend reemplaza los tres valores. */
  private guardarConclusion(
    cambios: { conclusion?: Conclusion; ipercActividadId?: string },
    exito: string,
  ): void {
    const i = this.investigacion();
    if (!i) return;
    this.aplicar(
      this.service.guardarConclusion(i.id, {
        conclusion: cambios.conclusion ?? i.conclusion ?? undefined,
        leccionesAprendidas: this.leccionesAprendidas().trim() || undefined,
        ipercActividadId: cambios.ipercActividadId ?? i.ipercActividad?.id,
      }),
      exito,
      (inv) => this.leccionesAprendidas.set(inv.leccionesAprendidas ?? ''),
    );
  }

  protected guardarLecciones(): void {
    this.guardarConclusion({}, 'Lecciones aprendidas actualizadas.');
  }

  // ── 9. Acciones correctivas y preventivas ──

  protected alternarControl(nivel: NivelControl): void {
    this.nuevaAccionControles.update((l) =>
      l.includes(nivel) ? l.filter((n) => n !== nivel) : [...l, nivel],
    );
  }

  protected agregarAccion(): void {
    const i = this.investigacion();
    const plazo = this.nuevaAccionPlazo();
    if (!i || !plazo || !this.puedeAgregarAccion()) return;
    this.aplicar(
      this.service.registrarAccion(i.id, {
        descripcion: this.nuevaAccionDescripcion().trim(),
        tipo: this.nuevaAccionTipo(),
        responsableId: this.nuevaAccionResponsable(),
        plazo: toLocalDateString(plazo),
        controles: this.nuevaAccionControles(),
      }),
      'Acción registrada.',
      () => {
        this.nuevaAccionDescripcion.set('');
        this.nuevaAccionResponsable.set('');
        this.nuevaAccionPlazo.set(null);
        this.nuevaAccionControles.set([]);
      },
    );
  }

  protected implementarAccion(a: AccionInvestigacion): void {
    const i = this.investigacion();
    if (!i) return;
    this.aplicar(this.service.implementarAccion(i.id, a.id), 'La acción quedó implementada.');
  }

  protected setObservacionVerificacion(accionId: string, valor: string): void {
    this.observacionVerificacion.update((m) => ({ ...m, [accionId]: valor }));
  }

  protected verificarAccion(a: AccionInvestigacion, fueEficaz: boolean): void {
    const i = this.investigacion();
    if (!i) return;
    const observacion = (this.observacionVerificacion()[a.id] ?? '').trim();
    if (!fueEficaz && !observacion) {
      this.notify.error(
        'Falta la observación',
        'Si la acción no resultó eficaz, explique por qué.',
      );
      return;
    }
    this.aplicar(
      this.service.verificarAccion(i.id, a.id, fueEficaz, observacion || undefined),
      'Verificación registrada.',
    );
  }

  protected pedirCancelacion(a: AccionInvestigacion): void {
    this.accionCancelando.set(a.id);
    this.motivoCancelacion.set('');
  }

  protected confirmarCancelacion(a: AccionInvestigacion): void {
    const i = this.investigacion();
    const motivo = this.motivoCancelacion().trim();
    if (!i || !motivo) return;
    this.aplicar(
      this.service.cancelarAccion(i.id, a.id, motivo),
      'La acción quedó cancelada.',
      () => this.accionCancelando.set(null),
    );
  }

  // ── 10. Notificación legal ──

  /** Guarda la notificación legal (el backend reemplaza obligación y las dos fechas). */
  private guardarNotificacion(cambios: {
    requerida?: boolean;
    ministerio?: string;
    iess?: string;
  }): void {
    const i = this.investigacion();
    if (!i) return;
    const n = i.notificacionLegal;
    const requerida = cambios.requerida ?? true;
    const ministerio = cambios.ministerio ?? n.ministerioTrabajoNotificadoAt ?? undefined;
    const iess = cambios.iess ?? n.iessNotificadoAt ?? undefined;
    this.aplicar(
      this.service.guardarNotificacionLegal(i.id, {
        requerida,
        ...(requerida && ministerio ? { ministerioTrabajoNotificadoAt: ministerio } : {}),
        ...(requerida && iess ? { iessNotificadoAt: iess } : {}),
      }),
      'Notificación legal actualizada.',
    );
  }

  protected alternarNotificacionRequerida(requerida: boolean): void {
    this.guardarNotificacion({ requerida });
  }

  protected marcarNotificadoMinisterio(): void {
    this.guardarNotificacion({ requerida: true, ministerio: new Date().toISOString() });
  }

  protected marcarNotificadoIess(): void {
    this.guardarNotificacion({ requerida: true, iess: new Date().toISOString() });
  }

  // ── 11 y 12. Vínculo con IPERC y conclusión ──

  protected seleccionarIperc(ipercActividadId: string): void {
    if (ipercActividadId)
      this.guardarConclusion({ ipercActividadId }, 'Vínculo con la matriz IPERC guardado.');
  }

  protected seleccionarConclusion(conclusion: Conclusion): void {
    if (conclusion) this.guardarConclusion({ conclusion }, 'Conclusión guardada.');
  }

  // ── 13. Revisión y cierre ──

  protected enviarARevision(): void {
    const i = this.investigacion();
    if (!i) return;
    this.aplicar(
      this.service.enviarARevision(i.id),
      'La investigación quedó en revisión del Gerente HSE.',
    );
  }

  protected devolver(): void {
    const i = this.investigacion();
    const observacion = this.observacionDevolucion().trim();
    if (!i) return;
    if (!observacion) {
      this.notify.error('Falta la observación', 'Escriba qué debe corregirse.');
      return;
    }
    this.aplicar(
      this.service.devolver(i.id, observacion),
      'La investigación se devolvió con su observación.',
      () => this.observacionDevolucion.set(''),
    );
  }

  protected cerrar(): void {
    const i = this.investigacion();
    if (!i) return;
    this.aplicar(
      this.service.cerrar(i.id),
      'Se aprobó el informe y la investigación quedó cerrada; el seguimiento de sus acciones continúa.',
    );
  }

  protected back(): void {
    this.router.navigate(['/dashboard/qhse/investigaciones']);
  }
}
