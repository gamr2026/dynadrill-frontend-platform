// Models
export type {
  Ticket,
  TicketStatus,
  TicketQhseVinculo,
  TicketQhseActividad,
  TicketIpercEstado,
  TicketQhsePtw,
  TicketPtwFase,
  TicketQhseSwa,
  TicketQhseDerrame,
  TicketQhseEmergencia,
} from './models/ticket.model';
export type { Unit, UnitStatus } from './models/unit.model';
export * from './models/operativo-docs.model';
export * from './models/catalogos.model';
export * from './models/timeline.model';

// Componentes de composición (documentos operativos)
export {
  ReporteCierrePdfDialog,
  type ReporteCierrePdfDialogData,
  type ReporteCierrePdfPhaseRow,
  type ReporteCierrePdfToolRow,
  type ReporteCierrePdfDiaBitacora,
  type ReporteCierrePdfDiaUso,
} from './components/reporte-cierre-pdf-dialog/reporte-cierre-pdf-dialog';

// Servicios
export { OperativoDocsBridgeService } from './services/operativo-docs-bridge.service';
export { CatalogosService } from './services/catalogos.service';

// Componentes compartidos
export { UbicacionSelectorComponent } from './components/ubicacion-selector/ubicacion-selector';
export { TimelineComponent } from './components/timeline/timeline';
export { TimelinePopoverTriggerDirective } from './components/timeline/timeline-popover-trigger.directive';

// Pipes
export * from './pipes/index';

// Directives
export * from './directives/index';

// Utils
export * from './utils/index';
