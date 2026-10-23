import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { EscalarDerrameContexto } from '../models/derrame';

/**
 * Quién abre el diálogo de Emergencias para escalar un derrame mayor o en cuerpo de agua (HSE-MASTER-001). El diálogo es de otro módulo, así
 * que aquí solo se declara el contrato: la función recibe el contexto del derrame y devuelve un flujo que emite `true` si se activó la
 * emergencia (y entonces la pantalla se recarga). Sin esta función provista, la pantalla muestra el aviso pero no el botón de escalar.
 *
 * Se provee en las rutas, por ejemplo:
 * `{ provide: ESCALAR_DERRAME_A_EMERGENCIA, useFactory: () => { const d = inject(DynadrillDialogService); return (c) => … } }`.
 */
export type EscalarDerrameAEmergencia = (contexto: EscalarDerrameContexto) => Observable<boolean>;

export const ESCALAR_DERRAME_A_EMERGENCIA = new InjectionToken<EscalarDerrameAEmergencia>(
  'ESCALAR_DERRAME_A_EMERGENCIA',
);
