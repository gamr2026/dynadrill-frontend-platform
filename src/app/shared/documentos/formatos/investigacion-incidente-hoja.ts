import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  INCIDENTE_RESULTADO_LABELS,
  type Investigacion,
} from '../../../features/qhse/investigaciones/models/investigacion.model';
import { DocumentoEncabezado } from '../documento-encabezado';
import { fechaDoc } from '../documento-format.util';

type Campo = readonly [etiqueta: string, valor: string];

const sn = (v: boolean | undefined): string => (v === true ? 'Sí' : v === false ? 'No' : '');

/**
 * Formato DYN-SGI-RE-034 "Reporte de investigación de incidentes y/o accidentes de trabajo" — 6 páginas: datos del
 * evento y del trabajador, descripción, testigos, técnica de análisis, entorno y causas, medidas de intervención,
 * verificación de eficacia, conclusión y equipo investigador. Las firmas (testigos, verificación y equipo) salen en
 * blanco con el nombre impreso de quien ya está registrado; se firman sobre el PDF.
 */
@Component({
  selector: 'app-doc-investigacion-incidente',
  imports: [DocumentoEncabezado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './investigacion-incidente-hoja.html',
  styleUrl: './investigacion-incidente-hoja.scss',
})
export class InvestigacionIncidenteHoja {
  readonly investigacion = input.required<Investigacion>();

  protected readonly fecha = fechaDoc;

  protected readonly otroTipo = computed(() => {
    const r = this.investigacion().resultado;
    return r === 'fatal' || r === 'grave' ? '' : INCIDENTE_RESULTADO_LABELS[r];
  });

  protected readonly perdidas = computed(() => {
    const d = this.investigacion().detalle;
    return [d.danosMateriales, d.totalPerdidasEconomicas != null ? `USD ${d.totalPerdidasEconomicas}` : ''].filter(Boolean).join(' — ');
  });

  protected readonly trabajador = computed<Campo[]>(() => {
    const t = this.investigacion().trabajador;
    return [
      ['Apellidos y nombres:', t?.apellidosNombres ?? ''],
      ['Número de Cédula de Identidad:', t?.cedula ?? ''],
      ['Dirección:', t?.direccion ?? ''],
      ['Teléfono:', t?.telefono ?? ''],
      ['Fecha de nacimiento:', fechaDoc(t?.fechaNacimiento)],
      ['Sexo:', t?.sexo ?? ''],
      ['Cargo:', t?.cargo ?? ''],
      ['Fecha de ingreso a la empresa:', fechaDoc(t?.fechaIngreso)],
      ['Tipo de vinculación:', t?.tipoVinculacion ?? ''],
      ['Oficio que desempeñaba en el momento del evento:', t?.oficioDesempenaba ?? ''],
      ['Jornada de trabajo habitual:', t?.jornadaHabitual ?? ''],
      ['Tiempo de experiencia en el oficio que desempeñaba en el momento del evento, en meses:', t?.tiempoExperienciaMeses != null ? String(t.tiempoExperienciaMeses) : ''],
    ];
  });

  protected readonly incidente1 = computed<Campo[]>(() => {
    const d = this.investigacion().detalle;
    return [
      ['Fecha de ocurrencia del suceso:', fechaDoc(d.fechaOcurrencia)],
      ['Día de ocurrencia del suceso:', d.diaOcurrencia ?? ''],
      ['Hora de ocurrencia del suceso:', d.horaOcurrencia ?? ''],
      ['Jornada en que sucede el suceso (ordinaria, extra, suplementaria):', d.jornadaSuceso ?? ''],
      ['Empresa donde ocurrió el suceso:', d.empresaDondeOcurrio ?? ''],
      ['Causó muerte el accidente?:', sn(d.causoMuerte)],
      ['Fecha de la muerte del trabajador:', fechaDoc(d.fechaMuerte)],
      ['Dirección donde ocurrió el suceso (incluya municipio y departamento):', d.direccionOcurrencia ?? ''],
      ['Zona (rural o urbana):', d.zona ?? ''],
      ['El oficio (Actividad) que ejecutaba era propio de su cargo o labor habitual:', sn(d.oficioEraPropioDeCargo)],
      ['Hora de inicio de la jornada laboral:', d.horaInicioJornada ?? ''],
      ['Total tiempo laborado previo al suceso:', d.tiempoLaboradoPrevioHoras != null ? `${d.tiempoLaboradoPrevioHoras} h` : ''],
    ];
  });

  protected readonly incidente2 = computed<Campo[]>(() => {
    const d = this.investigacion().detalle;
    return [
      ['Se informó oportunamente del suceso de trabajo:', sn(d.seInformoOportunamente)],
      ['Tiempo que tardó en recibir atención médica desde el momento del accidente:', d.tiempoAtencionMedica ?? ''],
      ['Centro Médico donde recibió la atención', d.centroMedico ?? ''],
      ['Parte del cuerpo afectada:', d.parteCuerpoAfectada ?? ''],
      ['Tipo de lesión sufrida:', d.tipoLesionSufrida ?? ''],
      ['Factor que originó el suceso:', d.factorQueOrigino ?? ''],
      ['Total días de incapacidad hasta la fecha de la investigación:', d.totalDiasIncapacidad != null ? String(d.totalDiasIncapacidad) : ''],
      ['Daños materiales de la empresa cliente o de la propia empresa:', d.danosMateriales ?? ''],
      ['Total pérdidas económicas para la empresa:', d.totalPerdidasEconomicas != null ? String(d.totalPerdidasEconomicas) : ''],
      ['Daños al medio ambiente:', d.danosMedioAmbiente ?? ''],
      ['Continúa incapacitado (Sí o no):', sn(d.continuaIncapacitado)],
      ['Han ocurrido sucesos similares (Sí o no. En caso afirmativo, ampliar detalles)', [sn(d.sucesosSimilaresPrevios), d.sucesosSimilaresDetalle].filter(Boolean).join(' — ')],
    ];
  });

  /** Siempre 3 testigos, como el formato. */
  protected readonly testigos = computed(() => {
    const t = this.investigacion().testigos;
    return [0, 1, 2].map(i => t[i] ?? { id: -i, nombresApellidos: '', cedula: '', version: '' });
  });

  protected readonly tecnica = computed(() => {
    const i = this.investigacion();
    const porques = i.cincoPorques.filter(p => p.respuesta.trim()).map((p, n) => `${n + 1}. ${p.pregunta} → ${p.respuesta}`);
    const ishikawa = Object.entries(i.ishikawa).filter(([, v]) => v.trim()).map(([k, v]) => `${k}: ${v}`);
    return [...porques, ...ishikawa];
  });

  protected readonly entorno = computed(() => {
    const e = [...this.investigacion().entornoTrabajo];
    while (e.length < 7) e.push({ id: -e.length, tipo: '', fuente: '', existeControl: '', contribuyoAlSuceso: '' });
    return e;
  });

  protected readonly acciones = computed(() => {
    const a = [...this.investigacion().acciones];
    return a;
  });
  protected readonly accionesFilas = computed(() => Array.from({ length: Math.max(9, this.acciones().length) }, (_, i) => this.acciones()[i] ?? null));
  protected readonly verificacionFilas = computed(() => Array.from({ length: Math.max(8, this.acciones().length) }, (_, i) => this.acciones()[i] ?? null));

  /** Nombres del equipo investigador en 4 cajas (2×2) como el formato; líder primero. */
  protected readonly equipo = computed(() => {
    const i = this.investigacion();
    const nombres = [i.liderInvestigacionNombre, ...i.equipoInvestigador].filter((n): n is string => !!n);
    return [0, 1, 2, 3].map(n => nombres[n] ?? '');
  });

  protected readonly marcaControl = (v: boolean | undefined): string => (v ? 'X' : '');
}
