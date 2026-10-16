import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DynadrillNotificationService } from '@digitec-it-projects/dynadrill-ui';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { Role, User } from '../models/user.model';
import { RolesService, UsersService } from '../services/users.service';
import { UserFormDialog } from './user-form-dialog';

const ROL: Role = { id: 'r-1', legacyId: null, name: 'Conductor', code: 'conductor', description: null };
const usuario = (status: boolean) =>
  ({
    id: 'u-1',
    email: 'ana@dynadrill.com',
    username: 'atorres',
    name: 'Ana Torres',
    phone: '0991234567',
    roleId: 'r-1',
    status,
  }) as User;

describe('UserFormDialog (estado activo)', () => {
  let fixture: ComponentFixture<UserFormDialog>;
  let el: HTMLElement;
  const usuarios = { get: vi.fn(), update: vi.fn(), create: vi.fn() };
  const notify = { success: vi.fn(), error: vi.fn() };
  const modalRef = { close: vi.fn() };

  async function render(permisos: string[], datos: { userId?: string }, existente?: User): Promise<void> {
    if (existente) usuarios.get.mockReturnValue(of(existente));
    TestBed.configureTestingModule({
      providers: [
        { provide: UsersService, useValue: usuarios },
        { provide: RolesService, useValue: { list: () => of([ROL]) } },
        { provide: AuthService, useValue: { can: (codigo: string) => permisos.includes(codigo) } },
        { provide: DynadrillNotificationService, useValue: notify },
        { provide: NzModalRef, useValue: modalRef },
        { provide: NZ_MODAL_DATA, useValue: datos },
      ],
    });
    fixture = TestBed.createComponent(UserFormDialog);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const casillaActivo = () =>
    Array.from(el.querySelectorAll('dynadrill-checkbox'))
      .find(c => c.textContent?.includes('Usuario activo'))!
      .querySelector<HTMLInputElement>('input')!;

  beforeEach(() => vi.clearAllMocks());

  it('sin identidad.usuarios.inactivar el estado de una cuenta activa queda deshabilitado, con una nota', async () => {
    await render(['identidad.usuarios.editar'], { userId: 'u-1' }, usuario(true));
    expect(casillaActivo().disabled).toBe(true);
    expect(el.textContent).toContain('No tiene permiso para inactivar usuarios');
  });

  it('con identidad.usuarios.inactivar el estado se puede cambiar', async () => {
    await render(['identidad.usuarios.editar', 'identidad.usuarios.inactivar'], { userId: 'u-1' }, usuario(true));
    expect(casillaActivo().disabled).toBe(false);
    expect(el.textContent).not.toContain('No tiene permiso para inactivar usuarios');
  });

  it('reactivar una cuenta inactiva solo exige editar', async () => {
    await render(['identidad.usuarios.editar'], { userId: 'u-1' }, usuario(false));
    expect(casillaActivo().disabled).toBe(false);
  });

  it('sin inactivar, guardar no envía status: false', async () => {
    usuarios.update.mockReturnValue(of(usuario(true)));
    await render(['identidad.usuarios.editar'], { userId: 'u-1' }, usuario(true));

    fixture.componentInstance.updateStatus(false);
    fixture.componentInstance.submit();

    expect(usuarios.update).toHaveBeenCalledWith('u-1', expect.objectContaining({ status: true }));
  });

  it('muestra el message del 403 cuando el backend rechaza guardar', async () => {
    usuarios.update.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'Falta el permiso identidad.usuarios.inactivar' } })),
    );
    await render(['identidad.usuarios.editar', 'identidad.usuarios.inactivar'], { userId: 'u-1' }, usuario(true));

    fixture.componentInstance.submit();

    expect(notify.error).toHaveBeenCalledWith('Error', 'Falta el permiso identidad.usuarios.inactivar');
  });
});
