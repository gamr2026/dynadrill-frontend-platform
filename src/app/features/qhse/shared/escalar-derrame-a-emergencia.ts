import { inject } from '@angular/core';
import { map } from 'rxjs';
import { DynadrillDialogService } from '@digitec-it-projects/dynadrill-ui';
import type { EscalarDerrameAEmergencia } from '../derrames-plataforma/services/escalar-emergencia';
import {
  EmergenciaActivarDialog,
  type EmergenciaActivada,
} from '../emergencias-plataforma/components/emergencia-activar-dialog';
import type { EmergenciaActivarDialogData } from '../emergencias-plataforma/models/emergencia';

/**
 * Conecta el botón «Escalar a Emergencia Mayor» del derrame (HSE-MASTER-001) con el diálogo de Emergencias. Se provee en la ruta del detalle del
 * derrame (`ESCALAR_DERRAME_A_EMERGENCIA`): así las dos pantallas no se importan entre sí. La emergencia hereda el servicio del derrame.
 */
export function escalarDerrameAEmergencia(): EscalarDerrameAEmergencia {
  const dialogos = inject(DynadrillDialogService);
  return (contexto) =>
    dialogos
      .open<EmergenciaActivarDialog, EmergenciaActivarDialogData>({
        title: 'Escalar a Emergencia Mayor — HSE-TRIAGE-001',
        content: EmergenciaActivarDialog,
        data: {
          origenDerrameId: contexto.derrameId,
          tipoSugerido: 'derrame_mayor',
          descripcionSugerida: `Escalado desde el derrame ${contexto.codigo}: ${contexto.descripcion}`,
          ...(contexto.ticketId ? { ticketId: contexto.ticketId } : {}),
        },
        footer: false,
        width: '560px',
      })
      .afterClose.pipe(map((activada?: EmergenciaActivada) => !!activada));
}
