import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTabsComponent,
  type DynadrillTab,
} from '@digitec-it-projects/dynadrill-ui';
import { injectNarrowViewport } from '../../../../../core/utils/narrow-viewport.util';
import { KpiStat, type KpiStatTone } from '../../../../../shared/components/kpi-stat/kpi-stat';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { mensajeDeError } from '../../../../../shared/utils/mensaje-error.util';
import {
  QhseRegistrosMovil,
  type RegistroMovil,
} from '../../../shared/components/qhse-registros-movil';
import {
  InspeccionDetalleDialog,
  type InspeccionDetalleDialogData,
} from '../../components/inspeccion-detalle-dialog';
import { InspeccionRegistrarDialog } from '../../components/inspeccion-registrar-dialog';
import {
  RESULTADO_ETIQUETA,
  textoProxima,
  type EstadoEquipo,
  type InspeccionResumen,
} from '../../models/inspeccion';
import { InspeccionesService } from '../../services/inspecciones.service';

/** Inspecciones de campo: el historial y el estado de cada equipo (cuarentena, próxima inspección debida y vigencia trimestral). */
@Component({
  selector: 'app-inspecciones-plataforma-page',
  imports: [
    PageHeader,
    KpiStat,
    QhseRegistrosMovil,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillIconButtonComponent,
    DynadrillDataTableComponent,
    DynadrillTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DatePipe],
  templateUrl: './inspecciones-page.html',
  styleUrl: './inspecciones-page.scss',
})
export class InspeccionesPage {
  private readonly servicio = inject(InspeccionesService);
  private readonly dialogos = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly datePipe = inject(DatePipe);

  protected readonly isMobile = injectNarrowViewport();
  protected readonly tabs: DynadrillTab[] = [
    { label: 'Equipos' },
    { label: 'Historial de inspecciones' },
  ];
  protected readonly tabActiva = signal(0);
  protected readonly cargando = signal(true);
  protected readonly inspecciones = signal<InspeccionResumen[]>([]);
  protected readonly equipos = signal<EstadoEquipo[]>([]);
  protected readonly busqueda = signal('');

  protected readonly kpis = computed<{ label: string; value: number; tone: KpiStatTone }[]>(() => {
    const e = this.equipos();
    return [
      { label: 'Equipos inspeccionados', value: e.length, tone: 'neutral' },
      { label: 'En cuarentena', value: e.filter((x) => x.enCuarentena).length, tone: 'warning' },
      { label: 'Inspección atrasada', value: e.filter((x) => x.atrasada).length, tone: 'warning' },
      {
        label: 'Vigencia trimestral vencida',
        value: e.filter((x) => x.vigenciaVencida).length,
        tone: 'warning',
      },
    ];
  });

  private fecha(dia: string): string {
    return this.datePipe.transform(`${dia}T12:00:00`, 'dd/MM/yyyy') ?? dia;
  }

  protected readonly columnasEquipos: DynadrillDataTableColumn[] = [
    { key: 'tipo', header: 'Tipo', sortable: true },
    { key: 'equipo', header: 'Equipo', sortable: true },
    { key: 'ultima', header: 'Última inspección' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
    { key: 'proxima', header: 'Próxima debida' },
    { key: 'vigencia', header: 'Vigencia trimestral' },
  ];

  protected readonly filasEquipos = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return this.equipos()
      .filter(
        (e) =>
          !q ||
          [e.equipoCodigo, e.tipo.nombre, e.unidadCodigo ?? ''].some((v) =>
            v.toLowerCase().includes(q),
          ),
      )
      .map((e) => ({
        id: e.ultimaInspeccion.id,
        tipo: e.tipo.nombre,
        equipo: e.equipoCodigo,
        ultima: `${this.fecha(e.ultimaInspeccion.fecha)} · ${e.ultimaInspeccion.codigo}`,
        estadoBadge: e.enCuarentena
          ? { text: 'En cuarentena', tone: 'error' as const }
          : e.atrasada
            ? { text: 'Atrasada', tone: 'warning' as const }
            : { text: 'Al día', tone: 'success' as const },
        proxima: `${this.fecha(e.proximaDebida)} (${textoProxima(e.diasParaProxima)})`,
        vigencia: e.vigenciaVencida
          ? `Vencida el ${this.fecha(e.vigenteHasta)}`
          : `Hasta el ${this.fecha(e.vigenteHasta)}`,
      }));
  });

  protected readonly columnasHistorial: DynadrillDataTableColumn[] = [
    { key: 'codigo', header: 'Inspección', sortable: true },
    { key: 'fecha', header: 'Fecha', sortable: true },
    { key: 'tipo', header: 'Tipo' },
    { key: 'equipo', header: 'Equipo' },
    { key: 'inspector', header: 'Inspector' },
    { key: 'resultadoBadge', header: 'Resultado', type: 'badge' },
  ];

  protected readonly filasHistorial = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return this.inspecciones()
      .filter(
        (i) =>
          !q ||
          [i.codigo, i.equipoCodigo, i.tipo.nombre, i.inspector].some((v) =>
            v.toLowerCase().includes(q),
          ),
      )
      .map((i) => ({
        id: i.id,
        codigo: i.codigo,
        fecha: this.fecha(i.fecha),
        tipo: i.tipo.nombre,
        equipo: i.equipoCodigo,
        inspector: i.inspector,
        resultadoBadge: {
          text: RESULTADO_ETIQUETA[i.resultado],
          tone: i.resultado === 'aprobado' ? ('success' as const) : ('error' as const),
        },
      }));
  });

  protected readonly itemsMovil = computed<RegistroMovil[]>(() =>
    this.filasEquipos().map((f) => ({
      id: f.id,
      eyebrow: f.tipo,
      title: f.equipo,
      subtitle: `Última: ${f.ultima}`,
      status: f.estadoBadge,
      fields: [
        { label: 'Próxima debida', value: f.proxima },
        { label: 'Vigencia', value: f.vigencia },
      ],
      actions: [
        {
          icon: 'eye',
          label: 'Ver la última inspección',
          primary: true,
          run: () => this.abrir(f.id),
        },
      ],
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.recargar();
  }

  protected abrir(id: string): void {
    this.dialogos.open<InspeccionDetalleDialog, InspeccionDetalleDialogData>({
      title: 'Inspección de campo',
      content: InspeccionDetalleDialog,
      data: { inspeccionId: id },
      footer: false,
      width: '640px',
    });
  }

  protected nueva(): void {
    const ref = this.dialogos.open<InspeccionRegistrarDialog>({
      title: 'Nueva inspección de campo',
      content: InspeccionRegistrarDialog,
      footer: false,
      width: '640px',
    });
    ref.afterClose.subscribe((r) => {
      if (r) this.recargar();
    });
  }

  private recargar(): void {
    this.cargando.set(true);
    forkJoin({ lista: this.servicio.listar(), equipos: this.servicio.equipos() }).subscribe({
      next: ({ lista, equipos }) => {
        this.inspecciones.set(lista);
        this.equipos.set(equipos);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudieron cargar las inspecciones.'));
      },
    });
  }
}
