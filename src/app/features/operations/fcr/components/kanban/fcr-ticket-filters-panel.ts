import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_DRAWER_DATA, NzDrawerRef } from 'ng-zorro-antd/drawer';
import {
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillChipGroupComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillSelectComponent,
  type DynadrillSelectOption,
  type DynadrillSelectValue,
} from '@digitec-it-projects/dynadrill-ui';
import { FCR_PHASE_LABELS, type FcrPhase, type FcrTicket, type TipoOt } from '../../models/fcr.model';
import { FCR_BOARD_PHASES, FCR_SERVICE_ONLY_PHASES, FCR_TICKET_RELATION_LABELS, fcrRolePhases, type FcrTicketRelation } from '../../models/fcr-flow';
import {
  FCR_ALERTA_LABELS,
  FCR_EMPTY_FILTERS,
  FCR_ESTADO_LABELS,
  FCR_TIEMPO_LABELS,
  FCR_TIPO_OT_LABELS,
  applyFcrFilters,
  fcrFilterOptions,
  type FcrAlertaQhse,
  type FcrEstadoFiltro,
  type FcrTicketFilters,
  type FcrTiempoEnEtapa,
} from '../../models/fcr-ticket-filters';

export interface FcrFiltersPanelData {
  filters: FcrTicketFilters;
  tickets: readonly FcrTicket[];
  roleName: string;
}

/** Los chip-groups trabajan con etiquetas — estos helpers traducen etiqueta ↔ valor. */
const toLabels = <T extends string>(values: readonly T[], labels: Record<T, string>): string[] => values.map(v => labels[v]);
const toValues = <T extends string>(selected: readonly string[], labels: Record<T, string>): T[] =>
  (Object.keys(labels) as T[]).filter(k => selected.includes(labels[k]));

const toIsoDate = (d: Date | null | undefined): string | null =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;
const fromIsoDate = (iso: string | null): Date | null => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const asStrings = (v: DynadrillSelectValue): string[] => (Array.isArray(v) ? v.map(String) : v === null ? [] : [String(v)]);

/**
 * Panel de filtros del tablero/tabla FCR (drawer lateral; a pantalla
 * completa en móvil). Trabaja sobre un borrador: nada se aplica hasta "Ver
 * resultados", que devuelve los filtros al cerrar el drawer.
 */
@Component({
  selector: 'app-fcr-ticket-filters-panel',
  imports: [
    DynadrillButtonComponent,
    DynadrillCheckboxComponent,
    DynadrillChipGroupComponent,
    DynadrillDatetimePickerComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fcr-ticket-filters-panel.html',
  styleUrl: './fcr-ticket-filters-panel.scss',
})
export class FcrTicketFiltersPanel {
  private readonly drawerRef = inject(NzDrawerRef<FcrTicketFiltersPanel, FcrTicketFilters>);
  private readonly data = inject<FcrFiltersPanelData>(NZ_DRAWER_DATA);

  protected readonly draft = signal<FcrTicketFilters>(this.data.filters);
  protected readonly resultCount = computed(() => applyFcrFilters(this.data.tickets, this.draft(), this.data.roleName).length);

  private readonly options = fcrFilterOptions(this.data.tickets);
  private readonly myPhases = fcrRolePhases(this.data.roleName);

  protected readonly clientes = this.options.clientes;
  protected readonly toSelect = (values: readonly string[]): DynadrillSelectOption[] => values.map(v => ({ label: v, value: v }));
  protected readonly supervisorOptions = this.toSelect(this.options.supervisores);
  protected readonly operadorOptions = this.toSelect(this.options.operadores);
  protected readonly unidadOptions = this.toSelect(this.options.unidades);
  protected readonly phaseOptions: DynadrillSelectOption[] = FCR_BOARD_PHASES.map(p => ({ label: FCR_PHASE_LABELS[p], value: p }));

  protected readonly tipoOptions = Object.values(FCR_TIPO_OT_LABELS);
  protected readonly tiempoOptions = Object.values(FCR_TIEMPO_LABELS);
  protected readonly relacionOptions = Object.values(FCR_TICKET_RELATION_LABELS);
  protected readonly estadoOptions = Object.values(FCR_ESTADO_LABELS);
  protected readonly alertas = Object.entries(FCR_ALERTA_LABELS) as [FcrAlertaQhse, string][];

  protected readonly tipoSelected = computed(() => toLabels(this.draft().tipos, FCR_TIPO_OT_LABELS));
  protected readonly tiempoSelected = computed(() => toLabels(this.draft().tiempos, FCR_TIEMPO_LABELS));
  protected readonly relacionSelected = computed(() => toLabels(this.draft().relaciones, FCR_TICKET_RELATION_LABELS));
  protected readonly estadoSelected = computed(() => [FCR_ESTADO_LABELS[this.draft().estado]]);
  protected readonly desdeDate = computed(() => fromIsoDate(this.draft().desde));
  protected readonly hastaDate = computed(() => fromIsoDate(this.draft().hasta));

  private patch(changes: Partial<FcrTicketFilters>): void {
    this.draft.update(f => ({ ...f, ...changes }));
  }

  protected setCodigo(v: string): void { this.patch({ codigo: v }); }
  protected setPozo(v: string): void { this.patch({ pozo: v }); }
  protected setTipos(labels: string[]): void { this.patch({ tipos: toValues<TipoOt>(labels, FCR_TIPO_OT_LABELS) }); }
  protected setFases(v: DynadrillSelectValue): void { this.patch({ fases: asStrings(v) as FcrPhase[] }); }
  protected setSupervisores(v: DynadrillSelectValue): void { this.patch({ supervisores: asStrings(v) }); }
  protected setOperadores(v: DynadrillSelectValue): void { this.patch({ operadores: asStrings(v) }); }
  protected setUnidades(v: DynadrillSelectValue): void { this.patch({ unidades: asStrings(v) }); }
  protected setDesde(d: Date | null): void { this.patch({ desde: toIsoDate(d) }); }
  protected setHasta(d: Date | null): void { this.patch({ hasta: toIsoDate(d) }); }
  protected setTiempos(labels: string[]): void { this.patch({ tiempos: toValues<FcrTiempoEnEtapa>(labels, FCR_TIEMPO_LABELS) }); }
  protected setRelaciones(labels: string[]): void { this.patch({ relaciones: toValues<FcrTicketRelation>(labels, FCR_TICKET_RELATION_LABELS) }); }
  protected setEstado(labels: string[]): void {
    const [estado] = toValues<FcrEstadoFiltro>(labels, FCR_ESTADO_LABELS);
    if (estado) this.patch({ estado });
  }

  protected toggleIn<K extends 'clientes' | 'alertas'>(key: K, value: FcrTicketFilters[K][number], on: boolean): void {
    this.draft.update(f => {
      const list = f[key] as string[];
      const next = on ? [...new Set([...list, value])] : list.filter(v => v !== value);
      return { ...f, [key]: next };
    });
  }

  protected soloMisEtapas(): void { this.patch({ fases: FCR_BOARD_PHASES.filter(p => this.myPhases.has(p)) }); }
  protected soloServicio(): void { this.patch({ fases: [...FCR_SERVICE_ONLY_PHASES], tipos: ['servicio'] }); }

  /** Limpia el panel; conserva lo escrito en la barra de búsqueda (es otro control). */
  protected clearAll(): void { this.draft.set({ ...FCR_EMPTY_FILTERS, texto: this.draft().texto }); }
  protected apply(): void { this.drawerRef.close(this.draft()); }
  protected cancel(): void { this.drawerRef.close(); }
}
