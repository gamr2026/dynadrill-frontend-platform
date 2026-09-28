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
import { injectNarrowViewport } from '../../../core/utils/narrow-viewport.util';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { SearchField } from '../../../shared/components/search-field/search-field';
import { UserCard } from '../components/user-card';
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
    UserCard,
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

  // ── Paginación de las tarjetas en móvil (la tabla de escritorio pagina sola) ──

  private readonly requestedPage = signal(1);
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.rows().length / PAGE_SIZE)));
  /** Acotada al total: una búsqueda que achica la lista no deja la vista en una página vacía. */
  protected readonly page = computed(() => Math.min(this.requestedPage(), this.totalPages()));
  protected readonly pageRows = computed(() => this.rows().slice((this.page() - 1) * PAGE_SIZE, this.page() * PAGE_SIZE));

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  protected onQueryChange(query: string): void {
    this.query.set(query);
    this.requestedPage.set(1);
  }

  protected goToPage(page: number): void {
    this.requestedPage.set(page);
  }

  private reload(): void {
    this.loading.set(true);
    forkJoin({ users: this.usersService.list(), roles: this.rolesService.list() }).subscribe({
      next: ({ users, roles }) => {
        this.users.set(users);
        this.roles.set(roles);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar la lista de usuarios.');
      },
    });
  }

  createUser(): void {
    this.openUserFormDialog();
  }

  editUser(user: Pick<UserRow, 'id'>): void {
    this.openUserFormDialog(user.id);
  }

  private openUserFormDialog(userId?: number): void {
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

  async deleteUser(user: Pick<UserRow, 'id' | 'name'>): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: `¿Eliminar a ${user.name}?`,
      content: 'Esta acción no se puede deshacer.',
      okText: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;

    this.usersService.delete(user.id).subscribe({
      next: () => {
        this.notify.success('Eliminado', 'Usuario eliminado.');
        this.reload();
      },
      error: () => this.notify.error('Error', 'No se pudo completar la eliminación.'),
    });
  }
}
