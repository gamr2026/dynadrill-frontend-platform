import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillCardComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  type DynadrillSelectOption,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import {
  CoberturaMapa,
  IpercCoberturaService,
  LINEA_SERVICIO_LABELS,
  LineaServicio,
} from '../../services/iperc-cobertura.service';
import { IpercService } from '../../services/iperc.service';
import { IpercMatrix } from '../../models/iperc.model';
import { AuthService } from '../../../../../core/services/auth.service';

/** Mismo orden y nombre que `LINEAS_SERVICIO` del backend. */
const LINEAS: LineaServicio[] = [
  'wellbore_cleanup_tools',
  'fishing_services',
  'remedial_tools',
  'completion_tools',
  'lower_completion',
  'milling',
  'casing_repair',
  'thru_tubing',
  'esp_equipment',
  'flow_control_tools',
  'liner_hanger',
  'pesca_wireline_tools',
  'pipe_recovery',
  'servicios_integrados',
  'slickline',
  'coiled_tubing',
  'cementing',
];
const MAPA_VACIO: CoberturaMapa = {
  wellbore_cleanup_tools: [],
  fishing_services: [],
  remedial_tools: [],
  completion_tools: [],
  lower_completion: [],
  milling: [],
  casing_repair: [],
  thru_tubing: [],
  esp_equipment: [],
  flow_control_tools: [],
  liner_hanger: [],
  pesca_wireline_tools: [],
  pipe_recovery: [],
  servicios_integrados: [],
  slickline: [],
  coiled_tubing: [],
  cementing: [],
};

/**
 * Editar el mapeo abre solicitudes de matriz — mismo criterio que aprobar
 * una IPERC (`ModuleRoles.ipercApprove` en el backend): sólo Coordinador y
 * Gerente HSE. El resto del staff HSE lo ve en modo lectura.
 */
const EDIT_ROLES = ['Coordinador HSE', 'Gerente HSE'];

const norm = (s: string): string => s.trim().toLowerCase();

type ActividadEstado = 'aprobada' | 'pendiente' | 'sin_matriz';

interface ActividadVista {
  nombre: string;
  estado: ActividadEstado;
  ipercId: number | null;
}

interface LineaVista {
  linea: LineaServicio;
  label: string;
  actividades: ActividadVista[];
  cobertura: 'ok' | 'incompleta';
  vacia: boolean;
  opciones: DynadrillSelectOption[];
}

const ESTADO_TAG: Record<ActividadEstado, { label: string; variant: DynadrillTagVariant }> = {
  aprobada: { label: 'Matriz aprobada', variant: 'success' },
  pendiente: { label: 'Pendiente de aprobación', variant: 'warning' },
  sin_matriz: { label: 'Sin matriz', variant: 'neutral' },
};

/**
 * QHSE ▸ Planificación ▸ Cobertura IPERC por línea. Configura qué
 * actividades de la Matriz Maestra (DYN-SGI-RE-087) exige cada línea de
 * servicio; el puente Facturación→QHSE lo lee al crear un ticket de
 * Pumping/FCR para decidir si el trabajo puede arrancar. Cada alta/baja se
 * guarda al instante (sin botón "Guardar"). Agregar una actividad que
 * todavía no tiene matriz abre su solicitud (borrador) para que HSE la
 * evalúe y apruebe.
 */
@Component({
  selector: 'app-iperc-cobertura-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DynadrillScreenHeaderComponent,
    DynadrillBannerComponent,
    DynadrillCardComponent,
    DynadrillTagComponent,
    DynadrillSelectComponent,
    DynadrillIconButtonComponent,
    DynadrillSpinnerComponent,
  ],
  templateUrl: './iperc-cobertura-page.html',
  styleUrl: './iperc-cobertura-page.scss',
})
export class IpercCoberturaPage {
  private readonly coberturaService = inject(IpercCoberturaService);
  private readonly ipercService = inject(IpercService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly dialog = inject(DynadrillDialogService);

  protected readonly loading = signal(true);
  protected readonly saving = signal<LineaServicio | null>(null);
  private readonly matrices = signal<IpercMatrix[]>([]);
  /** Estado guardado en el servidor — es la única fuente de verdad de la pantalla. */
  private readonly mapa = signal<CoberturaMapa>(MAPA_VACIO);

  protected readonly puedeEditar = computed(() => EDIT_ROLES.includes(this.auth.currentUser()?.roleName ?? ''));

  protected readonly estadoTag = (estado: ActividadEstado): { label: string; variant: DynadrillTagVariant } =>
    ESTADO_TAG[estado];

  /** Todas las actividades que ya tienen matriz (para el desplegable "+ agregar"). */
  private readonly actividadesConocidas = computed(() => {
    const vistos = new Set<string>();
    const out: string[] = [];
    for (const m of this.matrices()) {
      if (m.status === 'rechazada') continue;
      if (vistos.has(norm(m.actividad))) continue;
      vistos.add(norm(m.actividad));
      out.push(m.actividad);
    }
    return out.sort((a, b) => a.localeCompare(b));
  });

  protected readonly lineas = computed<LineaVista[]>(() =>
    LINEAS.map(linea => {
      const lista = this.mapa()[linea] ?? [];
      const actividades = lista.map(n => this.estadoActividad(n));
      const enUso = new Set(lista.map(norm));
      return {
        linea,
        label: LINEA_SERVICIO_LABELS[linea],
        actividades,
        cobertura: actividades.every(a => a.estado === 'aprobada') ? 'ok' : 'incompleta',
        vacia: lista.length === 0,
        opciones: this.actividadesConocidas()
          .filter(a => !enUso.has(norm(a)))
          .map(a => ({ label: a, value: a })),
      };
    }),
  );

  constructor() {
    forkJoin({ mapa: this.coberturaService.getAll(), matrices: this.ipercService.list() }).subscribe({
      next: ({ mapa, matrices }) => {
        this.matrices.set(matrices);
        this.mapa.set(this.normalizarMapa(mapa));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private normalizarMapa(mapa: CoberturaMapa): CoberturaMapa {
    return {
      wellbore_cleanup_tools: [...(mapa.wellbore_cleanup_tools ?? [])],
      fishing_services: [...(mapa.fishing_services ?? [])],
      remedial_tools: [...(mapa.remedial_tools ?? [])],
      completion_tools: [...(mapa.completion_tools ?? [])],
      lower_completion: [...(mapa.lower_completion ?? [])],
      milling: [...(mapa.milling ?? [])],
      casing_repair: [...(mapa.casing_repair ?? [])],
      thru_tubing: [...(mapa.thru_tubing ?? [])],
      esp_equipment: [...(mapa.esp_equipment ?? [])],
      flow_control_tools: [...(mapa.flow_control_tools ?? [])],
      liner_hanger: [...(mapa.liner_hanger ?? [])],
      pesca_wireline_tools: [...(mapa.pesca_wireline_tools ?? [])],
      pipe_recovery: [...(mapa.pipe_recovery ?? [])],
      servicios_integrados: [...(mapa.servicios_integrados ?? [])],
      slickline: [...(mapa.slickline ?? [])],
      coiled_tubing: [...(mapa.coiled_tubing ?? [])],
      cementing: [...(mapa.cementing ?? [])],
    };
  }

  private estadoActividad(nombre: string): ActividadVista {
    const m = this.matrices()
      .filter(x => x.status !== 'rechazada' && norm(x.actividad) === norm(nombre))
      .sort((a, b) => (a.status === 'aprobada' ? -1 : b.status === 'aprobada' ? 1 : b.id - a.id))[0];
    if (!m) return { nombre, estado: 'sin_matriz', ipercId: null };
    return { nombre, estado: m.status === 'aprobada' ? 'aprobada' : 'pendiente', ipercId: m.id };
  }

  protected agregar(linea: LineaServicio, nombre: string | null | undefined): void {
    const value = (nombre ?? '').trim();
    if (!value || this.saving()) return;
    const actual = this.mapa()[linea] ?? [];
    if (actual.some(n => norm(n) === norm(value))) return;
    this.persistir(linea, [...actual, value], `«${value}» agregada a ${LINEA_SERVICIO_LABELS[linea]}.`);
  }

  protected async quitar(linea: LineaServicio, nombre: string): Promise<void> {
    if (this.saving()) return;
    const ok = await this.dialog.confirm({
      title: `Quitar «${nombre}»`,
      content: `${LINEA_SERVICIO_LABELS[linea]} dejará de exigir esta actividad al crear un ticket. La matriz IPERC no se borra.`,
      okText: 'Quitar',
      cancelText: 'Cancelar',
      danger: true,
    });
    if (!ok) return;
    const restante = (this.mapa()[linea] ?? []).filter(n => n !== nombre);
    this.persistir(linea, restante, `«${nombre}» quitada de ${LINEA_SERVICIO_LABELS[linea]}.`);
  }

  /** Guarda la lista de una línea y refleja la respuesta del servidor. Revierte si falla. */
  private persistir(linea: LineaServicio, actividades: string[], mensajeOk: string): void {
    const previo = this.mapa();
    this.saving.set(linea);
    // Optimista: se ve el cambio de inmediato.
    this.mapa.set({ ...previo, [linea]: actividades });
    this.coberturaService.setLinea(linea, actividades).subscribe({
      next: mapa => {
        this.mapa.set(this.normalizarMapa(mapa));
        // Pudieron crearse borradores nuevos → refrescar la lista de matrices.
        this.ipercService.list().subscribe(matrices => this.matrices.set(matrices));
        this.saving.set(null);
        this.notify.success('Cobertura actualizada', mensajeOk);
      },
      error: () => {
        this.mapa.set(previo);
        this.saving.set(null);
        this.notify.error('No se pudo guardar', `Se revirtió el cambio en ${LINEA_SERVICIO_LABELS[linea]}.`);
      },
    });
  }
}
