import { conIdLegacy, type UsuarioPorRol } from './user.model';

describe('conIdLegacy', () => {
  const usuario = (over: Partial<UsuarioPorRol>): UsuarioPorRol => ({
    id: '0b5e7c1e-0000-4000-8000-000000000001',
    legacyId: 5,
    name: 'Luis Mena',
    specialty: 'Mecánico',
    ...over,
  });

  it('usa el legacyId (numérico) como id para los módulos viejos', () => {
    expect(conIdLegacy([usuario({})])).toEqual([{ id: 5, name: 'Luis Mena', specialty: 'Mecánico' }]);
  });

  it('descarta a quien no existe en la demo en vez de enviar un id inválido', () => {
    const resultado = conIdLegacy([usuario({ legacyId: null, name: 'Nuevo' }), usuario({ legacyId: 9, name: 'Ana' })]);
    expect(resultado.map(u => u.name)).toEqual(['Ana']);
  });
});
