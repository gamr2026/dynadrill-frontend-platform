import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillEmptyStateComponent,
  DynadrillIconButtonComponent,
  DynadrillIconComponent,
  DynadrillNotificationService,
  DynadrillSkeletonComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { injectNarrowViewport } from '../../../core/utils/narrow-viewport.util';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { SearchField } from '../../../shared/components/search-field/search-field';
import { EntityCard } from '../../../shared/components/entity-card/entity-card';
import { ListPager } from '../../../shared/components/list-pager/list-pager';
import type { RecordAction } from '../../../shared/components/record-card/record-card';
import { createPagination } from '../../../shared/utils/pagination.util';
import { mensajeError } from '../../roles-permisos/models/roles-permisos.model';
import { UserFormDialog, UserFormDialogData } from '../components/user-form-dialog';
import { UserRow, matchesUserQuery, toUserRows } from '../models/user-row.model';
import { Role, User } from '../models/user.model';
import { RolesService, UsersService } from '../services/users.service';

/** Mismo tamaño de página en la tabla (escritorio) y en las tarjetas (móvil). */
const PAGE_SIZE = 10;

@Component({
  selector: 'app-user-list-page',
  imports: [
    PageHeader,
    SearchField,
    EntityCard,
    ListPager,
    DynadrillButtonComponent,
    DynadrillDataTableComponent,
    DynadrillEmptyStateComponent,
    DynadrillIconButtonComponent,
    DynadrillIconComponent,
    DynadrillSkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-list-page.html',
  styleUrl: './user-list-page.scss',
})
export class UserListPage {
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  /** Cada acción exige su propio permiso; el backend responde 403 si falta. */
  protected readonly puedeCrear = computed(() => this.auth.can('identidad.usuarios.crear'));
  protected readonly puedeEditar = computed(() => this.auth.can('identidad.usuarios.editar'));
  protected readonly puedeInactivar = computed(() => this.auth.can('identidad.usuarios.inactivar'));

  protected readonly isMobile = injectNarrowViewport();
  protected readonly pageSize = PAGE_SIZE;

  protected readonly loading = signal(true);
  private readonly users = signal<User[]>([]);
  private readonly roles = signal<Role[]>([]);
  protected readonly query = signal('');

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'name', header: 'Nombre', sortable: true },
    { key: 'username', header: 'Usuario', sortable: true },
    { key: 'email', header: 'Correo' },
    { key: 'cargo', header: 'Cargo' },
    { key: 'roleBadge', header: 'Rol', type: 'badge' },
    { key: 'statusBadge', header: 'Estado', type: 'badge' },
  ];

  protected readonly rows = computed(() =>
    toUserRows(this.users(), this.roles()).filter(row => matchesUserQuery(row, this.query())),
  );

  protected readonly tableRows = computed(() =>
    this.rows().map(row => ({
      ...row,
      roleBadge: { text: row.role, tone: 'brand' as const },
      statusBadge: row.active ? { text: 'Activo', tone: 'success' as const } : { text: 'Inactivo', tone: 'neutral' as const },
    })),
  );

  /** Tarjetas en móvil (M · Usuarios · Lista en Figma). */
  protected readonly cards = computed(() =>
    this.rows().map(row => ({
      id: row.id,
      title: row.name,
      lines: [`${row.username} · ${row.email}`, `${row.cargo} · ${row.departamento}`],
      tags: [
        { text: row.role, tone: 'brand' as const },
        row.active ? { text: 'Activo', tone: 'success' as const } : { text: 'Inactivo', tone: 'neutral' as const },
      ],
      actions: [
        ...(this.puedeEditar() ? [{ icon: 'edit', label: `Editar a ${row.name}`, run: () => this.editUser(row) }] : []),
        ...(this.puedeInactivar() ? [{ icon: 'delete', label: `Inactivar a ${row.name}`, run: () => this.deleteUser(row) }] : []),
      ] as RecordAction[],
    })),
  );
  protected readonly pagination = createPagination(this.cards, PAGE_SIZE);

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  protected onQueryChange(query: string): void {
    this.query.set(query);
    this.pagination.reset();
  }

  private reload(): void {
    this.loading.set(true);
    forkJoin({ users: this.usersService.list(), roles: this.rolesService.list() }).subscribe({
      next: ({ users, roles }) => {
        this.users.set(users);
        this.roles.set(roles);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.notify.error('Error', mensajeError(err, 'No se pudo cargar la lista de usuarios.'));
      },
    });
  }

  createUser(): void {
    this.openUserFormDialog();
  }

  editUser(user: Pick<UserRow, 'id'>): void {
    this.openUserFormDialog(user.id);
  }

  private openUserFormDialog(userId?: string): void {
    const ref = this.dialog.open<UserFormDialog, UserFormDialogData>({
      title: userId != null ? 'Editar usuario' : 'Nuevo usuario',
      content: UserFormDialog,
      data: { userId },
      size: 'large',
    });
    ref.afterClose.subscribe((result: unknown) => {
      if (result === 'saved') this.reload();
    });
  }

  /** El backend ya no elimina: `DELETE /users/:id` inactiva la cuenta (status=false) y conserva su historial. */
  async deleteUser(user: Pick<UserRow, 'id' | 'name'>): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: `¿Inactivar a ${user.name}?`,
      content: 'La cuenta ya no podrá iniciar sesión. Usted puede reactivarla después editando al usuario.',
      okText: 'Inactivar',
      danger: true,
    });
    if (!confirmed) return;

    this.usersService.delete(user.id).subscribe({
      next: () => {
        this.notify.success('Inactivado', 'Usuario inactivado.');
        this.reload();
      },
      error: err => this.notify.error('Error', mensajeError(err, 'No se pudo inactivar al usuario.')),
    });
  }
}
