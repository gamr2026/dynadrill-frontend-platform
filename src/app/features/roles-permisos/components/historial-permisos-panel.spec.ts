import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NZ_DRAWER_DATA } from 'ng-zorro-antd/drawer';
import { RolesPermisosService } from '../services/roles-permisos.service';
import { HistorialPermisosPanel } from './historial-permisos-panel';

// En la app el locale 'es' se registra en app.config.ts; el spec no la arranca.
registerLocaleData(localeEs);

describe('HistorialPermisosPanel', () => {
  it('lista los cambios con acción, permiso y autor', async () => {
    const historial = vi.fn().mockReturnValue(
      of([
        { id: '1', permiso: 'qhse.iperc.aprobar', accion: 'otorgado', realizadoPor: { id: 'u1', name: 'Ana Torres' }, realizadoAt: '2026-10-01T15:30:00.000Z' },
        { id: '2', permiso: 'qhse.iperc.crear', accion: 'revocado', realizadoPor: null, realizadoAt: '2026-09-30T10:00:00.000Z' },
      ]),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: RolesPermisosService, useValue: { historial } },
        { provide: NZ_DRAWER_DATA, useValue: { roleId: 'id-r', roleName: 'Conductor' } },
      ],
    });
    const fixture = TestBed.createComponent(HistorialPermisosPanel);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(historial).toHaveBeenCalledWith('id-r');
    const items = el.querySelectorAll('li.historial__item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Otorgado');
    expect(items[0].textContent).toContain('qhse.iperc.aprobar');
    expect(items[0].textContent).toContain('Ana Torres');
    expect(items[1].textContent).toContain('Revocado');
    expect(items[1].textContent).toContain('Sistema');
  });
});
