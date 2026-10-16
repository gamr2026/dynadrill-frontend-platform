import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DynadrillDialogService, DynadrillNotificationService } from '@digitec-it-projects/dynadrill-ui';
import { of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { Role, User } from '../models/user.model';
import { RolesService, UsersService } from '../services/users.service';
import { UserListPage } from './user-list-page';

const ROL: Role = { id: 'r-1', legacyId: null, name: 'Conductor', code: 'conductor', description: null };
const USUARIO = {
  id: 'u-1',
  email: 'ana@dynadrill.com',
  username: 'atorres',
  name: 'Ana Torres',
  phone: '0991234567',
  roleId: 'r-1',
  status: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
} as User;

describe('UserListPage', () => {
  let fixture: ComponentFixture<UserListPage>;
  let el: HTMLElement;
  const usuarios = { list: vi.fn(), delete: vi.fn() };
  const roles = { list: vi.fn() };
  const confirm = vi.fn();
  const notify = { success: vi.fn(), error: vi.fn() };

  async function render(permisos: string[], movil = false): Promise<void> {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: movil, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    usuarios.list.mockReturnValue(of([USUARIO]));
    roles.list.mockReturnValue(of([ROL]));
    TestBed.configureTestingModule({
      providers: [
        { provide: UsersService, useValue: usuarios },
        { provide: RolesService, useValue: roles },
        { provide: AuthService, useValue: { can: (codigo: string) => permisos.includes(codigo) } },
        { provide: DynadrillDialogService, useValue: { confirm, open: vi.fn() } },
        { provide: DynadrillNotificationService, useValue: notify },
      ],
    });
    fixture = TestBed.createComponent(UserListPage);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const textoBotones = () => Array.from(el.querySelectorAll('button')).map(b => b.textContent?.trim() ?? '');
  const etiquetas = () => Array.from(el.querySelectorAll('button')).map(b => `${b.getAttribute('aria-label') ?? ''} ${b.getAttribute('title') ?? ''}`);
  const hay = (texto: string) => [...textoBotones(), ...etiquetas()].some(t => t.includes(texto));

  beforeEach(() => {
    vi.clearAllMocks();
    confirm.mockResolvedValue(true);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('muestra "Nuevo usuario" solo con identidad.usuarios.crear', async () => {
    await render(['identidad.usuarios.ver', 'identidad.usuarios.crear']);
    expect(textoBotones().some(t => t.includes('Nuevo usuario'))).toBe(true);
  });

  it('oculta "Nuevo usuario" sin identidad.usuarios.crear', async () => {
    await render(['identidad.usuarios.ver']);
    expect(textoBotones().some(t => t.includes('Nuevo usuario'))).toBe(false);
  });

  it('en la lista (tarjetas) ofrece Editar e Inactivar solo con su permiso', async () => {
    await render(['identidad.usuarios.ver', 'identidad.usuarios.editar'], true);
    expect(hay('Editar a Ana Torres')).toBe(true);
    expect(hay('Inactivar a Ana Torres')).toBe(false);
    TestBed.resetTestingModule();

    await render(['identidad.usuarios.ver', 'identidad.usuarios.inactivar'], true);
    expect(hay('Editar a Ana Torres')).toBe(false);
    expect(hay('Inactivar a Ana Torres')).toBe(true);
    expect(hay('Desactivar')).toBe(false);
  });

  it('solo con ver no hay acciones por fila', async () => {
    await render(['identidad.usuarios.ver'], true);
    expect(hay('Editar a')).toBe(false);
    expect(hay('Inactivar a')).toBe(false);
  });

  it('inactivar pide confirmación con el verbo "Inactivar" y avisa el resultado', async () => {
    usuarios.delete.mockReturnValue(of({ ok: true }));
    await render(['identidad.usuarios.ver', 'identidad.usuarios.inactivar'], true);

    await fixture.componentInstance.deleteUser({ id: 'u-1', name: 'Ana Torres' });

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Inactivar a Ana Torres?', okText: 'Inactivar' }));
    expect(usuarios.delete).toHaveBeenCalledWith('u-1');
    expect(notify.success).toHaveBeenCalledWith('Inactivado', 'Usuario inactivado.');
  });
});
