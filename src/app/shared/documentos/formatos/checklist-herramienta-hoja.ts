import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  FCR_TOOL_INSPECTION_FIRMA_LABELS,
  FCR_TOOL_INSPECTION_FIRMA_ROLES,
  type FcrToolInspection,
  type FcrToolInspectionParteResultado,
} from '../../../features/operations/fcr/models/fcr-tool-inspeccion.model';
import { DocumentoEncabezado } from '../documento-encabezado';
import { fechaDoc } from '../documento-format.util';

/**
 * Formato "Registro de inspección y reparación de herramientas" (FCR): datos de la herramienta, tabla de elementos
 * con inspección visual / END y cambio de elemento, nota y las tres firmas (Reparada por / Revisado por / Liberado
 * por QHSE). Nombre y fecha salen de lo ya registrado en el sistema; el espacio de firma queda en blanco.
 * El esquema de la herramienta (dibujo) del Excel no se reproduce: el sistema no lo guarda.
 */
@Component({
  selector: 'app-doc-checklist-herramienta',
  imports: [DocumentoEncabezado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './checklist-herramienta-hoja.html',
  styleUrl: './checklist-herramienta-hoja.scss',
})
export class ChecklistHerramientaHoja {
  readonly inspeccion = input.required<FcrToolInspection>();

  protected readonly fecha = fechaDoc;

  protected readonly marca = (r: FcrToolInspectionParteResultado): string => (r === 'ok' ? '√' : r === 'defectuoso' ? 'X' : '');

  protected readonly firmantes = computed(() =>
    FCR_TOOL_INSPECTION_FIRMA_ROLES.map(rol => {
      const f = this.inspeccion().firmas[rol];
      return { etiqueta: FCR_TOOL_INSPECTION_FIRMA_LABELS[rol], nombre: f?.firmado ? f.nombre : '', fecha: f?.firmado ? fechaDoc(f.fecha) : '' };
    }),
  );
}
