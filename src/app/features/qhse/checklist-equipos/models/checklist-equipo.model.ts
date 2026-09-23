/** `QhseChecklistEquipo` del backend — un caso por equipo (unidad) asignado a un ticket de Pumping (Fase 4). */
export interface ChecklistEquipo {
  id: number;
  pumpingTicketId: number;
  equipoTipo: string;
  equipoId: number;
  equipoNombre: string;
  estado: 'pendiente' | 'cargado' | 'aprobado' | 'rechazado';
  abiertoPor: string;
  documentoNombreOriginal: string | null;
  cargadoPor: string | null;
  cargadoAt: string | null;
  revisadoPor: string | null;
  revisadoAt: string | null;
  motivoRechazo: string | null;
  createdAt: string;
}
