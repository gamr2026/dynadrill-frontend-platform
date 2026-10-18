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
  id: 's-1',
  orderId: 'o-10',
  code: 'R2001-M',
  type: 'Mecánico',
  status: 'Pendiente',
  ...over,
});

describe('puedeEjecutar', () => {
  it('Operador de Mantenimiento ejecuta solo sus Mecánico/Instrumental abiertas', () => {
    expect(puedeEjecutar(sub({ assignedUserId: 'u-7' }), 'Operador de Mantenimiento', 'u-7')).toBe(true);
    expect(puedeEjecutar(sub({ assignedUserId: 'u-8' }), 'Operador de Mantenimiento', 'u-7')).toBe(false);
    // Sin sesión no hay sub-órdenes propias: nunca coincide con `undefined`.
    expect(puedeEjecutar(sub({}), 'Operador de Mantenimiento', null)).toBe(false);
    expect(puedeEjecutar(sub({ assignedUserId: 'u-7', status: 'En Revisión de Cierre' }), 'Operador de Mantenimiento', 'u-7')).toBe(false);
  });

  it('Operador de Pumping ejecuta las Operativo ya derivadas', () => {
    expect(puedeEjecutar(sub({ type: 'Operativo', status: 'Derivado a Pumping' }), 'Operador', 'u-3')).toBe(true);
    expect(puedeEjecutar(sub({ type: 'Operativo', status: 'Pendiente' }), 'Operador', 'u-3')).toBe(false);
  });

  it('Supervisor y Jefe no ejecutan', () => {
    expect(puedeEjecutar(sub({ type: 'Operativo', status: 'Derivado a Pumping' }), 'Supervisor Pumping', 'u-1')).toBe(false);
    expect(puedeEjecutar(sub({ assignedUserId: 'u-1' }), 'Jefe de Mantenimiento', 'u-1')).toBe(false);
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
    id: 'o-10',
    code: 'R2001',
    unidad,
    unitReportId: 'r-5',
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
        { provide: AuthService, useValue: { currentUser: user.asReadonly() } },
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
      order('PUM-07', [sub({ id: 's-1', code: 'R2001-M' }), sub({ id: 's-2', code: 'R2001-I', type: 'Instrumental', status: 'Cerrado' })]),
      order('PUM-15', [sub({ id: 's-3', code: 'R2002-M' })]),
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
