import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillStepperComponent,
  DynadrillTagComponent,
  DynadrillTextareaComponent,
  DynadrillUploadZoneComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import {
  PTW_DOCUMENTOS_REQUERIDOS,
  PTW_FASE_ORDER,
  PTW_FASE_STEPS,
  PTW_GAS_LIMITES,
  type PtwDailyLog,
  type PtwDocumentoTipo,
  type PtwFirma,
  type PtwGas,
  type PtwGasReading,
  type PtwMatrix,
  ptwCerrado,
  ptwControlDeHoyPendiente,
  ptwDailyLogSeguro,
  ptwGasEsSeguro,
} from '../../models/ptw.model';
import { PtwService } from '../../services/ptw.service';
import { downloadQhseReport, escapeHtml, qhseBadge, type QhseReportSection } from '../../../shared/utils/qhse-report.util';

type FirmaCampo = 'ptwFirmadoSitio' | 'actaRecibimientoFirmada' | 'ptwCerrado' | 'actaDevolucionFirmada';

@Component({
  selector: 'app-ptw-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DynadrillScreenHeaderComponent,
    DynadrillStepperComponent,
    DynadrillBannerComponent,
    DynadrillUploadZoneComponent,
    DynadrillInputComponent,
    DynadrillTagComponent,
    DynadrillTextareaComponent,
    DynadrillButtonComponent,
  ],
  templateUrl: './ptw-detail-page.html',
  styleUrl: './ptw-detail-page.scss',
})
export class PtwDetailPage {
  private readonly ptwService = inject(PtwService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly ptw = signal<PtwMatrix | null>(null);

  protected readonly steps = PTW_FASE_STEPS;
  protected readonly gasKeys: PtwGas[] = ['H2S', 'LEL', 'O2', 'CO'];
  protected readonly gasLimites = PTW_GAS_LIMITES;

  // ── Registro diario (Fase 3 — control del día a día durante la ejecución) ──
  protected readonly dailyGasDraft = signal<Record<PtwGas, string>>({ H2S: '', LEL: '', O2: '', CO: '' });
  protected readonly dailyToolboxTalk = signal(false);
  protected readonly dailyLoto = signal(false);
  protected readonly dailyObservaciones = signal('');

  protected readonly currentIndex = computed(() => {
    const p = this.ptw();
    return p ? Math.max(0, PTW_FASE_ORDER.indexOf(p.fase)) : 0;
  });

  protected readonly cerrado = computed(() => {
    const p = this.ptw();
    return !!p && ptwCerrado(p);
  });

  /**
   * Un PTW no es de un solo día — la Fase 5 ("Ejecución y devolución") dura
   * lo que dure el trabajo, con un registro diario propio (dailyLogs) que
   * antes solo se notaba si se bajaba hasta esa fase. Este contador va
   * arriba, junto al resto de metadatos, para que quede claro desde que se
   * abre la pantalla que esto puede llevar varios días.
   */
  protected readonly diasEjecucionRegistrados = computed(() => this.ptw()?.dailyLogs.length ?? 0);

  protected readonly puedeAvanzarDeGabinete = computed(() => (this.ptw()?.documentos ?? []).every(d => d.cargado));

  protected readonly puedeAvanzarDeFormalizacion = computed(() => {
    const p = this.ptw();
    return !!p && !!p.ptwFirmadoSitio && !!p.actaRecibimientoFirmada && p.barricadasInstaladas;
  });

  protected readonly puedeAvanzarDeEjecucion = computed(() => {
    const p = this.ptw();
    return !!p && p.limpiezaCompletada && p.inspeccionFinalConforme;
  });

  protected readonly puedeCerrar = computed(() => {
    const p = this.ptw();
    return !!p && !!p.ptwCerrado && !!p.actaDevolucionFirmada && p.respaldosEnviados;
  });

  /** Solo informativo mientras se está ejecutando el trabajo — no bloquea nada, es un recordatorio de que hoy todavía no se registró control. */
  protected readonly controlDeHoyPendiente = computed(() => {
    const p = this.ptw();
    return !!p && p.fase === 'ejecucion' && ptwControlDeHoyPendiente(p.dailyLogs);
  });

  protected dailyLogSeguro(log: PtwDailyLog): boolean {
    return ptwDailyLogSeguro(log);
  }

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.ptwService.get(id).subscribe({
      next: p => {
        this.ptw.set(p);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
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

  protected onDailyGasDraftChange(gas: PtwGas, value: string): void {
    this.dailyGasDraft.update(d => ({ ...d, [gas]: value }));
  }

  /** Un registro por día mientras el trabajo dure — HSE-SITIO-001 pide Toolbox Talk y monitoreo continuos, no solo al abrir el PTW. */
  protected registrarControlDiario(): void {
    const p = this.ptw();
    if (!p) return;
    const now = new Date().toISOString();
    const draft = this.dailyGasDraft();
    const gasReadings: PtwGasReading[] = [];
    for (const gas of this.gasKeys) {
      const raw = draft[gas];
      if (raw === '') continue;
      const lectura = Number(raw);
      if (Number.isNaN(lectura)) continue;
      gasReadings.push({ gas, lectura, seguro: ptwGasEsSeguro(gas, lectura), medidoAt: now });
    }

    const log: PtwDailyLog = {
      id: Date.now(),
      fecha: now,
      registradoPorNombre: this.auth.currentUser()?.name ?? '',
      toolboxTalkRealizado: this.dailyToolboxTalk(),
      lotoVerificado: this.dailyLoto(),
      gasReadings,
      observaciones: this.dailyObservaciones().trim() || undefined,
    };
    this.patch({ dailyLogs: [...p.dailyLogs, log] });

    this.dailyGasDraft.set({ H2S: '', LEL: '', O2: '', CO: '' });
    this.dailyToolboxTalk.set(false);
    this.dailyLoto.set(false);
    this.dailyObservaciones.set('');
    this.notify.success('Control diario registrado', 'Quedó guardado en el historial de este PTW.');
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
      title: 'Firmas y cierre',
      bodyHtml: `<table>
        ${firmaFila('PTW firmado en sitio', p.ptwFirmadoSitio)}
        ${firmaFila('Acta de Recibimiento', p.actaRecibimientoFirmada)}
        ${firmaFila('PTW cerrado', p.ptwCerrado)}
        ${firmaFila('Acta de Devolución', p.actaDevolucionFirmada)}
      </table>`,
    };

    const dailyLogRows = p.dailyLogs
      .map(
        l => `
          <tr>
            <td>${new Date(l.fecha).toLocaleString('es-EC')}</td>
            <td>${escapeHtml(l.registradoPorNombre)}</td>
            <td>${l.toolboxTalkRealizado ? 'Sí' : 'No'}</td>
            <td>${l.lotoVerificado ? 'Sí' : 'No'}</td>
            <td>${l.gasReadings.length > 0 ? (l.gasReadings.every(r => r.seguro) ? qhseBadge('Seguro', 'ok') : qhseBadge('Fuera de rango', 'error')) : '—'}</td>
          </tr>`,
      )
      .join('');
    const dailyLogSection: QhseReportSection = {
      title: 'Registro diario de control (Fase 5 — Ejecución)',
      bodyHtml:
        p.dailyLogs.length === 0
          ? '<p class="qr-empty">Sin registros diarios.</p>'
          : `<table><tr><th>Fecha</th><th>Registrado por</th><th>Toolbox Talk</th><th>LOTO</th><th>Gases</th></tr>${dailyLogRows}</table>`,
    };

    downloadQhseReport(
      `hse-sitio-001-${p.code}.html`,
      `Documentos HSE — ${p.code}`,
      `${p.actividad} — ${p.ubicacion} — Orden de trabajo ${p.ordenTrabajo} — IPERC origen ${p.ipercCode}`,
      [documentosSection, firmasSection, dailyLogSection],
    );
  }

  /**
   * HSE-SITIO-001: "Envío automático de respaldos a stakeholders" — apenas
   * quedan firmadas las dos actas de cierre (Cerrar PTW + Acta de
   * Devolución), no hace falta un tercer clic manual: se simula el envío
   * a HSE Base + Operaciones + Facturación en el acto.
   */
  protected firmar(campo: FirmaCampo): void {
    const p = this.ptw();
    if (!p) return;
    const nombre = this.auth.currentUser()?.name ?? '';
    const firma: PtwFirma = { nombre, firmadoAt: new Date().toISOString() };

    const cambios: Partial<PtwMatrix> = { [campo]: firma };
    const quedaCerradoConEsto =
      (campo === 'ptwCerrado' && !!p.actaDevolucionFirmada) || (campo === 'actaDevolucionFirmada' && !!p.ptwCerrado);

    if (quedaCerradoConEsto && !p.respaldosEnviados) {
      cambios.respaldosEnviados = true;
      this.notify.success('Respaldos enviados', 'Se enviaron automáticamente los respaldos digitales a HSE Base, Operaciones y Facturación.');
    }

    this.patch(cambios);
  }

  protected toggleBarricadas(): void {
    const p = this.ptw();
    if (p) this.patch({ barricadasInstaladas: !p.barricadasInstaladas });
  }

  protected toggleLimpieza(): void {
    const p = this.ptw();
    if (p) this.patch({ limpiezaCompletada: !p.limpiezaCompletada });
  }

  protected toggleInspeccionFinal(): void {
    const p = this.ptw();
    if (p) this.patch({ inspeccionFinalConforme: !p.inspeccionFinalConforme });
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
