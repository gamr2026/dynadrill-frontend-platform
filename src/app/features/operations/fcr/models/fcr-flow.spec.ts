import type { FcrPhase, FcrTicket, FcrTool } from './fcr.model';
import { fcrPhaseKeys, fcrResponsibleRole, fcrRolePhases, fcrTicketRelation } from './fcr-flow';

function ticket(overrides: Partial<FcrTicket> = {}): FcrTicket {
  return {
    id: 1,
    code: 'FCR-1',
    status: 'en_ejecucion',
    wellName: 'Pozo Sacha-1',
    clientName: 'EP Petroecuador',
    estimatedDate: '2026-10-01',
    assignedSupervisor: '',
    assignedOperator: '',
    unitCode: '',
    currentPhase: 'revision_inicial',
    tipoOt: 'venta',
    tools: [],
    observations: [],
    phaseHistory: [],
    ...overrides,
  } as FcrTicket;
}

const tool = (overrides: Partial<FcrTool>): FcrTool => ({ id: 1, name: 'Llave', status: 'seleccionada', ...overrides });

describe('fcr-flow', () => {
  it('usa el flujo de servicio solo para tipoOt servicio', () => {
    expect(fcrPhaseKeys('servicio')).toContain('inspeccion');
    expect(fcrPhaseKeys('venta')).not.toContain('inspeccion');
    expect(fcrPhaseKeys(undefined)).toEqual(fcrPhaseKeys('venta'));
  });

  describe('fcrResponsibleRole', () => {
    it('le pasa el turno a Ingeniería de Ventas cuando el Supervisor pidió corrección', () => {
      const t = ticket({ observations: [{ id: 1, author: 'Ana', role: 'Supervisor', date: '', message: 'Corregir' }] });
      expect(fcrResponsibleRole(t)).toBe('Ingeniería de Ventas FCR');
    });

    it('alterna Supervisor ↔ Bodeguero en Preparación de herramientas', () => {
      const phase: FcrPhase = 'preparacion_herramientas';
      expect(fcrResponsibleRole(ticket({ currentPhase: phase, tools: [tool({ sentToBodega: false })] }))).toBe('Supervisor');
      expect(fcrResponsibleRole(ticket({ currentPhase: phase, tools: [tool({ sentToBodega: true })] }))).toBe('Bodeguero');
      expect(
        fcrResponsibleRole(ticket({ currentPhase: phase, tools: [tool({ status: 'en_preparacion', sentToSupervisor: true })] })),
      ).toBe('Supervisor');
    });

    it('usa el rol fijo de la fase en el resto de casos', () => {
      expect(fcrResponsibleRole(ticket({ currentPhase: 'control_retorno' }))).toBe('Bodeguero');
    });
  });

  it('incluye las etapas donde el rol interviene sin ser responsable fijo', () => {
    const bodega = fcrRolePhases('Bodeguero');
    expect(bodega.has('preparacion_herramientas')).toBe(true);
    expect(bodega.has('control_retorno')).toBe(true);
    expect(bodega.has('cierre')).toBe(false);
  });

  describe('fcrTicketRelation', () => {
    it('es "turno" cuando le toca al rol', () => {
      expect(fcrTicketRelation(ticket({ currentPhase: 'control_retorno' }), 'Bodeguero')).toBe('turno');
    });

    it('es "proxima" cuando el ticket todavía pasará por una etapa del rol', () => {
      expect(fcrTicketRelation(ticket({ currentPhase: 'asignacion' }), 'Bodeguero')).toBe('proxima');
    });

    it('es "seguimiento" cuando ya no le toca o el ticket está cerrado', () => {
      expect(fcrTicketRelation(ticket({ currentPhase: 'cierre' }), 'Bodeguero')).toBe('seguimiento');
      expect(fcrTicketRelation(ticket({ currentPhase: 'control_retorno', status: 'cerrado' }), 'Bodeguero')).toBe('seguimiento');
    });
  });
});
