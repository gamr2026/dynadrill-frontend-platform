import { describe, expect, it } from 'vitest';
import {
  CABECERA_AS2,
  aHojaAot,
  csvAs2,
  muestraOrdenYCierre,
  siguientePasoCierre,
  type OrdenTrabajo,
} from './orden-trabajo';

const orden: OrdenTrabajo = {
  id: 'o1',
  pedidoId: 'p1',
  prefacturaId: 'f1',
  numero: 948,
  codigo: '948-OPR-ESTACION NORTE 2-UIO-2026',
  ciudad: { id: 'c', codigo: 'UIO', nombre: 'Quito' },
  anio: 2026,
  fecha: '2026-10-31',
  numeroContrato: '2025201',
  textoContrato: 'CONTRATO 2025201 - SERVICIOS',
  descripcionRequerimiento: 'Limpieza de pozo',
  servicio: 'Limpieza de pozo /ESTACION NORTE 2/RIGLESS',
  fechaInicio: '2026-11-01',
  fechaTerminacion: '2026-11-02',
  valorOt: 1254.46,
  representanteContratista: { nombre: 'Ab. Mónica Rojas', cargo: 'Representante Legal' },
  representanteCliente: { nombre: 'Ing. Cliente', cargo: 'Supervisor' },
  estado: 'generada',
  generadaAt: '2026-10-31T10:00:00Z',
  firmada: null,
  items: [
    {
      orden: 1,
      codigo: 'SUP-1',
      servicioRequerido: 'Supervisor',
      unidad: 'día',
      tarifaUnitaria: 437.23,
      cantidad: 2,
      total: 874.46,
    },
  ],
};

describe('orden de trabajo y cierre (modelo)', () => {
  it('solo queda por hacer generar la OT, y únicamente si el contrato la exige', () => {
    expect(siguientePasoCierre('ticket_firmado', true)).toBe('generar_orden');
    expect(siguientePasoCierre('ticket_firmado', false)).toBeNull();
    expect(siguientePasoCierre('aot_generada', true)).toBeNull();
    expect(siguientePasoCierre('facturado', true)).toBeNull();
    expect(siguientePasoCierre('abierto', true)).toBeNull();
  });

  it('la sección solo aparece desde "ticket firmado"', () => {
    expect(muestraOrdenYCierre('ticket_firmado')).toBe(true);
    expect(muestraOrdenYCierre('facturado')).toBe(true);
    expect(muestraOrdenYCierre('prefactura_generada')).toBe(false);
    expect(muestraOrdenYCierre('borrador')).toBe(false);
  });

  it('adapta la OT al modelo de la hoja de impresión', () => {
    const a = aHojaAot(orden);
    expect(a).toMatchObject({
      numeroOpr: '948-OPR-ESTACION NORTE 2-UIO-2026',
      fecha: '2026-10-31',
      contratoTexto: 'CONTRATO 2025201 - SERVICIOS',
      servicio: 'Limpieza de pozo /ESTACION NORTE 2/RIGLESS',
      valorOt: 1254.46,
      fechaInicio: '2026-11-01',
      fechaTerminacion: '2026-11-02',
      representanteCliente: { nombre: 'Ing. Cliente', cargo: 'Supervisor' },
    });
    expect(a.detalle).toEqual([
      {
        codigo: 'SUP-1',
        servicioRequerido: 'Supervisor',
        unidad: 'día',
        tarifaUnitaria: 437.23,
        cantidad: 2,
        total: 874.46,
      },
    ]);
  });

  it('arma el CSV de la plantilla de AS2 con sus columnas, comillas y BOM', () => {
    const csv = csvAs2([
      {
        codigoProducto: 'SFS6218',
        codigoUnidad: 'UN',
        cantidad: 2,
        descripcion: 'Cargo, "especial"',
        precio: 100,
        porcentajeDescuento: 10,
      },
      {
        codigoProducto: 'SUP-1',
        codigoUnidad: 'día',
        cantidad: 3,
        descripcion: 'Supervisor',
        precio: 437.23,
        porcentajeDescuento: 0,
      },
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lineas = csv.slice(1).trimEnd().split('\r\n');
    expect(lineas[0]).toBe(CABECERA_AS2.join(','));
    expect(lineas[1]).toBe('SFS6218,UN,2,"Cargo, ""especial""",100,10');
    expect(lineas[2]).toBe('SUP-1,día,3,Supervisor,437.23,0');
  });
});
