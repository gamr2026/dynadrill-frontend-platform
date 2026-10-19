import { describe, expect, it } from 'vitest';
import { hojaDeInspeccion, hojaDeViaje } from './hojas.mapper';
import type { InspeccionDetalle } from './inspeccion-flota.model';
import type { PreguntaRiesgo, ViajeDetalle } from './viaje-flota.model';

const inspeccion: InspeccionDetalle = {
  id: 'i-1',
  momento: 'salida',
  fecha: '2026-10-18T14:00:00.000Z',
  puntoPartida: 'Base Coca',
  destino: 'Pozo 1',
  observaciones: null,
  km: 1200,
  unidad: {
    id: 'u-1',
    codigo: 'CAM-04',
    nombre: 'Camioneta',
    vehiculo: { placa: 'PBA1234', marca: 'Toyota', modelo: 'Hilux', anio: 2022 },
    documentos: {
      fechaMatricula: '2026-01-10',
      caducidadMatricula: '2027-01-10',
      caducidadPoliza: null,
      vigenciaOtroDocumento: null,
    },
  },
  caso: null,
  conductor: { id: 'c-1', nombre: 'Carlos Conductor' },
  registradaPor: { id: 'c-1', nombre: 'Carlos Conductor' },
  registradaAt: '2026-10-18T14:00:00.000Z',
  anulada: null,
  estado: 'aprobada',
  hayNovedades: true,
  bloqueaUso: false,
  resultados: [
    {
      itemId: 'a',
      codigo: 'vidrios',
      seccion: 'vehiculo',
      orden: 1,
      etiqueta: 'Vidrios — buenas condiciones',
      resultado: 'cumple',
    },
    {
      itemId: 'b',
      codigo: 'frenos',
      seccion: 'vehiculo',
      orden: 2,
      etiqueta: 'Frenos — ajustados',
      resultado: 'no_cumple',
    },
    {
      itemId: 'c',
      codigo: 'extintor',
      seccion: 'equipo',
      orden: 1,
      etiqueta: 'Extintor tipo ABC',
      resultado: 'no_aplica',
    },
  ],
  revisiones: [
    {
      decision: 'aprobada',
      motivo: null,
      por: { id: 's-1', nombre: 'Sara Supervisora' },
      at: '2026-10-18T15:00:00.000Z',
    },
  ],
};

describe('hojaDeInspeccion', () => {
  it('traduce los resultados a C / NC / NA por sección y toma el vehículo del catálogo', () => {
    const h = hojaDeInspeccion(inspeccion);
    expect(h.checklistVehiculo).toEqual([
      { label: 'Vidrios — buenas condiciones', estado: 'C' },
      { label: 'Frenos — ajustados', estado: 'NC' },
    ]);
    expect(h.checklistEquipo).toEqual([{ label: 'Extintor tipo ABC', estado: 'NA' }]);
    expect(h).toMatchObject({
      placa: 'PBA1234',
      marca: 'Toyota',
      anioFabricacion: '2022',
      inspeccionadoPor: 'Carlos Conductor',
      supervisorApprovedBy: 'Sara Supervisora',
    });
  });

  it('el kilometraje es inicial en la salida y final en la llegada', () => {
    expect(hojaDeInspeccion(inspeccion)).toMatchObject({ kmInicial: 1200, kmFinal: 0 });
    expect(hojaDeInspeccion({ ...inspeccion, momento: 'llegada' })).toMatchObject({
      kmInicial: 0,
      kmFinal: 1200,
    });
  });
});

const preguntas: PreguntaRiesgo[] = [
  {
    id: 'p1',
    codigo: 'a',
    orden: 1,
    texto: '¿Realizó inspección Pre-viaje?',
    opciones: [
      { id: 'o1', etiqueta: 'Sí: Continue', puntos: 0, impideConducir: false },
      { id: 'o2', etiqueta: 'NO: Deténgase', puntos: 0, impideConducir: true },
    ],
  },
  {
    id: 'p2',
    codigo: 'b',
    orden: 2,
    texto: '¿Es conductor nuevo?',
    opciones: [
      { id: 'o3', etiqueta: 'NO = 0', puntos: 0, impideConducir: false },
      { id: 'o4', etiqueta: '0m - 3m = 40', puntos: 40, impideConducir: false },
    ],
  },
];

const viaje: ViajeDetalle = {
  id: 'v-1',
  codigo: 'GV-0007',
  tipo: 'salida',
  ticketId: 't-1',
  ticketNumero: 15,
  fecha: '2026-10-18',
  motivo: 'Traslado',
  conductor: { id: 'c-1', nombre: 'Carlos Conductor' },
  unidad: {
    id: 'u-1',
    codigo: 'CAM-08',
    nombre: 'Camión',
    categoriaPeso: 'pesado',
    placa: 'PCB5678',
  },
  origen: { tipo: 'bodega', id: 'b-1', nombre: 'Bodega Matriz' },
  destino: { tipo: 'pozo', id: 'z-1', nombre: 'SACHA-12', campo: 'SACHA' },
  puntajeTotal: 40,
  nivel: 'medio',
  descripcionNivel: null,
  pasajeros: null,
  puedeCombinarViajes: false,
  horaSalida: '06:00',
  horaLlegada: '10:00',
  datosPernocta: null,
  aprobacionTelefonica: null,
  respuestas: [
    { orden: 1, pregunta: '¿Realizó inspección Pre-viaje?', opcion: 'Sí: Continue', puntos: 0 },
    { orden: 2, pregunta: '¿Es conductor nuevo?', opcion: '0m - 3m = 40', puntos: 40 },
  ],
  paradas: [],
  comunicaciones: [],
  estado: 'autorizado',
  decision: {
    por: { id: 's-1', nombre: 'Sara Supervisora' },
    at: '2026-10-18T15:00:00.000Z',
    motivo: null,
  },
  registradoPor: { id: 'c-1', nombre: 'Carlos Conductor' },
  createdAt: '2026-10-18T14:00:00.000Z',
  puedeDecidir: false,
};

describe('hojaDeViaje', () => {
  it('arma las preguntas con todas las opciones y marca la elegida', () => {
    const h = hojaDeViaje(viaje, preguntas);
    expect(h.riskQuestions).toHaveLength(2);
    expect(h.riskQuestions[0]).toMatchObject({
      id: 1,
      selectedLabel: 'Sí: Continue',
      selectedValue: 0,
    });
    expect(h.riskQuestions[0].options.map((o) => o.value)).toEqual([0, 999]); // «Deténgase» vale 999 en la hoja
    expect(h.riskQuestions[1]).toMatchObject({ selectedValue: 40 });
  });

  it('traduce nivel, vehículo, ruta, ticket y quién autorizó', () => {
    expect(hojaDeViaje(viaje, preguntas)).toMatchObject({
      code: 'GV-0007',
      riskLevel: 'MEDIO',
      estado: 'aprobado',
      vehicleType: 'Pesado',
      placas: 'PCB5678',
      origen: 'Bodega Matriz',
      destino: 'SACHA-12',
      ticketCode: '15',
      aprobadoPor: 'Sara Supervisora',
      totalPoints: 40,
    });
  });

  it('sin paradas, el horario va en la fila única de la ruta', () => {
    expect(hojaDeViaje(viaje, preguntas).routeInfo).toEqual([
      { location: '', arrivalTime: '10:00', departureTime: '06:00', overnightDetails: '' },
    ]);
  });
});
