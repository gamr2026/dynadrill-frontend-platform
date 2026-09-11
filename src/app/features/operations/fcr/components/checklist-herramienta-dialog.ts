import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { firstValueFrom } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillSkeletonComponent,
  DynadrillTextComponent,
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
}

export interface ChecklistHerramientaDialogResult {
  inspection: FcrToolInspection;
}

const VISUAL_END_OPTIONS: DynadrillSelectOption[] = [
  { label: '—', value: '' },
  { label: 'OK', value: 'ok' },
  { label: 'Defectuoso', value: 'defectuoso' },
];

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
@Component({
  selector: 'app-checklist-herramienta-dialog',
  imports: [
    DynadrillTextComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillDatetimePickerComponent,
    DynadrillCheckboxComponent,
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillSkeletonComponent,
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

  protected readonly visualEndOptions = VISUAL_END_OPTIONS;
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

  protected readonly partes = signal<FcrToolInspectionParte[]>([]);

  /** Estado de las 3 firmas tal como lo devolvió el backend — nunca un checkbox/nombre local. */
  protected readonly firmas = signal<Partial<Record<FcrToolInspectionFirmaRol, FcrToolInspectionFirma>>>({});
  /** Rol de la firma con una llamada en curso — evita doble-click mientras se persiste. */
  protected readonly firmando = signal<FcrToolInspectionFirmaRol | null>(null);

  protected readonly roleName = computed(() => this.auth.currentUser()?.roleName ?? '');

  protected readonly yaEnviado = computed(() => this.estado() === 'enviado' || this.estado() === 'aprobado');
  /** "Reparado por" certifica los datos y las partes tal como quedaron — a partir de ahí nadie más (Revisado por, Liberado QHSE) puede editarlos, solo firmar. */
  protected readonly formularioBloqueado = computed(() => this.yaEnviado() || !!this.firmas()['reparadoPor']?.firmado);

  /** Las 3 firmas ya persistidas en el backend — no un checkbox marcado localmente. */
  protected readonly canEnviar = computed(
    () => !this.yaEnviado() && FCR_TOOL_INSPECTION_FIRMA_ROLES.every(rol => !!this.firmas()[rol]?.firmado),
  );

  constructor() {
    this.toolInspecciones.iniciar(this.data.ticketId, this.data.toolId, this.data.articuloId).subscribe({
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

  protected updateParte(id: number, patch: Partial<FcrToolInspectionParte>): void {
    this.partes.update(rows => rows.map(row => (row.id === id ? { ...row, ...patch } : row)));
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

  /** Handler del checkbox de firma: solo actúa al tildar (nunca al destildar) y solo si el paso realmente está habilitado. */
  protected onFirmaChange(rol: FcrToolInspectionFirmaRol, checked: boolean): void {
    if (!checked || !this.puedeFirmar(rol)) return;
    void this.firmar(rol);
  }

  /** Firma ESTE rol solo, de inmediato — no espera a un botón final que firme las 3 juntas. */
  private async firmar(rol: FcrToolInspectionFirmaRol): Promise<void> {
    const ticketId = this.data.ticketId;
    const inspectionId = this.inspectionId();
    if (!inspectionId) return;

    this.firmando.set(rol);
    try {
      const actualizado = await firstValueFrom(this.toolInspecciones.firmar(ticketId, inspectionId, rol, todayIso()));
      this.firmas.set(actualizado.firmas);
      this.notify.success('Firma registrada', `"${FCR_TOOL_INSPECTION_FIRMA_LABELS[rol]}" quedó firmado.`);
    } catch {
      this.notify.error('Error', 'No se pudo registrar la firma. Verifica tu rol e inténtalo de nuevo.');
    } finally {
      this.firmando.set(null);
    }
  }

  /** Ya no firma nada: las 3 firmas se hacen una a una al tildar cada checkbox. Solo persiste cabecera/partes y envía. */
  protected async enviarChecklist(): Promise<void> {
    if (this.saving() || !this.canEnviar()) return;
    const ticketId = this.data.ticketId;
    const inspectionId = this.inspectionId();
    if (!inspectionId) return;

    this.saving.set(true);
    try {
      await this.persistirCambios();
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
}
