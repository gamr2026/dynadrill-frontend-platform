import { PLANTILLAS_EJEMPLO } from './plantillas-ejemplo';

describe('plantillas de ejemplo del pedido', () => {
  it('cada ejemplo tiene un id único y un archivo .xlsx propio', () => {
    const ids = PLANTILLAS_EJEMPLO.map((p) => p.id);
    const archivos = PLANTILLAS_EJEMPLO.map((p) => p.archivo);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(archivos).size).toBe(archivos.length);
    for (const a of archivos) expect(a).toMatch(/^[a-z0-9-]+\.xlsx$/);
  });

  it('cada ejemplo fija una línea de servicio y un tipo de servicio coherentes con el catálogo de Comercial', () => {
    const tiposPorLinea: Record<string, string[]> = {
      pumping: ['coiled_tubing'],
      fcr: ['wellbore_cleanup_tools'],
    };
    for (const p of PLANTILLAS_EJEMPLO) {
      expect(tiposPorLinea[p.linea], p.id).toContain(p.tipoServicio);
    }
  });

  it('hay ejemplos de Pumping y de FCR', () => {
    expect(new Set(PLANTILLAS_EJEMPLO.map((p) => p.linea))).toEqual(new Set(['pumping', 'fcr']));
  });

  it('los textos usan «usted» y no el voseo de la demo', () => {
    for (const p of PLANTILLAS_EJEMPLO) {
      expect(`${p.titulo} ${p.detalle}`).not.toMatch(/\b(cargá|probá|elegí|empezá)\b/i);
    }
  });
});
