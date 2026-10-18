import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap } from 'rxjs';
import {
  MaintenanceOrderWithSubOrders,
  MaintenanceType,
  Repuesto,
  SubOrder,
  UnitFinalState,
} from '../models/maintenance-order.model';
import type { AsignacionApi } from '../models/mantenimiento-plataforma.model';
import {
  asignacionesDeOrden,
  avanceAApi,
  ordenAMaintenanceOrder,
  subordenASubOrder,
  tipoDeSubordenApi,
} from '../models/mantenimiento-plataforma.mapper';
import { MantenimientoPlataformaService } from './mantenimiento-plataforma.service';

export interface ClassifyTypeAssignment {
  type: MaintenanceType;
  /** Solo Mecánico/Instrumental: UUID de la cuenta del operador de mantenimiento. */
  userId?: string;
  userName?: string;
  /** Solo Operativo — true (default) = Atendido, se deriva de inmediato; false = queda Pendiente para derivar después desde el panel. */
  operativoAttended?: boolean;
  /** Solo Operativo + Atendido — motivo de la derivación, mismo campo que pide "Derivar a Pumping" del panel (esa ruta sí lo exigía; esta lo dejaba vacío). */
  operativoDeriveNote?: string;
}

export interface ClassifyOrderInput {
  /** UUID del reporte recibido que se clasifica. Quién asigna lo registra el backend (la cuenta que actúa). */
  unitReportId: string;
  assignments: ClassifyTypeAssignment[];
}

export interface CloseOrderInput {
  estadoFinal: UnitFinalState;
  observaciones: string;
}

const ESTADO_FINAL_API = { Disponible: 'disponible', 'Con restricciones': 'con_restricciones' } as const;

/** Lo que pide la clasificación → lo que recibe el backend. */
function aAsignacionApi(a: ClassifyTypeAssignment): AsignacionApi {
  if (a.type === 'Operativo') {
    return { tipo: 'operativo', derivar: a.operativoAttended ?? true, notaDerivacion: a.operativoDeriveNote ?? null };
  }
  return { tipo: tipoDeSubordenApi(a.type), usuarioId: a.userId ?? null };
}

/**
 * Órdenes y sub-órdenes de mantenimiento correctivo, contra el backend nuevo (`/api/operaciones/mantenimiento`). Traduce sus
 * respuestas a los modelos que usan las pantallas (ver `mantenimiento-plataforma.mapper.ts`).
 */
@Injectable({ providedIn: 'root' })
export class MaintenanceOrdersService {
  private readonly api = inject(MantenimientoPlataformaService);

  /** `asignadaA` (UUID): solo las órdenes con una sub-orden asignada a esa cuenta, para «Mis tareas». */
  list(filtros: { asignadaA?: string } = {}): Observable<MaintenanceOrderWithSubOrders[]> {
    return this.api.ordenes(filtros).pipe(map(os => os.map(ordenAMaintenanceOrder)));
  }

  get(id: string): Observable<MaintenanceOrderWithSubOrders> {
    return this.api.orden(id).pipe(map(ordenAMaintenanceOrder));
  }

  /** MAN-001-A: crea la orden + una sub-orden por cada tipo seleccionado. */
  classify(input: ClassifyOrderInput): Observable<MaintenanceOrderWithSubOrders> {
    return this.api.clasificar(input.unitReportId, input.assignments.map(aAsignacionApi)).pipe(map(ordenAMaintenanceOrder));
  }

  /**
   * Edita los tipos de una orden ya clasificada — agrega sub-órdenes para tipos nuevos, quita las que ya no aplican, y puede
   * reasignar el operador/estado Operativo de una sub-orden ya existente. Las sub-órdenes Cerradas se conservan intactas aunque su
   * tipo se destilde (no se pierde trabajo ya aprobado).
   */
  updateClassification(orderId: string, assignments: ClassifyTypeAssignment[]): Observable<MaintenanceOrderWithSubOrders> {
    return this.api.reclasificar(orderId, assignments.map(aAsignacionApi)).pipe(map(ordenAMaintenanceOrder));
  }

  /**
   * MAN-001-B paso 1: guarda diagnóstico, actividades, horas, repuestos y trabajos adicionales. La sub-orden pasa a "En Ejecución".
   * Un repuesto del catálogo lleva `articuloId` y `bodegaId` (sale de bodega al aprobar el cierre); uno de texto, su número de parte.
   */
  updateSubOrder(
    id: string,
    input: { diagnostico?: string; actividadesCorrectivas?: string; horasTrabajo?: number; repuestos?: Repuesto[]; trabajosAdicionales?: string },
  ): Observable<SubOrder> {
    return this.api.guardarAvance(id, avanceAApi(input)).pipe(map(subordenASubOrder));
  }

  /** MAN-001-B paso 2: operador declara la ejecución terminada — sub-orden pasa a "En Revisión de Cierre". */
  submitSubOrderForReview(id: string): Observable<SubOrder> {
    return this.api.enviarARevision(id).pipe(map(subordenASubOrder));
  }

  /** MAN-001-C: aprueba (cierra, y los repuestos del catálogo salen de bodega) o rechaza (vuelve a "Corrección Solicitada", con motivo). */
  reviewSubOrder(id: string, decision: 'approved' | 'rejected', correctionNote?: string): Observable<SubOrder> {
    const request$ =
      decision === 'approved' ? this.api.aprobarCierre(id) : this.api.solicitarCorreccion(id, correctionNote ?? '');
    return request$.pipe(map(subordenASubOrder));
  }

  /** Fin Correctivo: cierra la orden padre y la devuelve a Operaciones (quién la devuelve lo registra el backend: la cuenta que actúa). */
  closeOrder(orderId: string, input: CloseOrderInput): Observable<MaintenanceOrderWithSubOrders> {
    return this.api.retornar(orderId, ESTADO_FINAL_API[input.estadoFinal], input.observaciones.trim() || null).pipe(map(ordenAMaintenanceOrder));
  }

  /** El Jefe deriva una sub-orden Operativo a Pumping — sale del flujo de Mantenimiento. */
  deriveToOperations(subOrderId: string, note: string): Observable<SubOrder> {
    return this.cambiarClasificacion(subOrderId, { Operativo: { derivar: true, notaDerivacion: note } });
  }

  /** Reasigna el operador de una sub-orden sin cambiar su tipo ni estado. */
  reassignOperator(subOrderId: string, userId: string): Observable<SubOrder> {
    return this.cambiarClasificacion(subOrderId, undefined, userId);
  }

  /**
   * Derivar y reasignar no tienen endpoint propio: son una reclasificación de la orden que repite lo que ya tiene y cambia solo esa
   * sub-orden (el backend deja intacto lo demás).
   */
  private cambiarClasificacion(
    subOrderId: string,
    cambios?: Partial<Record<MaintenanceType, Partial<AsignacionApi>>>,
    nuevoOperadorId?: string,
  ): Observable<SubOrder> {
    return this.api.suborden(subOrderId).pipe(
      switchMap(sub => this.get(sub.ordenId)),
      switchMap(orden => {
        const objetivo = orden.subOrders.find(s => s.id === subOrderId);
        const porTipo = nuevoOperadorId && objetivo ? { [objetivo.type]: { usuarioId: nuevoOperadorId } } : (cambios ?? {});
        return this.api.reclasificar(orden.id, asignacionesDeOrden(orden, porTipo)).pipe(
          map(o => ordenAMaintenanceOrder(o).subOrders.find(s => s.id === subOrderId) as SubOrder),
        );
      }),
    );
  }
}
