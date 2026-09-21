import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillNotificationService, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import {
  calcularNP,
  calcularNR,
  ControlType,
  IpercHazard,
  IpercMatrix,
  ND_OPCIONES,
  NE_OPCIONES,
  NC_OPCIONES,
  interpretarNP,
  interpretarNR,
} from '../models/iperc.model';
import { exportarMatrizIpercXlsx } from '../utils/iperc-matriz-xlsx.util';
import { buildIpercHazardRows } from '../utils/iperc-consolidado.util';

export interface IpercMatrixPdfDialogData {
  /** Una sola matriz ("Ver matriz" por fila) o todas ("Ver matriz consolidada" — agrupadas por proceso, ver iperc-list-page.ts). */
  matrices: IpercMatrix[];
}

/**
 * Vista imprimible de la Matriz IPERC — réplica del formato real
 * `DYN-SGI-RE-087` (GTC 45): mismo encabezado, mismas tablas de referencia
 * ND/NE/NC (tomadas de `ND_OPCIONES`/`NE_OPCIONES`/`NC_OPCIONES`, no
 * reescritas a mano) y la tabla ancha por peligro con las columnas del
 * Excel real, mapeadas a mano contra el archivo original (columnas A-AS de
 * la hoja "GTC 45"). Sin librería de PDF: `window.print()` (mismo patrón
 * que `PrefacturaPdfDialog`).
 *
 * Acepta varias matrices a la vez — "Ver matriz consolidada" por área junta
 * todas las de un mismo `proceso` en una sola tabla ancha, igual que el
 * archivo real: ahí PROCESO/ACTIVIDAD son columnas planas de un registro
 * único, no una matriz por actividad (verificado contra las 325 filas del
 * DYN-SGI-RE-087 original).
 */
@Component({
  selector: 'app-iperc-matrix-pdf-dialog',
  imports: [DatePipe, DynadrillTextComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './iperc-matrix-pdf-dialog.html',
  styleUrl: './iperc-matrix-pdf-dialog.scss',
})
export class IpercMatrixPdfDialog {
  protected readonly data = inject<IpercMatrixPdfDialogData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<IpercMatrixPdfDialog>);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly printDate = new Date().toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
  protected readonly exportando = signal(false);

  protected readonly ndOpciones = ND_OPCIONES;
  protected readonly neOpciones = NE_OPCIONES;
  protected readonly ncOpciones = NC_OPCIONES;

  /** Solo relevante para el encabezado de una matriz individual (no consolidado). */
  protected readonly matrixUnica = this.data.matrices.length === 1 ? this.data.matrices[0] : null;

  /** Lista de áreas/procesos distintos incluidos — para el encabezado del consolidado. */
  protected readonly procesosIncluidos = [...new Set(this.data.matrices.map(m => m.proceso).filter((p): p is string => !!p))].sort();

  protected readonly hazardRows = buildIpercHazardRows(this.data.matrices);

  protected nd(h: IpercHazard, cual: 'inicial' | 'residual'): string {
    const v = (cual === 'inicial' ? h.riesgoInicial : h.riesgoResidual).nd;
    return v != null ? String(v) : '—';
  }

  protected ne(h: IpercHazard, cual: 'inicial' | 'residual'): string {
    const v = (cual === 'inicial' ? h.riesgoInicial : h.riesgoResidual).ne;
    return v != null ? String(v) : '—';
  }

  protected nc(h: IpercHazard, cual: 'inicial' | 'residual'): string {
    const v = (cual === 'inicial' ? h.riesgoInicial : h.riesgoResidual).nc;
    return v != null ? String(v) : '—';
  }

  protected np(h: IpercHazard, cual: 'inicial' | 'residual'): string {
    const ev = cual === 'inicial' ? h.riesgoInicial : h.riesgoResidual;
    const np = calcularNP(ev.nd, ev.ne);
    return np != null ? String(np) : '—';
  }

  protected npLabel(h: IpercHazard, cual: 'inicial' | 'residual'): string {
    const ev = cual === 'inicial' ? h.riesgoInicial : h.riesgoResidual;
    const np = calcularNP(ev.nd, ev.ne);
    return np != null ? interpretarNP(np).label : '—';
  }

  protected nr(h: IpercHazard, cual: 'inicial' | 'residual'): string {
    const ev = cual === 'inicial' ? h.riesgoInicial : h.riesgoResidual;
    const nr = calcularNR(ev.nd, ev.ne, ev.nc);
    return nr != null ? String(nr) : '—';
  }

  protected nrLabel(h: IpercHazard, cual: 'inicial' | 'residual'): string {
    const ev = cual === 'inicial' ? h.riesgoInicial : h.riesgoResidual;
    const nr = calcularNR(ev.nd, ev.ne, ev.nc);
    return nr != null ? interpretarNR(nr).label : '—';
  }

  protected aceptabilidad(h: IpercHazard, cual: 'inicial' | 'residual'): string {
    const ev = cual === 'inicial' ? h.riesgoInicial : h.riesgoResidual;
    const nr = calcularNR(ev.nd, ev.ne, ev.nc);
    return nr != null ? interpretarNR(nr).aceptabilidad : '—';
  }

  /** Controles de un tipo, unidos — el Excel real tiene una columna por cada uno de los 5 niveles de jerarquía GTC 45. */
  protected controlesDe(h: IpercHazard, tipo: ControlType): string {
    const descripciones = h.controles.filter(c => c.type === tipo).map(c => c.description);
    return descripciones.length > 0 ? descripciones.join('; ') : '—';
  }

  print(): void {
    window.print();
  }

  /** .xlsx real, clonando el formato oficial — ver iperc-matriz-xlsx.util.ts (usa exceljs, no el xlsx/SheetJS ya presente en el proyecto). */
  protected async exportarXlsx(): Promise<void> {
    if (this.exportando()) return;
    this.exportando.set(true);
    try {
      await exportarMatrizIpercXlsx(this.data.matrices);
    } catch {
      this.notify.error('Error', 'No se pudo generar el archivo .xlsx.');
    } finally {
      this.exportando.set(false);
    }
  }

  close(): void {
    this.modalRef.close();
  }
}
