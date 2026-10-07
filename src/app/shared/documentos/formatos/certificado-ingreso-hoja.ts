import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ChecklistIngresoEstado } from '../../../features/qhse/documentos/models/qhse-documentos.model';
import { DocumentoEncabezado } from '../documento-encabezado';
import { DocumentoFirmas, type DocumentoFirmante } from '../documento-firmas';
import { fechaDoc, fechaHoraDoc } from '../documento-format.util';

/**
 * Certificado de Ingreso y Verificaciones de Seguridad — constancia que QHSE emite de que Operativo hizo el checklist de
 * Ingreso a locación (Toolbox Talk, walk-around, línea base, rutas de emergencia, SIMOPS), el monitoreo de gases y la
 * verificación LOTO. Se imprime con `window.print()` (mismo mecanismo que el resto de documentos).
 * No es un formato DYN-* del SGI todavía — sin código ni revisión.
 */
@Component({
  selector: 'app-doc-certificado-ingreso',
  imports: [DocumentoEncabezado, DocumentoFirmas],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './certificado-ingreso-hoja.html',
  styleUrl: './certificado-ingreso-hoja.scss',
})
export class CertificadoIngresoHoja {
  readonly pedidoCode = input.required<string>();
  readonly cliente = input.required<string>();
  readonly campo = input<string>('');
  readonly pozo = input<string>('');
  readonly fechaServicio = input<string | null>(null);
  readonly checklist = input.required<ChecklistIngresoEstado>();

  protected readonly fecha = fechaDoc;
  protected readonly fechaHora = fechaHoraDoc;

  protected readonly verificaciones = computed<{ label: string; ok: boolean }[]>(() => {
    const c = this.checklist();
    return [
      { label: 'Toolbox Talk realizado', ok: c.toolboxTalkRealizado },
      { label: 'Inspección conjunta Walk-around', ok: c.walkaroundCompletado },
      { label: 'Línea base ambiental documentada', ok: c.lineaBaseAmbientalDocumentada },
      { label: 'Rutas de emergencia verificadas', ok: c.rutasEmergenciaVerificadas },
      { label: 'SIMOPS confirmado — sin trabajos incompatibles', ok: c.simopsConfirmado },
    ];
  });

  protected readonly firmantes = computed<DocumentoFirmante[]>(() => [
    { cargo: 'Responsable Operativo (confirmó el checklist)', nombre: this.checklist().confirmadoPor ?? '' },
    { cargo: 'QHSE — emite el certificado', nombre: '' },
  ]);
}
