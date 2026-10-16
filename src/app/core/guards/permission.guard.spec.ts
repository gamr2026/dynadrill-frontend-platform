import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { permissionGuard } from './permission.guard';

describe('permissionGuard', () => {
  const urlTree = {} as UrlTree;
  const createUrlTree = vi.fn().mockReturnValue(urlTree);

  function ejecutar(permisosDelUsuario: string[], ...exigidos: string[]): unknown {
    const can = (codigo: string) => permisosDelUsuario.includes(codigo);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { can, canAny: (...codigos: string[]) => codigos.some(can) } },
        { provide: Router, useValue: { createUrlTree } },
      ],
    });
    return TestBed.runInInjectionContext(() =>
      permissionGuard(...exigidos)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  beforeEach(() => createUrlTree.mockClear());

  it('deja pasar a quien tiene el permiso', () => {
    expect(ejecutar(['identidad.roles.ver'], 'identidad.roles.ver')).toBe(true);
    expect(createUrlTree).not.toHaveBeenCalled();
  });

  it('redirige al dashboard a quien no lo tiene', () => {
    expect(ejecutar(['comercial.pedidos.crear'], 'identidad.roles.ver')).toBe(urlTree);
    expect(createUrlTree).toHaveBeenCalledWith(['/dashboard']);
  });

  it('con varios permisos basta con tener uno', () => {
    expect(ejecutar(['b.x.y'], 'a.x.y', 'b.x.y')).toBe(true);
  });

  it('sin permisos exigidos no deja pasar a nadie (falla cerrado)', () => {
    expect(ejecutar(['a.x.y'])).toBe(urlTree);
  });
});
