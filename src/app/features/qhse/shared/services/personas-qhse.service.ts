import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { RolesService } from '../../../users/services/users.service';

export interface PersonaQhse {
  id: string;
  nombre: string;
}

/** Roles de cuenta a los que QHSE puede encargar una acción o un seguimiento (responsables de planes y controles). */
const ROLES_RESPONSABLES = [
  'tecnico_hse',
  'gerente_hse',
  'supervisor',
  'supervisor_pumping',
  'jefe_base',
  'operador_mantenimiento',
];

/**
 * Personas con cuenta del portal que pueden ser responsables de una acción (objetivos y aspectos ambientales, investigaciones). Las acciones y
 * los controles guardan la cuenta (id), no un nombre escrito a mano. Si una lista de rol no se puede leer con la sesión actual, se omite.
 */
@Injectable({ providedIn: 'root' })
export class PersonasQhseService {
  private readonly roles = inject(RolesService);

  /** Personas únicas, por nombre. */
  responsables(): Observable<PersonaQhse[]> {
    return forkJoin(
      ROLES_RESPONSABLES.map((r) => this.roles.usuariosPorRol(r).pipe(catchError(() => of([])))),
    ).pipe(
      map((listas) => {
        const unicas = new Map<string, PersonaQhse>();
        for (const u of listas.flat()) unicas.set(u.id, { id: u.id, nombre: u.name });
        return [...unicas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      }),
    );
  }
}
