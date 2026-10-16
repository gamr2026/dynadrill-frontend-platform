import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { DynadrillDialogService } from '@digitec-it-projects/dynadrill-ui';
import { AuthService, type AuthenticatedUser } from '../../../../../core/services/auth.service';
import type { MaintenanceOrderWithSubOrders, SubOrder, SubOrderStatus } from '../../../../maintenance/models/maintenance-order.model';
import { MaintenanceOrdersService } from '../../../../maintenance/services/maintenance-orders.service';
import { UnitReportsService } from '../../../../maintenance/services/unit-reports.service';
import { TicketMaintenanceCard, puedeEjecutar, puedeRevisar } from './ticket-maintenance-card';

const sub = (over: Partial<SubOrder>): SubOrder => ({
  id: 1,
  orderId: 10,
  code: 'R2001-M',
  type: 'Mecánico',
  status: 'Pendiente',
  ...over,
});

describe('puedeEjecutar', () => {
  it('Operador de Mantenimiento ejecuta solo sus Mecánico/Instrumental abiertas', () => {
    expect(puedeEjecutar(sub({ assignedUserId: 7 }), 'Operador de Mantenimiento', 7)).toBe(true);
    expect(puedeEjecutar(sub({ assignedUserId: 8 }), 'Operador de Mantenimiento', 7)).toBe(false);
    // Sin id legacy (usuario nacido en el backend nuevo) no hay sub-órdenes propias: nunca coincide con `undefined`.
    expect(puedeEjecutar(sub({}), 'Operador de Mantenimiento', null)).toBe(false);
    expect(puedeEjecutar(sub({ assignedUserId: 7, status: 'En Revisión de Cierre' }), 'Operador de Mantenimiento', 7)).toBe(false);
  });

  it('Operador de Pumping ejecuta las Operativo ya derivadas', () => {
    expect(puedeEjecutar(sub({ type: 'Operativo', status: 'Derivado a Pumping' }), 'Operador', 3)).toBe(true);
    expect(puedeEjecutar(sub({ type: 'Operativo', status: 'Pendiente' }), 'Operador', 3)).toBe(false);
  });

  it('Supervisor y Jefe no ejecutan', () => {
    expect(puedeEjecutar(sub({ type: 'Operativo', status: 'Derivado a Pumping' }), 'Supervisor Pumping', 1)).toBe(false);
    expect(puedeEjecutar(sub({ assignedUserId: 1 }), 'Jefe de Mantenimiento', 1)).toBe(false);
  });
});

describe('puedeRevisar', () => {
  const enRevision = (type: SubOrder['type']) => sub({ type, status: 'En Revisión de Cierre' });

  it('solo en "En Revisión de Cierre"', () => {
    expect(puedeRevisar(sub({ status: 'En Ejecución' as SubOrderStatus }), 'Jefe de Mantenimiento')).toBe(false);
  });

  it('Operativo: Jefe de Mantenimiento o Supervisor Pumping', () => {
    expect(puedeRevisar(enRevision('Operativo'), 'Supervisor Pumping')).toBe(true);
    expect(puedeRevisar(enRevision('Operativo'), 'Jefe de Mantenimiento')).toBe(true);
    expect(puedeRevisar(enRevision('Operativo'), 'Operador')).toBe(false);
  });

  it('Mecánico/Instrumental: solo Jefe de Mantenimiento', () => {
    expect(puedeRevisar(enRevision('Instrumental'), 'Jefe de Mantenimiento')).toBe(true);
    expect(puedeRevisar(enRevision('Instrumental'), 'Supervisor Pumping')).toBe(false);
  });
});

describe('TicketMaintenanceCard', () => {
  const order = (unidad: string, subOrders: SubOrder[]): MaintenanceOrderWithSubOrders => ({
    id: 10,
    code: 'R2001',
    unidad,
    unitReportId: 5,
    origin: 'Pumping',
    sourceModule: 'Pumping',
    createdAt: '2026-10-01T10:00:00.000Z',
    returnedToOperation: false,
    subOrders,
  });

  function render(orders: MaintenanceOrderWithSubOrders[], roleName = 'Jefe de Mantenimiento'): HTMLElement {
    const user = signal<AuthenticatedUser>({
      id: 'u-1',
      legacyId: 1,
      name: 'Jefe',
      email: 'j@dynadrill.com',
      roleId: 'r-1',
      roleLegacyId: 1,
      roleName,
      roleCode: 'rol',
      permissions: [],
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { currentUser: user.asReadonly(), legacyUserId: () => user().legacyId } },
        { provide: MaintenanceOrdersService, useValue: { list: () => of(orders) } },
        { provide: UnitReportsService, useValue: { list: () => of([]) } },
        { provide: DynadrillDialogService, useValue: { open: () => undefined } },
      ],
    });
    const fixture = TestBed.createComponent(TicketMaintenanceCard);
    fixture.componentRef.setInput('unitCode', 'PUM-07');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra solo las sub-órdenes de la unidad del ticket, con el resumen', () => {
    const el = render([
      order('PUM-07', [sub({ id: 1, code: 'R2001-M' }), sub({ id: 2, code: 'R2001-I', type: 'Instrumental', status: 'Cerrado' })]),
      order('PUM-15', [sub({ id: 3, code: 'R2002-M' })]),
    ]);
    expect(el.querySelectorAll('.ticket-maintenance__item').length).toBe(2);
    expect(el.textContent).not.toContain('R2002-M');
    expect(el.querySelector('.ticket-maintenance__summary')?.textContent).toContain('1 abierto');
  });

  it('estado vacío cuando la unidad no tiene mantenimientos', () => {
    const el = render([]);
    expect(el.textContent).toContain('Sin mantenimientos registrados para la unidad PUM-07');
  });
});
