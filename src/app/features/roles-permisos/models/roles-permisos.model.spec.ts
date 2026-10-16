import { Permiso, agruparPorModulo, filasPorRecurso, mensajeError, nombrePermiso, rolCoincide, textoLegible } from './roles-permisos.model';

const permiso = (codigo: string): Permiso => {
  const [modulo, recurso, accion] = codigo.split('.');
  return { id: codigo, codigo, modulo, recurso, accion, descripcion: '' };
};

describe('roles-permisos.model', () => {
  it('agrupa por módulo, ordenado alfabéticamente', () => {
    const grupos = agruparPorModulo([permiso('qhse.iperc.aprobar'), permiso('comercial.pedidos.crear'), permiso('qhse.iperc.crear')]);
    expect(grupos.map(g => g.modulo)).toEqual(['comercial', 'qhse']);
    expect(grupos[1].permisos.map(p => p.codigo)).toEqual(['qhse.iperc.aprobar', 'qhse.iperc.crear']);
  });

  it('arma un nombre legible con recurso y acción', () => {
    expect(nombrePermiso({ recurso: 'iperc', accion: 'aprobar' })).toBe('Iperc · aprobar');
    expect(nombrePermiso({ recurso: 'guias_remision', accion: 'ver' })).toBe('Guias remision · ver');
  });

  it('agrupa por recurso separando acciones estándar de las propias del negocio', () => {
    const filas = filasPorRecurso([
      permiso('qhse.iperc.crear'),
      permiso('qhse.iperc.aprobar'),
      permiso('qhse.iperc.ver'),
      permiso('qhse.desechos.ver'),
      permiso('qhse.iperc.operar'),
    ]);
    expect(filas.map(f => f.recurso)).toEqual(['desechos', 'iperc']);
    const iperc = filas[1];
    expect(iperc.estandar.ver?.codigo).toBe('qhse.iperc.ver');
    expect(iperc.estandar.crear?.codigo).toBe('qhse.iperc.crear');
    expect(iperc.estandar.editar).toBeNull();
    expect(iperc.estandar.anular).toBeNull();
    expect(iperc.estandar.inactivar).toBeNull();
    expect(iperc.otras.map(p => p.accion)).toEqual(['aprobar', 'operar']);
    expect(textoLegible('editar_permisos')).toBe('Editar permisos');
  });

  it('busca roles sin distinguir tildes ni mayúsculas, por nombre o código', () => {
    expect(rolCoincide({ name: 'Ingeniería de Ventas', code: 'ing_ventas' }, 'ingenieria')).toBe(true);
    expect(rolCoincide({ name: 'Conductor', code: 'conductor' }, 'ventas')).toBe(false);
    expect(rolCoincide({ name: 'Conductor', code: 'conductor' }, '  ')).toBe(true);
  });

  it('extrae el message del backend (string o string[])', () => {
    expect(mensajeError({ error: { message: 'Sin permiso' } }, 'x')).toBe('Sin permiso');
    expect(mensajeError({ error: { message: ['a', 'b'] } }, 'x')).toBe('a b');
    expect(mensajeError(new Error('boom'), 'por defecto')).toBe('por defecto');
    expect(mensajeError(null, 'por defecto')).toBe('por defecto');
  });
});
