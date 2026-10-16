import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DynadrillEmptyStateComponent, DynadrillSkeletonComponent, DynadrillTagComponent } from '@digitec-it-projects/dynadrill-ui';
import { NZ_DRAWER_DATA } from 'ng-zorro-antd/drawer';
import { HistorialPermiso, mensajeError } from '../models/roles-permisos.model';
import { RolesPermisosService } from '../services/roles-permisos.service';

export interface HistorialPermisosPanelData {
  roleId: string;
  roleName: string;
}

/** Contenido del drawer "Historial": últimos cambios de permisos del rol, el más reciente primero. */
@Component({
  selector: 'app-historial-permisos-panel',
  imports: [DatePipe, DynadrillEmptyStateComponent, DynadrillSkeletonComponent, DynadrillTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="historial__intro">Últimos cambios de permisos del rol {{ data.roleName }}.</p>

    @if (loading()) {
      <div class="historial__lista" role="status" aria-label="Cargando historial…">
        @for (placeholder of [1, 2, 3, 4]; track placeholder) {
          <dynadrill-skeleton variant="block" height="64px" />
        }
      </div>
    } @else if (error()) {
      <p class="historial__error" role="alert">{{ error() }}</p>
    } @else if (items().length === 0) {
      <dynadrill-empty-state title="Sin cambios registrados" description="Este rol todavía no tiene cambios de permisos." />
    } @else {
      <ul class="historial__lista">
        @for (item of items(); track item.id) {
          <li class="historial__item">
            <dynadrill-tag
              [label]="item.accion === 'otorgado' ? 'Otorgado' : 'Revocado'"
              [variant]="item.accion === 'otorgado' ? 'success' : 'error'"
            />
            <code class="historial__permiso">{{ item.permiso }}</code>
            <span class="historial__meta">
              {{ item.realizadoPor?.name ?? 'Sistema' }} · {{ item.realizadoAt | date: 'dd/MM/yyyy HH:mm' : '' : 'es' }}
            </span>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: block; }
    .historial__intro { margin: 0 0 16px; color: var(--text-muted, #5c5870); font-size: 14px; }
    .historial__lista { display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; list-style: none; }
    .historial__item {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 12px;
      align-items: center;
      padding: 12px;
      border: var(--border-width, 1px) solid var(--border, #e5e4ea);
      border-radius: var(--radius-sm, 8px);
    }
    .historial__permiso { overflow-wrap: anywhere; font-size: 13px; color: var(--text, #2c2b35); }
    .historial__meta { grid-column: 1 / -1; color: var(--text-muted, #5c5870); font-size: 12px; }
    .historial__error { margin: 0; color: var(--danger-text, #a8071a); font-size: 14px; }
  `,
})
export class HistorialPermisosPanel {
  protected readonly data = inject<HistorialPermisosPanelData>(NZ_DRAWER_DATA);
  private readonly service = inject(RolesPermisosService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<HistorialPermiso[]>([]);

  constructor() {
    this.service.historial(this.data.roleId).subscribe({
      next: items => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(mensajeError(err, 'No se pudo cargar el historial del rol.'));
        this.loading.set(false);
      },
    });
  }
}
