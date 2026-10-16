import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  type DynadrillSelectOption,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import { injectNarrowViewport } from '../../../../core/utils/narrow-viewport.util';
import { EntityCard } from '../../../../shared/components/entity-card/entity-card';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import type { RecordAction } from '../../../../shared/components/record-card/record-card';
import { SearchField } from '../../../../shared/components/search-field/search-field';
import { UnidadFormDialog, type UnidadFormDialogData } from '../../components/unidad-form-dialog';
import {
  CATEGORIA_PESO_LABEL,
  TIPO_UNIDAD_LABEL,
  type AlertaPreventivaFlota,
  type NivelAlertaFlota,
  type TipoUnidadFlota,
  type UnidadFlota,
} from '../../models/unidad-flota.model';
import { FlotaUnidadesService } from '../../services/flota-unidades.service';
import { formatoNumero } from '../../utils/flota.util';

const TONO: Record<NivelAlertaFlota, DynadrillTagVariant> = { rojo: 'error', amarillo: 'warning', verde: 'success' };
const ETIQUETA: Record<NivelAlertaFlota, string> = { rojo: 'Vencido', amarillo: 'Próximo', verde: 'Al día' };
const ORDEN: NivelAlertaFlota[] = ['rojo', 'amarillo', 'verde'];

const TIPO_FILTRO: DynadrillSelectOption[] = [
  { label: 'Todos los tipos', value: '' },
  { label: 'Servicio', value: 'servicio' },
  { label: 'Auxiliar', value: 'auxiliar' },
  { label: 'Transporte', value: 'transporte' },
];

/** Listado de unidades de Flota con el estado de su mantenimiento preventivo (el peor nivel entre sus alertas). */
@Component({
  selector: 'app-unidades-list-page',
  imports: [
    PageHeader,
    EntityCard,
    SearchField,
    DynadrillDataTableComponent,
    DynadrillButtonComponent,
    DynadrillIconComponent,
    DynadrillSpinnerComponent,
    DynadrillSelectComponent,
    DynadrillCheckboxComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unidades-list-page.html',
  styleUrl: './unidades-list-page.scss',
})
export class UnidadesListPage {
  private readonly flota = inject(FlotaUnidadesService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly isMobile = injectNarrowViewport();
  protected readonly puedeCrear = computed(() => this.auth.can('flota.unidades.crear'));
  protected readonly tipoFiltro = TIPO_FILTRO;

  protected readonly query = signal('');
  protected readonly tipo = signal<TipoUnidadFlota | ''>('');
  protected readonly incluirBajas = signal(false);
  protected readonly loading = signal(true);
  protected readonly unidades = signal<UnidadFlota[]>([]);
  private readonly alertas = signal<AlertaPreventivaFlota[]>([]);

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'codigo', header: 'Código', sortable: true, searchable: true },
    { key: 'nombre', header: 'Nombre', searchable: true },
    { key: 'tipo', header: 'Tipo' },
    { key: 'placa', header: 'Placa' },
    { key: 'lectura', header: 'Lectura actual' },
    { key: 'preventivoBadge', header: 'Mantenimiento preventivo', type: 'badge' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  private readonly peorNivel = computed(() => {
    const mapa = new Map<string, NivelAlertaFlota>();
    for (const a of this.alertas()) {
      const actual = mapa.get(a.unidad.id);
      if (!actual || ORDEN.indexOf(a.nivel) < ORDEN.indexOf(actual)) mapa.set(a.unidad.id, a.nivel);
    }
    return mapa;
  });

  protected readonly rows = computed(() =>
    this.unidades().map(u => {
      const nivel = this.peorNivel().get(u.id);
      const lectura = u.tipo === 'servicio' ? u.horometro : u.tipo === 'transporte' ? u.odometro : null;
      const unidadLectura = u.tipo === 'servicio' ? 'h' : 'km';
      return {
        id: u.id,
        codigo: u.codigo,
        nombre: u.nombre,
        tipo: u.categoriaPeso ? `${TIPO_UNIDAD_LABEL[u.tipo]} · ${CATEGORIA_PESO_LABEL[u.categoriaPeso]}` : TIPO_UNIDAD_LABEL[u.tipo],
        placa: u.vehiculo?.placa ?? '—',
        lectura: lectura ? `${formatoNumero(lectura.valor)} ${unidadLectura}` : '—',
        preventivoBadge: nivel ? { text: ETIQUETA[nivel], tone: TONO[nivel] } : { text: 'Sin datos', tone: 'neutral' as DynadrillTagVariant },
        estadoBadge: u.activa ? { text: 'Activa', tone: 'success' as DynadrillTagVariant } : { text: 'De baja', tone: 'neutral' as DynadrillTagVariant },
      };
    }),
  );

  protected readonly cards = computed(() => {
    const q = this.query().trim().toLocaleLowerCase('es');
    return this.rows()
      .filter(r => !q || r.codigo.toLocaleLowerCase('es').includes(q) || r.nombre.toLocaleLowerCase('es').includes(q))
      .map(r => ({
        id: r.id,
        title: `${r.codigo} · ${r.nombre}`,
        lines: [[r.tipo, r.placa !== '—' ? r.placa : '', r.lectura !== '—' ? r.lectura : ''].filter(Boolean).join(' · ')],
        tags: [r.preventivoBadge, r.estadoBadge],
        actions: [{ icon: 'eye', label: `Ver ficha de ${r.codigo}`, primary: true, run: () => this.verFicha(r.id) }] as RecordAction[],
      }));
  });

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.recargar();
  }

  protected recargar(): void {
    this.loading.set(true);
    this.flota
      .listar({ tipo: this.tipo() || undefined, activa: this.incluirBajas() ? 'todas' : 'true' })
      .subscribe({
        next: unidades => {
          this.unidades.set(unidades);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.notify.error('Error', 'No se pudo cargar el listado de unidades.');
        },
      });
    this.flota.alertas().subscribe({
      next: a => this.alertas.set(a),
      error: () => this.alertas.set([]),
    });
  }

  protected cambiarTipo(valor: string): void {
    this.tipo.set(valor as TipoUnidadFlota | '');
    this.recargar();
  }

  protected cambiarBajas(valor: boolean): void {
    this.incluirBajas.set(valor);
    this.recargar();
  }

  protected nuevaUnidad(): void {
    const ref = this.dialog.open<UnidadFormDialog, UnidadFormDialogData>({
      title: 'Nueva unidad',
      content: UnidadFormDialog,
      data: {},
      footer: false,
    });
    ref.afterClose.subscribe(creada => {
      if (creada) this.recargar();
    });
  }

  protected verFicha(id: string): void {
    void this.router.navigate(['/dashboard/flota/unidades', id]);
  }

  protected verFilaFicha(row: Record<string, unknown>): void {
    this.verFicha(String(row['id']));
  }
}
