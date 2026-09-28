import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillIconComponent,
  DynadrillSpinnerComponent,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { UnidadesService } from '../../../maintenance/services/unidades.service';
import { AlertaPreventivaNivel, calcularAlertas, Unidad } from '../../../maintenance/models/unidad.model';
import { VehiculoPatrimonioDialog, VehiculoPatrimonioDialogData } from '../../components/vehiculo-patrimonio-dialog';
import { UnidadCreateDialog } from '../../components/unidad-create-dialog';
import { HistorialDialog, HistorialDialogData } from '../../../maintenance/components/historial-dialog';
import { injectNarrowViewport } from '../../../../core/utils/narrow-viewport.util';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { EntityCard } from '../../../../shared/components/entity-card/entity-card';
import { SearchField } from '../../../../shared/components/search-field/search-field';
import type { RecordAction } from '../../../../shared/components/record-card/record-card';

/** Mismos tonos/etiquetas que la bandeja de Mantenimiento (maintenance-list-page) — un vehículo vencido se ve igual de urgente lo mires desde donde lo mires. */
const PREVENTIVO_TONE: Record<AlertaPreventivaNivel, DynadrillTagVariant> = {
  rojo: 'error',
  amarillo: 'warning',
  verde: 'success',
};

const PREVENTIVO_LABEL: Record<AlertaPreventivaNivel, string> = {
  rojo: 'Vencido',
  amarillo: 'Próximo',
  verde: 'Al día',
};

/** Peor nivel entre todas las alertas de la unidad (una unidad de Servicio puede tener alertas A y B a la vez) — rojo gana sobre amarillo, gana sobre verde. */
function peorNivel(niveles: AlertaPreventivaNivel[]): AlertaPreventivaNivel | null {
  if (niveles.includes('rojo')) return 'rojo';
  if (niveles.includes('amarillo')) return 'amarillo';
  if (niveles.includes('verde')) return 'verde';
  return null;
}

/**
 * Misma fuente que Mantenimiento (UnidadesService) — no una lista de
 * vehículos aparte. Esta vista solo resalta los campos patrimoniales
 * (placa/marca/responsable) que a la bandeja operativa de Mantenimiento
 * no le hacían falta.
 */
@Component({
  selector: 'app-vehiculos-list-page',
  imports: [PageHeader, EntityCard, SearchField, DynadrillDataTableComponent, DynadrillButtonComponent, DynadrillIconComponent, DynadrillSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vehiculos-list-page.html',
  styleUrl: './vehiculos-list-page.scss',
})
export class VehiculosListPage {
  private readonly unidadesService = inject(UnidadesService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  /** Móvil: buscador + tarjetas (M · Vehículos · Lista en Figma). */
  protected readonly isMobile = injectNarrowViewport();
  protected readonly query = signal('');

  protected readonly loading = signal(true);
  protected readonly unidades = signal<Unidad[]>([]);

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Código', sortable: true, searchable: true },
    { key: 'nombre', header: 'Nombre', searchable: true },
    { key: 'tipo', header: 'Tipo' },
    { key: 'placa', header: 'Placa' },
    { key: 'marca', header: 'Marca / Modelo' },
    { key: 'responsablePatrimonial', header: 'Responsable' },
    { key: 'preventivoBadge', header: 'Mantenimiento preventivo', type: 'badge' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  protected readonly rows = computed(() =>
    this.unidades().map(u => {
      const nivel = peorNivel(calcularAlertas(u).map(a => a.nivel));
      return {
        id: u.id,
        code: u.code,
        nombre: u.nombre,
        tipo: u.tipo,
        placa: u.placa ?? '—',
        marca: [u.marca, u.modelo].filter(Boolean).join(' ') || '—',
        responsablePatrimonial: u.responsablePatrimonial ?? '—',
        preventivoBadge: nivel
          ? { text: PREVENTIVO_LABEL[nivel], tone: PREVENTIVO_TONE[nivel] }
          : { text: 'Sin datos', tone: 'neutral' as DynadrillTagVariant },
        estadoBadge:
          u.activo === false
            ? { text: 'Inactivo', tone: 'neutral' as const }
            : { text: 'Activo', tone: 'success' as const },
      };
    }),
  );

  protected readonly cards = computed(() => {
    const q = this.query().trim().toLocaleLowerCase('es');
    return this.rows()
      .filter(r => !q || r.code.toLocaleLowerCase('es').includes(q) || r.nombre.toLocaleLowerCase('es').includes(q))
      .map(r => ({
        id: r.id,
        title: `${r.code} · ${r.nombre}`,
        lines: [[r.tipo, r.placa, r.marca, r.responsablePatrimonial].filter(v => v && v !== '—').join(' · ')],
        tags: [r.preventivoBadge, r.estadoBadge],
        actions: [
          { icon: 'clock-circle', label: `Ver historial de ${r.code}`, run: () => this.verHistorial(r) },
          { icon: 'edit', label: `Editar ${r.code}`, run: () => this.editar(r) },
        ] as RecordAction[],
      }));
  });

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.unidadesService.list().subscribe({
      next: unidades => {
        this.unidades.set(unidades);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar el listado de vehículos.');
      },
    });
  }

  protected nuevaUnidad(): void {
    const ref = this.dialog.open<UnidadCreateDialog>({ title: 'Nueva unidad', content: UnidadCreateDialog, footer: false });
    ref.afterClose.subscribe(created => {
      if (created) this.reload();
    });
  }

  /** Mismo diálogo que usa la bandeja de Mantenimiento (historial-dialog) — antes solo estaba enganchado ahí, sin forma de llegar desde Inventario a la misma unidad. */
  protected verHistorial(row: Record<string, unknown>): void {
    const unidad = this.unidades().find(u => u.id === row['id']);
    if (!unidad) return;
    this.dialog.open<HistorialDialog, HistorialDialogData>({
      title: 'Historial de mantenimiento',
      content: HistorialDialog,
      data: { unidadId: unidad.id, unidadCode: unidad.code, unidadNombre: unidad.nombre },
      footer: false,
      width: '640px',
    });
  }

  protected editar(row: Record<string, unknown>): void {
    const unidad = this.unidades().find(u => u.id === row['id']);
    if (!unidad) return;
    const ref = this.dialog.open<VehiculoPatrimonioDialog, VehiculoPatrimonioDialogData>({
      title: `Datos patrimoniales — ${unidad.code}`,
      content: VehiculoPatrimonioDialog,
      data: { unidad },
      footer: false,
    });
    ref.afterClose.subscribe(updated => {
      if (updated) this.reload();
    });
  }
}
