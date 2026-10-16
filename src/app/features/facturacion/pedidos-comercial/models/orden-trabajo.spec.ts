import { describe, expect, it } from 'vitest';
import { CABECERA_AS2, aHojaAot, csvAs2, muestraOrdenYCierre, siguientePasoCierre, validarFactura, type OrdenTrabajo } from './orden-trabajo';

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
  items: [{ orden: 1, codigo: 'SUP-1', servicioRequerido: 'Supervisor', unidad: 'día', tarifaUnitaria: 437.23, cantidad: 2, total: 874.46 }],
};

describe('orden de trabajo y cierre (modelo)', () => {
  it('indica el siguiente paso según el estado y si el contrato exige la OT', () => {
    expect(siguientePasoCierre('ticket_firmado', true)).toBe('generar_orden');
    expect(siguientePasoCierre('ticket_firmado', false)).toBe('control_costos');
    expect(siguientePasoCierre('aot_generada', true)).toBe('control_costos');
    expect(siguientePasoCierre('enviado_a_control_de_costos', true)).toBe('listo_para_facturar');
    expect(siguientePasoCierre('listo_para_facturar', false)).toBe('facturar');
    expect(siguientePasoCierre('facturado', true)).toBeNull();
    expect(siguientePasoCierre('abierto', true)).toBeNull();
  });

  it('la sección solo aparece desde "ticket firmado"', () => {
    expect(muestraOrdenYCierre('ticket_firmado')).toBe(true);
    expect(muestraOrdenYCierre('facturado')).toBe(true);
    expect(muestraOrdenYCierre('prefactura_generada')).toBe(false);
    expect(muestraOrdenYCierre('borrador')).toBe(false);
  });

  it('valida el número de factura', () => {
    expect(validarFactura('  ')).toContain('número de la factura');
    expect(validarFactura('ab')).toContain('número de la factura');
    expect(validarFactura('x'.repeat(41))).toContain('demasiado largo');
    expect(validarFactura('001-001-000001234')).toBeNull();
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
    expect(a.detalle).toEqual([{ codigo: 'SUP-1', servicioRequerido: 'Supervisor', unidad: 'día', tarifaUnitaria: 437.23, cantidad: 2, total: 874.46 }]);
  });

  it('arma el CSV de la plantilla de AS2 con sus columnas, comillas y BOM', () => {
    const csv = csvAs2([
      { codigoProducto: 'SFS6218', codigoUnidad: 'UN', cantidad: 2, descripcion: 'Cargo, "especial"', precio: 100, porcentajeDescuento: 10 },
      { codigoProducto: 'SUP-1', codigoUnidad: 'día', cantidad: 3, descripcion: 'Supervisor', precio: 437.23, porcentajeDescuento: 0 },
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lineas = csv.slice(1).trimEnd().split('\r\n');
    expect(lineas[0]).toBe(CABECERA_AS2.join(','));
    expect(lineas[1]).toBe('SFS6218,UN,2,"Cargo, ""especial""",100,10');
    expect(lineas[2]).toBe('SUP-1,día,3,Supervisor,437.23,0');
  });
});
