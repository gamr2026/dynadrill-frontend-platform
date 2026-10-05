import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillIconButtonComponent,
  DynadrillNotificationService,
} from '@digitec-it-projects/dynadrill-ui';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { injectNarrowViewport } from '../../../../../core/utils/narrow-viewport.util';
import { QhseRegistrosMovil, type RegistroMovil } from '../../../shared/components/qhse-registros-movil';
import { QhseDocumentosService } from '../../services/qhse-documentos.service';
import {
  PedidoConEstadoDocumental,
  QHSE_REFERENCIA_VIGENTE,
  QHSE_TIPO_CARNET_VACUNAS,
  QHSE_TIPO_FORMATO_RECEPCION,
  QHSE_TIPO_SFI,
} from '../../models/qhse-documentos.model';
import { crearReportePdf, descargarReportePdf } from '../../../../../shared/utils/reporte-pdf.util';

type BadgeTone = 'success' | 'warning' | 'error' | 'neutral' | 'brand' | 'info';
interface Badge {
  text: string;
  tone: BadgeTone;
}

const CARGADO: Badge = { text: 'Cargado', tone: 'success' };
const PENDIENTE: Badge = { text: 'Pendiente', tone: 'warning' };
const VENCIDO: Badge = { text: 'Vencido', tone: 'error' };
const SIN_ART: Badge = { text: 'Sin ART', tone: 'neutral' };
const APROBADO: Badge = { text: 'Aprobado', tone: 'success' };

/**
 * Bandeja "Documentos por pedido" de QHSE — ver PLAN-QHSE-PUMPING-NOTIFICACIONES,
 * Fase 2. QHSE sube acá el Formato de Recepción, el SFI y el Carnet de
 * Vacunas; ART y PT los sube el Supervisor desde su ticket de Pumping o FCR
 * (esta pantalla solo los muestra).
 */
@Component({
  selector: 'app-documentos-pedidos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, QhseRegistrosMovil, DynadrillDataTableComponent, DynadrillIconButtonComponent],
  templateUrl: './documentos-pedidos-page.html',
  styleUrl: './documentos-pedidos-page.scss',
})
export class DocumentosPedidosPage {
  private readonly service = inject(QhseDocumentosService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly isMobile = injectNarrowViewport();
  protected readonly loading = signal(true);
  protected readonly pedidos = signal<PedidoConEstadoDocumental[]>([]);
  protected readonly subiendo = signal<string | null>(null);

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Pedido', sortable: true, searchable: true },
    { key: 'linea', header: 'Línea' },
    { key: 'cliente', header: 'Cliente', searchable: true },
    { key: 'campo', header: 'Campo / Pozo', searchable: true },
    { key: 'formatoRecepcionBadge', header: 'Formato de Recepción', type: 'badge' },
    { key: 'carnetVacunasBadge', header: 'Carnet de Vacunas', type: 'badge' },
    { key: 'artBadge', header: 'ART', type: 'badge' },
    { key: 'ptBadge', header: 'PT (hoy)', type: 'badge' },
    { key: 'sfiBadge', header: 'SFI', type: 'badge' },
    { key: 'checklistIngresoBadge', header: 'Ingreso + Verif.', type: 'badge' },
    { key: 'companyManBadge', header: 'Company Man', type: 'badge' },
  ];

  protected readonly rows = computed(() =>
    this.pedidos().map(p => ({
      pedidoId: p.pedidoId,
      code: p.code,
      linea: p.lineaServicio === 'fcr' ? 'FCR' : 'Pumping',
      cliente: p.cliente,
      campo: `${p.campo} / ${p.pozo}`,
      formatoRecepcionBadge: p.estado.formatoRecepcion ? CARGADO : PENDIENTE,
      carnetVacunasBadge: p.estado.carnetVacunas ? CARGADO : PENDIENTE,
      artBadge: p.estado.artVigente === true ? CARGADO : p.estado.artVigente === false ? VENCIDO : SIN_ART,
      ptBadge: p.estado.ptHoy ? CARGADO : PENDIENTE,
      sfiBadge: p.estado.sfi ? CARGADO : PENDIENTE,
      checklistIngresoBadge: p.estado.checklistIngreso?.completo ? CARGADO : PENDIENTE,
      companyManBadge: p.estado.companyManAprobado ? APROBADO : PENDIENTE,
      estado: p.estado,
    })),
  );

  /** Tarjetas de la lista en móvil (Figma "M · Documentos por pedido"): estado de los tres documentos que sube QHSE + subir/descargar. */
  protected readonly itemsMovil = computed<RegistroMovil[]>(() =>
    this.rows().map(r => {
      const tono = (b: Badge): 'success' | 'warning' | 'error' | undefined =>
        b.tone === 'success' ? 'success' : b.tone === 'warning' ? 'warning' : b.tone === 'error' ? 'error' : undefined;
      const accionDoc = (nombre: string, cargado: boolean, tipo: typeof QHSE_TIPO_FORMATO_RECEPCION | typeof QHSE_TIPO_SFI | typeof QHSE_TIPO_CARNET_VACUNAS) =>
        cargado
          ? { icon: 'download', label: `Descargar ${nombre}`, run: () => this.descargar(r.pedidoId, tipo) }
          : { icon: 'upload', label: `Subir ${nombre}`, run: () => this.elegirYSubir(r.pedidoId, tipo) };
      return {
        id: r.pedidoId,
        eyebrow: r.code,
        title: r.cliente,
        subtitle: r.campo,
        status: { text: `Company Man: ${r.companyManBadge.text}`, tone: r.companyManBadge.tone },
        fields: [
          { label: 'Formato Recepción', value: r.formatoRecepcionBadge.text, tone: tono(r.formatoRecepcionBadge) },
          { label: 'Carnet', value: r.carnetVacunasBadge.text, tone: tono(r.carnetVacunasBadge) },
          { label: 'ART', value: r.artBadge.text, tone: tono(r.artBadge) },
          { label: 'PT (hoy)', value: r.ptBadge.text, tone: tono(r.ptBadge) },
          { label: 'SFI', value: r.sfiBadge.text, tone: tono(r.sfiBadge) },
          { label: 'Ingreso + Verif.', value: r.checklistIngresoBadge.text, tone: tono(r.checklistIngresoBadge) },
        ],
        actions: [
          { ...accionDoc('Formato de Recepción', r.estado.formatoRecepcion, QHSE_TIPO_FORMATO_RECEPCION), primary: true },
          accionDoc('Carnet de Vacunas', r.estado.carnetVacunas, QHSE_TIPO_CARNET_VACUNAS),
          accionDoc('SFI', r.estado.sfi, QHSE_TIPO_SFI),
        ],
      } satisfies RegistroMovil;
    }),
  );

  /** En móvil no hay `<input type=file>` por fila: se crea uno al vuelo y se reutiliza `subir`. */
  protected elegirYSubir(
    pedidoId: number,
    tipo: typeof QHSE_TIPO_FORMATO_RECEPCION | typeof QHSE_TIPO_SFI | typeof QHSE_TIPO_CARNET_VACUNAS,
  ): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.addEventListener('change', () => this.subir(pedidoId, tipo, input));
    input.click();
  }

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['pedidoId']);

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.loading.set(true);
    this.service.listarPedidos().subscribe({
      next: pedidos => {
        this.pedidos.set(pedidos);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private key(pedidoId: number, tipo: string): string {
    return `${pedidoId}:${tipo}`;
  }

  protected subiendoTipo(pedidoId: number, tipo: string): boolean {
    return this.subiendo() === this.key(pedidoId, tipo);
  }

  /** Sube (o reemplaza) el Formato de Recepción, el SFI o el Carnet de Vacunas de un pedido — los tipos que QHSE sube directamente. */
  protected subir(
    pedidoId: number,
    tipo: typeof QHSE_TIPO_FORMATO_RECEPCION | typeof QHSE_TIPO_SFI | typeof QHSE_TIPO_CARNET_VACUNAS,
    input: HTMLInputElement,
  ): void {
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    this.subiendo.set(this.key(pedidoId, tipo));
    this.service.subir(pedidoId, tipo, QHSE_REFERENCIA_VIGENTE, archivo).subscribe({
      next: () => {
        this.subiendo.set(null);
        this.notify.success('Guardado', 'El documento quedó guardado.');
        this.cargar();
      },
      error: () => {
        this.subiendo.set(null);
        this.notify.error('Error', 'No se pudo subir el documento.');
      },
    });
  }

  protected descargar(pedidoId: number, tipo: string): void {
    this.service.descargar(pedidoId, tipo, QHSE_REFERENCIA_VIGENTE).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.notify.error('Error', 'No se pudo abrir el documento.'),
    });
  }

  /**
   * Certificado de respaldo (Fase 2, PLAN-QHSE-FASE2-PTW-STOP-EPI-DESECHOS)
   * — QHSE ya no llena el checklist de Ingreso/Verificaciones, pero sí
   * necesita poder emitir constancia de que Operativo lo hizo. Mismo patrón
   * de PDF con membrete (`crearReportePdf`/`descargarReportePdf`) que
   * Reporte Job/Reporte de Herramientas.
   */
  protected descargarCertificadoChecklistIngreso(row: { code: string; cliente: string; campo: string; estado: { checklistIngreso: PedidoConEstadoDocumental['estado']['checklistIngreso'] } }): void {
    const c = row.estado.checklistIngreso;
    if (!c || !c.completo) return;

    const { doc, y } = crearReportePdf('Certificado de Ingreso y Verificaciones de Seguridad', `Pedido ${row.code}`, {
      code: row.code,
      cliente: row.cliente,
      pozo: row.campo,
      supervisor: c.confirmadoPor ?? '—',
      operador: '',
    });

    let cursorY = y;
    doc.setFontSize(10);
    doc.setTextColor(30);
    const items: [string, boolean][] = [
      ['Toolbox Talk realizado', c.toolboxTalkRealizado],
      ['Inspección conjunta Walk-around', c.walkaroundCompletado],
      ['Línea base ambiental documentada', c.lineaBaseAmbientalDocumentada],
      ['Rutas de emergencia verificadas', c.rutasEmergenciaVerificadas],
      ['SIMOPS confirmado — sin trabajos incompatibles', c.simopsConfirmado],
    ];
    for (const [label, ok] of items) {
      doc.text(`${ok ? '✓' : '✗'} ${label}`, 40, cursorY);
      cursorY += 16;
    }

    cursorY += 8;
    doc.text('Monitoreo de gases:', 40, cursorY);
    cursorY += 16;
    if (c.gasReadings.length === 0) {
      doc.text('Sin lecturas registradas.', 40, cursorY);
      cursorY += 16;
    } else {
      for (const r of c.gasReadings) {
        doc.text(`${r.gas}: ${r.lectura} (${r.seguro ? 'seguro' : 'fuera de rango'}) — ${new Date(r.medidoAt).toLocaleString('es-EC')}`, 40, cursorY);
        cursorY += 16;
      }
    }

    cursorY += 8;
    doc.text('Verificación LOTO:', 40, cursorY);
    cursorY += 16;
    for (const item of c.lotoChecklist) {
      doc.text(`${item.checked ? '✓' : '✗'} ${item.label}`, 40, cursorY);
      cursorY += 16;
    }

    cursorY += 8;
    doc.text(
      `Confirmado por: ${c.confirmadoPor ?? '—'} — ${c.confirmadoAt ? new Date(c.confirmadoAt).toLocaleString('es-EC') : '—'}`,
      40,
      cursorY,
    );

    descargarReportePdf(doc, `Certificado Ingreso - ${row.code}.pdf`);
  }
}
