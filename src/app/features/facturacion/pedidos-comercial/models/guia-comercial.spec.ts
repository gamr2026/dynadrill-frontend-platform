import { describe, expect, it } from 'vitest';
import { AVISO_FIRMA_ELECTRONICA, ESTADO_FIRMA_ELECTRONICA, esPdfFirmado, validacionPendiente, armarEmision, filaDesdeItem, filaVacia, mensajeErrorGuia, validarGuia, type BorradorGuia } from './guia-comercial';

const borrador = (extra: Partial<BorradorGuia> = {}): BorradorGuia => ({
  fecha: '2026-11-03',
  lugarOrigenId: 'l1',
  transportistaId: 't1',
  vehiculoId: null,
  choferId: null,
  solicitadoPorNombre: '',
  despachadoPorNombre: '',
  horaSalida: '',
  horaLlegada: '',
  observaciones: '',
  numero: '',
  filas: [{ codigo: 'X-1', descripcion: 'Cargo básico', cantidad: '1', unidad: 'Unidad', serie: 'DY-1', origen: 'herramienta' }],
  ...extra,
});

describe('guía de remisión (modelo)', () => {
  it('acepta un borrador completo y rechaza lo que falta', () => {
    expect(validarGuia(borrador())).toBeNull();
    expect(validarGuia(borrador({ fecha: null }))).toContain('fecha');
    expect(validarGuia(borrador({ lugarOrigenId: null }))).toContain('lugar');
    expect(validarGuia(borrador({ transportistaId: null }))).toContain('transportista');
    expect(validarGuia(borrador({ horaSalida: '25:00' }))).toContain('HH:mm');
    expect(validarGuia(borrador({ numero: '12345678' }))).toContain('7 dígitos');
    expect(validarGuia(borrador({ filas: [] }))).toContain('al menos un ítem');
  });

  it('valida cada ítem: descripción, cantidad mayor que cero y unidad', () => {
    const fila = filaVacia();
    expect(validarGuia(borrador({ filas: [fila] }))).toContain('ítem 1 necesita una descripción');
    expect(validarGuia(borrador({ filas: [{ ...fila, descripcion: 'Caja', cantidad: '0' }] }))).toContain('cantidad');
    expect(validarGuia(borrador({ filas: [{ ...fila, descripcion: 'Caja', cantidad: 'abc' }] }))).toContain('cantidad');
    expect(validarGuia(borrador({ filas: [{ ...fila, descripcion: 'Caja', unidad: ' ' }] }))).toContain('unidad');
    expect(validarGuia(borrador({ filas: [{ ...fila, descripcion: 'Caja', cantidad: '2,5' }] }))).toBeNull();
  });

  it('arma la petición: recorta textos, omite lo vacío y convierte números', () => {
    const r = armarEmision(borrador({ numero: ' 11036 ', horaSalida: '07:30', observaciones: '  ', filas: [{ codigo: ' ', descripcion: ' Niple ', cantidad: '2,5', unidad: 'Unidad', serie: '', origen: 'manual' }] }), 'prev');
    expect(r).toMatchObject({ numero: 11036, horaSalida: '07:30', observaciones: undefined, reemplazaAId: 'prev' });
    expect(r.items).toEqual([{ codigo: undefined, descripcion: 'Niple', cantidad: 2.5, unidad: 'Unidad', serie: undefined, origen: 'manual' }]);
  });

  it('la propuesta del backend se vuelve fila editable', () => {
    expect(filaDesdeItem({ codigo: null, descripcion: 'Cargo', cantidad: 1, unidad: 'Unidad', serie: 'DY-1', origen: 'herramienta' })).toEqual({
      codigo: '', descripcion: 'Cargo', cantidad: '1', unidad: 'Unidad', serie: 'DY-1', origen: 'herramienta',
    });
  });

  it('muestra el mensaje del backend', () => {
    expect(mensajeErrorGuia({ status: 409, error: { message: 'Ese número ya está usado' } }, 'x')).toBe('Ese número ya está usado');
    expect(mensajeErrorGuia({ status: 409, error: {} }, 'x')).toContain('conflicto');
    expect(mensajeErrorGuia({ status: 500 }, 'por defecto')).toBe('por defecto');
  });
});

describe('firma electrónica de la guía', () => {
  it('cada estado tiene texto y tono, y alterado se marca como error', () => {
    expect(Object.keys(ESTADO_FIRMA_ELECTRONICA).sort()).toEqual(['alterado', 'firmantes_no_verificados', 'sin_firmas_digitales', 'verificado', 'verificado_con_advertencias']);
    expect(ESTADO_FIRMA_ELECTRONICA.alterado.tono).toBe('error');
    expect(ESTADO_FIRMA_ELECTRONICA.verificado.tono).toBe('success');
    expect(AVISO_FIRMA_ELECTRONICA).toContain('revocación');
  });
});

describe('validaciones del archivo firmado de la guía', () => {
  const base = { estado: 'emitida' as const, firmada: { archivoId: 'a', archivoNombre: 'guia.pdf', at: null }, firmaManuscrita: { verificacion: 'no_verificada' as const, confianza: null, at: null }, firmaElectronica: null };

  it('un PDF espera las dos ayudas; una imagen solo la manuscrita', () => {
    expect(esPdfFirmado(base)).toBe(true);
    expect(validacionPendiente(base)).toBe(true);
    const leida = { ...base.firmaManuscrita, at: '2026-11-03T10:00:00Z' };
    expect(validacionPendiente({ ...base, firmaManuscrita: leida })).toBe(true); // falta la electrónica
    expect(validacionPendiente({ ...base, firmaManuscrita: leida, firmaElectronica: { estado: 'verificado', resumen: null, at: null, firmas: [] } })).toBe(false);
    const imagen = { ...base, firmada: { archivoId: 'a', archivoNombre: 'Escaneo.PNG', at: null } };
    expect(esPdfFirmado(imagen)).toBe(false);
    expect(validacionPendiente({ ...imagen, firmaManuscrita: leida })).toBe(false);
  });

  it('sin archivo firmado o anulada no hay nada pendiente', () => {
    expect(validacionPendiente({ ...base, firmada: null })).toBe(false);
    expect(validacionPendiente({ ...base, estado: 'anulada' })).toBe(false);
  });
});
