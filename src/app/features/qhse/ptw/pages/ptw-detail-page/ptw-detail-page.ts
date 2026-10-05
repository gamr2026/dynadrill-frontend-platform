import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillStepperComponent,
  DynadrillTagComponent,
  DynadrillUploadZoneComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import {
  PTW_DOCUMENTOS_REQUERIDOS,
  PTW_FASE_ORDER,
  PTW_FASE_STEPS,
  type PtwDocumentoTipo,
  type PtwFirma,
  type PtwMatrix,
  ptwCerrado,
} from '../../models/ptw.model';
import { PtwService } from '../../services/ptw.service';
import { QhseDocumentosService } from '../../../documentos/services/qhse-documentos.service';
import { QHSE_REFERENCIA_VIGENTE, QHSE_TIPO_FORMATO_ENTREGA } from '../../../documentos/models/qhse-documentos.model';
import { downloadQhseReport, escapeHtml, qhseBadge, type QhseReportSection } from '../../../shared/utils/qhse-report.util';

@Component({
  selector: 'app-ptw-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DynadrillScreenHeaderComponent,
    DynadrillStepperComponent,
    DynadrillUploadZoneComponent,
    DynadrillTagComponent,
    DynadrillButtonComponent,
  ],
  templateUrl: './ptw-detail-page.html',
  styleUrl: './ptw-detail-page.scss',
})
export class PtwDetailPage {
  private readonly ptwService = inject(PtwService);
  private readonly documentosService = inject(QhseDocumentosService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly ptw = signal<PtwMatrix | null>(null);

  protected readonly steps = PTW_FASE_STEPS;

  protected readonly currentIndex = computed(() => {
    const p = this.ptw();
    // Fases heredadas (formalización, ejecución…) cuentan como "Cierre": ya pasaron el gabinete.
    return p && p.fase !== 'gabinete' ? PTW_FASE_ORDER.indexOf('gestion_documental') : 0;
  });

  /** Acta de Entrega de Locación cargada por el Supervisor (solo se puede consultar si el PTW está ligado a un pedido). */
  protected readonly actaEntrega = signal<{ cargada: boolean; nombre?: string; cargadaPor?: string } | null>(null);

  protected readonly cerrado = computed(() => {
    const p = this.ptw();
    return !!p && ptwCerrado(p);
  });

  protected readonly puedeAvanzarDeGabinete = computed(() => (this.ptw()?.documentos ?? []).every(d => d.cargado));

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.ptwService.get(id).subscribe({
      next: p => {
        this.ptw.set(p);
        this.loading.set(false);
        if (p.pedidoId) this.cargarActaEntrega(p.pedidoId);
      },
      error: () => this.loading.set(false),
    });
  }

  private cargarActaEntrega(pedidoId: number): void {
    this.documentosService.listar(pedidoId).subscribe({
      next: docs => {
        const d = docs.find(x => x.tipo === QHSE_TIPO_FORMATO_ENTREGA && x.referencia === QHSE_REFERENCIA_VIGENTE);
        this.actaEntrega.set(d ? { cargada: true, nombre: d.nombreOriginal, cargadaPor: d.uploadedBy } : { cargada: false });
      },
      error: () => this.actaEntrega.set(null),
    });
  }

  protected descargarActaEntrega(): void {
    const p = this.ptw();
    if (!p?.pedidoId) return;
    this.documentosService.descargar(p.pedidoId, QHSE_TIPO_FORMATO_ENTREGA, QHSE_REFERENCIA_VIGENTE).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.notify.error('Error', 'No se pudo abrir el Acta de Entrega.'),
    });
  }

  protected back(): void {
    this.router.navigate(['/dashboard/qhse/ptw']);
  }

  private patch(changes: Partial<PtwMatrix>): void {
    const current = this.ptw();
    if (!current) return;
    this.ptw.set({ ...current, ...changes });
    this.ptwService.update(current.id, changes).subscribe({
      error: () => {
        // Revierte el update optimista: sin esto, un fallo de red dejaba la UI mostrando
        // un cambio que nunca se guardó, sin ningún aviso — el usuario lo descubría recién
        // al recargar y ver que "desapareció".
        this.ptw.set(current);
        this.notify.error('Error', 'No se pudo guardar el cambio. Inténtalo de nuevo.');
      },
    });
  }

  /**
   * Cada documento se guarda al instante, uno por uno — no hace falta que
   * los 4 estén listos a la vez ni un botón aparte de "guardar avances".
   * El toast es solo para que quede claro que ya quedó guardado.
   */
  protected onDocumentoUpload(tipo: PtwDocumentoTipo, file: { name?: string }): void {
    const p = this.ptw();
    if (!p) return;
    const documentos = p.documentos.map(d =>
      d.tipo === tipo ? { ...d, cargado: true, fileName: file.name ?? d.label, cargadoAt: new Date().toISOString() } : d,
    );
    this.patch({ documentos });
    this.notify.success('Documento guardado', 'Se guardó al instante — puedes continuar con el resto cuando estén disponibles.');
  }

  /**
   * Simulación de descarga del formato en blanco — Formato de Recepción,
   * ART y PTW pre-llenado son formatos del cliente/externos que hoy el
   * sistema no genera de verdad (ver nota de la Fase 1: "el sistema los
   * carga, valida y archiva, no los construye como formulario propio").
   * No hay un archivo real detrás — se genera un placeholder .html
   * claramente marcado como plantilla, con el mismo mecanismo de descarga
   * (Blob + <a download>) que ya usa downloadQhseReport(), para que quien
   * necesite el formato tenga algo que llenar e imprimir/adjuntar sin
   * salir del sistema. Carnet de Vacunas queda afuera a propósito: es un
   * documento personal del trabajador, no una plantilla que Dynadrill
   * provea.
   */
  // `sfi` queda afuera a propósito: no es un formato que el cliente/MSP provea
  // para completar y volver a cargar — lo elabora QHSE directamente (punto 6
  // del plan QHSE↔Pumping), no tiene sentido un "formato en blanco" para él.
  protected descargarFormatoBlanco(tipo: Exclude<PtwDocumentoTipo, 'carnet_vacunas' | 'sfi'>): void {
    const doc = PTW_DOCUMENTOS_REQUERIDOS.find(d => d.tipo === tipo);
    if (!doc) return;

    const camposPorTipo: Record<typeof tipo, string[]> = {
      formato_recepcion: ['Fecha de recepción', 'Locación / pozo', 'Empresa operadora', 'Company Man', 'Responsable Dynadrill', 'Observaciones de la locación', 'Firma de recepción'],
      art: ['Fecha', 'Actividad a realizar', 'Peligros identificados', 'Medidas de control', 'Personal involucrado', 'Firma de quien elabora', 'Firma de quien aprueba'],
      ptw_prellenado: ['N° de permiso', 'Descripción del trabajo', 'Ubicación exacta', 'Fecha y hora de inicio', 'Fecha y hora de fin estimada', 'Riesgos asociados', 'Firma del solicitante'],
    };

    const camposHtml = camposPorTipo[tipo].map(campo => `<tr><td>${campo}</td><td>&nbsp;</td></tr>`).join('');
    const section: QhseReportSection = {
      title: doc.label,
      bodyHtml: `
        <p class="qr-meta"><strong>Formato en blanco — plantilla para completar y volver a cargar en el sistema.</strong></p>
        <p class="qr-meta">Simulación: este es un documento de ejemplo generado por el sistema, no el formato real proporcionado por el cliente/MSP. Sirve para tener una referencia de los campos esperados mientras no exista integración con el archivo original.</p>
        <table><tr><th>Campo</th><th>Completar</th></tr>${camposHtml}</table>`,
    };

    downloadQhseReport(`${doc.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-formato-en-blanco.html`, doc.label, 'HSE-SITIO-001 — Recibimiento de Sitio (PTW)', [section]);
  }

  /** Carga rápida (pruebas): simula que los 4 documentos de gabinete ya se subieron, sin tener que cargarlos uno por uno. */
  protected simularCargaDocumentos(): void {
    const p = this.ptw();
    if (!p) return;
    const ahora = new Date().toISOString();
    const documentos = p.documentos.map(d => ({ ...d, cargado: true, fileName: d.fileName ?? `${d.tipo}-simulado.pdf`, cargadoAt: d.cargadoAt ?? ahora }));
    this.patch({ documentos });
    this.notify.success('Documentos simulados', 'Los 4 documentos de gabinete quedaron marcados como cargados.');
  }

  /**
   * PUM-004 (Consolidación y Carga de Documentación Operativa de Pumping)
   * describe un paso "Descargar documentos HSE Ref: HSE-SITIO-001" — este
   * PTW es exactamente ese HSE-SITIO-001. Mientras Pumping no tenga su
   * propia integración con este módulo, este botón deja lista la misma
   * descarga que ese flujo necesitaría consumir: documentos cargados y
   * firmas del Recibimiento de Sitio (Ingreso/Verificaciones ya no viven
   * acá — ver el certificado de Ingreso desde el ticket de Pumping/QHSE).
   */
  protected descargarDocumentosHse(): void {
    const p = this.ptw();
    if (!p) return;

    const documentosRows = p.documentos
      .map(
        d => `
          <tr>
            <td>${escapeHtml(d.label)}</td>
            <td>${d.cargado ? qhseBadge('Cargado', 'ok') : qhseBadge('Pendiente', 'warn')}</td>
            <td>${d.fileName ? escapeHtml(d.fileName) : '—'}</td>
            <td>${d.cargadoAt ? new Date(d.cargadoAt).toLocaleString('es-EC') : '—'}</td>
          </tr>`,
      )
      .join('');
    const documentosSection: QhseReportSection = {
      title: 'Documentos de recepción (Fase 1 — Gabinete)',
      bodyHtml: `<table><tr><th>Documento</th><th>Estado</th><th>Archivo</th><th>Cargado</th></tr>${documentosRows}</table>`,
    };

    const firmaFila = (label: string, f?: PtwFirma) =>
      `<tr><td>${label}</td><td>${f ? `${escapeHtml(f.nombre)} — ${new Date(f.firmadoAt).toLocaleString('es-EC')}` : '—'}</td></tr>`;
    const firmasSection: QhseReportSection = {
      title: 'Confirmación y cierre',
      bodyHtml: `<table>
        ${firmaFila('Entrega de locación confirmada por QHSE', p.entregaLocacionConfirmada ? p.entregaLocacionConfirmadaPor : undefined)}
        ${firmaFila('PTW cerrado', p.ptwCerrado)}
      </table>`,
    };

    downloadQhseReport(
      `hse-sitio-001-${p.code}.html`,
      `Documentos HSE — ${p.code}`,
      `${p.actividad} — ${p.ubicacion} — Orden de trabajo ${p.ordenTrabajo} — IPERC origen ${p.ipercCode}`,
      [documentosSection, firmasSection],
    );
  }

  /** QHSE confirma (Sí / No) que el Supervisor cargó el Acta de Entrega de Locación. Con "Sí" ya se puede cerrar el PTW. */
  protected confirmarEntrega(cargada: boolean): void {
    const p = this.ptw();
    if (!p || this.cerrado()) return;
    const nombre = this.auth.currentUser()?.name ?? '';
    this.patch({
      entregaLocacionConfirmada: cargada,
      entregaLocacionConfirmadaPor: { nombre, firmadoAt: new Date().toISOString() },
    });
  }

  /**
   * Cierra el PTW. Se registra la misma firma en "PTW cerrado" y "Acta de devolución" (el resto del sistema —Facturación,
   * avisos, gate del ticket— lee esa pareja) y se notifican solos los respaldos a HSE Base, Operaciones y Facturación.
   */
  protected cerrarPtw(): void {
    const p = this.ptw();
    if (!p || !p.entregaLocacionConfirmada || p.ptwCerrado) return;
    const firma: PtwFirma = { nombre: this.auth.currentUser()?.name ?? '', firmadoAt: new Date().toISOString() };
    this.patch({ ptwCerrado: firma, actaDevolucionFirmada: firma, respaldosEnviados: true, fase: 'gestion_documental' });
    this.notify.success('PTW cerrado', 'Se notificó a HSE Base, Operaciones y Facturación.');
  }

  protected avanzarFase(): void {
    const p = this.ptw();
    if (!p) return;
    const idx = PTW_FASE_ORDER.indexOf(p.fase);
    const next = PTW_FASE_ORDER[idx + 1];
    if (!next) return;
    this.patch({ fase: next });
  }
}
