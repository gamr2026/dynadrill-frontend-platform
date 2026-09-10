// Models
export type { Ticket, TicketStatus, TicketQhseVinculo, TicketIpercEstado } from './models/ticket.model';
export type { Unit, UnitStatus } from './models/unit.model';
export * from './models/operativo-docs.model';
export * from './models/catalogos.model';

// Componentes de composición (documentos operativos)
export { ReporteJobPdfDialog, type ReporteJobPdfDialogData } from './components/reporte-job-pdf-dialog/reporte-job-pdf-dialog';
export {
  ReporteHerramientasPdfDialog,
  type ReporteHerramientasPdfDialogData,
} from './components/reporte-herramientas-pdf-dialog/reporte-herramientas-pdf-dialog';

// Servicios
export { OperativoDocsBridgeService } from './services/operativo-docs-bridge.service';
export { CatalogosService } from './services/catalogos.service';

// Componentes compartidos
export { UbicacionSelectorComponent } from './components/ubicacion-selector/ubicacion-selector';

// Pipes
export * from './pipes/index';

// Directives
export * from './directives/index';

// Utils
export * from './utils/index';
