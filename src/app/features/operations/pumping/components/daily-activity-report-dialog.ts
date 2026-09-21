import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { NzUploadFile } from 'ng-zorro-antd/upload';
import * as XLSX from 'xlsx';
import {
  DynadrillButtonComponent,
  DynadrillChipGroupComponent,
  DynadrillContextCardComponent,
  DynadrillDatetimePickerComponent,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
  DynadrillUploadZoneComponent,
  type DynadrillContextCardItem,
} from '@digitec-it-projects/dynadrill-ui';
import type { DailyActivityEntry, DailyActivityReport } from '../models/pumping.model';
import { UBICACION_VACIA, UbicacionSelectorComponent, type UbicacionSeleccion } from '../../../../shared/index';
import { parseLocalDateString, toLocalDateString } from '../../../../shared/utils';
import { PumpingDocumento, PumpingService } from '../services/pumping.service';

const MAX_PLANTILLA_BYTES = 5 * 1024 * 1024;
const MAX_MONITOREO_BYTES = 5 * 1024 * 1024;

/**
 * Columnas (índice de `sheet_to_json(header:1)`) del formato real
 * DYN-SGI-RE-047 — verificadas a mano rellenando marcas en el archivo real
 * y releyéndolo con la misma librería, no adivinadas por inspección visual
 * (el Excel tiene celdas combinadas que desalinean la posición "visual" de
 * cada valor respecto al índice real de columna).
 */
const COL = {
  fecha: 4,
  cliente: 4,
  ordenContrato: 8,
  pozo: 4,
  representanteCliente: 8,
  campoBloque: 4,
  cargo: 8,
  taladro: 4,
  actInicio: 1,
  actFin: 2,
  actHoras: 3,
  actDetalle: 4,
  tiempoProductivo: 4,
  tiempoNoProductivo: 6,
  observaciones: 4,
  nombreSupervisor: 4,
} as const;
const FILA = {
  fecha: 5,
  cliente: 6,
  pozo: 7,
  campoBloque: 8,
  taladro: 9,
  actividadesInicio: 12,
  actividadesFin: 22,
  tiempos: 23,
  observaciones: 24,
  firmas: 29,
} as const;

/** Excel guarda fechas tipeadas con el formato regional de la celda — se prueban los formatos más comunes (no hay uno solo garantizado). */
function parseFechaPlantilla(texto: string): Date | null {
  const t = texto.trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const anio = Number(m[3]) < 100 ? Number(m[3]) + 2000 : Number(m[3]);
    const d = new Date(anio, Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * `<input type="time">` (donde caen inicio/fin de cada actividad) solo acepta
 * el formato estricto `HH:mm[:ss]`, 24 horas, sin AM/PM — si el texto no
 * matchea exacto el navegador lo descarta en silencio y el campo queda
 * vacío. Excel puede devolver "11:00 AM", "11:00:00 AM" o ya "23:00" según
 * el formato de número que tenga esa celda puntual (no hay uno garantizado,
 * mismo problema que `parseFechaPlantilla`) — esto normaliza cualquiera de
 * esas variantes a `HH:mm` antes de asignarlo.
 */
function parseHoraPlantilla(texto: string): string {
  const t = texto.trim();
  if (!t) return '';
  const m = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (!m) return '';
  let horas = Number(m[1]);
  const minutos = m[2];
  const meridiano = m[3]?.toUpperCase();
  if (meridiano === 'PM' && horas < 12) horas += 12;
  if (meridiano === 'AM' && horas === 12) horas = 0;
  if (horas > 23) return '';
  return `${String(horas).padStart(2, '0')}:${minutos}`;
}

export interface DailyActivityReportDialogData {
  ticketCode: string;
  /** Solo si viene, se puede cargar/ver el documento de "monitoreo" — el id real del ticket, no el `code`. */
  ticketId?: number;
  /** Fecha ISO del día de este reporte (la del renglón donde se abrió) — arma el slot 'monitoreo-<fecha>', independiente de lo que el usuario después edite en el campo "Fecha" del formulario. */
  fechaClave?: string;
  cliente: string;
  pozo: string;
  campoBloque: string;
  supervisor: string;
  /** Nº de contrato/OT heredado del Pedido — prellena "Orden/Contrato N°". */
  numeroContrato?: string;
  /** Taladro heredado del Pedido/Ticket — prellena el selector de ubicación. */
  taladro?: string;
  taladroId?: number;
  /** Representante de campo / Company Man ya definido en el Pedido — prellena "Representante del Cliente". */
  representanteCliente?: string;
  /** Pre-fill from existing report if editing */
  existing?: DailyActivityReport;
}

export interface DailyActivityReportDialogResult {
  saved: boolean;
  report?: DailyActivityReport;
}

/** Copia estática del formato real DYN-SGI-RE-047 — ver public/plantillas/. */
const URL_PLANTILLA_REPORTE_DIARIO = '/plantillas/reporte-diario-actividades.xlsx';

@Component({
  selector: 'app-daily-activity-report-dialog',
  imports: [
    DynadrillTextComponent,
    DynadrillContextCardComponent,
    DynadrillButtonComponent,
    DynadrillIconButtonComponent,
    DynadrillChipGroupComponent,
    DynadrillInputComponent,
    DynadrillDatetimePickerComponent,
    DynadrillTextareaComponent,
    DynadrillUploadZoneComponent,
    UbicacionSelectorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daily-activity-report-dialog.html',
  styleUrl: './daily-activity-report-dialog.scss',
})
export class DailyActivityReportDialog {
  private readonly modalRef = inject(NzModalRef<DailyActivityReportDialog, DailyActivityReportDialogResult | undefined>);
  private readonly data = inject<DailyActivityReportDialogData>(NZ_MODAL_DATA);
  private readonly notify = inject(DynadrillNotificationService);

  // ── Header info ──
  // dynadrill-datetime-picker trabaja con Date, no con el string ISO que guarda DailyActivityReport.fecha
  // (mismo patrón que travel-management-dialog.ts). Tipado `Date | null` porque el picker permite limpiar
  // el campo (allowClear) y emite null pese a que su tipo declarado diga Date — canSave/save() lo validan.
  protected readonly fecha = signal<Date | null>(this.data.existing?.fecha ? parseLocalDateString(this.data.existing.fecha) : new Date());
  protected readonly cliente = signal(this.data.existing?.cliente ?? this.data.cliente);
  protected readonly ordenContrato = signal(this.data.existing?.ordenContrato ?? this.data.numeroContrato ?? '');
  /** Ya definido en el Pedido (Company Man / Representante de Campo) — se precarga, queda editable por si cambió en sitio. */
  protected readonly representanteCliente = signal(this.data.existing?.representanteCliente ?? this.data.representanteCliente ?? '');
  protected readonly cargo = signal(
    this.data.existing?.cargo ?? (this.data.representanteCliente ? 'Representante de Campo' : ''),
  );

  /** Pozo / Campo / Bloque / Taladro — del catálogo. Prellena con lo que trae el ticket. */
  protected readonly ubicacionInicial: Partial<UbicacionSeleccion> = {
    pozo: this.data.existing?.pozo ?? this.data.pozo,
    taladro: this.data.existing?.taladro ?? this.data.taladro ?? '',
    taladroId: this.data.taladroId ?? null,
  };
  protected readonly ubicacion = signal<UbicacionSeleccion>({
    ...UBICACION_VACIA,
    pozo: this.ubicacionInicial.pozo ?? '',
    taladro: this.ubicacionInicial.taladro ?? '',
  });

  protected readonly headerItems = computed<DynadrillContextCardItem[]>(() => [
    { label: 'Documento', value: 'DYN-SGI-RE-047 V11' },
    { label: 'Ticket', value: this.data.ticketCode },
  ]);

  // ── Activities ── (una sola fila por defecto — "+ Agregar" cubre el resto, no hace falta arrancar con 2)
  protected readonly actividades = signal<DailyActivityEntry[]>(
    this.data.existing?.actividades ?? [{ inicio: '', fin: '', horas: null, detalle: '' }],
  );

  /** Descarga el formato físico DYN-SGI-RE-047 en blanco — para quien prefiera llenarlo a mano y adjuntarlo. */
  protected descargarPlantilla(): void {
    const a = document.createElement('a');
    a.href = URL_PLANTILLA_REPORTE_DIARIO;
    a.download = 'DYN-SGI-RE-047 Reporte diario actividades.xlsx';
    a.click();
  }

  protected addActivity(): void {
    this.actividades.update(list => [...list, { inicio: '', fin: '', horas: null, detalle: '' }]);
  }

  protected removeActivity(index: number): void {
    this.actividades.update(list => list.filter((_, i) => i !== index));
  }

  protected onActivityChange(index: number, field: keyof DailyActivityEntry, value: string): void {
    this.actividades.update(list =>
      list.map((entry, i) => {
        if (i !== index) return entry;
        const updated = { ...entry, [field]: field === 'horas' ? (Number(value) || null) : value };
        // Auto-calculate horas from inicio and fin
        if ((field === 'inicio' || field === 'fin') && updated.inicio && updated.fin) {
          updated.horas = this.calculateHours(updated.inicio, updated.fin);
        }
        return updated;
      }),
    );
  }

  private calculateHours(inicio: string, fin: string): number | null {
    const [h1, m1] = inicio.split(':').map(Number);
    const [h2, m2] = fin.split(':').map(Number);
    if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return null;
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 24 * 60;
    return Math.round((diff / 60) * 100) / 100;
  }

  // ── Time summaries ──
  protected readonly tiempoProductivo = signal(this.data.existing?.tiempoProductivo?.toString() ?? '');
  protected readonly tiempoNoProductivo = signal(this.data.existing?.tiempoNoProductivo?.toString() ?? '');

  protected readonly tiempoTotal = computed(() => {
    const totalFromActivities = this.actividades()
      .reduce((sum, a) => sum + (a.horas ?? 0), 0);
    return Math.round(totalFromActivities * 100) / 100;
  });

  // ── Observations ── (radio Sí/No en vez de un textarea siempre visible — la mayoría de los días no tiene novedades)
  protected readonly observaciones = signal(this.data.existing?.observaciones ?? '');
  protected readonly tieneObservaciones = signal(!!this.data.existing?.observaciones);

  protected onTieneObservacionesChange(tiene: boolean): void {
    this.tieneObservaciones.set(tiene);
    if (!tiene) this.observaciones.set('');
  }

  // ── Signatures ──
  // "Nombre (Representante Cliente)" NO es un campo propio acá: es la misma
  // persona que ya se anotó en "Información general" (representanteCliente)
  // — antes eran dos signals separados y el formulario pedía escribir el
  // mismo nombre dos veces. Tampoco se pide C.I. de ninguno de los dos: ya
  // se identifican por nombre (Supervisor asignado al ticket / Representante
  // de campo del pedido), pedirla de nuevo acá era información redundante.
  protected readonly nombreSupervisor = signal(this.data.existing?.nombreSupervisor ?? this.data.supervisor);

  // ── File upload ──
  protected readonly uploadState = signal<'idle' | 'uploaded'>('idle');
  protected readonly uploadFileName = signal('');
  protected readonly uploadedFileData = signal<string | null>(this.data.existing?.archivoAdjunto ?? null);

  // ── Documento de monitoreo (generado externamente, ej. sensores en campo) ──
  // A diferencia de "Cargar documento" (arriba), esto SÍ sube el archivo real
  // a disco (PumpingDocumento) — el Reporte diario en sí no se persiste
  // server-side, así que el documento se cuelga del ticket con un slot por
  // día: 'monitoreo-<fechaClave>'. Solo disponible si el diálogo se abrió con
  // `ticketId`/`fechaClave` (siempre debería, ver ticket-detail-page.ts).
  private readonly pumpingService = inject(PumpingService);
  protected readonly monitoreoCampo = this.data.fechaClave ? `monitoreo-${this.data.fechaClave}` : null;
  protected readonly monitoreoDoc = signal<PumpingDocumento | null>(null);
  protected readonly monitoreoSubiendo = signal(false);

  constructor() {
    this.cargarMonitoreoExistente();
  }

  private cargarMonitoreoExistente(): void {
    if (!this.data.ticketId || !this.monitoreoCampo) return;
    this.pumpingService.metadataDocumento(this.data.ticketId, this.monitoreoCampo).subscribe({
      next: doc => this.monitoreoDoc.set(doc),
      error: () => this.monitoreoDoc.set(null), // 404 = todavía no hay documento subido para este día
    });
  }

  protected onMonitoreoSeleccionado(file: NzUploadFile): void {
    const ticketId = this.data.ticketId;
    if (!ticketId || !this.monitoreoCampo || this.monitoreoSubiendo()) return;
    const archivo = (file.originFileObj as File | undefined) ?? (file as unknown as File);
    if (!archivo || typeof archivo.size !== 'number') {
      this.notify.error('Archivo no reconocido', 'No se pudo leer el archivo seleccionado. Probá de nuevo.');
      return;
    }
    if (archivo.size > MAX_MONITOREO_BYTES) {
      this.notify.error('Archivo demasiado grande', 'El archivo supera el máximo permitido de 5MB.');
      return;
    }
    this.monitoreoSubiendo.set(true);
    this.pumpingService.subirDocumento(ticketId, this.monitoreoCampo, archivo).subscribe({
      next: doc => {
        this.monitoreoDoc.set(doc);
        this.monitoreoSubiendo.set(false);
        this.notify.success('Documento cargado', `${doc.nombreOriginal} — documento de monitoreo del ${this.data.fechaClave}.`);
      },
      error: () => {
        this.monitoreoSubiendo.set(false);
        this.notify.error('Error', 'No se pudo subir el documento de monitoreo.');
      },
    });
  }

  protected verMonitoreo(): void {
    const ticketId = this.data.ticketId;
    if (!ticketId || !this.monitoreoCampo) return;
    this.pumpingService.descargarDocumento(ticketId, this.monitoreoCampo).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.notify.error('Error', 'No se pudo abrir el documento.'),
    });
  }

  protected eliminarMonitoreo(): void {
    const ticketId = this.data.ticketId;
    if (!ticketId || !this.monitoreoCampo) return;
    this.pumpingService.eliminarDocumento(ticketId, this.monitoreoCampo).subscribe({
      next: () => this.monitoreoDoc.set(null),
      error: () => this.notify.error('Error', 'No se pudo quitar el documento.'),
    });
  }

  /**
   * "Cargue la plantilla con datos y no vi que la info se visualice en los
   * campos... que sentido tiene llenarlo" — antes esto solo simulaba el
   * autocompletado de un campo (Nº); ahora parsea de verdad el .xlsx real
   * (DYN-SGI-RE-047) y vuelca cada valor en su campo del formulario.
   */
  protected onFileSelected(file: NzUploadFile): void {
    const archivo = (file.originFileObj as File | undefined) ?? (file as unknown as File);
    if (!archivo || typeof archivo.size !== 'number') {
      this.notify.error('Archivo no reconocido', 'No se pudo leer el archivo seleccionado. Probá de nuevo.');
      return;
    }
    if (archivo.size > MAX_PLANTILLA_BYTES) {
      this.notify.error('Archivo demasiado grande', 'El archivo supera el máximo permitido de 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = evento => {
      try {
        const datos = new Uint8Array(evento.target!.result as ArrayBuffer);
        const libro = XLSX.read(datos, { type: 'array' });
        const hoja = libro.Sheets[libro.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, defval: '', raw: false });
        const celda = (fila: number, col: number): string => (filas[fila]?.[col] ?? '').toString().trim();

        const fechaTexto = celda(FILA.fecha, COL.fecha);
        const fechaParseada = parseFechaPlantilla(fechaTexto);
        if (fechaParseada) this.fecha.set(fechaParseada);

        const cliente = celda(FILA.cliente, COL.cliente);
        if (cliente) this.cliente.set(cliente);
        const ordenContrato = celda(FILA.cliente, COL.ordenContrato);
        if (ordenContrato) this.ordenContrato.set(ordenContrato);
        const representanteCliente = celda(FILA.pozo, COL.representanteCliente);
        if (representanteCliente) this.representanteCliente.set(representanteCliente);
        const cargo = celda(FILA.campoBloque, COL.cargo);
        if (cargo) this.cargo.set(cargo);
        const nombreSupervisor = celda(FILA.firmas, COL.nombreSupervisor);
        if (nombreSupervisor) this.nombreSupervisor.set(nombreSupervisor);

        const actividades: DailyActivityEntry[] = [];
        for (let f = FILA.actividadesInicio; f <= FILA.actividadesFin; f++) {
          const detalle = celda(f, COL.actDetalle);
          const inicio = parseHoraPlantilla(celda(f, COL.actInicio));
          const fin = parseHoraPlantilla(celda(f, COL.actFin));
          if (!detalle && !inicio && !fin) continue;
          const horasTexto = celda(f, COL.actHoras);
          actividades.push({ inicio, fin, horas: horasTexto ? Number(horasTexto) || null : null, detalle });
        }
        if (actividades.length) this.actividades.set(actividades);

        const tiempoProductivo = celda(FILA.tiempos, COL.tiempoProductivo);
        if (tiempoProductivo && Number(tiempoProductivo)) this.tiempoProductivo.set(tiempoProductivo);
        const tiempoNoProductivo = celda(FILA.tiempos, COL.tiempoNoProductivo);
        if (tiempoNoProductivo && Number(tiempoNoProductivo)) this.tiempoNoProductivo.set(tiempoNoProductivo);

        const observaciones = celda(FILA.observaciones, COL.observaciones);
        if (observaciones) {
          this.observaciones.set(observaciones);
          this.tieneObservaciones.set(true);
        }

        this.uploadFileName.set(archivo.name ?? '');
        this.uploadedFileData.set(archivo.name ?? null);
        this.uploadState.set('uploaded');
        this.notify.success('Plantilla cargada', 'Se completaron los campos con los datos del archivo — revisalos antes de guardar.');
      } catch {
        this.notify.error('Error al leer el archivo', 'No se pudo procesar el Excel. Verificá que sea el formato DYN-SGI-RE-047 y que no esté dañado.');
      }
    };
    reader.readAsArrayBuffer(archivo);
  }

  // ── Validation ──
  protected readonly canSave = computed(() => {
    const acts = this.actividades();
    const hasAtLeastOneActivity = acts.some(a => a.detalle.trim() !== '');
    return this.fecha() !== null && this.cliente() !== '' && hasAtLeastOneActivity;
  });

  // ── Actions ──
  protected save(): void {
    const fecha = this.fecha();
    if (!fecha) return;
    const report: DailyActivityReport = {
      fecha: toLocalDateString(fecha),
      cliente: this.cliente(),
      ordenContrato: this.ordenContrato(),
      pozo: this.ubicacion().pozo || this.ubicacionInicial.pozo || '',
      representanteCliente: this.representanteCliente(),
      campoBloque: [this.ubicacion().campo, this.ubicacion().bloque].filter(Boolean).join(' / '),
      cargo: this.cargo(),
      taladro: this.ubicacion().taladro || this.ubicacionInicial.taladro || '',
      actividades: this.actividades().filter(a => a.detalle.trim() !== ''),
      tiempoProductivo: Number(this.tiempoProductivo()) || null,
      tiempoNoProductivo: Number(this.tiempoNoProductivo()) || null,
      tiempoTotal: this.tiempoTotal(),
      observaciones: this.observaciones(),
      nombreSupervisor: this.nombreSupervisor(),
      nombreCliente: this.representanteCliente(),
      firmaSupervisor: this.nombreSupervisor(),
      firmaCliente: this.representanteCliente(),
      ciSupervisor: '',
      ciCliente: '',
      archivoAdjunto: this.uploadedFileData(),
    };
    this.modalRef.close({ saved: true, report });
  }

  protected cancel(): void {
    this.modalRef.close(undefined);
  }
}
