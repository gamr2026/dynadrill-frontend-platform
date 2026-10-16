import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DynadrillDialogService, DynadrillDrawerService, DynadrillNotificationService } from '@digitec-it-projects/dynadrill-ui';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { Permiso, Role } from '../models/roles-permisos.model';
import { RolesPermisosService } from '../services/roles-permisos.service';
import { RolesPermisosPage } from './roles-permisos-page';

const rol = (code: string, name: string): Role => ({ id: `id-${code}`, legacyId: null, name, code, description: null });
const permiso = (codigo: string): Permiso => {
  const [modulo, recurso, accion] = codigo.split('.');
  return { id: `p-${codigo}`, codigo, modulo, recurso, accion, descripcion: `Descripción de ${codigo}` };
};

const ROLES = [rol('superadmin', 'Superadmin'), rol('conductor', 'Conductor')];
const CATALOGO = [
  permiso('identidad.roles.ver'),
  permiso('identidad.roles.editar_permisos'),
  permiso('identidad.usuarios.ver'),
  permiso('identidad.usuarios.crear'),
  permiso('identidad.usuarios.editar'),
  permiso('identidad.usuarios.inactivar'),
  permiso('qhse.iperc.aprobar'),
  permiso('qhse.iperc.crear'),
  permiso('qhse.iperc.ver'),
];

const PERMISOS_EDITOR = ['identidad.roles.ver', 'identidad.roles.editar_permisos'];

describe('RolesPermisosPage', () => {
  let fixture: ComponentFixture<RolesPermisosPage>;
  let el: HTMLElement;
  const servicio = {
    listarRoles: vi.fn(),
    listarPermisos: vi.fn(),
    permisosDeRol: vi.fn(),
    guardarPermisos: vi.fn(),
  };
  const confirm = vi.fn();
  const drawerOpen = vi.fn();
  const notify = { success: vi.fn(), error: vi.fn() };

  async function render(asignados: Record<string, string[]> = {}, permisosSesion: string[] = PERMISOS_EDITOR): Promise<void> {
    servicio.listarRoles.mockReturnValue(of(ROLES));
    servicio.listarPermisos.mockReturnValue(of(CATALOGO));
    servicio.permisosDeRol.mockImplementation((id: string) => of(asignados[id] ?? []));
    TestBed.configureTestingModule({
      providers: [
        { provide: RolesPermisosService, useValue: servicio },
        { provide: AuthService, useValue: { can: (codigo: string) => permisosSesion.includes(codigo) } },
        { provide: DynadrillDialogService, useValue: { confirm } },
        { provide: DynadrillDrawerService, useValue: { open: drawerOpen } },
        { provide: DynadrillNotificationService, useValue: notify },
      ],
    });
    fixture = TestBed.createComponent(RolesPermisosPage);
    el = fixture.nativeElement as HTMLElement;
    await refrescar();
  }

  async function refrescar(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const botonesRol = () => Array.from(el.querySelectorAll<HTMLButtonElement>('button.rol'));
  const casilla = (codigo: string) => el.querySelector<HTMLInputElement>(`input[aria-describedby="ayuda-p-${codigo}"]`)!;
  const filaDe = (recurso: string, modulo: string) =>
    Array.from(el.querySelectorAll<HTMLTableRowElement>(`section[aria-labelledby="grupo-${modulo}"] tbody tr`)).find(
      tr => tr.querySelector('th')?.textContent?.trim().toLowerCase() === recurso,
    )!;
  const botonAccion = (texto: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('dynadrill-button button')).find(b => b.textContent?.trim().startsWith(texto))!;

  async function elegirRol(indice: number): Promise<void> {
    botonesRol()[indice].click();
    await refrescar();
  }

  async function marcar(codigo: string, valor: boolean): Promise<void> {
    const input = casilla(codigo);
    input.checked = valor;
    input.dispatchEvent(new Event('change'));
    await refrescar();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    confirm.mockResolvedValue(true);
  });

  it('lista los roles y el aviso de renovación de sesión', async () => {
    await render();
    expect(botonesRol().map(b => b.querySelector('.rol__nombre')?.textContent?.trim())).toEqual(['Superadmin', 'Conductor']);
    expect(el.textContent).toContain('próxima renovación de sesión (hasta 15 minutos)');
  });

  it('al elegir un rol carga sus permisos y los agrupa por módulo', async () => {
    await render({ 'id-conductor': ['qhse.iperc.crear'] });
    await elegirRol(1);

    expect(servicio.permisosDeRol).toHaveBeenCalledWith('id-conductor');
    expect(el.querySelectorAll('section.grupo').length).toBe(2);
    expect(casilla('qhse.iperc.crear').checked).toBe(true);
    expect(casilla('qhse.iperc.aprobar').checked).toBe(false);
    // El código y la descripción quedan como ayuda accesible de cada casilla.
    expect(el.querySelector('#ayuda-p-qhse\\.iperc\\.aprobar')?.textContent).toContain('qhse.iperc.aprobar');
    expect(el.querySelector('#ayuda-p-qhse\\.iperc\\.aprobar')?.textContent).toContain('Descripción de qhse.iperc.aprobar');
  });

  it('la matriz muestra una fila por recurso: casilla en las acciones estándar presentes y "No aplica" en las ausentes', async () => {
    await render();
    await elegirRol(1);

    const encabezados = Array.from(el.querySelectorAll('section[aria-labelledby="grupo-qhse"] thead th')).map(th => th.textContent?.trim());
    expect(encabezados).toEqual(['Recurso', 'Ver', 'Crear', 'Editar', 'Anular', 'Inactivar', 'Otras acciones']);

    const fila = filaDe('iperc', 'qhse');
    const celdas = Array.from(fila.querySelectorAll('td'));
    // Ver y Crear existen; Editar, Anular e Inactivar no aplican.
    expect(celdas.slice(0, 5).map(td => td.querySelector('input') !== null)).toEqual([true, true, false, false, false]);
    expect(celdas[2].textContent).toContain('No aplica');
    // "aprobar" no es estándar: va en "Otras acciones".
    expect(celdas[5].querySelector('input')?.getAttribute('aria-label')).toBe('Aprobar iperc para el rol Conductor');
    expect(celdas[5].textContent).toContain('Aprobar');
  });

  it('cada casilla tiene una etiqueta accesible con la acción, el recurso y el rol', async () => {
    await render();
    await elegirRol(1);
    expect(casilla('identidad.usuarios.editar').getAttribute('aria-label')).toBe('Editar usuarios para el rol Conductor');
    expect(casilla('identidad.roles.editar_permisos').getAttribute('aria-label')).toBe('Editar permisos roles para el rol Conductor');
  });

  it('Guardar está deshabilitado sin cambios y se habilita al marcar o desmarcar', async () => {
    await render({ 'id-conductor': ['qhse.iperc.crear'] });
    await elegirRol(1);
    expect(botonAccion('Guardar').disabled).toBe(true);

    await marcar('qhse.iperc.aprobar', true);
    expect(botonAccion('Guardar').disabled).toBe(false);
    expect(el.textContent).toContain('Cambios sin guardar');

    await marcar('qhse.iperc.aprobar', false);
    expect(botonAccion('Guardar').disabled).toBe(true);
    expect(el.textContent).not.toContain('Cambios sin guardar');
  });

  it('Descartar vuelve al estado guardado', async () => {
    await render({ 'id-conductor': [] });
    await elegirRol(1);
    await marcar('qhse.iperc.crear', true);

    botonAccion('Descartar').click();
    await refrescar();

    expect(casilla('qhse.iperc.crear').checked).toBe(false);
    expect(botonAccion('Guardar').disabled).toBe(true);
  });

  it('"Seleccionar todo" marca todos los permisos del módulo', async () => {
    await render();
    await elegirRol(1);

    const todo = el.querySelector<HTMLInputElement>('section.grupo:last-of-type .grupo__todo input')!;
    todo.checked = true;
    todo.dispatchEvent(new Event('change'));
    await refrescar();

    expect(casilla('qhse.iperc.aprobar').checked).toBe(true);
    expect(casilla('qhse.iperc.crear').checked).toBe(true);
    expect(casilla('identidad.roles.ver').checked).toBe(false);
  });

  it('guardar envía el conjunto completo y avisa cuántos se otorgaron y revocaron', async () => {
    await render({ 'id-conductor': ['qhse.iperc.crear'] });
    servicio.guardarPermisos.mockReturnValue(
      of({ roleId: 'id-conductor', permisos: ['qhse.iperc.aprobar'], otorgados: ['qhse.iperc.aprobar'], revocados: ['qhse.iperc.crear'] }),
    );
    await elegirRol(1);
    await marcar('qhse.iperc.aprobar', true);
    await marcar('qhse.iperc.crear', false);

    botonAccion('Guardar').click();
    await refrescar();

    expect(servicio.guardarPermisos).toHaveBeenCalledWith('id-conductor', ['qhse.iperc.aprobar']);
    expect(notify.success).toHaveBeenCalledWith('Permisos guardados', 'Se otorgaron 1 permiso y se revocaron 1 permiso.');
    expect(botonAccion('Guardar').disabled).toBe(true);
  });

  it('muestra el message del backend cuando guardar falla con 400', async () => {
    await render({ 'id-conductor': [] });
    servicio.guardarPermisos.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { statusCode: 400, message: 'El permiso x.y.z no existe' } })),
    );
    await elegirRol(1);
    await marcar('qhse.iperc.crear', true);

    botonAccion('Guardar').click();
    await refrescar();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('El permiso x.y.z no existe');
    expect(botonAccion('Guardar').disabled).toBe(false);
  });

  it('el rol superadmin bloquea los 4 permisos protegidos y avisa por qué', async () => {
    const protegidos = ['identidad.roles.ver', 'identidad.roles.editar_permisos', 'identidad.usuarios.ver', 'identidad.usuarios.editar'];
    await render({ 'id-superadmin': [...protegidos, 'identidad.usuarios.crear', 'qhse.iperc.crear'] });
    await elegirRol(0);

    for (const codigo of protegidos) expect(casilla(codigo).disabled, codigo).toBe(true);
    expect(casilla('identidad.usuarios.crear').disabled).toBe(false);
    expect(casilla('identidad.usuarios.inactivar').disabled).toBe(false);
    expect(casilla('qhse.iperc.crear').disabled).toBe(false);
    expect(el.textContent).toContain('No se puede quitar: evita dejar el sistema sin administrador');

    // "Quitar todo" del módulo identidad no puede tocar los bloqueados.
    const todo = el.querySelector<HTMLInputElement>('section[aria-labelledby="grupo-identidad"] .grupo__todo input')!;
    todo.checked = false;
    todo.dispatchEvent(new Event('change'));
    await refrescar();
    for (const codigo of protegidos) expect(casilla(codigo).checked, codigo).toBe(true);
    expect(casilla('identidad.usuarios.crear').checked).toBe(false);
  });

  it('otro rol no bloquea esos permisos', async () => {
    await render({ 'id-conductor': ['identidad.roles.ver'] });
    await elegirRol(1);
    expect(casilla('identidad.roles.ver').disabled).toBe(false);
  });

  it('con solo identidad.roles.ver la pantalla queda en solo lectura: casillas deshabilitadas y sin Guardar', async () => {
    await render({ 'id-conductor': ['qhse.iperc.crear'] }, ['identidad.roles.ver']);
    await elegirRol(1);

    expect(el.textContent).toContain('Solo lectura: no tiene permiso para editar');
    expect(botonAccion('Guardar')).toBeUndefined();
    expect(botonAccion('Descartar')).toBeUndefined();
    expect(botonAccion('Historial')).toBeTruthy();
    expect(casilla('qhse.iperc.crear').checked).toBe(true);
    for (const input of Array.from(el.querySelectorAll<HTMLInputElement>('.matriz input, .grupo__todo input'))) {
      expect(input.disabled).toBe(true);
    }
  });

  it('con identidad.roles.editar_permisos se puede editar y no aparece el aviso de solo lectura', async () => {
    await render();
    await elegirRol(1);
    expect(el.textContent).not.toContain('Solo lectura');
    expect(botonAccion('Guardar')).toBeTruthy();
  });

  it('cambiar de rol con cambios pendientes pide confirmación y respeta la negativa', async () => {
    await render({ 'id-conductor': [] });
    await elegirRol(1);
    await marcar('qhse.iperc.crear', true);

    confirm.mockResolvedValueOnce(false);
    await elegirRol(0);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(servicio.permisosDeRol).toHaveBeenCalledTimes(1);
    expect(casilla('qhse.iperc.crear').checked).toBe(true);

    confirm.mockResolvedValueOnce(true);
    await elegirRol(0);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(servicio.permisosDeRol).toHaveBeenCalledWith('id-superadmin');
  });

  it('cambiar de rol sin cambios pendientes no pregunta', async () => {
    await render();
    await elegirRol(1);
    await elegirRol(0);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('el botón Historial abre el panel del rol elegido', async () => {
    await render();
    await elegirRol(1);

    botonAccion('Historial').click();
    expect(drawerOpen).toHaveBeenCalledWith(expect.objectContaining({ data: { roleId: 'id-conductor', roleName: 'Conductor' } }));
  });

  it('muestra un error accesible con reintento si falla la carga inicial', async () => {
    servicio.listarRoles.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'Sin permiso' } })));
    servicio.listarPermisos.mockReturnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        { provide: RolesPermisosService, useValue: servicio },
        { provide: AuthService, useValue: { can: () => true } },
        { provide: DynadrillDialogService, useValue: { confirm } },
        { provide: DynadrillDrawerService, useValue: { open: drawerOpen } },
        { provide: DynadrillNotificationService, useValue: notify },
      ],
    });
    fixture = TestBed.createComponent(RolesPermisosPage);
    el = fixture.nativeElement as HTMLElement;
    await refrescar();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Sin permiso');
    expect(botonAccion('Reintentar')).toBeTruthy();
  });
});
