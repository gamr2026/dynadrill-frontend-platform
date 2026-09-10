import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillCardComponent,
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
const LINEAS: LineaServicio[] = ['pumping', 'ctu', 'fishing', 'completion'];

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
  dirty: boolean;
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
 * Pumping/FCR para decidir si el trabajo puede arrancar. Agregar una
 * actividad que todavía no tiene matriz abre la solicitud (borrador) para
 * que HSE la evalúe y apruebe.
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
    DynadrillButtonComponent,
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

  protected readonly loading = signal(true);
  protected readonly saving = signal<LineaServicio | null>(null);
  private readonly matrices = signal<IpercMatrix[]>([]);
  /** Estado guardado en el servidor. */
  private readonly guardado = signal<CoberturaMapa>({ pumping: [], ctu: [], fishing: [], completion: [] });
  /** Copia editable — se sincroniza con `guardado` al cargar y al guardar cada línea. */
  private readonly draft = signal<Record<LineaServicio, string[]>>({ pumping: [], ctu: [], fishing: [], completion: [] });

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
      const draftList = this.draft()[linea] ?? [];
      const savedList = this.guardado()[linea] ?? [];
      const actividades = draftList.map(n => this.estadoActividad(n));
      const enUso = new Set(draftList.map(norm));
      return {
        linea,
        label: LINEA_SERVICIO_LABELS[linea],
        actividades,
        cobertura: actividades.every(a => a.estado === 'aprobada') ? 'ok' : 'incompleta',
        vacia: draftList.length === 0,
        dirty: JSON.stringify(draftList) !== JSON.stringify(savedList),
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
        this.setMapa(mapa);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private setMapa(mapa: CoberturaMapa): void {
    this.guardado.set(mapa);
    this.draft.set({
      pumping: [...(mapa.pumping ?? [])],
      ctu: [...(mapa.ctu ?? [])],
      fishing: [...(mapa.fishing ?? [])],
      completion: [...(mapa.completion ?? [])],
    });
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
    if (!value) return;
    if ((this.draft()[linea] ?? []).some(n => norm(n) === norm(value))) return;
    this.draft.update(d => ({ ...d, [linea]: [...(d[linea] ?? []), value] }));
  }

  protected quitar(linea: LineaServicio, nombre: string): void {
    this.draft.update(d => ({ ...d, [linea]: (d[linea] ?? []).filter(n => n !== nombre) }));
  }

  protected descartar(linea: LineaServicio): void {
    this.draft.update(d => ({ ...d, [linea]: [...(this.guardado()[linea] ?? [])] }));
  }

  protected guardar(linea: LineaServicio): void {
    if (this.saving()) return;
    this.saving.set(linea);
    this.coberturaService.setLinea(linea, this.draft()[linea] ?? []).subscribe({
      next: mapa => {
        // Pudieron crearse borradores nuevos → refrescar la lista de matrices.
        this.ipercService.list().subscribe(matrices => this.matrices.set(matrices));
        this.setMapa(mapa);
        this.saving.set(null);
        this.notify.success(
          'Mapeo actualizado',
          `${LINEA_SERVICIO_LABELS[linea]}: las actividades nuevas quedaron como solicitud (borrador) pendiente de que Coordinador/Gerente HSE las apruebe.`,
        );
      },
      error: () => {
        this.saving.set(null);
        this.notify.error('No se pudo guardar', `No se actualizó el mapeo de ${LINEA_SERVICIO_LABELS[linea]}.`);
      },
    });
  }
}
