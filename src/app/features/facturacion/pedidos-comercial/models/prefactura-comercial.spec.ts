import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PrefacturasComercialService } from '../services/prefacturas-comercial.service';
import {
  AVISO_VERIFICACION,
  LIMITE_SONDEO_MS,
  accionesDisponibles,
  debeSondear,
  estadoVerificacion,
  hayVerificacionPendiente,
  armarFirma,
  esVigente,
  etiquetaVerificacion,
  mensajeErrorPrefactura,
  prefacturaActual,
  validarFirma,
  validarMotivoRechazo,
  validarNumeroTicket,
  type BorradorFirma,
  type EstadoPrefactura,
  type Prefactura,
} from './prefactura-comercial';

const todos = () => true;
const nada = () => false;
const pf = (estado: EstadoPrefactura, nFirmas = 0) => ({ estado, firmas: Array.from({ length: nFirmas }, () => ({}) as never) });

describe('vigencia', () => {
  it('rechazada y anulada no son vigentes', () => {
    expect(esVigente({ estado: 'generada' })).toBe(true);
    expect(esVigente({ estado: 'firmada' })).toBe(true);
    expect(esVigente({ estado: 'rechazada' })).toBe(false);
    expect(esVigente({ estado: 'anulada' })).toBe(false);
  });

  it('la actual es la vigente o, si no hay, la más reciente', () => {
    const vs = [{ estado: 'rechazada' as const, id: 3 }, { estado: 'generada' as const, id: 2 }, { estado: 'rechazada' as const, id: 1 }];
    expect(prefacturaActual(vs)?.id).toBe(2);
    expect(prefacturaActual([vs[0], vs[2]])?.id).toBe(3);
    expect(prefacturaActual([])).toBeNull();
  });
});

describe('acciones disponibles', () => {
  it('sin prefactura (o rechazada) solo se puede generar, y con permiso', () => {
    expect(accionesDisponibles(null, todos)).toEqual(['generar']);
    expect(accionesDisponibles(pf('rechazada'), todos)).toEqual(['generar']);
    expect(accionesDisponibles(null, nada)).toEqual([]);
  });

  it('generada: recalcular, ticket, enviar y firma (sin "dar por firmada" ni rechazo)', () => {
    expect(accionesDisponibles(pf('generada', 1), todos)).toEqual(['recalcular', 'ticket', 'enviar', 'firma']);
  });

  it('enviada: ticket, firma, rechazo y "dar por firmada" solo con al menos una firma', () => {
    expect(accionesDisponibles(pf('enviada_para_firmas', 0), todos)).toEqual(['ticket', 'firma', 'rechazar']);
    expect(accionesDisponibles(pf('enviada_para_firmas', 2), todos)).toEqual(['ticket', 'firma', 'firmada', 'rechazar']);
  });

  it('firmada solo admite registrar el número de ticket', () => {
    expect(accionesDisponibles(pf('firmada', 1), todos)).toEqual(['ticket']);
  });

  it('cada permiso habilita solo lo suyo', () => {
    expect(accionesDisponibles(pf('generada'), p => p === 'comercial.prefacturas.enviar')).toEqual(['enviar']);
    expect(accionesDisponibles(pf('generada'), p => p === 'comercial.prefacturas.firmar')).toEqual(['firma']);
    expect(accionesDisponibles(pf('enviada_para_firmas', 1), p => p === 'comercial.prefacturas.rechazar')).toEqual(['rechazar']);
    expect(accionesDisponibles(pf('generada'), nada)).toEqual([]);
  });
});

describe('validaciones', () => {
  it('número de ticket: entero positivo, tolera el prefijo PRC-', () => {
    expect(validarNumeroTicket('1234')).toEqual({ valor: 1234, error: null });
    expect(validarNumeroTicket('PRC-77')).toEqual({ valor: 77, error: null });
    expect(validarNumeroTicket('0').error).toMatch(/mayor que cero/);
    expect(validarNumeroTicket('12.5').error).toMatch(/entero/);
    expect(validarNumeroTicket('').valor).toBeNull();
  });

  it('rechazo: motivo mínimo y destino', () => {
    expect(validarMotivoRechazo('mal', 'ventas')).toMatch(/al menos 5/);
    expect(validarMotivoRechazo('faltan firmas', null)).toMatch(/a quién/);
    expect(validarMotivoRechazo('faltan firmas', 'ventas')).toBeNull();
  });

  const base: BorradorFirma = {
    firmanteTipo: 'cliente',
    personaIdRepresentante: null,
    nombre: 'Ana Pérez',
    cargo: '',
    firmadoAt: '2026-10-10',
    archivo: { name: 'firma.pdf', size: 1000, type: 'application/pdf' },
  };

  it('firma válida', () => {
    expect(validarFirma(base, '2026-10-15')).toBeNull();
  });

  it('firma: tipo, nombre, fecha y archivo son obligatorios', () => {
    expect(validarFirma({ ...base, firmanteTipo: null }, '2026-10-15')).toMatch(/quién firma/);
    expect(validarFirma({ ...base, nombre: ' ' }, '2026-10-15')).toMatch(/nombre/);
    expect(validarFirma({ ...base, firmadoAt: null }, '2026-10-15')).toMatch(/fecha/);
    expect(validarFirma({ ...base, firmadoAt: '2026-10-20' }, '2026-10-15')).toMatch(/futura/);
    expect(validarFirma({ ...base, archivo: null }, '2026-10-15')).toMatch(/Adjunte/);
    expect(validarFirma({ ...base, archivo: { name: 'a.docx', size: 5, type: 'application/msword' } }, '2026-10-15')).toMatch(/PDF, PNG o JPEG/);
    expect(validarFirma({ ...base, archivo: { name: 'a.pdf', size: 26 * 1024 * 1024, type: 'application/pdf' } }, '2026-10-15')).toMatch(/25 MB/);
  });

  it('el company man usa el representante de campo del pedido y no pide nombre', () => {
    const cm: BorradorFirma = { ...base, firmanteTipo: 'company_man', personaIdRepresentante: 'p1', nombre: '' };
    expect(validarFirma(cm, '2026-10-15')).toBeNull();
    expect(armarFirma(cm, 'a1')).toEqual({ firmanteTipo: 'company_man', firmadoAt: '2026-10-10', archivoId: 'a1', personaId: 'p1' });
  });

  it('company man sin representante asignado exige nombre', () => {
    expect(validarFirma({ ...base, firmanteTipo: 'company_man', nombre: '' }, '2026-10-15')).toMatch(/representante de campo/);
  });

  it('arma el cuerpo con nombre y cargo cuando no hay persona', () => {
    expect(armarFirma({ ...base, cargo: ' Gerente ' }, 'a1')).toEqual({ firmanteTipo: 'cliente', firmadoAt: '2026-10-10', archivoId: 'a1', nombre: 'Ana Pérez', cargo: 'Gerente' });
  });
});

describe('mensajes', () => {
  it('la verificación se muestra como "Sin verificar"', () => {
    expect(etiquetaVerificacion('no_verificada')).toBe('Sin verificar');
  });

  it('422 de documentación incompleta muestra lo que falta', () => {
    expect(mensajeErrorPrefactura({ status: 422, error: { code: 'DOCUMENTACION_INCOMPLETA', message: 'Falta: Reporte Job' } }, 'x')).toBe('Falta: Reporte Job');
    expect(mensajeErrorPrefactura({ status: 409, error: {} }, 'x')).toMatch(/conflicto/);
    expect(mensajeErrorPrefactura({ status: 500 }, 'por defecto')).toBe('por defecto');
  });
});

describe('PrefacturasComercialService', () => {
  let s: PrefacturasComercialService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    s = TestBed.inject(PrefacturasComercialService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const pedido = (r: string, method: string, body?: unknown) => {
    const req = http.expectOne(`/api/comercial/${r}`);
    expect(req.request.method).toBe(method);
    if (body !== undefined) expect(req.request.body).toEqual(body);
    req.flush({} as Prefactura);
  };

  it('lista, detalle y generación', () => {
    s.delPedido('p1').subscribe();
    pedido('pedidos/p1/prefacturas', 'GET');
    s.detalle('f1').subscribe();
    pedido('prefacturas/f1', 'GET');
    s.generar('p1').subscribe();
    pedido('pedidos/p1/prefacturas', 'POST', {});
  });

  it('recalcular, ticket, enviar', () => {
    s.recalcular('f1').subscribe();
    pedido('prefacturas/f1/recalcular', 'POST');
    s.registrarTicket('f1', 1234).subscribe();
    pedido('prefacturas/f1/ticket', 'POST', { numero: 1234 });
    s.enviar('f1', 'email').subscribe();
    pedido('prefacturas/f1/enviar', 'POST', { medio: 'email' });
  });

  it('firmas, dar por firmada (razón opcional) y rechazo', () => {
    s.registrarFirma('f1', { firmanteTipo: 'cliente', nombre: 'Ana', firmadoAt: '2026-10-10', archivoId: 'a1' }).subscribe();
    pedido('prefacturas/f1/firmas', 'POST', { firmanteTipo: 'cliente', nombre: 'Ana', firmadoAt: '2026-10-10', archivoId: 'a1' });
    s.darPorFirmada('f1').subscribe();
    pedido('prefacturas/f1/firmar', 'POST', {});
    s.darPorFirmada('f1', ' llegó tarde ').subscribe();
    pedido('prefacturas/f1/firmar', 'POST', { razonRetraso: 'llegó tarde' });
    s.rechazar('f1', ' falta firma ', 'ventas').subscribe();
    pedido('prefacturas/f1/rechazar', 'POST', { motivo: 'falta firma', devueltoA: 'ventas' });
  });
});

describe('verificación de firmas (solo informativa)', () => {
  const f = (p: Partial<{ verificacion: 'no_verificada' | 'firma_detectada' | 'firma_no_detectada' | 'no_concluyente'; verificacionConfianza: number | null; verificacionAt: string | null; nombreCoincide: boolean | null }>) => ({
    verificacion: 'no_verificada' as const,
    verificacionConfianza: null,
    verificacionAt: '2026-10-15T10:00:00Z',
    nombreCoincide: null,
    ...p,
  });

  it('sin resultado: "Verificando…" y, agotado el sondeo, aviso para reintentar', () => {
    expect(estadoVerificacion(f({ verificacionAt: null }))).toMatchObject({ clave: 'verificando', texto: 'Verificando…' });
    expect(estadoVerificacion(f({ verificacionAt: null }), true)).toMatchObject({ clave: 'sin_resultado' });
  });

  it('no_verificada con fecha: el servicio no respondió', () => {
    expect(estadoVerificacion(f({}))).toMatchObject({ clave: 'no_se_pudo', texto: 'No se pudo verificar (el servicio no respondió)' });
  });

  it('firma detectada con confianza en porcentaje y coincidencia del nombre', () => {
    const e = estadoVerificacion(f({ verificacion: 'firma_detectada', verificacionConfianza: 0.876, nombreCoincide: true }));
    expect(e.texto).toBe('Se detecta una firma — revise el documento');
    expect(e.detalle).toBe('Confianza: 88 % · El nombre coincide');
    expect(estadoVerificacion(f({ verificacion: 'firma_detectada', nombreCoincide: false })).detalle).toBe('No se encontró el nombre esperado');
    expect(estadoVerificacion(f({ verificacion: 'firma_detectada' })).detalle).toBeNull();
  });

  it('no detectada y no concluyente', () => {
    expect(estadoVerificacion(f({ verificacion: 'firma_no_detectada' })).texto).toBe('No se detecta firma manuscrita — revise el documento');
    expect(estadoVerificacion(f({ verificacion: 'no_concluyente' })).texto).toBe('No concluyente — revise a mano');
  });

  it('el aviso fijo existe', () => {
    expect(AVISO_VERIFICACION).toBe('La lectura automática es una ayuda para revisar; no certifica que la firma sea auténtica.');
  });

  it('sondea solo con resultados pendientes y hasta el límite de ~90 s', () => {
    const pendiente = [{ verificacionAt: null }];
    const lista = [{ verificacionAt: '2026-10-15T10:00:00Z' }];
    expect(debeSondear(pendiente, 0, 10_000)).toBe(true);
    expect(debeSondear(pendiente, 0, LIMITE_SONDEO_MS)).toBe(false);
    expect(debeSondear(lista, 0, 1_000)).toBe(false);
    expect(debeSondear([], 0, 1_000)).toBe(false);
    expect(hayVerificacionPendiente([...lista, ...pendiente])).toBe(true);
  });

  it('nunca condiciona las acciones: "Dar por firmada" no depende del resultado', () => {
    const base = (verificacion: string) => ({ estado: 'enviada_para_firmas' as const, firmas: [{ verificacion, verificacionAt: null }] as never });
    for (const v of ['no_verificada', 'firma_no_detectada', 'no_concluyente', 'firma_detectada']) {
      expect(accionesDisponibles(base(v), todos)).toContain('firmada');
    }
  });

  it('el servicio vuelve a verificar con POST firmas/:firmaId/verificar', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const s = TestBed.inject(PrefacturasComercialService);
    const http = TestBed.inject(HttpTestingController);
    s.verificarFirma('f1', 'g1').subscribe();
    const req = http.expectOne('/api/comercial/prefacturas/f1/firmas/g1/verificar');
    expect(req.request.method).toBe('POST');
    req.flush({});
    http.verify();
  });
});
