import type {
  FcrToolInspection,
  FcrToolInspectionFirma,
  FcrToolInspectionFirmaRol,
} from '../../models/fcr-tool-inspeccion.model';
import type { InspeccionHerramienta } from '../models/ticket-fcr';

const ESTADOS = {
  borrador: 'borrador',
  enviada: 'enviado',
  aprobada: 'aprobado',
  rechazada: 'rechazado',
} as const;

/** La inspección del backend nuevo en la forma que imprime la hoja del formato DYN-FCR-RE-009 (Inspección y reparación de herramientas). */
export function inspeccionAFormato(i: InspeccionHerramienta): FcrToolInspection {
  const firmas: Partial<Record<FcrToolInspectionFirmaRol, FcrToolInspectionFirma>> = {};
  const poner = (
    rol: FcrToolInspectionFirmaRol,
    f: InspeccionHerramienta['firmas'][keyof InspeccionHerramienta['firmas']],
  ) => {
    if (f) firmas[rol] = { nombre: f.nombre, fecha: f.firmadaAt, firmado: true };
  };
  poner('reparadoPor', i.firmas.reparado_por);
  poner('revisadoPor', i.firmas.revisado_por);
  poner('liberadoQhse', i.firmas.liberado_qhse);
  return {
    id: 0,
    ticketId: 0,
    toolId: 0,
    articuloId: null,
    cliente: i.cliente ?? '',
    pozo: i.pozo ?? '',
    fechaInspeccion: i.fechaInspeccion,
    fechaReparacion: i.fechaReparacion,
    fechaEnvio: i.fechaEnvio,
    descripcionHerramienta: i.descripcionHerramienta,
    numeroSerie: i.numeroSerie ?? '',
    inspeccionadoPor: i.inspeccionadoPor ?? '',
    reparadoPor: firmas.reparadoPor?.nombre ?? '',
    estado: ESTADOS[i.estado],
    observaciones: i.observaciones ?? '',
    firmas,
    partes: i.partes.map((p, k) => ({
      id: k + 1,
      orden: p.orden,
      item: p.item,
      codigo: p.codigo ?? '',
      descripcion: p.descripcion,
      cantidadEsperada: p.cantidadEsperada,
      visualResultado: p.visual ?? '',
      endResultado: p.endResultado ?? '',
      cambioCantidad: p.cambioCantidad,
      accion: p.accion ?? '',
      manual: p.manual,
    })),
  };
}
