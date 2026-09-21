import { inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import type { DynadrillSelectOption } from '@digitec-it-projects/dynadrill-ui';
import { PumpingService } from '../../../operations/pumping/services/pumping.service';
import { FcrService } from '../../../operations/fcr/services/fcr.service';

/** `<tipo>:<code>` → `{ ticketTipo, ticketCode }` para los diálogos de Reportar. */
export function parseServicio(value: string): { ticketTipo: 'pumping' | 'fcr'; ticketCode: string } | undefined {
  const [tipo, code] = (value ?? '').split(':');
  return (tipo === 'pumping' || tipo === 'fcr') && code ? { ticketTipo: tipo, ticketCode: code } : undefined;
}

/**
 * Opciones "servicio afectado" para los diálogos de SWA / derrame: los
 * tickets de Pumping + FCR en curso. Best-effort — si el rol no puede
 * listar tickets, devuelve `[]` (el evento igual se registra sin ligar).
 */
export function useServiciosOperativosOptions(): Observable<DynadrillSelectOption[]> {
  const pumping = inject(PumpingService);
  const fcr = inject(FcrService);
  return forkJoin({
    pumping: pumping.listTickets().pipe(catchError(() => of([]))),
    fcr: fcr.listTickets().pipe(catchError(() => of([]))),
  }).pipe(
    map(({ pumping: p, fcr: f }) => [
      ...p.map(t => ({ label: `Pumping · ${t.code} — ${t.wellName}`, value: `pumping:${t.code}` })),
      ...f.map(t => ({ label: `FCR · ${t.code} — ${t.wellName}`, value: `fcr:${t.code}` })),
    ]),
  );
}
