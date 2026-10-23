import { describe, expect, it } from 'vitest';
import {
  avisoCertificado,
  documentoDe,
  etiquetaContenedor,
  fechaCorta,
  fechaIso,
  firmaPideFirmante,
  firmasPendientes,
  lecturaDeFirma,
  textoLimite,
  tonoLimite,
  totalGalones,
  type DesechoDetalle,
  type DesechoResumen,
  type ManifiestoDesecho,
} from './desecho';

const resumen = (
  extra: Partial<DesechoResumen>,
): Pick<DesechoResumen, 'estado' | 'diasParaLimite' | 'vencido'> => ({
  estado: { codigo: 'almacenado', nombre: 'Almacenado' },
  diasParaLimite: 100,
  vencido: false,
  ...extra,
});

const manifiesto = (extra: Partial<ManifiestoDesecho> = {}): ManifiestoDesecho => ({
  numero: 'MAN-1',
  fecha: '2026-10-01',
  certificadoVenceEl: '2026-10-31',
  certificadoVencido: false,
  certificadoFueraDePlazo: false,
  gestorNombre: 'Gestor',
  gestorLicenciaSuia: 'SUIA-1',
  cliente: null,
  solicitadoPor: null,
  transportista: {
    compania: null,
    conductor: null,
    cedulaConductor: null,
    vehiculo: null,
    placas: null,
  },
  horaSalida: null,
  horaLlegada: null,
  firmas: [
    {
      rol: 'despachado_por',
      firmadoAt: '2026-10-02T10:00:00Z',
      registradoPor: 'Ana',
      firmanteNombre: null,
      firmanteCedula: null,
    },
    {
      rol: 'transportado_por',
      firmadoAt: null,
      registradoPor: null,
      firmanteNombre: null,
      firmanteCedula: null,
    },
    {
      rol: 'recibido_por',
      firmadoAt: null,
      registradoPor: null,
      firmanteNombre: null,
      firmanteCedula: null,
    },
  ],
  firmasCompletas: false,
  ...extra,
});

describe('desechos: reglas de pantalla', () => {
  it('el contenedor se muestra con su color y su uso, como en la demo', () => {
    expect(etiquetaContenedor({ nombre: 'Rojo', uso: 'Biológico-infeccioso' })).toBe(
      'Rojo — biológico-infeccioso',
    );
    expect(etiquetaContenedor({ nombre: 'Gris', uso: '' })).toBe('Gris');
  });

  it('el total de galones suma las líneas sin arrastrar decimales binarios', () => {
    expect(
      totalGalones([{ cantidadGalones: 0.1 }, { cantidadGalones: 0.2 }, { cantidadGalones: 12.5 }]),
    ).toBe(12.8);
    expect(totalGalones([])).toBe(0);
  });

  it('las fechas se muestran sin correr el día', () => {
    expect(fechaCorta('2027-10-24')).toBe('24/10/2027');
    expect(fechaCorta(null)).toBe('');
    expect(fechaIso(new Date(2026, 10, 5, 23, 30))).toBe('2026-11-05');
  });

  it('el límite de 12 meses dice cuánto falta o cuánto pasó, y la insignia avisa dentro de los 30 días', () => {
    expect(textoLimite(resumen({ diasParaLimite: 20 }))).toBe('Faltan 20 días');
    expect(textoLimite(resumen({ diasParaLimite: 1 }))).toBe('Faltan 1 día');
    expect(textoLimite(resumen({ diasParaLimite: 0 }))).toBe('Vence hoy');
    expect(textoLimite(resumen({ diasParaLimite: -3, vencido: true }))).toBe('Vencido hace 3 días');
    expect(
      textoLimite(
        resumen({ estado: { codigo: 'dispuesto', nombre: 'Dispuesto' }, diasParaLimite: null }),
      ),
    ).toBe('—');
    expect(tonoLimite(resumen({ diasParaLimite: 100 }))).toBe('neutral');
    expect(tonoLimite(resumen({ diasParaLimite: 30 }))).toBe('warning');
    expect(tonoLimite(resumen({ diasParaLimite: -1, vencido: true }))).toBe('error');
    expect(
      tonoLimite(
        resumen({ estado: { codigo: 'dispuesto', nombre: 'Dispuesto' }, diasParaLimite: null }),
      ),
    ).toBe('neutral');
  });

  it('solo el transportista y el gestor se identifican al firmar en papel', () => {
    expect(firmaPideFirmante('despachado_por')).toBe(false);
    expect(firmaPideFirmante('transportado_por')).toBe(true);
    expect(firmaPideFirmante('recibido_por')).toBe(true);
  });

  it('las firmas pendientes salen en el orden del formato', () => {
    expect(firmasPendientes(manifiesto())).toEqual(['transportado_por', 'recibido_por']);
  });

  it('la lectura de la firma es solo un indicador: pendiente, detectada, no detectada o no concluyente', () => {
    expect(
      lecturaDeFirma({
        verificacion: 'no_verificada',
        verificacionConfianza: null,
        verificacionAt: null,
      }),
    ).toEqual({
      texto: 'Leyendo la firma…',
      tono: 'neutral',
      pendiente: true,
    });
    expect(
      lecturaDeFirma({
        verificacion: 'no_verificada',
        verificacionConfianza: null,
        verificacionAt: '2026-10-24T10:00:00Z',
      }),
    ).toEqual({ texto: 'Firma sin verificar', tono: 'neutral', pendiente: false });
    expect(
      lecturaDeFirma({
        verificacion: 'firma_detectada',
        verificacionConfianza: 0.92,
        verificacionAt: 'x',
      }),
    ).toEqual({
      texto: 'Firma detectada (92 %)',
      tono: 'success',
      pendiente: false,
    });
    expect(
      lecturaDeFirma({
        verificacion: 'firma_no_detectada',
        verificacionConfianza: 0.1,
        verificacionAt: 'x',
      }).tono,
    ).toBe('warning');
    expect(
      lecturaDeFirma({
        verificacion: 'no_concluyente',
        verificacionConfianza: null,
        verificacionAt: 'x',
      }).texto,
    ).toBe('Lectura no concluyente');
  });

  it('el plazo del certificado avisa si venció o si se registró fuera de plazo, y no antes', () => {
    expect(avisoCertificado(manifiesto(), false)).toBeNull();
    expect(avisoCertificado(manifiesto({ certificadoVencido: true }), false)).toEqual({
      texto: 'El plazo del certificado venció el 31/10/2026',
      tono: 'error',
    });
    expect(avisoCertificado(manifiesto({ certificadoFueraDePlazo: true }), true)?.tono).toBe(
      'warning',
    );
    expect(avisoCertificado(manifiesto({ certificadoVencido: true }), true)).toBeNull();
  });

  it('el documento de un tipo se busca entre los cargados', () => {
    const d = {
      documentos: [
        { tipo: 'manifiesto_firmado', archivoId: 'a' },
        { tipo: 'certificado_disposicion', archivoId: 'b' },
      ],
    } as unknown as Pick<DesechoDetalle, 'documentos'>;
    expect(documentoDe(d, 'certificado_disposicion')?.archivoId).toBe('b');
    expect(documentoDe({ documentos: [] }, 'manifiesto_firmado')).toBeNull();
  });
});
