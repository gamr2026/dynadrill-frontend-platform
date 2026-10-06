import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import type { NzUploadFile } from 'ng-zorro-antd/upload';
import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillDatetimePickerComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillSkeletonComponent,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
  DynadrillUploadZoneComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import {
  FCR_TOOL_INSPECTION_FIRMA_LABELS,
  FCR_TOOL_INSPECTION_FIRMA_ROL_ANTERIOR,
  FCR_TOOL_INSPECTION_FIRMA_ROLES,
  FCR_TOOL_INSPECTION_FIRMA_ROLES_REQUERIDOS,
  FcrToolInspection,
  FcrToolInspectionFirma,
  FcrToolInspectionFirmaRol,
  FcrToolInspectionParte,
  FcrToolInspectionParteResultado,
  FcrToolInspectionResponsable,
} from '../models/fcr-tool-inspeccion.model';
import { FcrToolInspeccionesService } from '../services/fcr-tool-inspecciones.service';
import { AuthService } from '../../../../core/services/auth.service';

export interface ChecklistHerramientaDialogData {
  ticketId: number;
  toolId: number;
  articuloId: number;
  toolName: string;
  /** Operador de campo asignado al ticket (fase `asignacion`) — quien se lleva la herramienta al pozo. Solo informativo acá, no se edita desde este diálogo. */
  operadorCampoAsignado?: string;
  /** Del ticket — solo se usan para precargar `cliente`/`pozo` en la primera creación del checklist (ver `iniciar()`). */
  cliente?: string;
  pozo?: string;
}

export interface ChecklistHerramientaDialogResult {
  inspection: FcrToolInspection;
}

const INSPECCIONADO_POR_OPTIONS: DynadrillSelectOption[] = [
  { label: '—', value: '' },
  { label: 'Dynadrill', value: 'dynadrill' },
  { label: 'Proveedor externo', value: 'proveedor_externo' },
];

function toIsoDate(date: Date): string {
  return date.toISOString();
}

function todayIso(): string {
  return new Date().toISOString();
}

function parseFecha(iso: string | null): Date | null {
  return iso ? new Date(iso) : null;
}

/** No usa `Number(x) || null`: una cantidad real de 0 es un valor válido, no "sin dato". */
function parseCambioCantidad(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isNaN(value) ? null : value;
}

const MAX_PLANTILLA_PARTES_BYTES = 5 * 1024 * 1024;

/** Acepta variantes razonables de lo que alguien pueda escribir a mano en la celda — `null` = "sin dato, no tocar el valor actual". */
function normalizeResultado(raw: string): FcrToolInspectionParteResultado | null {
  const v = raw.trim().toLowerCase();
  if (v === 'ok' || v === 'bien' || v === 'bueno') return 'ok';
  if (v === 'defectuoso' || v === 'defecto' || v === 'no ok' || v === 'nok' || v === 'x' || v === 'malo') return 'defectuoso';
  return null;
}

/**
 * Checklist digital "Inspección y reparación de herramientas" — uno por
 * cada `FcrTool` del ticket. Mismo patrón que `FirmaActaDialog`
 * (`NZ_MODAL_DATA`/`NzModalRef`, signals planos, sin `FormArray` — array de
 * objetos tipados actualizado con `update()`, ver el comentario de
 * `unit-report-dialog.ts` sobre por qué). Las 3 firmas NO son un canvas
 * dibujado ni texto libre: checkbox de confirmación + usuario logueado +
 * fecha, secuenciales y cada una solo firmable por el rol que le corresponde
 * (`FCR_TOOL_INSPECTION_FIRMA_ROLES_REQUERIDOS`) — nunca el mismo operador
 * de campo tildando (y escribiendo) sus 3 propias firmas.
 *
 * Diseño de guardado: "Guardar borrador" persiste cabecera + partes sin
 * exigir las firmas (permite retomar un checklist largo más tarde). Cada
 * firma se envía sola al backend apenas se tilda su checkbox (no espera a un
 * botón final). "Enviar checklist" ya no firma nada — solo persiste
 * cabecera/partes y llama a `enviar()`, que el backend rechaza si falta
 * alguna de las 3 firmas ya persistidas.
 */
import { DocumentoPdfService } from '../../../../shared/documentos';
import { ChecklistHerramientaHoja } from '../../../../shared/documentos/formatos/checklist-herramienta-hoja';

@Component({
  selector: 'app-checklist-herramienta-dialog',
  /** Pantalla completa en móvil (formulario largo) — ver styles.scss. */
  host: { class: 'app-dialog-fullscreen-mobile' },
  imports: [
    DatePipe,
    DynadrillTextComponent,
    DynadrillInputComponent,
    DynadrillIconButtonComponent,
    DynadrillSelectComponent,
    DynadrillDatetimePickerComponent,
    DynadrillCheckboxComponent,
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillSkeletonComponent,
    DynadrillTextareaComponent,
    DynadrillUploadZoneComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './checklist-herramienta-dialog.html',
  styleUrl: './checklist-herramienta-dialog.scss',
})
export class ChecklistHerramientaDialog {
  private readonly modalRef = inject(NzModalRef<ChecklistHerramientaDialog, ChecklistHerramientaDialogResult | undefined>);
  protected readonly data = inject<ChecklistHerramientaDialogData>(NZ_MODAL_DATA);
  private readonly toolInspecciones = inject(FcrToolInspeccionesService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly documentoPdf = inject(DocumentoPdfService);

  protected readonly inspeccionadoPorOptions = INSPECCIONADO_POR_OPTIONS;
  protected readonly firmaLabels = FCR_TOOL_INSPECTION_FIRMA_LABELS;
  /** Orden de la secuencia — el mismo `@for` del template las recorre en este orden. */
  protected readonly firmaRoles = FCR_TOOL_INSPECTION_FIRMA_ROLES;

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly inspectionId = signal<number | null>(null);
  protected readonly estado = signal<string>('borrador');

  protected readonly cliente = signal('');
  protected readonly pozo = signal('');
  protected readonly fechaInspeccion = signal<Date | null>(null);
  protected readonly fechaReparacion = signal<Date | null>(null);
  protected readonly fechaEnvio = signal<Date | null>(null);
  protected readonly descripcionHerramienta = signal('');
  protected readonly numeroSerie = signal('');
  protected readonly inspeccionadoPor = signal<FcrToolInspectionResponsable>('');
  protected readonly reparadoPor = signal('');
  protected readonly observaciones = signal('');

  protected readonly partes = signal<FcrToolInspectionParte[]>([]);

  /** Estado de las 3 firmas tal como lo devolvió el backend — nunca un checkbox/nombre local. */
  protected readonly firmas = signal<Partial<Record<FcrToolInspectionFirmaRol, FcrToolInspectionFirma>>>({});
  /** Rol de la firma con una llamada en curso — evita doble-click mientras se persiste. */
  protected readonly firmando = signal<FcrToolInspectionFirmaRol | null>(null);

  protected readonly roleName = computed(() => this.auth.currentUser()?.roleName ?? '');

  protected readonly yaEnviado = computed(() => this.estado() === 'enviado' || this.estado() === 'aprobado');
  /** "Reparado por" certifica los datos y las partes tal como quedaron — a partir de ahí nadie más (Revisado por, Liberado QHSE) puede editarlos, solo firmar. */
  protected readonly formularioBloqueado = computed(() => this.yaEnviado() || !!this.firmas()['reparadoPor']?.firmado);

  /** Indicador para el operador de campo: la herramienta ya quedó reparada (mecánico firmó su parte) y cuándo. No es un nuevo estado de `FcrToolStatus`, solo deriva de la firma ya persistida. */
  protected readonly reparada = computed(() => !!this.firmas()['reparadoPor']?.firmado);
  protected readonly fechaReparadaTexto = computed(() => this.firmas()['reparadoPor']?.fecha ?? null);

  /** Las 3 firmas ya persistidas en el backend — no un checkbox marcado localmente. */
  protected readonly canEnviar = computed(
    () => !this.yaEnviado() && FCR_TOOL_INSPECTION_FIRMA_ROLES.every(rol => !!this.firmas()[rol]?.firmado),
  );

  constructor() {
    this.toolInspecciones.iniciar(this.data.ticketId, this.data.toolId, this.data.articuloId, this.data.cliente, this.data.pozo).subscribe({
      next: inspection => {
        this.aplicarInspection(inspection);
        this.loading.set(false);
      },
      error: () => {
        this.notify.error('Error', 'No se pudo abrir el checklist de esta herramienta.');
        this.modalRef.close(undefined);
      },
    });
  }

  private aplicarInspection(inspection: FcrToolInspection): void {
    this.inspectionId.set(inspection.id);
    this.estado.set(inspection.estado);
    this.cliente.set(inspection.cliente);
    this.pozo.set(inspection.pozo);
    this.fechaInspeccion.set(parseFecha(inspection.fechaInspeccion));
    this.fechaReparacion.set(parseFecha(inspection.fechaReparacion));
    this.fechaEnvio.set(parseFecha(inspection.fechaEnvio));
    this.descripcionHerramienta.set(inspection.descripcionHerramienta || this.data.toolName);
    this.numeroSerie.set(inspection.numeroSerie);
    this.inspeccionadoPor.set(inspection.inspeccionadoPor);
    this.reparadoPor.set(inspection.reparadoPor);
    this.observaciones.set(inspection.observaciones);
    this.partes.set(inspection.partes);
    this.firmas.set(inspection.firmas);
  }

  /** Rol de UI actual habilitado para dejar esta firma (comparación por `roleName`, mismo criterio que el resto de FCR). */
  protected tieneRolParaFirmar(rol: FcrToolInspectionFirmaRol): boolean {
    return FCR_TOOL_INSPECTION_FIRMA_ROLES_REQUERIDOS[rol].includes(this.roleName());
  }

  /** La firma anterior de la secuencia (si la hay) ya está persistida como firmada. */
  protected pasoAnteriorFirmado(rol: FcrToolInspectionFirmaRol): boolean {
    const anterior = FCR_TOOL_INSPECTION_FIRMA_ROL_ANTERIOR[rol];
    return !anterior || !!this.firmas()[anterior]?.firmado;
  }

  protected puedeFirmar(rol: FcrToolInspectionFirmaRol): boolean {
    return (
      !this.yaEnviado() &&
      !this.firmando() &&
      !this.firmas()[rol]?.firmado &&
      this.tieneRolParaFirmar(rol) &&
      this.pasoAnteriorFirmado(rol)
    );
  }

  /** Texto visible de por qué el checkbox está deshabilitado — vacío si ya se puede firmar o ya está firmada. */
  protected motivoDeshabilitado(rol: FcrToolInspectionFirmaRol): string {
    if (this.firmas()[rol]?.firmado) return '';
    if (!this.pasoAnteriorFirmado(rol)) {
      const anterior = FCR_TOOL_INSPECTION_FIRMA_ROL_ANTERIOR[rol];
      return anterior ? `Primero debe firmar "${FCR_TOOL_INSPECTION_FIRMA_LABELS[anterior]}".` : '';
    }
    if (!this.tieneRolParaFirmar(rol)) {
      return `Requiere rol ${this.rolRequeridoTexto(rol)}.`;
    }
    return '';
  }

  /** Texto legible del/de los rol(es) habilitados para esta firma — usado tanto en el motivo de bloqueo como en el hint "por hacer". */
  protected rolRequeridoTexto(rol: FcrToolInspectionFirmaRol): string {
    return FCR_TOOL_INSPECTION_FIRMA_ROLES_REQUERIDOS[rol].join(' / ');
  }

  // ── Partes agregadas a mano (la herramienta no las traía en el catálogo) ──

  protected readonly nuevaParteDescripcion = signal('');
  protected readonly nuevaParteCodigo = signal('');
  protected readonly nuevaParteCantidad = signal('1');
  protected readonly agregandoParte = signal(false);
  protected readonly puedeAgregarParte = computed(() => this.nuevaParteDescripcion().trim().length > 0 && !this.agregandoParte());

  /** Se guarda en la base al instante; los resultados que ya se marcaron en pantalla no se tocan (solo se suma la fila nueva). */
  protected async agregarParte(): Promise<void> {
    const inspectionId = this.inspectionId();
    if (!inspectionId || !this.puedeAgregarParte()) return;
    this.agregandoParte.set(true);
    try {
      const cantidad = Number(this.nuevaParteCantidad());
      const inspeccion = await firstValueFrom(
        this.toolInspecciones.agregarParte(this.data.ticketId, inspectionId, {
          descripcion: this.nuevaParteDescripcion().trim(),
          codigo: this.nuevaParteCodigo().trim() || undefined,
          cantidadEsperada: Number.isInteger(cantidad) && cantidad > 0 ? cantidad : 1,
        }),
      );
      const conocidas = new Set(this.partes().map(p => p.id));
      this.partes.update(rows => [...rows, ...inspeccion.partes.filter(p => !conocidas.has(p.id))]);
      this.nuevaParteDescripcion.set('');
      this.nuevaParteCodigo.set('');
      this.nuevaParteCantidad.set('1');
    } catch {
      this.notify.error('Error', 'No se pudo agregar la parte. Inténtalo de nuevo.');
    } finally {
      this.agregandoParte.set(false);
    }
  }

  protected async quitarParte(parte: FcrToolInspectionParte): Promise<void> {
    const inspectionId = this.inspectionId();
    if (!inspectionId || !parte.manual) return;
    try {
      await firstValueFrom(this.toolInspecciones.quitarParte(this.data.ticketId, inspectionId, parte.id));
      this.partes.update(rows => rows.filter(p => p.id !== parte.id));
    } catch {
      this.notify.error('Error', 'No se pudo quitar la parte.');
    }
  }

  protected updateParte(id: number, patch: Partial<FcrToolInspectionParte>): void {
    this.partes.update(rows => rows.map(row => (row.id === id ? { ...row, ...patch } : row)));
  }

  /**
   * Llenar 30-50 partes una por una es la queja más común del checklist en
   * papel — esto marca todas OK de una vez (Visual, End, Cambio·Cantidad en 0
   * y Acción "Ninguna", ya que una parte OK no tuvo cambio ni requirió
   * acción), y el operador solo corrige a mano las excepciones.
   */
  protected marcarTodoOk(): void {
    this.partes.update(rows => rows.map(row => ({ ...row, visualResultado: 'ok', endResultado: 'ok', cambioCantidad: 0, accion: 'Ninguna' })));
  }

  /**
   * Genera la plantilla "Inspección y reparación de herramientas" (mismo
   * formato ITEM/CANTIDAD/CODIGO/DESCRIPCION/VISUAL/END/CANTIDAD(cambio)/
   * ACCION que lee `onCargarPlantillaPartes`), precargada con las partes
   * reales de esta herramienta (`ArticuloParte`, ya en `this.partes()`) y las
   * columnas de inspección en blanco, para llenar fuera de línea (en campo,
   * sin señal) y volver a subirla.
   */
  protected descargarPlantillaPartes(): void {
    const encabezado = ['ITEM', 'CANTIDAD', 'CODIGO', 'DESCRIPCION', 'VISUAL', 'END', 'CANTIDAD', '', 'ACCION'];
    const filas = this.partes().map(parte => [parte.item, parte.cantidadEsperada, parte.codigo, parte.descripcion, '', '', '', '', '']);
    const hoja = XLSX.utils.aoa_to_sheet([encabezado, ...filas]);
    const libro = XLSX.utils.book_new();
    const nombreHoja = this.data.toolName.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Herramienta';
    XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
    XLSX.writeFile(libro, `plantilla-inspeccion-${this.data.toolName.replace(/[\\/:*?"<>|]/g, ' ')}.xlsx`);
  }

  /**
   * Carga la plantilla real "Inspección y reparación de herramientas.xlsx"
   * (una hoja por tipo de herramienta, encabezado ITEM/CANTIDAD/CODIGO/
   * DESCRIPCION/VISUAL/END/CANTIDAD(cambio)/ACCION) — mismo patrón que
   * `onCargarPlantilla` de `nuevo-pedido-dialog.ts`. A diferencia de esa,
   * acá NO reemplaza la tabla: la fila ya viene de `ArticuloParte` (snapshot
   * de `iniciar()`), así que solo actualiza Visual/End/Cambio·Cantidad/Acción
   * de las partes existentes, emparejando por código — para alguien que
   * llenó el Excel a mano en campo (sin señal) y ahora lo vuelca al digital.
   */
  protected onCargarPlantillaPartes(file: NzUploadFile): void {
    const archivo = (file.originFileObj as File | undefined) ?? (file as unknown as File);
    if (!archivo || typeof archivo.size !== 'number') {
      this.notify.error('Archivo no reconocido', 'No se pudo leer el archivo seleccionado. Probá de nuevo.');
      return;
    }
    if (archivo.size > MAX_PLANTILLA_PARTES_BYTES) {
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

        const idxCabecera = filas.findIndex(f => (f[0] ?? '').toString().trim().toUpperCase() === 'ITEM');
        if (idxCabecera === -1) {
          this.notify.error(
            'Plantilla no reconocida',
            'No se encontró el encabezado "ITEM" — ¿es la plantilla "Inspección y reparación de herramientas"? Asegurate de que la hoja del tipo de herramienta sea la primera del archivo.',
          );
          return;
        }

        const porCodigo = new Map(this.partes().map(p => [p.codigo.trim().toUpperCase(), p]));
        let actualizadas = 0;
        let sinCoincidencia = 0;

        for (const fila of filas.slice(idxCabecera + 1)) {
          const codigo = (fila[2] ?? '').toString().trim();
          if (!codigo) break; // primera fila sin código = fin de los datos (footer de firmas)
          const parte = porCodigo.get(codigo.toUpperCase());
          if (!parte) {
            sinCoincidencia++;
            continue;
          }

          const visual = normalizeResultado((fila[4] ?? '').toString());
          const end = normalizeResultado((fila[5] ?? '').toString());
          const cambioCantidadRaw = (fila[6] ?? '').toString().trim();
          const accion = (fila[8] ?? '').toString().trim();

          const patch: Partial<FcrToolInspectionParte> = {};
          if (visual) patch.visualResultado = visual;
          if (end) patch.endResultado = end;
          if (cambioCantidadRaw) patch.cambioCantidad = parseCambioCantidad(cambioCantidadRaw);
          if (accion) patch.accion = accion;
          if (Object.keys(patch).length > 0) {
            this.updateParte(parte.id, patch);
            actualizadas++;
          }
        }

        if (actualizadas === 0) {
          this.notify.error(
            'Sin datos para cargar',
            'Ninguna fila de la plantilla coincidió (por código) con las partes de esta herramienta, o venían todas vacías.',
          );
          return;
        }
        this.notify.success(
          'Plantilla cargada',
          `${actualizadas} parte(s) actualizada(s) desde el archivo.` +
            (sinCoincidencia > 0 ? ` ${sinCoincidencia} fila(s) no coincidieron con ninguna parte de esta herramienta.` : ''),
        );
      } catch {
        this.notify.error('Error al leer el archivo', 'No se pudo procesar el Excel. Verificá que no esté dañado.');
      }
    };
    reader.readAsArrayBuffer(archivo);
  }

  protected onVisualChange(id: number, value: unknown): void {
    this.updateParte(id, { visualResultado: value as FcrToolInspectionParteResultado });
  }

  protected onEndChange(id: number, value: unknown): void {
    this.updateParte(id, { endResultado: value as FcrToolInspectionParteResultado });
  }

  protected onCambioCantidadChange(id: number, raw: string): void {
    this.updateParte(id, { cambioCantidad: parseCambioCantidad(raw) });
  }

  protected onAccionChange(id: number, value: string): void {
    this.updateParte(id, { accion: value });
  }

  /** Persiste cabecera + todas las partes en paralelo — no exige firmas, deja el checklist en `borrador`. */
  private async persistirCambios(): Promise<void> {
    const ticketId = this.data.ticketId;
    const inspectionId = this.inspectionId();
    if (!inspectionId) return;

    await firstValueFrom(
      this.toolInspecciones.guardarHeader(ticketId, inspectionId, {
        cliente: this.cliente(),
        pozo: this.pozo(),
        fechaInspeccion: this.fechaInspeccion() ? toIsoDate(this.fechaInspeccion()!) : null,
        fechaReparacion: this.fechaReparacion() ? toIsoDate(this.fechaReparacion()!) : null,
        fechaEnvio: this.fechaEnvio() ? toIsoDate(this.fechaEnvio()!) : null,
        descripcionHerramienta: this.descripcionHerramienta(),
        numeroSerie: this.numeroSerie(),
        inspeccionadoPor: this.inspeccionadoPor(),
        reparadoPor: this.reparadoPor(),
        observaciones: this.observaciones(),
      }),
    );

    await Promise.all(
      this.partes().map(parte =>
        firstValueFrom(
          this.toolInspecciones.guardarParte(ticketId, inspectionId, parte.id, {
            visualResultado: parte.visualResultado,
            endResultado: parte.endResultado,
            cambioCantidad: parte.cambioCantidad,
            accion: parte.accion,
          }),
        ),
      ),
    );
  }

  protected async guardarBorrador(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.persistirCambios();
      this.notify.success('Checklist guardado', 'Los avances se guardaron como borrador.');
    } catch {
      this.notify.error('Error', 'No se pudo guardar el checklist. Inténtalo de nuevo.');
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Campos obligatorios para poder firmar "Reparado por" (certifica los
   * datos y las partes tal como quedaron, justo antes de que el formulario
   * se bloquee) — todo salvo "Observaciones" (opcional) y "Fecha de revisión"
   * (`fechaReparacion`): esa fecha la fija el backend automáticamente recién
   * AL firmar "reparadoPor" (ver `fcr-tool-inspecciones.service.ts`), nunca
   * antes — exigirla acá como requisito previo era un candado imposible de
   * abrir (bug: nunca se podía firmar "Reparado por").
   * En borrador (antes de esta firma) sí se permite dejar campos vacíos.
   */
  protected camposFaltantes(): string[] {
    const faltantes: string[] = [];
    if (!this.cliente().trim()) faltantes.push('Cliente');
    if (!this.pozo().trim()) faltantes.push('Pozo');
    if (!this.fechaInspeccion()) faltantes.push('Fecha de inspección');
    if (!this.fechaEnvio()) faltantes.push('Fecha de envío');
    if (!this.descripcionHerramienta().trim()) faltantes.push('Descripción de la herramienta');
    if (!this.numeroSerie().trim()) faltantes.push('N° de serie');
    if (!this.inspeccionadoPor()) faltantes.push('Inspeccionado por');
    if (!this.reparadoPor().trim()) faltantes.push('Operador mecánico (Reparado por)');
    const parteIncompleta = this.partes().some(
      p => !p.visualResultado || !p.endResultado || p.cambioCantidad === null || !p.accion.trim(),
    );
    if (parteIncompleta) faltantes.push('Resultado visual, resultado final, cambio de cantidad y acción de cada parte');
    return faltantes;
  }

  /** Handler del checkbox de firma: solo actúa al tildar (nunca al destildar) y solo si el paso realmente está habilitado. Pide confirmación antes de firmar — es irreversible (bloquea el formulario si es "Reparado por", o queda registrado a nombre de quien firma). */
  protected async onFirmaChange(rol: FcrToolInspectionFirmaRol, checked: boolean): Promise<void> {
    if (!checked || !this.puedeFirmar(rol)) return;
    if (rol === 'reparadoPor') {
      const faltantes = this.camposFaltantes();
      if (faltantes.length > 0) {
        this.notify.error('Faltan datos por completar', `Antes de confirmar "Reparado por": ${faltantes.join(', ')}.`);
        return;
      }
    }
    const nombre = this.auth.currentUser()?.name ?? this.roleName();
    const contenido =
      rol === 'reparadoPor'
        ? `Vas a confirmar "Reparado por" como ${nombre}. Esto certifica los datos y las partes tal como quedaron — a partir de acá se bloquean para edición, solo faltarán las confirmaciones restantes.`
        : `Vas a confirmar "${this.firmaLabels[rol]}" como ${nombre}. No se puede deshacer.`;
    const ok = await this.dialog.confirm({ title: 'Confirmar firma', content: contenido, okText: 'Firmar', cancelText: 'Cancelar' });
    if (!ok) return;
    void this.firmar(rol);
  }

  /**
   * Firma ESTE rol solo, de inmediato — no espera a un botón final que firme
   * las 3 juntas. Antes de firmar persiste cabecera+partes si el formulario
   * todavía es editable: "Reparado por" bloquea el formulario server-side
   * apenas queda firmado (`assertFormularioEditable`), así que si no se
   * guarda ANTES de esa firma, lo marcado localmente nunca llega al backend
   * y se pierde (bug reportado: el revisor abre el checklist y no ve nada
   * marcado). Para `revisadoPor`/`liberadoQhse` el formulario ya está
   * bloqueado en ese punto, así que este guardado no hace nada extra.
   */
  private async firmar(rol: FcrToolInspectionFirmaRol): Promise<void> {
    const ticketId = this.data.ticketId;
    const inspectionId = this.inspectionId();
    if (!inspectionId) return;

    this.firmando.set(rol);
    try {
      if (!this.formularioBloqueado()) await this.persistirCambios();
      const actualizado = await firstValueFrom(this.toolInspecciones.firmar(ticketId, inspectionId, rol, todayIso()));
      this.aplicarInspection(actualizado);
      this.notify.success('Firma registrada', `"${FCR_TOOL_INSPECTION_FIRMA_LABELS[rol]}" quedó firmado.`);
    } catch {
      this.notify.error('Error', 'No se pudo registrar la firma. Verifica tu rol e inténtalo de nuevo.');
    } finally {
      this.firmando.set(null);
    }
  }

  /** Ya no firma nada: las 3 firmas se hacen una a una al tildar cada checkbox. Solo persiste cabecera/partes y envía. */
  protected async enviarChecklist(): Promise<void> {
    if (this.saving() || !this.canEnviar() || !this.tieneRolParaFirmar('liberadoQhse')) return;
    const ticketId = this.data.ticketId;
    const inspectionId = this.inspectionId();
    if (!inspectionId) return;

    this.saving.set(true);
    try {
      // Una vez firmado "Reparado por" el formulario queda bloqueado server-side
      // (`assertFormularioEditable`) — reintentar guardar cabecera/partes acá
      // pisa esa protección y el backend responde 400 (bug reportado: "no se
      // pudo enviar el checklist" con las 3 firmas ya puestas).
      if (!this.formularioBloqueado()) await this.persistirCambios();
      const enviado = await firstValueFrom(this.toolInspecciones.enviar(ticketId, inspectionId));
      this.notify.success('Checklist enviado', 'El checklist de esta herramienta quedó enviado.');
      this.modalRef.close({ inspection: enviado });
    } catch {
      this.notify.error('Error', 'No se pudo enviar el checklist. Verifica los datos e inténtalo de nuevo.');
      this.saving.set(false);
    }
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }

  /** Formato "Registro de inspección y reparación de herramientas" con lo que hay en pantalla; las firmas se ponen sobre el PDF. */
  protected verPdf(): void {
    const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
    const inspeccion: FcrToolInspection = {
      id: this.inspectionId() ?? 0,
      ticketId: this.data.ticketId,
      toolId: this.data.toolId,
      articuloId: this.data.articuloId,
      cliente: this.cliente(),
      pozo: this.pozo(),
      fechaInspeccion: iso(this.fechaInspeccion()),
      fechaReparacion: iso(this.fechaReparacion()),
      fechaEnvio: iso(this.fechaEnvio()),
      descripcionHerramienta: this.descripcionHerramienta(),
      numeroSerie: this.numeroSerie(),
      inspeccionadoPor: this.inspeccionadoPor(),
      reparadoPor: this.reparadoPor(),
      estado: this.estado() as FcrToolInspection['estado'],
      observaciones: this.observaciones(),
      firmas: this.firmas(),
      partes: this.partes(),
    };
    this.documentoPdf.abrir({
      titulo: `Inspección y reparación — ${this.descripcionHerramienta() || this.data.toolName}`,
      component: ChecklistHerramientaHoja,
      inputs: { inspeccion },
      nombreArchivo: `Inspección y reparación ${this.descripcionHerramienta() || this.data.toolName}`,
    });
  }
}
