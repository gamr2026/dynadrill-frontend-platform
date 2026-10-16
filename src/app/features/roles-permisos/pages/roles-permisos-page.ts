import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillDrawerService,
  DynadrillEmptyStateComponent,
  DynadrillNotificationService,
  DynadrillSkeletonComponent,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { SearchField } from '../../../shared/components/search-field/search-field';
import { HistorialPermisosPanel, HistorialPermisosPanelData } from '../components/historial-permisos-panel';
import {
  ACCIONES_ESTANDAR,
  AccionEstandar,
  ETIQUETAS_ACCION_ESTANDAR,
  PERMISOS_PROTEGIDOS_SUPERADMIN,
  PERMISO_EDITAR_ROLES,
  Permiso,
  Role,
  SUPERADMIN_ROLE_CODE,
  agruparPorModulo,
  filasPorRecurso,
  mensajeError,
  nombreModulo,
  rolCoincide,
  textoLegible,
} from '../models/roles-permisos.model';
import { RolesPermisosService } from '../services/roles-permisos.service';

/** Permiso del catálogo tal como lo pinta la plantilla (con su estado en el rol elegido). */
interface PermisoVista extends Permiso {
  /** Nombre legible de la acción ("Editar", "Editar permisos"). */
  nombreAccion: string;
  /** Texto para lectores de pantalla: "Editar pedidos para el rol Conductor". */
  etiquetaAria: string;
  checked: boolean;
  bloqueado: boolean;
}

/** Celda de una acción estándar: `permiso` es `null` si el recurso no la tiene en el catálogo ("No aplica"). */
interface CeldaVista {
  accion: AccionEstandar;
  permiso: PermisoVista | null;
}

/** Un recurso del módulo = una fila de la matriz. */
interface FilaVista {
  recurso: string;
  nombre: string;
  celdas: CeldaVista[];
  otras: PermisoVista[];
}

interface ColumnaVista {
  accion: AccionEstandar;
  etiqueta: string;
}

interface GrupoVista {
  modulo: string;
  nombre: string;
  permisos: PermisoVista[];
  filas: FilaVista[];
  seleccionados: number;
  todos: boolean;
  algunos: boolean;
  /** Todos los permisos del módulo están bloqueados: la casilla del módulo no puede cambiar nada. */
  sinEditables: boolean;
}

const mismoConjunto = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => a.size === b.size && [...a].every(c => b.has(c));

@Component({
  selector: 'app-roles-permisos-page',
  imports: [
    PageHeader,
    SearchField,
    DynadrillButtonComponent,
    DynadrillEmptyStateComponent,
    DynadrillSkeletonComponent,
    DynadrillTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './roles-permisos-page.html',
  styleUrl: './roles-permisos-page.scss',
})
export class RolesPermisosPage {
  private readonly service = inject(RolesPermisosService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly drawer = inject(DynadrillDrawerService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  protected readonly columnas: ColumnaVista[] = ACCIONES_ESTANDAR.map(accion => ({ accion, etiqueta: ETIQUETAS_ACCION_ESTANDAR[accion] }));
  /** Sin `identidad.roles.editar_permisos` la pantalla funciona en solo lectura (el backend respondería 403 al guardar). */
  protected readonly puedeEditar = computed(() => this.auth.can(PERMISO_EDITAR_ROLES));
  /** Permiso bajo el cursor o el foco, para mostrar su código y descripción (ayuda visible, también con teclado). */
  protected readonly ayuda = signal<PermisoVista | null>(null);

  /** Carga inicial (roles + catálogo). */
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly roles = signal<Role[]>([]);
  private readonly catalogo = signal<Permiso[]>([]);
  protected readonly query = signal('');

  protected readonly rolSeleccionado = signal<Role | null>(null);
  protected readonly loadingPermisos = signal(false);
  protected readonly permisosError = signal<string | null>(null);
  protected readonly saving = signal(false);
  /** Mensaje del último intento de guardar fallido (400/403 del backend). */
  protected readonly saveError = signal<string | null>(null);

  /** Permisos que el rol tiene guardados en el backend / permisos marcados en pantalla. */
  private readonly asignados = signal<ReadonlySet<string>>(new Set());
  private readonly seleccion = signal<ReadonlySet<string>>(new Set());

  /** Evita que la respuesta tardía de un rol anterior pise al rol elegido después. */
  private solicitud = 0;

  protected readonly rolesFiltrados = computed(() => this.roles().filter(rol => rolCoincide(rol, this.query())));

  private readonly esSuperadmin = computed(() => this.rolSeleccionado()?.code === SUPERADMIN_ROLE_CODE);

  protected readonly otorgar = computed(() => [...this.seleccion()].filter(c => !this.asignados().has(c)).length);
  protected readonly revocar = computed(() => [...this.asignados()].filter(c => !this.seleccion().has(c)).length);
  protected readonly dirty = computed(() => !mismoConjunto(this.seleccion(), this.asignados()));

  protected readonly grupos = computed<GrupoVista[]>(() => {
    const seleccion = this.seleccion();
    const superadmin = this.esSuperadmin();
    const rolNombre = this.rolSeleccionado()?.name ?? '';
    return agruparPorModulo(this.catalogo()).map(grupo => {
      const permisos = grupo.permisos.map<PermisoVista>(p => {
        const nombreAccion = textoLegible(p.accion);
        return {
          ...p,
          nombreAccion,
          etiquetaAria: `${nombreAccion} ${p.recurso.replace(/[_-]/g, ' ')} para el rol ${rolNombre}`,
          checked: seleccion.has(p.codigo),
          bloqueado: superadmin && PERMISOS_PROTEGIDOS_SUPERADMIN.includes(p.codigo),
        };
      });
      const porCodigo = new Map(permisos.map(p => [p.codigo, p]));
      const vista = (p: Permiso | null): PermisoVista | null => (p ? (porCodigo.get(p.codigo) ?? null) : null);
      const filas = filasPorRecurso(permisos).map<FilaVista>(fila => ({
        recurso: fila.recurso,
        nombre: textoLegible(fila.recurso),
        celdas: ACCIONES_ESTANDAR.map(accion => ({ accion, permiso: vista(fila.estandar[accion]) })),
        otras: fila.otras.map(p => vista(p)!),
      }));
      const seleccionados = permisos.filter(p => p.checked).length;
      return {
        modulo: grupo.modulo,
        nombre: nombreModulo(grupo.modulo),
        permisos,
        filas,
        seleccionados,
        todos: seleccionados === permisos.length,
        algunos: seleccionados > 0 && seleccionados < permisos.length,
        sinEditables: permisos.every(p => p.bloqueado),
      };
    });
  });

  constructor() {
    this.cargarInicial();
  }

  protected cargarInicial(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({ roles: this.service.listarRoles(), catalogo: this.service.listarPermisos() }).subscribe({
      next: ({ roles, catalogo }) => {
        this.roles.set(roles);
        this.catalogo.set(catalogo);
        this.loading.set(false);
      },
      error: err => {
        this.loadError.set(mensajeError(err, 'No se pudieron cargar los roles y el catálogo de permisos.'));
        this.loading.set(false);
      },
    });
  }

  protected onQueryChange(query: string): void {
    this.query.set(query);
  }

  /** Elige un rol; con cambios sin guardar pide confirmación antes de descartarlos. */
  async seleccionarRol(rol: Role): Promise<void> {
    if (this.rolSeleccionado()?.id === rol.id) return;
    if (this.dirty()) {
      const confirmado = await this.dialog.confirm({
        title: 'Hay cambios sin guardar',
        content: `Si cambia de rol se perderán los cambios de permisos sin guardar. ¿Desea continuar?`,
        okText: 'Descartar y cambiar',
        cancelText: 'Seguir editando',
        danger: true,
      });
      if (!confirmado) return;
    }
    this.cargarPermisosDe(rol);
  }

  private cargarPermisosDe(rol: Role): void {
    const solicitud = ++this.solicitud;
    this.rolSeleccionado.set(rol);
    this.loadingPermisos.set(true);
    this.permisosError.set(null);
    this.saveError.set(null);
    this.asignados.set(new Set());
    this.seleccion.set(new Set());
    this.service.permisosDeRol(rol.id).subscribe({
      next: codigos => {
        if (solicitud !== this.solicitud) return;
        this.asignados.set(new Set(codigos));
        this.seleccion.set(new Set(codigos));
        this.loadingPermisos.set(false);
      },
      error: err => {
        if (solicitud !== this.solicitud) return;
        this.permisosError.set(mensajeError(err, 'No se pudieron cargar los permisos del rol.'));
        this.loadingPermisos.set(false);
      },
    });
  }

  protected reintentarPermisos(): void {
    const rol = this.rolSeleccionado();
    if (rol) this.cargarPermisosDe(rol);
  }

  protected alternarPermiso(permiso: PermisoVista, checked: boolean): void {
    if (permiso.bloqueado || !this.puedeEditar()) return;
    this.seleccion.update(actual => {
      const siguiente = new Set(actual);
      if (checked) siguiente.add(permiso.codigo);
      else siguiente.delete(permiso.codigo);
      return siguiente;
    });
  }

  /** Marca o desmarca todos los permisos del módulo, salvo los bloqueados. */
  protected alternarModulo(grupo: GrupoVista, checked: boolean): void {
    if (!this.puedeEditar()) return;
    this.seleccion.update(actual => {
      const siguiente = new Set(actual);
      for (const permiso of grupo.permisos) {
        if (permiso.bloqueado) continue;
        if (checked) siguiente.add(permiso.codigo);
        else siguiente.delete(permiso.codigo);
      }
      return siguiente;
    });
  }

  protected mostrarAyuda(permiso: PermisoVista | null): void {
    this.ayuda.set(permiso);
  }

  descartar(): void {
    this.seleccion.set(new Set(this.asignados()));
    this.saveError.set(null);
  }

  guardar(): void {
    const rol = this.rolSeleccionado();
    if (!rol || !this.puedeEditar() || !this.dirty() || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.service.guardarPermisos(rol.id, [...this.seleccion()].sort()).subscribe({
      next: resultado => {
        // Si mientras tanto se cambió de rol (no debería: el botón queda bloqueado), no se toca la pantalla.
        if (this.rolSeleccionado()?.id === rol.id) {
          this.asignados.set(new Set(resultado.permisos));
          this.seleccion.set(new Set(resultado.permisos));
        }
        this.saving.set(false);
        this.notify.success('Permisos guardados', this.resumen(resultado.otorgados.length, resultado.revocados.length));
      },
      error: err => {
        this.saving.set(false);
        const mensaje = mensajeError(err, 'No se pudieron guardar los permisos.');
        this.saveError.set(mensaje);
        this.notify.error('No se guardaron los permisos', mensaje);
      },
    });
  }

  private resumen(otorgados: number, revocados: number): string {
    const plural = (n: number) => `${n} ${n === 1 ? 'permiso' : 'permisos'}`;
    return `Se otorgaron ${plural(otorgados)} y se revocaron ${plural(revocados)}.`;
  }

  verHistorial(): void {
    const rol = this.rolSeleccionado();
    if (!rol) return;
    this.drawer.open<HistorialPermisosPanel, HistorialPermisosPanelData>({
      title: `Historial de permisos · ${rol.name}`,
      content: HistorialPermisosPanel,
      data: { roleId: rol.id, roleName: rol.name },
      size: 'medium',
    });
  }
}
