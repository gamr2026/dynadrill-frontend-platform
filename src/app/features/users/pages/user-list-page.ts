import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconComponent,
  DynadrillNotificationService,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { forkJoin } from 'rxjs';
import { UserFormDialog, UserFormDialogData } from '../components/user-form-dialog';
import { Role, User } from '../models/user.model';
import { RolesService, UsersService } from '../services/users.service';

@Component({
  selector: 'app-user-list-page',
  imports: [DynadrillTextComponent, DynadrillButtonComponent, DynadrillDataTableComponent, DynadrillIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-list-page.html',
  styleUrl: './user-list-page.scss',
})
export class UserListPage {
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly loading = signal(true);
  protected readonly users = signal<User[]>([]);
  protected readonly roles = signal<Role[]>([]);

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'name', header: 'Nombre', sortable: true, searchable: true },
    { key: 'username', header: 'Usuario', sortable: true, searchable: true },
    { key: 'email', header: 'Correo', searchable: true },
    { key: 'code', header: 'Código', sortable: true },
    { key: 'phone', header: 'Teléfono' },
    { key: 'role', header: 'Rol', type: 'badge' },
    { key: 'statusBadge', header: 'Estado', type: 'badge' },
  ];

  protected readonly rows = computed(() => {
    const roleById = new Map(this.roles().map(r => [r.id, r.name]));
    return this.users().map(user => ({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      code: user.code,
      phone: user.phone,
      role: { text: roleById.get(user.roleId) ?? '—', tone: 'brand' as const },
      statusBadge: user.status
        ? { text: 'Activo', tone: 'success' as const }
        : { text: 'Inactivo', tone: 'neutral' as const },
    }));
  });

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
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

  editRow(row: Record<string, unknown>): void {
    this.openUserFormDialog(row['id'] as number);
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

  async deleteRow(row: Record<string, unknown>): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: `¿Eliminar a ${row['name']}?`,
      content: 'Esta acción no se puede deshacer.',
      okText: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;

    this.usersService.delete(row['id'] as number).subscribe({
      next: () => {
        this.notify.success('Eliminado', 'Usuario eliminado.');
        this.reload();
      },
      error: () => this.notify.error('Error', 'No se pudo completar la eliminación.'),
    });
  }
}
