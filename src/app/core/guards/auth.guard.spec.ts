import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { authGuard, sessionGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard / sessionGuard', () => {
  const ruta = {} as ActivatedRouteSnapshot;
  const estado = {} as RouterStateSnapshot;
  const crearArbol = (url: string) => ({ url }) as unknown as UrlTree;

  function configurar(sesion: { autenticado: boolean; cambioPendiente: boolean }) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { isAuthenticated: () => sesion.autenticado, mustChangePassword: () => sesion.cambioPendiente },
        },
        { provide: Router, useValue: { createUrlTree: (c: string[]) => crearArbol(c.join('')) } },
      ],
    });
  }
  const ejecutar = (guard: typeof authGuard) => TestBed.runInInjectionContext(() => guard(ruta, estado));

  it('sin sesión manda a /login', () => {
    configurar({ autenticado: false, cambioPendiente: false });
    expect(ejecutar(authGuard)).toEqual(crearArbol('/login'));
    expect(ejecutar(sessionGuard)).toEqual(crearArbol('/login'));
  });

  it('con sesión normal deja pasar', () => {
    configurar({ autenticado: true, cambioPendiente: false });
    expect(ejecutar(authGuard)).toBe(true);
    expect(ejecutar(sessionGuard)).toBe(true);
  });

  it('con clave provisional, authGuard manda a /cambiar-clave pero sessionGuard deja entrar a esa pantalla', () => {
    configurar({ autenticado: true, cambioPendiente: true });
    expect(ejecutar(authGuard)).toEqual(crearArbol('/cambiar-clave'));
    expect(ejecutar(sessionGuard)).toBe(true);
  });
});
