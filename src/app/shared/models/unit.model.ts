export type UnitStatus = 'disponible' | 'asignado' | 'en_uso' | 'en_mantenimiento' | 'fuera_servicio';

export interface Unit {
  id: number;
  code: string;
  type: string;
  status: UnitStatus;
  currentKm: number;
  currentHours: number;
}
