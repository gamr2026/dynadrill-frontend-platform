import type {
  GerenciamientoViaje,
  TravelRiskQuestion,
} from '../../conductor/models/gerenciamiento-viaje.model';
import type {
  VehicleInspection,
  VehicleChecklistItem,
  ChecklistEstado,
} from '../../maintenance/models/vehicle-inspection.model';
import type { InspeccionDetalle, ResultadoChecklist } from './inspeccion-flota.model';
import type { PreguntaRiesgo, ViajeDetalle } from './viaje-flota.model';

/**
 * Traductores puros de los datos de Flota (backend nuevo) al modelo que esperan las hojas imprimibles DYN-SGI-RE-068 y DYN-SGI-RE-049.
 * Las hojas siguen siendo las mismas (las comparte el módulo viejo contra la demo); los campos que ellas no imprimen (ids, auditoría)
 * van con valores neutros.
 */

const ESTADO: Record<ResultadoChecklist, ChecklistEstado> = {
  cumple: 'C',
  no_cumple: 'NC',
  no_aplica: 'NA',
};

/**
 * Inspección de vehículos. La hoja ubica cada ítem por el inicio de su etiqueta. Los seis documentos del conductor salen como vigentes
 * porque el servidor no guarda una inspección si alguno no lo está; el kilometraje es la lectura de odómetro de esa inspección (inicial
 * en la salida, final en la llegada).
 */
export function hojaDeInspeccion(d: InspeccionDetalle): VehicleInspection {
  const items = (seccion: 'vehiculo' | 'equipo'): VehicleChecklistItem[] =>
    d.resultados
      .filter((r) => r.seccion === seccion)
      .map((r) => ({ label: r.etiqueta, estado: ESTADO[r.resultado] }));
  const v = d.unidad.vehiculo;
  const aprobada = d.revisiones.find((r) => r.decision === 'aprobada');
  return {
    id: 0,
    unidadId: 0,
    unidadCode: d.unidad.codigo,
    fecha: d.fecha,
    puntoPartida: d.puntoPartida,
    destino: d.destino ?? '',
    inspeccionadoPor: d.conductor.nombre,
    marca: v?.marca ?? '',
    tipo: '',
    modelo: v?.modelo ?? '',
    anioFabricacion: v?.anio ? String(v.anio) : '',
    placa: v?.placa ?? '',
    fechaMatricula: d.unidad.documentos.fechaMatricula ?? undefined,
    caducidadMatricula: d.unidad.documentos.caducidadMatricula ?? undefined,
    caducidadPoliza: d.unidad.documentos.caducidadPoliza ?? undefined,
    vigenciaOtroDocumento: d.unidad.documentos.vigenciaOtroDocumento ?? undefined,
    kmInicial: d.momento === 'salida' ? (d.km ?? 0) : 0,
    kmFinal: d.momento === 'llegada' ? (d.km ?? 0) : 0,
    checklistVehiculo: items('vehiculo'),
    checklistEquipo: items('equipo'),
    licenciaVigente: true,
    manejoDefensivoVigente: true,
    examenMedicoVigente: true,
    examenPsicosensometrico: true,
    documentosClientes: true,
    vacunasCertificado: true,
    reuneCondicionesParaTrabajar: true,
    observacionesConductor: d.observaciones ?? undefined,
    supervisorApprovedBy: aprobada?.por.nombre,
    supervisorApprovedAt: aprobada?.at,
    createdAt: d.registradaAt,
  };
}

const BLOQUEANTE = 999;

/**
 * Gerenciamiento de viaje. La hoja muestra las tres casillas de cada pregunta, así que se arma con el catálogo (todas las opciones)
 * y la respuesta que se eligió. Una respuesta que impide viajar vale 999 en la hoja (sale como «NO VIAJA»).
 */
export function hojaDeViaje(v: ViajeDetalle, preguntas: PreguntaRiesgo[]): GerenciamientoViaje {
  const riskQuestions: TravelRiskQuestion[] = preguntas.map((p) => {
    const elegida = v.respuestas.find((r) => r.orden === p.orden);
    const valor = (o: PreguntaRiesgo['opciones'][number]) =>
      o.impideConducir ? BLOQUEANTE : o.puntos;
    const opcion = p.opciones.find((o) => o.etiqueta === elegida?.opcion);
    return {
      id: p.orden,
      question: p.texto,
      options: p.opciones.map((o) => ({ label: o.etiqueta, value: valor(o) })),
      selectedValue: opcion ? valor(opcion) : null,
      selectedLabel: opcion?.etiqueta ?? null,
    };
  });
  const lugar = (e: ViajeDetalle['origen']) => e.nombre;
  return {
    id: 0,
    code: v.codigo,
    estado: v.estado === 'autorizado' ? 'aprobado' : v.estado,
    riskLevel: v.nivel === 'bajo' ? 'BAJO' : v.nivel === 'medio' ? 'MEDIO' : 'ALTO',
    tipo: v.tipo,
    solicitanteUserId: 0,
    fecha: v.fecha,
    motivoViaje: v.motivo,
    origen: lugar(v.origen),
    destino: lugar(v.destino),
    ticketCode: v.ticketNumero !== null ? String(v.ticketNumero) : undefined,
    vehicleType: v.unidad.categoriaPeso === 'pesado' ? 'Pesado' : 'Liviano',
    placas: v.unidad.placa ?? v.unidad.codigo,
    riskQuestions,
    totalPoints: v.puntajeTotal,
    passengers: v.pasajeros ?? undefined,
    canCombineTrips: v.puedeCombinarViajes,
    routeInfo: v.paradas.length
      ? v.paradas.map((p) => ({
          location: p.lugar,
          arrivalTime: p.horaLlegada ?? '',
          departureTime: p.horaSalida ?? '',
          overnightDetails: p.detallePernocta ?? '',
        }))
      : [
          {
            location: '',
            arrivalTime: v.horaLlegada ?? '',
            departureTime: v.horaSalida ?? '',
            overnightDetails: v.datosPernocta ?? '',
          },
        ],
    communication: v.comunicaciones.map((c) => ({
      frequency: c.frecuencia,
      contactPerson: c.personaContacto,
      contactDetails: c.datosContacto ?? '',
    })),
    departureTime: v.horaSalida ?? undefined,
    arrivalTime: v.horaLlegada ?? undefined,
    overnightData: v.datosPernocta ?? undefined,
    conductorNames: v.conductor.nombre,
    conductorSignature: '',
    phoneApprovalBy: v.aprobacionTelefonica?.de,
    phoneApprovalTime: v.aprobacionTelefonica?.hora ?? undefined,
    aprobadoPor: v.estado === 'autorizado' ? (v.decision?.por?.nombre ?? undefined) : undefined,
    aprobadoAt: v.estado === 'autorizado' ? v.decision?.at : undefined,
    motivoRechazo: v.estado === 'rechazado' ? (v.decision?.motivo ?? undefined) : undefined,
    createdAt: v.createdAt,
  };
}
